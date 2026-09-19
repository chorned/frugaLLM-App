use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::Manager;
use crate::state::FrugalConfigState;

/// Finds an executable name within system PATH directories without external dependencies.
pub fn find_executable_in_path(name: &str) -> Option<PathBuf> {
    if let Some(path_var) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let full_path = dir.join(name);
            if full_path.is_file() {
                return Some(full_path);
            }
            #[cfg(windows)]
            {
                let exe_path = dir.join(format!("{}.exe", name));
                if exe_path.is_file() {
                    return Some(exe_path);
                }
                let cmd_path = dir.join(format!("{}.cmd", name));
                if cmd_path.is_file() {
                    return Some(cmd_path);
                }
            }
        }
    }
    None
}

/// Expands `~` or `~/...` (and Windows `~\...`) to the canonical user home directory
/// and ensures the target directory actually exists on disk so `cd` operations succeed.
pub fn resolve_and_ensure_dir(input: Option<&str>) -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

    let path = match input {
        Some(p) if p.trim().is_empty() => home,
        Some(p) => {
            let trimmed = p.trim();
            if trimmed == "~" {
                home
            } else if let Some(rest) = trimmed.strip_prefix("~/") {
                home.join(rest)
            } else if let Some(rest) = trimmed.strip_prefix("~\\") {
                home.join(rest)
            } else {
                PathBuf::from(trimmed)
            }
        }
        None => home,
    };

    // Ensure the target directory actually exists so `cd` never fails
    let _ = std::fs::create_dir_all(&path);
    path
}

/// Discovers the absolute path of a binary across known installation locations,
/// falling back to finding it in system PATH, and finally the bare binary name.
pub fn resolve_binary(binary_name: &str) -> String {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

    #[cfg(target_os = "macos")]
    let candidates = vec![
        home.join(format!(".hermes/bin/{}", binary_name)),
        home.join(format!(".opencode/bin/{}", binary_name)),
        home.join(format!(".local/bin/{}", binary_name)),
        home.join(format!(".cargo/bin/{}", binary_name)),
        PathBuf::from(format!("/opt/homebrew/bin/{}", binary_name)),
        PathBuf::from(format!("/usr/local/bin/{}", binary_name)),
        PathBuf::from(format!("/Applications/Ollama.app/Contents/Resources/{}", binary_name)),
    ];

    #[cfg(target_os = "linux")]
    let candidates = vec![
        home.join(format!(".hermes/bin/{}", binary_name)),
        home.join(format!(".opencode/bin/{}", binary_name)),
        home.join(format!(".local/bin/{}", binary_name)),
        home.join(format!(".cargo/bin/{}", binary_name)),
        PathBuf::from(format!("/usr/bin/{}", binary_name)),
        PathBuf::from(format!("/usr/local/bin/{}", binary_name)),
        PathBuf::from(format!("/bin/{}", binary_name)),
    ];

    #[cfg(target_os = "windows")]
    let candidates = {
        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
        let app_data = std::env::var("APPDATA").unwrap_or_default();
        let prog_files = std::env::var("ProgramFiles").unwrap_or_default();
        vec![
            PathBuf::from(&local_app_data).join(format!("hermes\\bin\\{}.exe", binary_name)),
            PathBuf::from(&local_app_data).join(format!("Programs\\opencode\\{}.exe", binary_name)),
            PathBuf::from(&local_app_data).join(format!("Programs\\Ollama\\{}.exe", binary_name)),
            PathBuf::from(&prog_files).join(format!("Ollama\\{}.exe", binary_name)),
            PathBuf::from(&app_data).join(format!("npm\\{}.cmd", binary_name)),
            home.join(format!(".cargo\\bin\\{}.exe", binary_name)),
        ]
    };

    for candidate in candidates {
        if candidate.is_file() {
            return candidate.to_string_lossy().to_string();
        }
    }

    if let Some(in_path) = find_executable_in_path(binary_name) {
        return in_path.to_string_lossy().to_string();
    }

    // Fallback to bare command name if not found in standard paths
    binary_name.to_string()
}

/// Builds the AppleScript script to execute in macOS Terminal.app.
pub fn build_macos_applescript(
    _title: &str,
    cwd: Option<&Path>,
    env_vars: &HashMap<String, String>,
    command: &str,
) -> String {
    let mut parts: Vec<String> = Vec::new();

    // Standard candidate CLI tools path
    parts.push("export PATH=\"$HOME/.local/bin:$HOME/.hermes/bin:$HOME/.opencode/bin:$HOME/.cargo/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH\"".to_string());

    if let Some(c) = cwd {
        let path_str = c.to_string_lossy().replace('\'', "'\\''");
        parts.push(format!("cd '{}'", path_str));
    }

    for (k, v) in env_vars {
        let safe_val = v.replace('\'', "'\\''");
        parts.push(format!("export {}='{}'", k, safe_val));
    }

    parts.push(command.to_string());
    let full_command = parts.join(" && ");

    // Escape for AppleScript string literal (\ -> \\, " -> \")
    let escaped_for_applescript = full_command
        .replace('\\', "\\\\")
        .replace('"', "\\\"");

    format!(
        "tell application \"Terminal\"\n    activate\n    do script \"{}\"\nend tell",
        escaped_for_applescript
    )
}

/// Builds the PowerShell script command line for Windows Terminal or PowerShell.
pub fn build_windows_powershell_script(
    cwd: Option<&Path>,
    env_vars: &HashMap<String, String>,
    command: &str,
) -> String {
    let mut parts: Vec<String> = Vec::new();

    // Standard candidate paths on Windows
    parts.push("$env:PATH=\"$HOME\\.local\\bin;$HOME\\.hermes\\bin;$HOME\\.opencode\\bin;$HOME\\.cargo\\bin;$env:LOCALAPPDATA\\hermes\\bin;$env:LOCALAPPDATA\\Programs\\opencode;$env:APPDATA\\npm;$env:LOCALAPPDATA\\Programs\\Ollama;$env:ProgramFiles\\Ollama;$env:PATH\";".to_string());

    for (k, v) in env_vars {
        let safe_v = v.replace('"', "`\"").replace('$', "`$");
        parts.push(format!("$env:{}=\"{}\";", k, safe_v));
    }

    if let Some(c) = cwd {
        let path_str = c.to_string_lossy().replace('\'', "''");
        parts.push(format!("Set-Location -LiteralPath '{}';", path_str));
    }

    parts.push(command.to_string());
    parts.join(" ")
}

/// Builds the bash command string for Linux desktop terminal emulators.
pub fn build_linux_bash_command(
    cwd: Option<&Path>,
    env_vars: &HashMap<String, String>,
    command: &str,
) -> String {
    let mut parts: Vec<String> = Vec::new();

    parts.push("export PATH=\"$HOME/.local/bin:$HOME/.hermes/bin:$HOME/.opencode/bin:$HOME/.cargo/bin:/usr/local/bin:$PATH\"".to_string());

    if let Some(c) = cwd {
        let path_str = c.to_string_lossy().replace('\'', "'\\''");
        parts.push(format!("cd '{}'", path_str));
    }

    for (k, v) in env_vars {
        let safe_val = v.replace('\'', "'\\''");
        parts.push(format!("export {}='{}'", k, safe_val));
    }

    parts.push(format!("{}; exec bash", command));
    parts.join(" && ")
}

/// Cross-platform launcher that opens the native terminal on macOS, Windows, or Linux.
pub fn launch_in_native_terminal(
    title: &str,
    cwd: Option<&Path>,
    env_vars: &HashMap<String, String>,
    command: &str,
) -> Result<(), String> {
    let resolved_cwd = cwd.map(|c| resolve_and_ensure_dir(c.to_str()));
    let effective_cwd = resolved_cwd.as_deref();

    #[cfg(target_os = "macos")]
    {
        use std::io::Write;
        let script = build_macos_applescript(title, effective_cwd, env_vars, command);
        let mut child = std::process::Command::new("osascript")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn osascript: {}", e))?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(script.as_bytes()).map_err(|e| e.to_string())?;
        }

        let output = child.wait_with_output().map_err(|e| e.to_string())?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Terminal.app launch error via osascript: {}", stderr));
        }
        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        let ps_script = build_windows_powershell_script(effective_cwd, env_vars, command);

        // First attempt Windows Terminal (wt.exe) if available
        let wt_found = find_executable_in_path("wt.exe").is_some()
            || find_executable_in_path("wt").is_some()
            || Path::new("C:\\Users")
                .join(std::env::var("USERNAME").unwrap_or_default())
                .join("AppData\\Local\\Microsoft\\WindowsApps\\wt.exe")
                .is_file();

        if wt_found {
            let mut cmd = std::process::Command::new("wt.exe");
            cmd.arg("--title").arg(title);
            if let Some(c) = effective_cwd {
                cmd.arg("-d").arg(c);
            }
            cmd.args([
                "powershell.exe",
                "-NoExit",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &ps_script,
            ]);

            if let Ok(_) = cmd.spawn() {
                return Ok(());
            }
        }

        // Fallback to standard PowerShell via cmd.exe /c start
        let mut fallback = std::process::Command::new("cmd.exe");
        fallback.args([
            "/C",
            "start",
            title,
            "powershell.exe",
            "-NoExit",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &ps_script,
        ]);

        fallback
            .spawn()
            .map_err(|e| format!("Failed to launch terminal on Windows: {}", e))?;

        Ok(())
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let bash_cmd = build_linux_bash_command(effective_cwd, env_vars, command);
        let candidates = [
            "x-terminal-emulator",
            "gnome-terminal",
            "konsole",
            "xfce4-terminal",
            "terminator",
            "tilix",
            "alacritty",
            "kitty",
            "foot",
            "xterm",
        ];

        for cand in candidates {
            if let Some(bin_path) = find_executable_in_path(cand) {
                let mut cmd = std::process::Command::new(bin_path);
                match cand {
                    "gnome-terminal" => {
                        cmd.arg("--title").arg(title);
                        if let Some(c) = effective_cwd {
                            cmd.arg(format!("--working-directory={}", c.display()));
                        }
                        cmd.arg("--").arg("bash").arg("-c").arg(&bash_cmd);
                    }
                    "konsole" => {
                        if let Some(c) = effective_cwd {
                            cmd.arg("--workdir").arg(c);
                        }
                        cmd.arg("-e").arg("bash").arg("-c").arg(&bash_cmd);
                    }
                    "xfce4-terminal" => {
                        if let Some(c) = effective_cwd {
                            cmd.arg(format!("--working-directory={}", c.display()));
                        }
                        cmd.arg("-T").arg(title);
                        cmd.arg("-e").arg(format!("bash -c '{}'", bash_cmd.replace('\'', "'\\''")));
                    }
                    _ => {
                        cmd.arg("-e").arg("bash").arg("-c").arg(&bash_cmd);
                    }
                }

                if cmd.spawn().is_ok() {
                    return Ok(());
                }
            }
        }

        Err("No supported native terminal emulator found on this Linux system.".to_string())
    }
}

#[tauri::command]
pub async fn launch_native_terminal(
    title: Option<String>,
    cwd: Option<String>,
    env_vars: Option<HashMap<String, String>>,
    command: String,
) -> Result<(), String> {
    let t = title.unwrap_or_else(|| "FrugaLLM Terminal".to_string());
    let resolved_cwd = cwd.as_deref().map(|c| resolve_and_ensure_dir(Some(c)));
    let empty_env = HashMap::new();
    let env = env_vars.as_ref().unwrap_or(&empty_env);
    launch_in_native_terminal(&t, resolved_cwd.as_deref(), env, &command)
}

#[tauri::command]
pub async fn launch_native_app_session(
    app: tauri::AppHandle,
    state: tauri::State<'_, FrugalConfigState>,
    app_name: String,
    model: Option<String>,
    workspace_override: Option<String>,
) -> Result<(), String> {
    let (port, api_key, hermes_ws, opencode_ws) = {
        let config = state.config.lock().await;
        (
            config.port,
            config.api_password.clone().unwrap_or_else(|| "frugallm".to_string()),
            config.hermes_workspace.clone(),
            config.opencode_workspace.clone(),
        )
    };

    let home_dir = app.path().home_dir().ok();

    let mut env_vars = HashMap::new();
    let proxy_endpoint = format!("http://127.0.0.1:{}/v1", port);
    env_vars.insert("OPENAI_BASE_URL".to_string(), proxy_endpoint.clone());
    env_vars.insert("OPENAI_API_BASE".to_string(), proxy_endpoint);
    env_vars.insert("OPENAI_API_KEY".to_string(), api_key.clone());

    match app_name.as_str() {
        "hermes" => {
            let _ = crate::commands::agents::sync_hermes_config(&app, port, &api_key);
            let target_cwd = resolve_and_ensure_dir(workspace_override.as_deref().or(hermes_ws.as_deref()));
            let hermes_bin = resolve_binary("hermes");
            let cmd = if hermes_bin.contains(' ') {
                format!("\"{}\"", hermes_bin)
            } else {
                hermes_bin.clone()
            };
            
            crate::commands::system::log_event(
                &app,
                "INFO",
                "TERMINAL",
                &format!("Launching Hermes CLI in native terminal ({})", hermes_bin),
            );
            launch_in_native_terminal("Hermes", Some(&target_cwd), &env_vars, &cmd)
        }
        "opencode" => {
            let _ = crate::commands::agents::sync_opencode_config(&app, port, &api_key);
            let target_cwd = resolve_and_ensure_dir(workspace_override.as_deref().or(opencode_ws.as_deref()));
            let opencode_bin = resolve_binary("opencode");
            let cmd = if opencode_bin.contains(' ') {
                format!("\"{}\" -m litellm/frugallm", opencode_bin)
            } else {
                format!("{} -m litellm/frugallm", opencode_bin)
            };

            crate::commands::system::log_event(
                &app,
                "INFO",
                "TERMINAL",
                &format!("Launching OpenCode CLI in native terminal ({})", opencode_bin),
            );
            launch_in_native_terminal(
                "OpenCode",
                Some(&target_cwd),
                &env_vars,
                &cmd,
            )
        }
        "ollama" => {
            let target_model = match model {
                Some(m) if !m.trim().is_empty() => m,
                _ => crate::commands::agents::get_ollama_chat_model().await,
            };

            let title = format!("Ollama Chat - {}", target_model);
            let target_cwd = resolve_and_ensure_dir(home_dir.as_deref().and_then(|p| p.to_str()));
            let ollama_bin = resolve_binary("ollama");
            let cmd = if ollama_bin.contains(' ') {
                format!("\"{}\" run {}", ollama_bin, target_model)
            } else {
                format!("{} run {}", ollama_bin, target_model)
            };

            crate::commands::system::log_event(
                &app,
                "INFO",
                "TERMINAL",
                &format!("Launching Ollama CLI in native terminal ({}) for model {}", ollama_bin, target_model),
            );
            launch_in_native_terminal(&title, Some(&target_cwd), &env_vars, &cmd)
        }
        _ => Err(format!("Unsupported application for native terminal: {}", app_name)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_and_ensure_dir_tilde_expansion_and_creation() {
        let home = dirs::home_dir().expect("Home dir must resolve in test");
        let test_folder_name = format!(".frugallm_test_mkdir_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let tilde_path = format!("~/{}", test_folder_name);

        let resolved = resolve_and_ensure_dir(Some(&tilde_path));
        let expected = home.join(&test_folder_name);
        assert_eq!(resolved, expected);
        assert!(resolved.is_dir(), "Target directory must be auto-created");

        // Clean up test directory
        let _ = std::fs::remove_dir(&resolved);

        // Test bare tilde
        let resolved_tilde = resolve_and_ensure_dir(Some("~"));
        assert_eq!(resolved_tilde, home);

        // Test None
        let resolved_none = resolve_and_ensure_dir(None);
        assert_eq!(resolved_none, home);

        // Test empty string
        let resolved_empty = resolve_and_ensure_dir(Some("   "));
        assert_eq!(resolved_empty, home);
    }

    #[test]
    fn test_resolve_binary_fallback_and_discovery() {
        // Fallback for non-existent binary returns the command string unchanged
        let non_existent = resolve_binary("frugallm_non_existent_binary_xyz_123");
        assert_eq!(non_existent, "frugallm_non_existent_binary_xyz_123");

        // Existing system command or candidates
        #[cfg(unix)]
        {
            let sh_bin = resolve_binary("sh");
            assert!(sh_bin.contains("sh"));
        }
    }

    #[test]
    fn test_build_macos_applescript_structure_and_escaping() {
        let mut env = HashMap::new();
        env.insert("OPENAI_API_KEY".to_string(), "sk-test\"123\\abc".to_string());
        let cwd = Path::new("/Users/test/my project");

        let script = build_macos_applescript("Hermes", Some(cwd), &env, "hermes");
        assert!(script.contains("tell application \"Terminal\""));
        assert!(script.contains("activate"));
        assert!(script.contains("cd '/Users/test/my project'"));
        assert!(script.contains("export PATH="));
        assert!(script.contains("hermes"));
        // Check escaping of quotes inside AppleScript string literal
        assert!(script.contains("sk-test\\\"123\\\\abc"));
    }

    #[test]
    fn test_build_windows_powershell_script_structure() {
        let mut env = HashMap::new();
        env.insert("OPENAI_BASE_URL".to_string(), "http://127.0.0.1:61721/v1".to_string());
        let cwd = Path::new("C:\\Users\\test\\My Documents");

        let ps = build_windows_powershell_script(Some(cwd), &env, "opencode -m litellm/frugallm");
        assert!(ps.contains("$env:PATH="));
        assert!(ps.contains("$env:OPENAI_BASE_URL=\"http://127.0.0.1:61721/v1\""));
        assert!(ps.contains("Set-Location -LiteralPath 'C:\\Users\\test\\My Documents'"));
        assert!(ps.contains("opencode -m litellm/frugallm"));
    }

    #[test]
    fn test_build_linux_bash_command_structure() {
        let mut env = HashMap::new();
        env.insert("OPENAI_API_KEY".to_string(), "secret-key".to_string());
        let cwd = Path::new("/home/user/workspace");

        let bash = build_linux_bash_command(Some(cwd), &env, "ollama run llama3");
        assert!(bash.contains("export PATH="));
        assert!(bash.contains("cd '/home/user/workspace'"));
        assert!(bash.contains("export OPENAI_API_KEY='secret-key'"));
        assert!(bash.contains("ollama run llama3; exec bash"));
    }

    #[test]
    fn test_hostile_input_escaping() {
        let mut env = HashMap::new();
        env.insert("WEIRD_VAR".to_string(), "foo'bar\"baz$qux\\end".to_string());
        let cwd = Path::new("/tmp/path with 'single' and \"double\" quotes");

        let mac_script = build_macos_applescript("Test", Some(cwd), &env, "echo hostile");
        assert!(!mac_script.is_empty());

        let win_script = build_windows_powershell_script(Some(cwd), &env, "echo hostile");
        assert!(!win_script.is_empty());

        let linux_script = build_linux_bash_command(Some(cwd), &env, "echo hostile");
        assert!(!linux_script.is_empty());
    }
}
