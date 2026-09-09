use crate::commands::*;
use crate::proxy::*;
use crate::state::*;
use std::env;
use tauri::{Emitter, Manager, State};

#[tauri::command]
pub fn get_launch_options() -> LaunchOptions {
    let args: Vec<String> = env::args().collect();
    let mut openrouter_key = None;
    let mut local_llm_ip = None;

    let mut i = 1;
    while i < args.len() {
        if args[i] == "--openrouter-key" && i + 1 < args.len() {
            openrouter_key = Some(args[i + 1].clone());
            i += 2;
        } else if args[i] == "--local-llm" && i + 1 < args.len() {
            local_llm_ip = Some(args[i + 1].clone());
            i += 2;
        } else {
            i += 1;
        }
    }

    LaunchOptions {
        openrouter_key,
        local_llm_ip,
    }
}

#[tauri::command]
pub async fn get_frugallm_config(
    state: State<'_, FrugalConfigState>,
) -> Result<FrugalConfig, String> {
    let config = state.config.lock().await;
    Ok(config.clone())
}

#[tauri::command]
pub async fn get_frugallm_server_status(
    state: State<'_, FrugalConfigState>,
) -> Result<ServerStatus, String> {
    let status = state.server_status.read().await;
    Ok(status.clone())
}

#[tauri::command]
pub async fn set_frugallm_config(
    app: tauri::AppHandle,
    state: State<'_, FrugalConfigState>,
    new_config: FrugalConfig,
) -> Result<(), String> {
    let mut config = state.config.lock().await;
    let mut updated_config = new_config.clone();
    updated_config.input_tokens_lifetime = config.input_tokens_lifetime;
    updated_config.output_tokens_lifetime = config.output_tokens_lifetime;
    updated_config.input_tokens_session = config.input_tokens_session;
    updated_config.output_tokens_session = config.output_tokens_session;

    let port_changed = config.port != updated_config.port;
    let ip_changed = config.bind_all_interfaces != updated_config.bind_all_interfaces;

    *config = updated_config.clone();

    let path = get_config_path(&app)?;
    if let Ok(json) = serde_json::to_string_pretty(&*config) {
        let _ = std::fs::write(path, json);
    }
    state
        .is_dirty
        .store(false, std::sync::atomic::Ordering::Release);

    if port_changed || ip_changed {
        {
            let mut status = state.server_status.write().await;
            *status = ServerStatus::Starting;
        }
        let _ = app.emit("frugallm_server_status", ServerStatus::Starting);

        if let Some(handle) = state.server_abort_handle.lock().await.take() {
            handle.abort();
        }

        let app_clone = app.clone();
        let new_abort = tauri::async_runtime::spawn(async move {
            start_frugallm_server(app_clone).await;
        });

        *state.server_abort_handle.lock().await = Some(new_abort);
    }

    Ok(())
}

pub const FRUGALLM_PATH_BLOCK_START: &str = "# >>> FrugaLLM CLI PATH >>>";
pub const FRUGALLM_PATH_BLOCK_END: &str = "# <<< FrugaLLM CLI PATH <<<";

pub fn remove_path_block(content: &str) -> String {
    let mut result = String::new();
    let mut inside_block = false;
    for line in content.lines() {
        if line.trim() == FRUGALLM_PATH_BLOCK_START {
            inside_block = true;
            continue;
        }
        if line.trim() == FRUGALLM_PATH_BLOCK_END {
            inside_block = false;
            continue;
        }
        if !inside_block {
            result.push_str(line);
            result.push('\n');
        }
    }
    result
}

pub fn update_shell_config_path(home: &std::path::Path, enable: bool) -> Result<(), String> {
    let rc_files = [".zshrc", ".bashrc", ".profile"];
    for rc_name in rc_files {
        let rc_path = home.join(rc_name);
        if enable {
            let should_create = cfg!(target_os = "macos") && rc_name == ".zshrc";
            if rc_path.exists() || should_create {
                let content = if rc_path.exists() {
                    std::fs::read_to_string(&rc_path).unwrap_or_default()
                } else {
                    String::new()
                };

                if !content.contains(FRUGALLM_PATH_BLOCK_START) {
                    let addition = format!(
                        "\n{}\nexport PATH=\"$HOME/.local/bin:$HOME/.hermes/bin:$PATH\"\n{}\n",
                        FRUGALLM_PATH_BLOCK_START, FRUGALLM_PATH_BLOCK_END
                    );
                    let mut new_content = content;
                    new_content.push_str(&addition);
                    let _ = std::fs::write(&rc_path, new_content);
                }
            }
        } else if rc_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&rc_path) {
                if content.contains(FRUGALLM_PATH_BLOCK_START) {
                    let cleaned = remove_path_block(&content);
                    let _ = std::fs::write(&rc_path, cleaned);
                }
            }
        }
    }
    Ok(())
}

#[cfg(unix)]
pub fn sync_unix_symlinks(home: &std::path::Path, enable: bool) -> Result<(), String> {
    let local_bin = home.join(".local").join("bin");
    if enable {
        let _ = std::fs::create_dir_all(&local_bin);
    }

    let tools = [
        ("hermes", get_hermes_source_path(home)),
        ("opencode", get_opencode_source_path(home)),
        ("ollama", get_ollama_source_path()),
    ];

    for (name, maybe_source) in tools {
        let target = local_bin.join(name);
        if enable {
            if let Some(source) = maybe_source {
                if target.exists() || target.symlink_metadata().is_ok() {
                    let _ = std::fs::remove_file(&target);
                }
                let _ = std::os::unix::fs::symlink(&source, &target);

                let usr_local_bin = std::path::Path::new("/usr/local/bin").join(name);
                if usr_local_bin.symlink_metadata().is_ok() {
                    let _ = std::fs::remove_file(&usr_local_bin);
                }
                let _ = std::os::unix::fs::symlink(&source, &usr_local_bin);
            }
        } else {
            if target.symlink_metadata().is_ok() {
                let _ = std::fs::remove_file(&target);
            }
            let usr_local_bin = std::path::Path::new("/usr/local/bin").join(name);
            if let Ok(meta) = usr_local_bin.symlink_metadata() {
                if meta.file_type().is_symlink() {
                    let _ = std::fs::remove_file(&usr_local_bin);
                }
            }
        }
    }
    Ok(())
}

#[cfg(windows)]
pub fn sync_windows_path(home: &std::path::Path, enable: bool) -> Result<(), String> {
    let hermes_bin = home.join(".hermes").join("bin");
    let local_bin = home.join(".local").join("bin");

    let hermes_str = hermes_bin.to_string_lossy();
    let local_str = local_bin.to_string_lossy();

    let script = if enable {
        format!(
            "$p = [Environment]::GetEnvironmentVariable('Path', 'User'); \
            $paths = $p -split ';' | Where-Object {{ $_ }}; \
            $added = @(); \
            if ($paths -notcontains '{0}') {{ $added += '{0}' }}; \
            if ($paths -notcontains '{1}') {{ $added += '{1}' }}; \
            if ($added.Count -gt 0) {{ \
                $newP = ($paths + $added) -join ';'; \
                [Environment]::SetEnvironmentVariable('Path', $newP, 'User'); \
            }}",
            hermes_str, local_str
        )
    } else {
        format!(
            "$p = [Environment]::GetEnvironmentVariable('Path', 'User'); \
            $paths = $p -split ';' | Where-Object {{ $_ -and $_ -ne '{0}' -and $_ -ne '{1}' }}; \
            $newP = $paths -join ';'; \
            [Environment]::SetEnvironmentVariable('Path', $newP, 'User');",
            hermes_str, local_str
        )
    };

    let _ = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output();

    Ok(())
}

#[tauri::command]
pub fn set_global_cli_commands(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;

    #[cfg(unix)]
    {
        sync_unix_symlinks(&home, enabled)?;
        update_shell_config_path(&home, enabled)?;
    }

    #[cfg(windows)]
    {
        sync_windows_path(&home, enabled)?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_global_cli_commands_status(app: tauri::AppHandle) -> Result<bool, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;

    #[cfg(unix)]
    {
        let local_bin_hermes = home.join(".local").join("bin").join("hermes");
        if local_bin_hermes.exists() || local_bin_hermes.symlink_metadata().is_ok() {
            return Ok(true);
        }
        for rc_name in [".zshrc", ".bashrc", ".profile"] {
            let rc_path = home.join(rc_name);
            if let Ok(content) = std::fs::read_to_string(&rc_path) {
                if content.contains(FRUGALLM_PATH_BLOCK_START) {
                    return Ok(true);
                }
            }
        }
    }

    #[cfg(windows)]
    {
        let script = "[Environment]::GetEnvironmentVariable('Path', 'User')";
        if let Ok(output) = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains(".hermes\\bin") || stdout.contains(".local\\bin") {
                return Ok(true);
            }
        }
    }

    Ok(false)
}

#[tauri::command]
pub fn is_wipe_mode() -> bool {
    std::env::args().any(|arg| arg == "--wipe")
}

pub fn check_mock_update_arg(mut args: impl Iterator<Item = String>) -> bool {
    if std::env::var("MOCK_UPDATE")
        .map(|v| v == "1" || v == "true")
        .unwrap_or(false)
        || std::env::var("FRUGALLM_MOCK_UPDATE")
            .map(|v| v == "1" || v == "true")
            .unwrap_or(false)
    {
        return true;
    }
    args.any(|arg| arg == "--mockUpdate" || arg == "--mock-update")
}

#[tauri::command]
pub fn is_mock_update_mode() -> bool {
    check_mock_update_arg(std::env::args())
}
