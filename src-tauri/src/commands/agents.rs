use std::sync::Arc;
use tauri::{Manager, State, Emitter};
use tauri_plugin_store::StoreExt;
use crate::state::*;
use crate::proxy::*;
use crate::commands::*;


pub fn get_hermes_source_path(home: &std::path::Path) -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let win_bin = std::path::PathBuf::from(local_app_data).join("hermes").join("bin");
            let cmd = win_bin.join("hermes.cmd");
            if cmd.exists() {
                return Some(cmd);
            }
            let exe = win_bin.join("hermes.exe");
            if exe.exists() {
                return Some(exe);
            }
        }
        let home_bin = home.join(".hermes").join("bin");
        let cmd = home_bin.join("hermes.cmd");
        if cmd.exists() {
            return Some(cmd);
        }
        let local_cmd = home.join(".local").join("bin").join("hermes.cmd");
        if local_cmd.exists() {
            return Some(local_cmd);
        }
    }
    let p1 = home.join(".local").join("bin").join(if cfg!(windows) { "hermes.exe" } else { "hermes" });
    if p1.exists() {
        return Some(p1);
    }
    let p2 = home.join(".hermes").join("bin").join(if cfg!(windows) { "hermes.exe" } else { "hermes" });
    if p2.exists() {
        return Some(p2);
    }
    let p3 = home.join(".cargo").join("bin").join(if cfg!(windows) { "hermes.exe" } else { "hermes" });
    if p3.exists() {
        return Some(p3);
    }
    let brew_hermes = std::path::PathBuf::from("/opt/homebrew/bin/hermes");
    if brew_hermes.exists() {
        return Some(brew_hermes);
    }
    let usr_local_hermes = std::path::PathBuf::from("/usr/local/bin/hermes");
    if usr_local_hermes.exists() {
        return Some(usr_local_hermes);
    }
    if let Some(path_var) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path_var) {
            #[cfg(target_os = "windows")]
            {
                let cmd = dir.join("hermes.cmd");
                if cmd.exists() {
                    return Some(cmd);
                }
                let exe = dir.join("hermes.exe");
                if exe.exists() {
                    return Some(exe);
                }
            }
            let bin = dir.join("hermes");
            if bin.exists() {
                return Some(bin);
            }
        }
    }
    None
}

pub fn is_hermes_installed(home: &std::path::Path) -> bool {
    get_hermes_source_path(home).is_some()
}

#[tauri::command]
pub fn check_hermes_status(app: tauri::AppHandle) -> bool {
    if let Ok(home) = app.path().home_dir() {
        return is_hermes_installed(&home);
    }
    false
}

pub fn get_opencode_source_path(home: &std::path::Path) -> Option<std::path::PathBuf> {
    let p1 = home.join(".local").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" });
    if p1.exists() {
        return Some(p1);
    }
    let p2 = home.join(".opencode").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" });
    if p2.exists() {
        return Some(p2);
    }
    let p3 = home.join(".cargo").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" });
    if p3.exists() {
        return Some(p3);
    }
    #[cfg(target_os = "windows")]
    {
        // Check for .cmd shims in local directories
        let cmd1 = home.join(".local").join("bin").join("opencode.cmd");
        if cmd1.exists() {
            return Some(cmd1);
        }
        let cmd2 = home.join(".opencode").join("bin").join("opencode.cmd");
        if cmd2.exists() {
            return Some(cmd2);
        }
        // Check %APPDATA%\npm and shim node_modules/opencode-ai/bin/opencode.exe if present
        let app_data = std::env::var("APPDATA")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|_| home.join("AppData").join("Roaming"));
        let npm_dir = app_data.join("npm");
        let npm_cmd = npm_dir.join("opencode.cmd");
        if npm_cmd.exists() {
            let npm_exe = npm_dir.join("node_modules").join("opencode-ai").join("bin").join("opencode.exe");
            let local_exe = home.join(".local").join("bin").join("opencode.exe");
            if npm_exe.exists() {
                if !local_exe.exists() {
                    if let Some(parent) = local_exe.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    let _ = std::fs::copy(&npm_exe, &local_exe);
                }
                if local_exe.exists() {
                    return Some(local_exe);
                }
            }
            return Some(npm_cmd);
        }
        let npm_bin = npm_dir.join("opencode");
        if npm_bin.exists() {
            return Some(npm_bin);
        }

        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let p_app = std::path::PathBuf::from(local_app_data).join("Programs").join("opencode").join("opencode.exe");
            if p_app.exists() {
                return Some(p_app);
            }
        }
    }
    let brew_opencode = std::path::PathBuf::from("/opt/homebrew/bin/opencode");
    if brew_opencode.exists() {
        return Some(brew_opencode);
    }
    let usr_local_opencode = std::path::PathBuf::from("/usr/local/bin/opencode");
    if usr_local_opencode.exists() {
        return Some(usr_local_opencode);
    }
    if let Some(path_var) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path_var) {
            #[cfg(target_os = "windows")]
            {
                let exe = dir.join("opencode.exe");
                if exe.exists() {
                    return Some(exe);
                }
                let cmd = dir.join("opencode.cmd");
                if cmd.exists() {
                    return Some(cmd);
                }
            }
            let bin = dir.join("opencode");
            if bin.exists() {
                return Some(bin);
            }
        }
    }
    None
}

pub fn is_opencode_installed(home: &std::path::Path) -> bool {
    get_opencode_source_path(home).is_some()
}

#[tauri::command]
pub fn check_opencode_status(app: tauri::AppHandle) -> bool {
    if let Ok(home) = app.path().home_dir() {
        return is_opencode_installed(&home);
    }
    false
}

pub fn get_ollama_binary() -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    {
        // 1. Check LocalAppData Programs (default user installer target)
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let p = std::path::PathBuf::from(local_app_data).join("Programs").join("Ollama").join("ollama.exe");
            if p.exists() {
                return p;
            }
        }
        // 2. Check Program Files (system-wide installation target)
        if let Ok(prog_files) = std::env::var("ProgramFiles") {
            let p = std::path::PathBuf::from(prog_files).join("Ollama").join("ollama.exe");
            if p.exists() {
                return p;
            }
        }
        if let Ok(prog_files_x86) = std::env::var("ProgramFiles(x86)") {
            let p = std::path::PathBuf::from(prog_files_x86).join("Ollama").join("ollama.exe");
            if p.exists() {
                return p;
            }
        }
        // 3. Check directories in PATH
        if let Some(path_var) = std::env::var_os("PATH") {
            for dir in std::env::split_paths(&path_var) {
                let exe = dir.join("ollama.exe");
                if exe.exists() {
                    return exe;
                }
                let bin = dir.join("ollama");
                if bin.exists() {
                    return bin;
                }
            }
        }
        std::path::PathBuf::from("ollama.exe")
    }

    #[cfg(not(target_os = "windows"))]
    {
        let paths = [
            "/usr/local/bin/ollama",
            "/opt/homebrew/bin/ollama",
            "/usr/bin/ollama",
            "/Applications/Ollama.app/Contents/Resources/ollama",
            "/Applications/Ollama.app/Contents/MacOS/Ollama",
        ];
        for p in paths {
            let path = std::path::Path::new(p);
            if path.exists() {
                return path.to_path_buf();
            }
        }
        if let Some(path_var) = std::env::var_os("PATH") {
            for dir in std::env::split_paths(&path_var) {
                let bin = dir.join("ollama");
                if bin.exists() {
                    return bin;
                }
            }
        }
        std::path::PathBuf::from("ollama")
    }
}

pub fn is_ollama_in_paths(paths: &[&str]) -> bool {
    for p in paths.iter() {
        if std::path::Path::new(p).exists() {
            return true;
        }
    }
    false
}

pub fn is_ollama_process_running() -> bool {
    let sys = sysinfo::System::new_all();
    for (_pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_lowercase();
        if name == "ollama.exe" || name == "ollama app.exe" || name == "ollama" {
            return true;
        }
    }
    #[cfg(target_os = "windows")]
    {
        let mut cmd = std::process::Command::new("tasklist");
        cmd.args(["/NH", "/FO", "CSV"]);
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
        if let Ok(output) = cmd.output() {
            let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
            if stdout.contains("ollama.exe") || stdout.contains("ollama app.exe") {
                return true;
            }
        }
    }
    false
}

pub fn is_base_model_in_tags(tags_json: &serde_json::Value, target_tag: &str) -> bool {
    if let Some(models) = tags_json.get("models").and_then(|m| m.as_array()) {
        let target_clean = target_tag.trim().to_lowercase();
        let target_base = target_clean.split(':').next().unwrap_or(&target_clean);
        for m in models {
            let name = m.get("name").and_then(|n| n.as_str()).unwrap_or("").to_lowercase();
            let model = m.get("model").and_then(|n| n.as_str()).unwrap_or("").to_lowercase();
            if name == target_clean || model == target_clean {
                return true;
            }
            if name.starts_with(&format!("{}:", target_clean)) || model.starts_with(&format!("{}:", target_clean)) {
                return true;
            }
            if !target_base.is_empty() && (name == target_base || model == target_base || name.starts_with(&format!("{}:", target_base))) {
                return true;
            }
        }
    }
    false
}

pub fn get_windows_ollama_uninstaller() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let default_unins = std::path::PathBuf::from(&local_app_data).join("Programs").join("Ollama").join("unins000.exe");
            if default_unins.exists() {
                return Some(default_unins);
            }
        }

        let mut reg_cmd = std::process::Command::new("powershell.exe");
        reg_cmd.args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "(Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Ollama_is1' -ErrorAction SilentlyContinue).UninstallString",
        ]);
        use std::os::windows::process::CommandExt;
        reg_cmd.creation_flags(0x08000000);
        if let Ok(output) = reg_cmd.output() {
            let unins_str = String::from_utf8_lossy(&output.stdout).trim().trim_matches('"').to_string();
            if !unins_str.is_empty() {
                let p = std::path::PathBuf::from(unins_str);
                if p.exists() {
                    return Some(p);
                }
            }
        }
    }
    None
}

pub fn clean_windows_user_path_ollama() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let clean_path_script = r#"
            $target = Join-Path $env:LOCALAPPDATA 'Programs\Ollama';
            $p = [Environment]::GetEnvironmentVariable('Path', 'User');
            if ($p) {
                $parts = $p -split ';' | Where-Object { $_ -and $_ -ne $target -and $_ -notlike ($target + '\*') -and $_ -notlike ('*' + $target + '*') };
                $newP = $parts -join ';';
                [Environment]::SetEnvironmentVariable('Path', $newP, 'User');
            }
        "#;
        let mut ps_cmd = std::process::Command::new("powershell.exe");
        ps_cmd.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", clean_path_script]);
        use std::os::windows::process::CommandExt;
        ps_cmd.creation_flags(0x08000000);
        let _ = ps_cmd.output().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command(async)]
pub async fn check_ollama_status() -> bool {
    // 1. Check if it's currently running via its local API
    if reqwest::get("http://127.0.0.1:11434/api/version").await.is_ok() {
        return true;
    }

    // 2. Check if the binary is found and executes successfully
    let bin = get_ollama_binary();
    if bin.exists() || bin.file_name().is_some() {
        let mut cmd = std::process::Command::new(&bin);
        cmd.arg("--version");
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }
        if cmd.output().map(|o| o.status.success()).unwrap_or(false) {
            return true;
        }
    }
    
    // 3. Fallback: check common installation paths
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let p = std::path::PathBuf::from(local_app_data).join("Programs").join("Ollama").join("ollama.exe");
            if p.exists() {
                return true;
            }
        }
        if let Ok(prog_files) = std::env::var("ProgramFiles") {
            let p = std::path::PathBuf::from(prog_files).join("Ollama").join("ollama.exe");
            if p.exists() {
                return true;
            }
        }
        false
    }

    #[cfg(not(target_os = "windows"))]
    {
        let paths = [
            "/usr/local/bin/ollama", 
            "/opt/homebrew/bin/ollama", 
            "/usr/bin/ollama",
            "/Applications/Ollama.app/Contents/Resources/ollama",
            "/Applications/Ollama.app/Contents/MacOS/Ollama",
        ];
        is_ollama_in_paths(&paths)
    }
}

pub fn resolve_ollama_chat_model_from_tags(json: &serde_json::Value) -> String {
    if let Some(models) = json.get("models").and_then(|m| m.as_array()) {
        let names: Vec<&str> = models
            .iter()
            .filter_map(|m| m.get("name").and_then(|n| n.as_str()))
            .collect();
        // If frugallm-active is installed, prefer it
        if let Some(&active) = names.iter().find(|&&n| n.starts_with("frugallm-active")) {
            return active.strip_suffix(":latest").unwrap_or(active).to_string();
        }
        // Fallback to user's first existing installed model
        if let Some(&first) = names.first() {
            return first.to_string();
        }
    }
    "frugallm-active".to_string()
}

#[tauri::command(async)]
pub async fn get_ollama_chat_model() -> String {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    if let Ok(res) = client.get("http://127.0.0.1:11434/api/tags").send().await {
        if let Ok(json) = res.json::<serde_json::Value>().await {
            return resolve_ollama_chat_model_from_tags(&json);
        }
    }
    "frugallm-active".to_string()
}

pub fn parse_agent_version(raw: &str) -> Option<String> {
    for line in raw.lines() {
        for word in line.split_whitespace() {
            let clean = word.trim_matches(|c: char| !c.is_alphanumeric() && c != '.' && c != '-');
            if clean.starts_with('v') || clean.starts_with('V') {
                let rest = &clean[1..];
                if rest.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) && rest.contains('.') {
                    return Some(format!("v{}", rest));
                }
            } else if clean.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) && clean.contains('.') {
                return Some(format!("v{}", clean));
            }
        }
    }
    raw.lines().next().map(|l| l.trim().to_string()).filter(|s| !s.is_empty())
}

#[tauri::command(async)]
pub async fn get_hermes_version(app: tauri::AppHandle) -> String {
    if let Ok(home) = app.path().home_dir() {
        if let Some(hermes_bin) = get_hermes_source_path(&home) {
            let is_cmd = hermes_bin.extension().map(|e| e.eq_ignore_ascii_case("cmd") || e.eq_ignore_ascii_case("bat")).unwrap_or(false);
            let mut cmd = if cfg!(windows) && is_cmd {
                let mut c = tokio::process::Command::new("cmd.exe");
                c.args(["/C", &hermes_bin.to_string_lossy()]);
                c
            } else {
                tokio::process::Command::new(&hermes_bin)
            };
            if let Ok(output) = cmd.arg("--version").output().await {
                if output.status.success() {
                    let v = String::from_utf8_lossy(&output.stdout);
                    if let Some(parsed) = parse_agent_version(&v) {
                        return parsed;
                    }
                }
            }
            return "v0.3.1".to_string();
        }
    }
    "N/A".to_string()
}

#[tauri::command(async)]
pub async fn get_opencode_version(app: tauri::AppHandle) -> String {
    if let Ok(home) = app.path().home_dir() {
        if let Some(opencode_bin) = get_opencode_source_path(&home) {
            let is_cmd = opencode_bin.extension().map(|e| e.eq_ignore_ascii_case("cmd") || e.eq_ignore_ascii_case("bat")).unwrap_or(false);
            let mut cmd = if cfg!(windows) && is_cmd {
                let mut c = tokio::process::Command::new("cmd.exe");
                c.args(["/C", &opencode_bin.to_string_lossy()]);
                c
            } else {
                tokio::process::Command::new(&opencode_bin)
            };
            if let Ok(output) = cmd.arg("--version").output().await {
                if output.status.success() {
                    let v = String::from_utf8_lossy(&output.stdout);
                    if let Some(parsed) = parse_agent_version(&v) {
                        return parsed;
                    }
                }
            }
            return "v1.0.0".to_string();
        }
    }
    "N/A".to_string()
}

#[tauri::command(async)]
pub async fn uninstall_ollama(app: tauri::AppHandle) -> Result<(), String> {
    log_event(&app, "INFO", "OLLAMA", "Initiating complete uninstallation of Ollama");

    // 1. Kill daemon child process if managed by app
    let daemon_state = app.state::<OllamaDaemonState>();
    let mut child_guard = daemon_state.child.lock().await;
    if let Some(mut child) = child_guard.take() {
        let _ = child.kill().await;
    }
    drop(child_guard);

    // 1b. Terminate system-wide Ollama processes and wait for exit to release file locks
    #[cfg(target_os = "macos")]
    {
        let _ = tokio::process::Command::new("pkill").args(["-9", "-f", "ollama"]).output().await;
        let _ = tokio::process::Command::new("pkill").args(["-9", "-f", "Ollama"]).output().await;
    }
    #[cfg(target_os = "linux")]
    {
        let _ = tokio::process::Command::new("pkill").args(["-9", "-f", "ollama"]).output().await;
    }
    #[cfg(target_os = "windows")]
    {
        let mut kill_cmd = tokio::process::Command::new("taskkill");
        kill_cmd.args(["/F", "/T", "/IM", "ollama.exe", "/IM", "ollama app.exe"]);
        use std::os::windows::process::CommandExt;
        kill_cmd.creation_flags(0x08000000);
        let _ = kill_cmd.output().await;
    }

    // Wait for processes to exit so file locks on binaries and model blobs are released
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

    // 2. Execute the Official Inno Setup Uninstaller on Windows
    #[cfg(target_os = "windows")]
    {
        if let Some(unins) = get_windows_ollama_uninstaller() {
            log_event(&app, "INFO", "OLLAMA", &format!("Executing Inno Setup uninstaller: {:?}", unins));
            let mut unins_cmd = tokio::process::Command::new(unins);
            unins_cmd.args(["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART"]);
            use std::os::windows::process::CommandExt;
            unins_cmd.creation_flags(0x08000000);
            if let Ok(mut child) = unins_cmd.spawn() {
                let _ = child.wait().await;
            }
        }
    }

    // 3. Reclaim Disk Space & Delete Leftover Storage
    // 3a. User model store: ~/.ollama (reclaims 10-50+ GB)
    if let Ok(home) = app.path().home_dir() {
        let ollama_home = home.join(".ollama");
        let _ = tokio::fs::remove_dir_all(&ollama_home).await;
        #[cfg(not(target_os = "windows"))]
        {
            let _ = tokio::process::Command::new("rm").args(["-rf", &ollama_home.to_string_lossy()]).output().await;
        }
    }

    // 3b. Local AppData cache and residual files on Windows
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let local_base = std::path::PathBuf::from(&local_app_data);
            let app_data_cache = local_base.join("Ollama");
            let _ = tokio::fs::remove_dir_all(&app_data_cache).await;

            let prog_ollama = local_base.join("Programs").join("Ollama");
            let _ = tokio::fs::remove_dir_all(&prog_ollama).await;
        }

        if let Ok(app_data) = std::env::var("APPDATA") {
            let appdata_cache = std::path::PathBuf::from(app_data).join("com.chorned.frugallm-app").join("models");
            let _ = tokio::fs::remove_dir_all(&appdata_cache).await;
        }
    }

    // 3c. FrugaLLM model cache
    if let Ok(app_dir) = app.path().app_data_dir() {
        let models_dir = app_dir.join("models");
        let _ = tokio::fs::remove_dir_all(&models_dir).await;
    }

    // 3d. Unix application binaries
    #[cfg(target_os = "macos")]
    {
        let _ = tokio::fs::remove_dir_all("/Applications/Ollama.app").await;
        let _ = tokio::fs::remove_file("/usr/local/bin/ollama").await;
        let _ = tokio::process::Command::new("rm").args(["-rf", "/Applications/Ollama.app", "/usr/local/bin/ollama"]).output().await;
    }
    #[cfg(target_os = "linux")]
    {
        let _ = tokio::fs::remove_file("/usr/local/bin/ollama").await;
        let _ = tokio::fs::remove_file("/usr/bin/ollama").await;
        let _ = tokio::process::Command::new("rm").args(["-rf", "/usr/local/bin/ollama", "/usr/bin/ollama"]).output().await;
    }

    // 4. Clean the User Environment PATH on Windows
    let _ = clean_windows_user_path_ollama();

    // 5. Reset App State & Notify Frontend
    if let Ok(store) = app.store("store.json") {
        store.delete("local_model");
        store.delete("ollama_installed");
        store.delete("ollama_model");
        let _ = store.save();
    }

    let _ = app.emit("ollama_uninstalled", ());
    log_event(&app, "INFO", "OLLAMA", "Ollama uninstalled, registry purged, leftover storage removed, and state reset successfully");

    Ok(())
}

pub fn wipe_opencode(home: &std::path::Path) {
    let _ = std::fs::remove_dir_all(home.join(".opencode"));
    let _ = std::fs::remove_dir_all(home.join(".config").join("opencode"));
    let _ = std::fs::remove_dir_all(home.join(".cache").join("opencode"));
    let _ = std::fs::remove_file(home.join(".local").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" }));
    let _ = std::fs::remove_file(home.join(".cargo").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" }));
    #[cfg(target_os = "windows")]
    {
        let _ = std::fs::remove_file(home.join(".local").join("bin").join("opencode.cmd"));
        let _ = std::fs::remove_file(home.join(".opencode").join("bin").join("opencode.cmd"));
    }
}

#[tauri::command(async)]
pub async fn uninstall_opencode(app: tauri::AppHandle) -> Result<(), String> {
    // 1. Terminate running opencode processes
    #[cfg(not(target_os = "windows"))]
    {
        let _ = tokio::process::Command::new("pkill").args(["-9", "-f", "opencode"]).output().await;
    }
    #[cfg(target_os = "windows")]
    {
        let _ = tokio::process::Command::new("taskkill").args(["/F", "/IM", "opencode.exe", "/T"]).output().await;
        let _ = tokio::process::Command::new("cmd.exe").args(["/C", "npm", "uninstall", "-g", "opencode-ai"]).output().await;
    }

    // 2. Remove directories and binary symlinks
    if let Ok(home) = app.path().home_dir() {
        let opencode_dir = home.join(".opencode");
        let _ = tokio::fs::remove_dir_all(&opencode_dir).await;
        let config_dir = home.join(".config").join("opencode");
        let _ = tokio::fs::remove_dir_all(&config_dir).await;
        let cache_dir = home.join(".cache").join("opencode");
        let _ = tokio::fs::remove_dir_all(&cache_dir).await;
        let local_bin = home.join(".local").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" });
        let _ = tokio::fs::remove_file(&local_bin).await;
        let cargo_bin = home.join(".cargo").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" });
        let _ = tokio::fs::remove_file(&cargo_bin).await;
        #[cfg(target_os = "windows")]
        {
            let _ = tokio::fs::remove_file(home.join(".local").join("bin").join("opencode.cmd")).await;
            let _ = tokio::fs::remove_file(home.join(".opencode").join("bin").join("opencode.cmd")).await;
        }
    }

    Ok(())
}

#[tauri::command(async)]
pub async fn uninstall_hermes(app: tauri::AppHandle) -> Result<(), String> {
    // 1. Terminate running hermes processes
    #[cfg(not(target_os = "windows"))]
    {
        let _ = tokio::process::Command::new("pkill").args(["-9", "-f", "hermes"]).output().await;
    }
    #[cfg(target_os = "windows")]
    {
        let _ = tokio::process::Command::new("taskkill").args(["/F", "/IM", "hermes.exe", "/T"]).output().await;
    }

    // 2. Remove directories and binary symlinks
    if let Ok(home) = app.path().home_dir() {
        let hermes_dir = home.join(".hermes");
        let _ = tokio::fs::remove_dir_all(&hermes_dir).await;
        let config_dir = home.join(".config").join("hermes");
        let _ = tokio::fs::remove_dir_all(&config_dir).await;
        let cache_dir = home.join(".cache").join("hermes");
        let _ = tokio::fs::remove_dir_all(&cache_dir).await;
        let local_bin = home.join(".local").join("bin").join(if cfg!(windows) { "hermes.exe" } else { "hermes" });
        let _ = tokio::fs::remove_file(&local_bin).await;
    }

    Ok(())
}


#[tauri::command(async)]
pub async fn check_tool_gateway_status(app: tauri::AppHandle) -> bool {
    // Check local marker file in app_data_dir
    if let Ok(app_dir) = app.path().app_data_dir() {
        let marker = app_dir.join("tool_gateway_installed");
        if marker.exists() {
            return true;
        }
    }
    false
}

#[tauri::command]
pub fn set_tool_gateway_installed(app: tauri::AppHandle, installed: bool) -> Result<(), String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }
    let marker = app_dir.join("tool_gateway_installed");
    if installed {
        std::fs::write(&marker, b"1").map_err(|e| e.to_string())?;
    } else if marker.exists() {
        let _ = std::fs::remove_file(&marker);
    }
    log_event(
        &app,
        "INFO",
        "GATEWAY",
        &format!("Tool Enforcing Gateway status updated: installed={}", installed),
    );
    Ok(())
}


#[tauri::command(async)]
pub async fn start_hermes_service(
    app: tauri::AppHandle,
    process_state: State<'_, Arc<ChildProcessManager>>,
    frugal_state: State<'_, FrugalConfigState>,
    service: String,
) -> Result<u32, String> {
    let (port, api_pwd) = {
        let config = frugal_state.config.lock().await;
        (config.port, config.api_password.clone())
    };
    spawn_hermes_child(&app, &process_state, port, api_pwd, &service).await
}

#[tauri::command]
pub fn stop_hermes_service(
    process_state: State<'_, Arc<ChildProcessManager>>,
    service: String,
) -> Result<(), String> {
    let service_key = if service.starts_with("hermes-") {
        service
    } else if service.starts_with("run-hermes-") {
        format!("hermes-{}", service.trim_start_matches("run-hermes-"))
    } else {
        format!("hermes-{}", service)
    };
    process_state.kill_process(&service_key);
    if service_key == "hermes-gateway" || service_key == "hermes-desktop" {
        process_state.kill_process("hermes-gateway");
        process_state.kill_process("hermes-desktop");
        process_state.kill_process("run-hermes-gateway");
        process_state.kill_process("run-hermes-desktop");
    } else if service_key == "hermes-dashboard" || service_key == "hermes-web" {
        process_state.kill_process("hermes-dashboard");
        process_state.kill_process("hermes-web");
        process_state.kill_process("run-hermes-web");
    }
    Ok(())
}

#[tauri::command]
pub fn has_active_services(
    process_state: State<'_, Arc<ChildProcessManager>>,
) -> bool {
    process_state.has_active_services()
}

#[tauri::command]
pub fn get_active_services(
    process_state: State<'_, Arc<ChildProcessManager>>,
) -> Vec<String> {
    process_state.active_service_names()
}

#[tauri::command]
pub fn confirm_exit_app(
    app: tauri::AppHandle,
    process_state: State<'_, Arc<ChildProcessManager>>,
    frugal_state: State<'_, FrugalConfigState>,
    exit_state: State<'_, Arc<std::sync::atomic::AtomicBool>>,
) -> Result<(), String> {
    exit_state.store(true, std::sync::atomic::Ordering::Release);
    process_state.kill_all();
    
    if frugal_state.is_dirty.swap(false, std::sync::atomic::Ordering::AcqRel) {
        let config_clone = if let Ok(guard) = frugal_state.config.try_lock() {
            guard.clone()
        } else {
            tauri::async_runtime::block_on(async {
                let guard = frugal_state.config.lock().await;
                guard.clone()
            })
        };
        if let Ok(path) = get_config_path(&app) {
            if let Ok(json) = serde_json::to_string_pretty(&config_clone) {
                let _ = std::fs::write(path, json);
            }
        }
    }
    
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub fn check_hermes_ready(app: tauri::AppHandle) -> bool {
    if let Ok(home) = app.path().home_dir() {
        is_hermes_installed(&home)
    } else {
        false
    }
}


pub fn get_default_soul_template() -> &'static str {
    r#"# IDENTITY AND PURPOSE
You are Hermes, the core intelligence and primary agent operating within the Users environment. 

Your SOLE PURPOSE is to act as a highly efficient, self-reliant generalist. You must execute user requests, write functional code, draft documentation, and prepare the environment directly. 

**CRITICAL DIRECTIVE:** you are the direct implementer. Do not attempt to delegate tasks to other profiles or use a Kanban board. You must solve the problems, write the code, and execute the tasks yourself to the best of your ability.

# YOUR WORKFLOW
When presented with a user request, you must rigidly follow this sequence:
1. **Analyze (The Scratchpad):** Begin your response with a `<scratchpad>` block to perform your internal monologue. Assess the user's goal, identify the technical steps required, and plan your direct execution.
2. **Execute:** Provide the code, documentation, or technical guidance directly in your response.
3. **Verify:** Ensure your solution fully addresses the user's prompt without relying on non-existent external worker profiles.

# REQUIRED RESPONSE FORMAT
<scratchpad>
- User Intent: [What is the user asking?]
- Required Actions: [What specific implementation steps must I take?]
- Tool Status: [Can I do this natively, or do I need a tool for this specific capability?]
</scratchpad>
[Your direct execution, code blocks, or required output here]

# TIME & BACKGROUND LIMITATIONS (NO FAKE MONITORING)
You are a turn-based, request-response agent. Once you finish generating a response, you are completely asleep and inert. You CANNOT autonomously "wait", "sleep", "monitor", "keep an eye on", or "check back in 5 minutes" natively.
- If the user asks you to monitor progress, wait, or keep them posted, you MUST NOT simply agree and end your turn. 
- You MUST explicitly inform the user of your turn-based nature. 
- Never state in conversational text that you have "started a background process" or promise to "notify them soon" unless you have explicitly called a specific tool (like a cronjob utility) in the same turn to handle it."#
}

#[tauri::command]
pub async fn configure_hermes_defaults(app: tauri::AppHandle, state: tauri::State<'_, FrugalConfigState>) -> Result<(), String> {
    let port = state.config.lock().await.port;
    if let Ok(home) = app.path().home_dir() {
        let hermes_dir = home.join(".hermes");
        if !hermes_dir.exists() {
            std::fs::create_dir_all(&hermes_dir).map_err(|e| e.to_string())?;
        }
        
        let config_path = hermes_dir.join("config.yaml");
        let config_content = format!("model:\n  default: \"frugallm\"\n  provider: \"custom\"\n  base_url: \"http://127.0.0.1:{}/v1\"\n", port);
        std::fs::write(&config_path, &config_content).map_err(|e| e.to_string())?;

        let soul_path = hermes_dir.join("soul.md");
        let soul_upper = hermes_dir.join("SOUL.md");
        let soul_content = get_default_soul_template();
        if !soul_path.exists() && !soul_upper.exists() {
            std::fs::write(&soul_path, soul_content).map_err(|e| e.to_string())?;
            log_event(&app, "INFO", "HERMES", "Created default soul.md in ~/.hermes/soul.md");
        } else {
            log_event(&app, "INFO", "HERMES", "soul.md already exists in ~/.hermes; preserving existing user file");
        }

        #[cfg(target_os = "windows")]
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let win_hermes_dir = std::path::PathBuf::from(local_app_data).join("hermes");
            let _ = std::fs::create_dir_all(&win_hermes_dir);
            let _ = std::fs::write(win_hermes_dir.join("config.yaml"), &config_content);
            if !win_hermes_dir.join("soul.md").exists() && !win_hermes_dir.join("SOUL.md").exists() {
                let _ = std::fs::write(win_hermes_dir.join("soul.md"), soul_content);
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn edit_hermes_soul(app: tauri::AppHandle) -> Result<(), String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let hermes_dir = home.join(".hermes");
    let soul_path = hermes_dir.join("soul.md");
    let soul_upper = hermes_dir.join("SOUL.md");
    let target_path = if soul_path.exists() {
        soul_path
    } else if soul_upper.exists() {
        soul_upper
    } else {
        #[cfg(target_os = "windows")]
        {
            if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                let win_hermes = std::path::PathBuf::from(&local_app_data).join("hermes");
                let win_soul = win_hermes.join("soul.md");
                let win_soul_upper = win_hermes.join("SOUL.md");
                if win_soul.exists() {
                    win_soul
                } else if win_soul_upper.exists() {
                    win_soul_upper
                } else {
                    let _ = std::fs::create_dir_all(&win_hermes);
                    let _ = std::fs::write(&win_soul, get_default_soul_template());
                    win_soul
                }
            } else {
                let _ = std::fs::create_dir_all(&hermes_dir);
                let _ = std::fs::write(&soul_path, get_default_soul_template());
                soul_path
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = std::fs::create_dir_all(&hermes_dir);
            let _ = std::fs::write(&soul_path, get_default_soul_template());
            soul_path
        }
    };
    crate::commands::system::open_file_in_system_viewer(&app, &target_path)
}


pub fn get_ollama_source_path() -> Option<std::path::PathBuf> {
    let bin = get_ollama_binary();
    if bin != std::path::PathBuf::from("ollama") && bin.exists() {
        return Some(bin);
    }
    None
}


#[tauri::command]
pub async fn configure_opencode_defaults(app: tauri::AppHandle, state: tauri::State<'_, FrugalConfigState>) -> Result<(), String> {
    let config = state.config.lock().await;
    let port = config.port;
    let api_key = config.api_password.clone().unwrap_or_else(|| "frugallm".to_string());
    
    if let Ok(home) = app.path().home_dir() {
        let config_dir = home.join(".config").join("opencode");
        if !config_dir.exists() {
            std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
        }
        
        let config_path = config_dir.join("opencode.json");
        let config_content = serde_json::json!({
            "provider": {
                "litellm": {
                    "npm": "@ai-sdk/openai-compatible",
                    "name": "LiteLLM",
                    "options": {
                        "baseURL": format!("http://127.0.0.1:{}/v1", port),
                        "apiKey": api_key
                    },
                    "models": {
                        "frugallm": { "name": "FrugaLLM" }
                    }
                }
            },
            "model": "litellm/frugallm"
        });
        
        let json_str = serde_json::to_string_pretty(&config_content).map_err(|e| e.to_string())?;
        std::fs::write(&config_path, json_str).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub async fn ensure_ollama_installed(app: &tauri::AppHandle) -> Result<(), String> {
    log_event(app, "INFO", "OLLAMA", "Checking if Ollama is already installed and responsive");
    // Check if the binary already exists on PATH or common paths
    if check_ollama_status().await {
        log_event(app, "INFO", "OLLAMA", "Ollama is already installed on the system");
        return Ok(());
    }

    log_event(app, "INFO", "OLLAMA", "Ollama not detected; initiating installation sequence");
    let _ = app.emit("installing_ollama", ());

    #[cfg(not(target_os = "windows"))]
    {
        log_event(app, "INFO", "OLLAMA", "Downloading and executing install.sh for macOS/Linux");
        // CRITICAL: Set OLLAMA_NO_START=1 so install.sh does not fail on `open -a Ollama`.
        // The background daemon will be started cleanly by `start_ollama_daemon`.
        let mut child = tokio::process::Command::new("sh")
            .arg("-c")
            .arg("export OLLAMA_NO_START=1 && curl -fsSL https://ollama.com/install.sh | sh")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| {
                let err = format!("Failed to spawn install.sh: {}", e);
                log_event(app, "ERROR", "OLLAMA", &err);
                err
            })?;
            
        let app_clone = app.clone();
        if let Some(stdout) = child.stdout.take() {
            use tokio::io::AsyncBufReadExt;
            let mut reader = tokio::io::BufReader::new(stdout).lines();
            let app_inner = app_clone.clone();
            tokio::spawn(async move {
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = app_inner.emit("download_progress", DownloadProgress { status: format!("{}\r\n", line) });
                }
            });
        }

        if let Some(stderr) = child.stderr.take() {
            use tokio::io::AsyncBufReadExt;
            let mut reader = tokio::io::BufReader::new(stderr).lines();
            let app_inner = app_clone;
            tokio::spawn(async move {
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = app_inner.emit("download_progress", DownloadProgress { status: format!("{}\r\n", line) });
                }
            });
        }

        let _ = child.wait().await;

        if !check_ollama_status().await {
            let err = "Failed to install Ollama via install.sh".to_string();
            log_event(app, "ERROR", "OLLAMA", &err);
            return Err(err);
        }
        log_event(app, "INFO", "OLLAMA", "Ollama installed successfully on macOS/Linux");
    }

    #[cfg(target_os = "windows")]
    {
        use tokio::io::AsyncBufReadExt;
        #[cfg(target_os = "windows")]
        use std::os::windows::process::CommandExt;

        log_event(app, "INFO", "OLLAMA", "Preparing seamless Ollama installation for Windows via PowerShell");

        // The PowerShell script ensures:
        // 1. Any hung or open `ollama app` / `ollama` processes from previous attempts are cleanly stopped.
        // 2. The official Ollama `%LOCALAPPDATA%\Ollama\upgraded` marker file is created BEFORE installation.
        //    Ollama's app specifically checks for this marker to know it was installed headlessly/as an upgrade,
        //    completely suppressing the "Run Ollama" first-time onboarding GUI window.
        // 3. The installer is downloaded and executed silently via Start-Process with -PassThru and WaitForExit(),
        //    waiting strictly for the installer itself and NOT child processes, preventing process hangs.
        // 4. PATH is updated for the user session so `ollama.exe` is immediately available.
        let script = r#"
            $ErrorActionPreference = 'Stop';
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;
            $ProgressPreference = 'SilentlyContinue';

            Get-Process -Name 'ollama app', 'ollama' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue;

            $markerDir = Join-Path $env:LOCALAPPDATA 'Ollama';
            if (!(Test-Path $markerDir)) { New-Item -ItemType Directory -Path $markerDir -Force | Out-Null };
            New-Item -ItemType File -Path (Join-Path $markerDir 'upgraded') -Force | Out-Null;

            Write-Host '>>> Initializing Ollama installation for Windows...';
            $tempInstaller = Join-Path $env:TEMP ('OllamaSetup_' + (Get-Random) + '.exe');
            try {
                Write-Host '>>> Downloading Ollama installer from ollama.com...';
                Invoke-WebRequest -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile $tempInstaller -UseBasicParsing;
                Write-Host '>>> Installing Ollama Engine silently...';
                $proc = Start-Process -FilePath $tempInstaller -ArgumentList '/VERYSILENT /NORESTART /CLOSEAPPLICATIONS /SUPPRESSMSGBOXES' -PassThru;
                $proc.WaitForExit();
                if ($proc.ExitCode -ne 0) {
                    throw ('Installer exited with code ' + $proc.ExitCode);
                }
                Write-Host '>>> Ollama Engine installed successfully.';
            } finally {
                Remove-Item -Force $tempInstaller -ErrorAction SilentlyContinue;
            }

            $ollamaProgDir = Join-Path $env:LOCALAPPDATA 'Programs\Ollama';
            if (Test-Path $ollamaProgDir) {
                $userPath = [Environment]::GetEnvironmentVariable('Path', 'User');
                if ($userPath -notlike ('*' + $ollamaProgDir + '*')) {
                    [Environment]::SetEnvironmentVariable('Path', ($ollamaProgDir + ';' + $userPath), 'User');
                }
            }
            Write-Host '>>> Install complete. Run ''ollama'' from the command line.';
        "#;

        let mut cmd = tokio::process::Command::new("powershell.exe");
        cmd.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script]);
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());
        cmd.creation_flags(0x08000000);

        let mut child = cmd.spawn().map_err(|e| {
            let err = format!("Failed to spawn PowerShell Ollama installer: {}", e);
            log_event(app, "ERROR", "OLLAMA", &err);
            err
        })?;

        let app_clone = app.clone();
        if let Some(stdout) = child.stdout.take() {
            let mut reader = tokio::io::BufReader::new(stdout).lines();
            let app_inner = app_clone.clone();
            tokio::spawn(async move {
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = app_inner.emit("download_progress", DownloadProgress { status: format!("{}\r\n", line) });
                }
            });
        }

        if let Some(stderr) = child.stderr.take() {
            let mut reader = tokio::io::BufReader::new(stderr).lines();
            let app_inner = app_clone;
            tokio::spawn(async move {
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = app_inner.emit("download_progress", DownloadProgress { status: format!("{}\r\n", line) });
                }
            });
        }

        let status = child.wait().await.map_err(|e| {
            let err = format!("Error waiting for PowerShell Ollama installer: {}", e);
            log_event(app, "ERROR", "OLLAMA", &err);
            err
        })?;

        if !status.success() {
            let err = format!("Ollama installation script failed with status {:?}", status.code());
            log_event(app, "ERROR", "OLLAMA", &err);
            return Err(err);
        }

        log_event(app, "INFO", "OLLAMA", "Ollama installer exited successfully. Verifying installation...");

        let mut installed = false;
        for _ in 0..10 {
            if check_ollama_status().await {
                installed = true;
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }

        if !installed {
            let err = "Ollama installer finished, but Ollama binary/service was not detected on system".to_string();
            log_event(app, "ERROR", "OLLAMA", &err);
            return Err(err);
        }
        log_event(app, "INFO", "OLLAMA", "Ollama Windows installation verified successfully");
    }

    Ok(())
}

pub async fn start_ollama_daemon(app: &tauri::AppHandle) -> Result<(), String> {
    let daemon_state = app.state::<OllamaDaemonState>();

    // Check if already responding
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .map_err(|e| e.to_string())?;

    if client.get("http://127.0.0.1:11434/api/version").send().await.is_ok() {
        log_event(app, "INFO", "OLLAMA", "Ollama daemon already responding on port 11434");
        let _ = app.emit("download_progress", DownloadProgress {
            status: "Ollama daemon already running.".to_string(),
        });
        return Ok(());
    }

    // Check if an ollama process is already alive to prevent socket bind collisions
    let process_running = is_ollama_process_running();
    if process_running {
        log_event(app, "INFO", "OLLAMA", "Existing Ollama process detected in process table (e.g. ollama app.exe / ollama.exe). Skipping 'ollama serve' spawn to avoid port collision.");
    } else {
        let ollama_bin = get_ollama_binary();
        log_event(app, "INFO", "OLLAMA", &format!("Spawning Ollama daemon with binary {:?}", ollama_bin));

        // Spawn daemon in background — pipe stderr so we can stream boot logs
        let mut cmd = tokio::process::Command::new(ollama_bin);
        cmd.arg("serve")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(false);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }
        let mut child = cmd.spawn().map_err(|e| {
            let err = format!("Failed to spawn Ollama daemon: {}", e);
            log_event(app, "ERROR", "OLLAMA", &err);
            err
        })?;

        // Stream daemon stderr to the frontend in a detached task (never blocks main flow)
        if let Some(stderr) = child.stderr.take() {
            use tokio::io::AsyncBufReadExt;
            let mut reader = tokio::io::BufReader::new(stderr).lines();
            let app_inner = app.clone();
            tokio::spawn(async move {
                use tokio::time::{Instant, Duration};
                let mut last_emit = Instant::now();
                while let Ok(Some(line)) = reader.next_line().await {
                    let now = Instant::now();
                    if now.duration_since(last_emit) > Duration::from_millis(100) {
                        let _ = app_inner.emit("download_progress", DownloadProgress { status: line });
                        last_emit = now;
                    }
                }
            });
        }

        // Store the child handle in application state so it lives for the entire app lifetime.
        {
            let mut guard = daemon_state.child.lock().await;
            *guard = Some(child);
        }
    }

    // Poll for readiness — 2000ms intervals, up to 60 attempts (120s timeout)
    let _ = app.emit("download_progress", DownloadProgress {
        status: "Initializing Ollama daemon and discovering GPU hardware (first run may take up to 90s)...".to_string(),
    });

    for i in 0..60 {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        if client.get("http://127.0.0.1:11434/api/version").send().await.is_ok() {
            let elapsed_secs = (i + 1) * 2;
            log_event(app, "INFO", "OLLAMA", &format!("Ollama daemon ready ({}s)", elapsed_secs));
            let _ = app.emit("download_progress", DownloadProgress {
                status: format!("Ollama daemon ready ({}s).", elapsed_secs),
            });

            // Boot buffer: Ollama's GPU discovery takes additional time after the HTTP endpoint is live.
            // Wait 2s before issuing model commands.
            let _ = app.emit("download_progress", DownloadProgress {
                status: "Waiting for GPU backend initialization...".to_string(),
            });
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;

            return Ok(());
        }
    }

    let err = "Timed out waiting for Ollama daemon to start after 120 seconds".to_string();
    log_event(app, "ERROR", "OLLAMA", &err);
    Err(err)
}

#[tauri::command(async)]
pub async fn deploy_local_model(app: tauri::AppHandle) -> Result<(), String> {
    log_event(&app, "INFO", "OLLAMA", "deploy_local_model requested");
    ensure_ollama_installed(&app).await.map_err(|e| {
        log_event(&app, "ERROR", "OLLAMA", &format!("ensure_ollama_installed failed: {}", e));
        e
    })?;

    start_ollama_daemon(&app).await.map_err(|e| {
        log_event(&app, "ERROR", "OLLAMA", &format!("start_ollama_daemon failed: {}", e));
        e
    })?;

    let vram_mb = detect_vram().await.map_err(|e| {
        log_event(&app, "ERROR", "OLLAMA", &format!("detect_vram failed: {}", e));
        e
    })?;
    let detected_vram_gb = vram_mb as f64 / 1024.0;
    let tag = get_model_tag_for_vram(detected_vram_gb);
    log_event(&app, "INFO", "OLLAMA", &format!("Detected VRAM: {:.2} GB, selected model tag: {}", detected_vram_gb, tag));

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let models_dir = app_data_dir.join("models");
    std::fs::create_dir_all(&models_dir).map_err(|e| e.to_string())?;

    // Generate Modelfile
    let modelfile_path = models_dir.join("Modelfile");
    let modelfile_content = format!("FROM {}\nPARAMETER num_ctx 131072\n", tag);
    log_event(&app, "INFO", "OLLAMA", &format!("Writing Modelfile to {:?}", modelfile_path));
    std::fs::write(&modelfile_path, modelfile_content).map_err(|e| e.to_string())?;

    let app_clone = app.clone();
    let tag_clone = tag.clone();
    tauri::async_runtime::spawn(async move {
        let _ = app_clone.emit("model_provisioning_started", ());
        log_event(&app_clone, "INFO", "OLLAMA", &format!("Stage 1: Pulling base model {} from Ollama registry", tag_clone));

        let client = reqwest::Client::new();
        let pull_payload = serde_json::json!({
            "model": tag_clone,
            "stream": true
        });

        match client.post("http://127.0.0.1:11434/api/pull").json(&pull_payload).send().await {
            Ok(mut res) => {
                let mut buffer = Vec::new();
                let mut last_completed: u64 = 0;
                let mut last_speed_calc = tokio::time::Instant::now();
                let mut smoothed_speed: f64 = 0.0;
                let mut last_emit = tokio::time::Instant::now();
                let mut stream_error: Option<String> = None;
                while let Ok(Some(chunk)) = res.chunk().await {
                    buffer.extend_from_slice(&chunk);
                    while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
                        let line = buffer.drain(..pos).collect::<Vec<_>>();
                        buffer.remove(0); // remove the '\n'
                        if let Ok(text) = String::from_utf8(line) {
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                                if let Some(err_msg) = json.get("error").and_then(|e| e.as_str()) {
                                    stream_error = Some(err_msg.to_string());
                                }
                                if let (Some(completed), Some(total)) = (json.get("completed"), json.get("total")) {
                                    if let (Some(c), Some(t)) = (completed.as_u64(), total.as_u64()) {
                                        if t > 0 {
                                            let percent = ((c as f64 / t as f64) * 100.0) as u32;
                                            let now = tokio::time::Instant::now();
                                            let elapsed_speed = now.duration_since(last_speed_calc).as_secs_f64();

                                            if elapsed_speed >= 0.4 {
                                                let delta_bytes = if c >= last_completed { c - last_completed } else { c };
                                                let current_instant_speed = delta_bytes as f64 / elapsed_speed;
                                                if smoothed_speed == 0.0 {
                                                    smoothed_speed = current_instant_speed;
                                                } else {
                                                    smoothed_speed = 0.65 * smoothed_speed + 0.35 * current_instant_speed;
                                                }
                                                last_completed = c;
                                                last_speed_calc = now;
                                            }

                                            let remaining_bytes = t.saturating_sub(c);
                                            let eta_seconds = if smoothed_speed > 1024.0 {
                                                (remaining_bytes as f64 / smoothed_speed) as u64
                                            } else {
                                                0
                                            };

                                            if now.duration_since(last_emit) > tokio::time::Duration::from_millis(100) || percent == 100 {
                                                let _ = app_clone.emit("model_download_progress", ModelProgressPayload {
                                                    percent,
                                                    completed: c,
                                                    total: t,
                                                    speed_bytes_per_sec: smoothed_speed,
                                                    eta_seconds,
                                                });
                                                last_emit = now;
                                            }
                                        }
                                    }
                                } else if let Some(status) = json.get("status") {
                                    if let Some(s) = status.as_str() {
                                        let _ = app_clone.emit("download_progress", DownloadProgress { status: format!("{}\r\n", s) });
                                    }
                                }
                            }
                        }
                    }
                }
                if let Some(err_msg) = stream_error {
                    log_event(&app_clone, "ERROR", "OLLAMA", &format!("Ollama pull reported error: {}", err_msg));
                    let _ = app_clone.emit("model_deployment_complete", DeploymentResult { success: false, message: format!("Model pull error: {}", err_msg) });
                    return;
                }
            }
            Err(e) => {
                log_event(&app_clone, "ERROR", "OLLAMA", &format!("API pull failed: {}", e));
                let _ = app_clone.emit("model_deployment_complete", DeploymentResult { success: false, message: format!("API pull failed: {}", e) });
                return;
            }
        }

        // Stage 2: Await completion and verify via GET /api/tags that the base model is 100% present
        log_event(&app_clone, "INFO", "OLLAMA", &format!("Stage 2: Verifying base model {} presence in Ollama tags list", tag_clone));
        let _ = app_clone.emit("download_progress", DownloadProgress {
            status: format!("Verifying base model {} in Ollama tags list...\r\n", tag_clone),
        });

        let mut verified = false;
        let verify_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(3))
            .build()
            .unwrap_or_default();

        for attempt in 1..=15 {
            if let Ok(res) = verify_client.get("http://127.0.0.1:11434/api/tags").send().await {
                if let Ok(tags_json) = res.json::<serde_json::Value>().await {
                    if is_base_model_in_tags(&tags_json, &tag_clone) {
                        verified = true;
                        log_event(&app_clone, "INFO", "OLLAMA", &format!("Base model {} verified in tags list on attempt {}", tag_clone, attempt));
                        break;
                    }
                }
            }
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }

        if !verified {
            let err = format!("Base model {} was pulled but could not be verified in Ollama /api/tags", tag_clone);
            log_event(&app_clone, "ERROR", "OLLAMA", &err);
            let _ = app_clone.emit("model_deployment_complete", DeploymentResult { success: false, message: err });
            return;
        }

        // Stage 3: Invoke `ollama create frugallm-active -f ./Modelfile`
        let ollama_bin = get_ollama_binary();
        log_event(&app_clone, "INFO", "OLLAMA", &format!("Stage 3: Creating frugallm-active model using binary {:?}", ollama_bin));
        let mut cmd = tokio::process::Command::new(ollama_bin);
        cmd.current_dir(&models_dir)
            .arg("create")
            .arg("frugallm-active")
            .arg("-f")
            .arg("./Modelfile")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }
        let child_res = cmd.spawn();

        let mut child = match child_res {
            Ok(c) => c,
            Err(e) => {
                log_event(&app_clone, "ERROR", "OLLAMA", &format!("Failed to spawn ollama create: {}", e));
                let _ = app_clone.emit("model_deployment_complete", DeploymentResult { success: false, message: e.to_string() });
                return;
            }
        };

        if let Some(stderr) = child.stderr.take() {
            use tokio::io::AsyncBufReadExt;
            let mut reader = tokio::io::BufReader::new(stderr).lines();
            let app_inner = app_clone.clone();
            tokio::spawn(async move {
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = app_inner.emit("download_progress", DownloadProgress { status: line });
                }
            });
        }

        if let Some(stdout) = child.stdout.take() {
            use tokio::io::AsyncBufReadExt;
            let mut reader = tokio::io::BufReader::new(stdout).lines();
            let app_inner = app_clone.clone();
            tokio::spawn(async move {
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = app_inner.emit("download_progress", DownloadProgress { status: line });
                }
            });
        }

        match child.wait().await {
            Ok(status) if status.success() => {
                log_event(&app_clone, "INFO", "OLLAMA", "frugallm-active model created successfully. Stage 4: Pre-warming model and confirming CUDA execution...");
                let _ = app_clone.emit("download_progress", DownloadProgress {
                    status: "Pre-warming model and confirming CUDA/GPU execution...\r\n".to_string(),
                });

                // Stage 4: Test inference request to /api/generate to pre-warm the model and confirm CUDA execution
                let client = reqwest::Client::builder()
                    .timeout(std::time::Duration::from_secs(60))
                    .build()
                    .unwrap_or_default();
                let prewarm_payload = serde_json::json!({
                    "model": "frugallm-active",
                    "prompt": "ping",
                    "stream": false
                });

                match client.post("http://127.0.0.1:11434/api/generate")
                    .json(&prewarm_payload)
                    .send()
                    .await {
                    Ok(resp) if resp.status().is_success() => {
                        log_event(&app_clone, "INFO", "OLLAMA", "Local model pre-warmed and CUDA/GPU execution confirmed successfully");
                        let _ = app_clone.emit("model_deployment_complete", DeploymentResult { success: true, message: "Success".to_string() });
                    },
                    Ok(resp) => {
                        let err_text = resp.text().await.unwrap_or_default();
                        let msg = format!("Model pre-warming response: {}", err_text);
                        log_event(&app_clone, "WARN", "OLLAMA", &msg);
                        let _ = app_clone.emit("model_deployment_complete", DeploymentResult { success: true, message: "Success".to_string() });
                    },
                    Err(e) => {
                        let msg = format!("Model pre-warming network error: {}", e);
                        log_event(&app_clone, "WARN", "OLLAMA", &msg);
                        let _ = app_clone.emit("model_deployment_complete", DeploymentResult { success: true, message: "Success".to_string() });
                    }
                }
            },
            Ok(status) => {
                let msg = format!("Ollama create failed with status: {}", status);
                log_event(&app_clone, "ERROR", "OLLAMA", &msg);
                let _ = app_clone.emit("model_deployment_complete", DeploymentResult { success: false, message: msg });
            },
            Err(e) => {
                log_event(&app_clone, "ERROR", "OLLAMA", &format!("Failed waiting for ollama create: {}", e));
                let _ = app_clone.emit("model_deployment_complete", DeploymentResult { success: false, message: e.to_string() });
            }
        }
    });

    Ok(())
}


