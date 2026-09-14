use std::sync::Arc;
use tauri::{Manager, State, Emitter};
use crate::state::*;
use crate::proxy::*;
use crate::commands::*;


pub fn get_hermes_source_path(home: &std::path::Path) -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let home_local_appdata = home.join("AppData").join("Local");
        let win_bin = home_local_appdata.join("hermes").join("bin");
        let cmd = win_bin.join("hermes.cmd");
        if cmd.exists() {
            return Some(cmd);
        }
        let exe = win_bin.join("hermes.exe");
        if exe.exists() {
            return Some(exe);
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

    let is_live_home = if cfg!(windows) {
        std::env::var_os("USERPROFILE")
            .map(|u| std::path::PathBuf::from(u) == home)
            .unwrap_or(true)
    } else {
        std::env::var_os("HOME")
            .map(|h| std::path::PathBuf::from(h) == home)
            .unwrap_or(true)
    };

    if is_live_home {
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
    #[cfg(target_os = "windows")]
    {
        let home_local_appdata = home.join("AppData").join("Local");
        let p_app = home_local_appdata.join("Programs").join("opencode").join("opencode.exe");
        if p_app.exists() {
            return Some(p_app);
        }
        let p_cmd = home_local_appdata.join("Programs").join("opencode").join("opencode.cmd");
        if p_cmd.exists() {
            return Some(p_cmd);
        }
        let home_roaming_npm = home.join("AppData").join("Roaming").join("npm");
        let p_npm_cmd = home_roaming_npm.join("opencode.cmd");
        if p_npm_cmd.exists() {
            return Some(p_npm_cmd);
        }
        let p_npm_exe = home_roaming_npm.join("opencode.exe");
        if p_npm_exe.exists() {
            return Some(p_npm_exe);
        }
    }
    let p1 = home.join(".local").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" });
    if p1.exists() {
        return Some(p1);
    }
    #[cfg(target_os = "windows")]
    {
        let p1_cmd = home.join(".local").join("bin").join("opencode.cmd");
        if p1_cmd.exists() {
            return Some(p1_cmd);
        }
    }
    let p2 = home.join(".opencode").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" });
    if p2.exists() {
        return Some(p2);
    }
    #[cfg(target_os = "windows")]
    {
        let p2_cmd = home.join(".opencode").join("bin").join("opencode.cmd");
        if p2_cmd.exists() {
            return Some(p2_cmd);
        }
    }
    let p3 = home.join(".cargo").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" });
    if p3.exists() {
        return Some(p3);
    }
    #[cfg(target_os = "windows")]
    {
        let p3_cmd = home.join(".cargo").join("bin").join("opencode.cmd");
        if p3_cmd.exists() {
            return Some(p3_cmd);
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

    let is_live_home = if cfg!(windows) {
        std::env::var_os("USERPROFILE")
            .map(|u| std::path::PathBuf::from(u) == home)
            .unwrap_or(true)
    } else {
        std::env::var_os("HOME")
            .map(|h| std::path::PathBuf::from(h) == home)
            .unwrap_or(true)
    };

    if is_live_home {
        #[cfg(target_os = "windows")]
        {
            if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                let p_app = std::path::PathBuf::from(&local_app_data).join("Programs").join("opencode").join("opencode.exe");
                if p_app.exists() {
                    return Some(p_app);
                }
                let p_cmd = std::path::PathBuf::from(&local_app_data).join("Programs").join("opencode").join("opencode.cmd");
                if p_cmd.exists() {
                    return Some(p_cmd);
                }
            }
            if let Ok(app_data) = std::env::var("APPDATA") {
                let p_npm_cmd = std::path::PathBuf::from(&app_data).join("npm").join("opencode.cmd");
                if p_npm_cmd.exists() {
                    return Some(p_npm_cmd);
                }
                let p_npm_exe = std::path::PathBuf::from(&app_data).join("npm").join("opencode.exe");
                if p_npm_exe.exists() {
                    return Some(p_npm_exe);
                }
            }
        }

        if let Some(path_var) = std::env::var_os("PATH") {
            for dir in std::env::split_paths(&path_var) {
                #[cfg(target_os = "windows")]
                {
                    let cmd = dir.join("opencode.cmd");
                    if cmd.exists() {
                        return Some(cmd);
                    }
                    let exe = dir.join("opencode.exe");
                    if exe.exists() {
                        return Some(exe);
                    }
                }
                let bin = dir.join("opencode");
                if bin.exists() {
                    return Some(bin);
                }
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
            #[cfg(target_os = "windows")]
            {
                cmd.creation_flags(0x08000000);
            }
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
            #[cfg(target_os = "windows")]
            {
                cmd.creation_flags(0x08000000);
            }
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
    // 1. Kill daemon child process if managed by app
    let daemon_state = app.state::<OllamaDaemonState>();
    let mut child_guard = daemon_state.child.lock().await;
    if let Some(mut child) = child_guard.take() {
        let _ = child.kill().await;
    }

    // 2. Terminate system-wide Ollama processes
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
        let mut kill = tokio::process::Command::new("taskkill");
        kill.args(["/F", "/T", "/IM", "ollama app.exe", "/IM", "ollama.exe", "/IM", "ollama_llama_server.exe"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .creation_flags(0x08000000);
        let _ = kill.output().await;

        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let p = std::path::PathBuf::from(&local_app_data).join("Programs").join("Ollama");
            let _ = tokio::fs::remove_dir_all(&p).await;
            let p_data = std::path::PathBuf::from(&local_app_data).join("Ollama");
            let _ = tokio::fs::remove_dir_all(&p_data).await;
        }
    }

    // 3. Remove application binaries and model directories
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

    if let Ok(home) = app.path().home_dir() {
        let ollama_home = home.join(".ollama");
        let _ = tokio::fs::remove_dir_all(&ollama_home).await;
        let _ = tokio::process::Command::new("rm").args(["-rf", &ollama_home.to_string_lossy()]).output().await;
    }

    if let Ok(app_dir) = app.path().app_data_dir() {
        let models_dir = app_dir.join("models");
        let _ = tokio::fs::remove_dir_all(&models_dir).await;
    }

    log_event(&app, "INFO", "OLLAMA", "Ollama uninstalled and associated processes terminated");

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
        let _ = std::fs::remove_file(home.join(".cargo").join("bin").join("opencode.cmd"));
        let _ = std::fs::remove_dir_all(home.join("AppData").join("Local").join("Programs").join("opencode"));
        let _ = std::fs::remove_dir_all(home.join("AppData").join("Roaming").join("opencode"));
        let npm_home = home.join("AppData").join("Roaming").join("npm");
        let _ = std::fs::remove_file(npm_home.join("opencode.exe"));
        let _ = std::fs::remove_file(npm_home.join("opencode.cmd"));
        let _ = std::fs::remove_file(npm_home.join("opencode"));
        let _ = std::fs::remove_dir_all(npm_home.join("node_modules").join("opencode"));
        let _ = std::fs::remove_dir_all(npm_home.join("node_modules").join("opencode-ai"));

        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let _ = std::fs::remove_dir_all(std::path::PathBuf::from(local_app_data).join("Programs").join("opencode"));
        }
        if let Ok(app_data) = std::env::var("APPDATA") {
            let p_appdata = std::path::PathBuf::from(app_data);
            let _ = std::fs::remove_dir_all(p_appdata.join("opencode"));
            let p_npm = p_appdata.join("npm");
            let _ = std::fs::remove_file(p_npm.join("opencode.exe"));
            let _ = std::fs::remove_file(p_npm.join("opencode.cmd"));
            let _ = std::fs::remove_file(p_npm.join("opencode"));
            let _ = std::fs::remove_dir_all(p_npm.join("node_modules").join("opencode"));
            let _ = std::fs::remove_dir_all(p_npm.join("node_modules").join("opencode-ai"));
        }
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
        let mut kill = tokio::process::Command::new("taskkill");
        kill.args(["/F", "/IM", "opencode.exe", "/T"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .creation_flags(0x08000000);
        let _ = kill.output().await;
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
            let local_cmd = home.join(".local").join("bin").join("opencode.cmd");
            let _ = tokio::fs::remove_file(&local_cmd).await;
            let cargo_cmd = home.join(".cargo").join("bin").join("opencode.cmd");
            let _ = tokio::fs::remove_file(&cargo_cmd).await;
            let home_opencode = home.join("AppData").join("Local").join("Programs").join("opencode");
            let _ = tokio::fs::remove_dir_all(&home_opencode).await;
            let home_roaming_opencode = home.join("AppData").join("Roaming").join("opencode");
            let _ = tokio::fs::remove_dir_all(&home_roaming_opencode).await;
            let npm_home = home.join("AppData").join("Roaming").join("npm");
            let _ = tokio::fs::remove_file(npm_home.join("opencode.exe")).await;
            let _ = tokio::fs::remove_file(npm_home.join("opencode.cmd")).await;
            let _ = tokio::fs::remove_file(npm_home.join("opencode")).await;
            let _ = tokio::fs::remove_dir_all(npm_home.join("node_modules").join("opencode")).await;
            let _ = tokio::fs::remove_dir_all(npm_home.join("node_modules").join("opencode-ai")).await;
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let prog_opencode = std::path::PathBuf::from(local_app_data).join("Programs").join("opencode");
            let _ = tokio::fs::remove_dir_all(&prog_opencode).await;
        }
        if let Ok(app_data) = std::env::var("APPDATA") {
            let p_appdata = std::path::PathBuf::from(app_data);
            let roaming_opencode = p_appdata.join("opencode");
            let _ = tokio::fs::remove_dir_all(&roaming_opencode).await;
            let npm_dir = p_appdata.join("npm");
            let _ = tokio::fs::remove_file(npm_dir.join("opencode.exe")).await;
            let _ = tokio::fs::remove_file(npm_dir.join("opencode.cmd")).await;
            let _ = tokio::fs::remove_file(npm_dir.join("opencode")).await;
            let _ = tokio::fs::remove_dir_all(npm_dir.join("node_modules").join("opencode")).await;
            let _ = tokio::fs::remove_dir_all(npm_dir.join("node_modules").join("opencode-ai")).await;
        }
        let mut npm_uninstall = tokio::process::Command::new("cmd.exe");
        npm_uninstall.args(["/C", "npm", "uninstall", "-g", "opencode", "opencode-ai"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .creation_flags(0x08000000);
        let _ = npm_uninstall.output().await;
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
        let mut kill = tokio::process::Command::new("taskkill");
        kill.args(["/F", "/IM", "hermes.exe", "/T"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .creation_flags(0x08000000);
        let _ = kill.output().await;
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
        #[cfg(target_os = "windows")]
        {
            let local_cmd = home.join(".local").join("bin").join("hermes.cmd");
            let _ = tokio::fs::remove_file(&local_cmd).await;
            let home_local_hermes = home.join("AppData").join("Local").join("hermes");
            let _ = tokio::fs::remove_dir_all(&home_local_hermes).await;
            let home_roaming_hermes = home.join("AppData").join("Roaming").join("hermes");
            let _ = tokio::fs::remove_dir_all(&home_roaming_hermes).await;
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let win_hermes = std::path::PathBuf::from(local_app_data).join("hermes");
            let _ = tokio::fs::remove_dir_all(&win_hermes).await;
        }
        if let Ok(app_data) = std::env::var("APPDATA") {
            let win_roaming_hermes = std::path::PathBuf::from(app_data).join("hermes");
            let _ = tokio::fs::remove_dir_all(&win_roaming_hermes).await;
        }
    }

    Ok(())
}

pub async fn execute_deep_wipe(app: &tauri::AppHandle) {
    let _ = delete_local_model(app.clone()).await;
    let _ = uninstall_ollama(app.clone()).await;
    let _ = uninstall_opencode(app.clone()).await;
    let _ = uninstall_hermes(app.clone()).await;

    if let Ok(home) = app.path().home_dir() {
        wipe_opencode(&home);
        let _ = tokio::fs::remove_dir_all(home.join(".hermes")).await;
        let _ = tokio::fs::remove_dir_all(home.join(".ollama")).await;
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let p = std::path::PathBuf::from(&local_app_data);
            let _ = tokio::fs::remove_dir_all(p.join("hermes")).await;
            let _ = tokio::fs::remove_dir_all(p.join("Ollama")).await;
            let _ = tokio::fs::remove_dir_all(p.join("Programs").join("Ollama")).await;
            let _ = tokio::fs::remove_dir_all(p.join("Programs").join("opencode")).await;
        }
        if let Ok(app_data) = std::env::var("APPDATA") {
            let p = std::path::PathBuf::from(&app_data);
            let _ = tokio::fs::remove_dir_all(p.join("opencode")).await;
            let _ = tokio::fs::remove_dir_all(p.join("hermes")).await;
            let npm_dir = p.join("npm");
            let _ = tokio::fs::remove_file(npm_dir.join("opencode.exe")).await;
            let _ = tokio::fs::remove_file(npm_dir.join("opencode.cmd")).await;
            let _ = tokio::fs::remove_file(npm_dir.join("opencode")).await;
            let _ = tokio::fs::remove_dir_all(npm_dir.join("node_modules").join("opencode")).await;
            let _ = tokio::fs::remove_dir_all(npm_dir.join("node_modules").join("opencode-ai")).await;
        }
    }

    if let Ok(app_dir) = app.path().app_data_dir() {
        let _ = tokio::fs::remove_file(app_dir.join("tool_gateway_installed")).await;
        let _ = tokio::fs::remove_dir_all(app_dir.join("models")).await;
        let _ = tokio::fs::remove_file(app_dir.join("frugal_config.json")).await;
    }
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

pub fn sync_hermes_config(app: &tauri::AppHandle, port: u16, api_key: &str) -> Result<(), String> {
    let config_content = format!(
        "model:\n  default: \"frugallm\"\n  provider: \"custom\"\n  base_url: \"http://127.0.0.1:{}/v1\"\n  api_key: \"{}\"\n",
        port, api_key
    );
    let soul_content = get_default_soul_template();

    if let Ok(home) = app.path().home_dir() {
        let hermes_dir = home.join(".hermes");
        let _ = std::fs::create_dir_all(&hermes_dir);
        let _ = std::fs::write(hermes_dir.join("config.yaml"), &config_content);

        let soul_path = hermes_dir.join("soul.md");
        let soul_upper = hermes_dir.join("SOUL.md");
        if !soul_path.exists() && !soul_upper.exists() {
            let _ = std::fs::write(&soul_path, soul_content);
            log_event(app, "INFO", "HERMES", "Created default soul.md in ~/.hermes/soul.md");
        } else {
            log_event(app, "INFO", "HERMES", "soul.md already exists in ~/.hermes; preserving existing user file");
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let win_hermes_dir = std::path::PathBuf::from(local_app_data).join("hermes");
            let _ = std::fs::create_dir_all(&win_hermes_dir);
            let _ = std::fs::write(win_hermes_dir.join("config.yaml"), &config_content);
            if !win_hermes_dir.join("soul.md").exists() && !win_hermes_dir.join("SOUL.md").exists() {
                let _ = std::fs::write(win_hermes_dir.join("soul.md"), soul_content);
            }
        }
        if let Ok(app_data) = std::env::var("APPDATA") {
            let win_roaming_hermes = std::path::PathBuf::from(app_data).join("hermes");
            let _ = std::fs::create_dir_all(&win_roaming_hermes);
            let _ = std::fs::write(win_roaming_hermes.join("config.yaml"), &config_content);
            if !win_roaming_hermes.join("soul.md").exists() && !win_roaming_hermes.join("SOUL.md").exists() {
                let _ = std::fs::write(win_roaming_hermes.join("soul.md"), soul_content);
            }
        }
    }

    log_event(app, "INFO", "HERMES", &format!("Hermes default configuration synchronized to port {}", port));
    Ok(())
}

#[tauri::command]
pub async fn configure_hermes_defaults(app: tauri::AppHandle, state: tauri::State<'_, FrugalConfigState>) -> Result<(), String> {
    let (port, api_key) = {
        let config = state.config.lock().await;
        (config.port, config.api_password.clone().unwrap_or_else(|| "frugallm".to_string()))
    };
    sync_hermes_config(&app, port, &api_key)
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

pub fn sync_opencode_config(app: &tauri::AppHandle, port: u16, api_key: &str) -> Result<(), String> {
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
    let config_str = serde_json::to_string_pretty(&config_content).unwrap_or_default();

    if let Ok(home) = app.path().home_dir() {
        let config_dir = home.join(".config").join("opencode");
        let _ = std::fs::create_dir_all(&config_dir);
        let _ = std::fs::write(config_dir.join("opencode.json"), &config_str);
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(app_data) = std::env::var("APPDATA") {
            let win_config_dir = std::path::PathBuf::from(app_data).join("opencode");
            let _ = std::fs::create_dir_all(&win_config_dir);
            let _ = std::fs::write(win_config_dir.join("opencode.json"), &config_str);
        }
        if let Ok(home) = app.path().home_dir() {
            let roaming_dir = home.join("AppData").join("Roaming").join("opencode");
            let _ = std::fs::create_dir_all(&roaming_dir);
            let _ = std::fs::write(roaming_dir.join("opencode.json"), &config_str);
        }
    }

    log_event(app, "INFO", "OPENCODE", &format!("OpenCode default configuration synchronized to port {}", port));
    Ok(())
}

pub fn sync_all_agent_configs(app: &tauri::AppHandle, port: u16, api_key: &str) {
    if let Ok(home) = app.path().home_dir() {
        if is_hermes_installed(&home) {
            let _ = sync_hermes_config(app, port, api_key);
        }
        if is_opencode_installed(&home) {
            let _ = sync_opencode_config(app, port, api_key);
        }
    }
}

#[tauri::command]
pub async fn configure_opencode_defaults(app: tauri::AppHandle, state: tauri::State<'_, FrugalConfigState>) -> Result<(), String> {
    let (port, api_key) = {
        let config = state.config.lock().await;
        (config.port, config.api_password.clone().unwrap_or_else(|| "frugallm".to_string()))
    };
    sync_opencode_config(&app, port, &api_key)
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
        use tokio::io::AsyncReadExt;

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

            Get-Process -Name 'ollama app', 'ollama', 'ollama_llama_server' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue;

            $markerDir = Join-Path $env:LOCALAPPDATA 'Ollama';
            if (!(Test-Path $markerDir)) { New-Item -ItemType Directory -Path $markerDir -Force | Out-Null };
            New-Item -ItemType File -Path (Join-Path $markerDir 'upgraded') -Force | Out-Null;

            Write-Host '>>> Initializing Ollama installation for Windows...';
            $tempInstaller = Join-Path $env:TEMP ('OllamaSetup_' + (Get-Random) + '.exe');
            try {
                Write-Host '>>> [1/4] Downloading Ollama installer from ollama.com...';
                $oldEap = $ErrorActionPreference;
                $ErrorActionPreference = 'Continue';
                $installerUrl = 'https://ollama.com/download/OllamaSetup.exe';
                curl.exe -# -L --fail -o "$tempInstaller" "$installerUrl";
                $curlExit = $LASTEXITCODE;
                $ErrorActionPreference = $oldEap;
                if ($curlExit -ne 0 -or !(Test-Path "$tempInstaller")) {
                    $wc = New-Object System.Net.WebClient;
                    $wc.DownloadFile($installerUrl, "$tempInstaller");
                }
                Write-Host '';

                $proc = Start-Process -FilePath $tempInstaller -ArgumentList '/VERYSILENT /NORESTART /CLOSEAPPLICATIONS /SUPPRESSMSGBOXES' -PassThru;
                $sp = @('|', '/', '-', '\');
                $sw = [System.Diagnostics.Stopwatch]::StartNew();
                $i = 0;
                while (-not $proc.HasExited) {
                    $sec = [math]::Floor($sw.Elapsed.TotalSeconds);
                    $char = $sp[$i % 4];
                    Write-Host -NoNewline ("`r>>> [2/4] Extracting & installing Ollama engine... (" + $sec + "s elapsed) [" + $char + "]   ");
                    Start-Sleep -Milliseconds 250;
                    $i++;
                }
                $sw.Stop();
                $proc.WaitForExit();
                if ($proc.ExitCode -ne 0) {
                    throw ('Installer exited with code ' + $proc.ExitCode);
                }
                Write-Host ("`r>>> [2/4] Ollama engine extraction complete! (" + [math]::Floor($sw.Elapsed.TotalSeconds) + "s)                    ");
            } finally {
                Remove-Item -Force $tempInstaller -ErrorAction SilentlyContinue;
            }

            # Stop any background tray/daemon processes auto-spawned by the installer so start_ollama_daemon can manage the process cleanly
            Get-Process -Name 'ollama app', 'ollama', 'ollama_llama_server' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue;

            $ollamaProgDir = Join-Path $env:LOCALAPPDATA 'Programs\Ollama';
            if (Test-Path $ollamaProgDir) {
                $userPath = [Environment]::GetEnvironmentVariable('Path', 'User');
                if ($userPath -notlike ('*' + $ollamaProgDir + '*')) {
                    [Environment]::SetEnvironmentVariable('Path', ($ollamaProgDir + ';' + $userPath), 'User');
                }
            }
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
        if let Some(mut stdout) = child.stdout.take() {
            let app_inner = app_clone.clone();
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                while let Ok(n) = stdout.read(&mut buf).await {
                    if n == 0 { break; }
                    let s = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_inner.emit("download_progress", DownloadProgress { status: s });
                }
            });
        }

        if let Some(mut stderr) = child.stderr.take() {
            let app_inner = app_clone;
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                while let Ok(n) = stderr.read(&mut buf).await {
                    if n == 0 { break; }
                    let s = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_inner.emit("download_progress", DownloadProgress { status: s });
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
        .timeout(std::time::Duration::from_secs(1))
        .build()
        .map_err(|e| e.to_string())?;

    if client.get("http://127.0.0.1:11434/api/version").send().await.is_ok()
        || client.get("http://127.0.0.1:11434/api/tags").send().await.is_ok()
    {
        log_event(app, "INFO", "OLLAMA", "Ollama daemon already responding on port 11434");
        let _ = app.emit("download_progress", DownloadProgress {
            status: ">>> Ollama daemon already running.\r\n".to_string(),
        });
        return Ok(());
    }

    let ollama_bin = get_ollama_binary();
    if !ollama_bin.exists() && !check_ollama_status().await {
        log_event(app, "INFO", "OLLAMA", "Ollama is not installed; skipping background daemon startup");
        return Ok(());
    }
    log_event(app, "INFO", "OLLAMA", &format!("Spawning Ollama daemon with binary {:?}", ollama_bin));

    // Redirect daemon stdout and stderr to server.log to suppress raw Go/route log bleed
    #[cfg(target_os = "windows")]
    let server_log_path = {
        let dir = std::env::var("LOCALAPPDATA")
            .map(|l| std::path::PathBuf::from(l).join("Ollama"))
            .unwrap_or_else(|_| std::env::temp_dir());
        let _ = std::fs::create_dir_all(&dir);
        dir.join("server.log")
    };
    #[cfg(not(target_os = "windows"))]
    let server_log_path = {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let dir = std::path::PathBuf::from(home).join(".ollama");
        let _ = std::fs::create_dir_all(&dir);
        dir.join("server.log")
    };

    let log_file = std::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .append(true)
        .open(&server_log_path);

    let (stdout_cfg, stderr_cfg) = match log_file {
        Ok(f) => {
            let stderr_f = f.try_clone().ok();
            (
                std::process::Stdio::from(f),
                stderr_f.map(std::process::Stdio::from).unwrap_or_else(std::process::Stdio::null),
            )
        }
        Err(_) => (std::process::Stdio::null(), std::process::Stdio::null()),
    };

    let mut cmd = tokio::process::Command::new(ollama_bin);
    cmd.arg("serve")
        .stdout(stdout_cfg)
        .stderr(stderr_cfg)
        .kill_on_drop(false);
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000);
    }
    let child = cmd.spawn().map_err(|e| {
        let err = format!("Failed to spawn Ollama daemon: {}", e);
        log_event(app, "ERROR", "OLLAMA", &err);
        err
    })?;

    // Store the child handle in application state so it lives for the entire app lifetime.
    // This prevents tokio from reaping or signaling the process when the handle is dropped.
    {
        let mut guard = daemon_state.child.lock().await;
        *guard = Some(child);
    }

    // Healthcheck against Ollama API with active in-terminal spinner and 120s total timeout
    // (Cold boot on Windows with modern discrete GPUs such as RTX 50-series Blackwell / CUDA 12/13
    // can take 60-90s for library extraction and GPU discovery).
    let spinner_chars = ['|', '/', '-', '\\'];
    let max_sec: u64 = 120;
    let mut is_ready = false;
    let start_time = std::time::Instant::now();
    let mut i: usize = 0;

    while start_time.elapsed().as_secs() < max_sec {
        let sec = start_time.elapsed().as_secs();
        let char = spinner_chars[i % spinner_chars.len()];
        let status_msg = format!("\r>>> [3/4] Initializing daemon & GPU discovery... ({}s/{}s) [{}]   ", sec, max_sec, char);
        let _ = app.emit("download_progress", DownloadProgress {
            status: status_msg,
        });

        if let Ok(res) = client.get("http://127.0.0.1:11434/api/version").send().await {
            if res.status().is_success() {
                is_ready = true;
                break;
            }
        } else if let Ok(res) = client.get("http://127.0.0.1:11434/").send().await {
            if res.status().is_success() {
                is_ready = true;
                break;
            }
        }

        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        i += 1;
    }

    if is_ready {
        let elapsed_sec = start_time.elapsed().as_secs();
        log_event(app, "INFO", "OLLAMA", "Ollama daemon online and ready");
        let _ = app.emit("download_progress", DownloadProgress {
            status: format!(
                "\r>>> [3/4] Ollama daemon is online and responsive! ({}s)                    \r\n>>> [4/4] Ollama setup completed successfully! Ready for use.\r\n\r\n",
                elapsed_sec
            ),
        });

        // Boot buffer: Ollama's GPU discovery on macOS/Windows takes additional time
        // after the HTTP endpoint is live. Wait 2s before issuing model commands.
        let _ = app.emit("download_progress", DownloadProgress {
            status: ">>> Waiting for GPU backend initialization...\r\n".to_string(),
        });
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        return Ok(());
    }

    let err = format!("Timed out waiting for Ollama daemon to start after {} seconds", max_sec);
    log_event(app, "ERROR", "OLLAMA", &err);
    let _ = app.emit("download_progress", DownloadProgress {
        status: format!("\r\n>>> [ERROR] Ollama daemon failed to respond within {} seconds.\r\n", max_sec),
    });
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
    if !models_dir.exists() {
        std::fs::create_dir_all(&models_dir).map_err(|e| e.to_string())?;
    }

    // Generate Modelfile
    let modelfile_path = models_dir.join("Modelfile");
    let modelfile_content = format!("FROM {}\nPARAMETER num_ctx 131072\n", tag);
    log_event(&app, "INFO", "OLLAMA", &format!("Writing Modelfile to {:?}", modelfile_path));
    std::fs::write(&modelfile_path, modelfile_content).map_err(|e| e.to_string())?;

    let app_clone = app.clone();
    let tag_clone = tag.clone();
    tauri::async_runtime::spawn(async move {
        let _ = app_clone.emit("model_provisioning_started", ());
        log_event(&app_clone, "INFO", "OLLAMA", &format!("Pulling model {} from Ollama registry", tag_clone));

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
                while let Ok(Some(chunk)) = res.chunk().await {
                    buffer.extend_from_slice(&chunk);
                    while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
                        let line = buffer.drain(..pos).collect::<Vec<_>>();
                        buffer.remove(0); // remove the '\n'
                        if let Ok(text) = String::from_utf8(line) {
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                                if let Some(err_val) = json.get("error") {
                                    if let Some(err_msg) = err_val.as_str() {
                                        log_event(&app_clone, "ERROR", "OLLAMA", &format!("Ollama pull error: {}", err_msg));
                                        let _ = app_clone.emit("model_deployment_complete", DeploymentResult { success: false, message: err_msg.to_string() });
                                        return;
                                    }
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
            }
            Err(e) => {
                log_event(&app_clone, "ERROR", "OLLAMA", &format!("API pull failed: {}", e));
                let _ = app_clone.emit("model_deployment_complete", DeploymentResult { success: false, message: format!("API pull failed: {}", e) });
                return;
            }
        }

        // Stage 2: Verification Gate - poll /api/tags to ensure base model is present locally
        log_event(&app_clone, "INFO", "OLLAMA", &format!("Stage 2: Verifying downloaded base model {} is registered in Ollama", tag_clone));
        let mut model_verified = false;
        for attempt in 1..=30 {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            if let Ok(tags_res) = client.get("http://127.0.0.1:11434/api/tags").send().await {
                if let Ok(tags_json) = tags_res.json::<serde_json::Value>().await {
                    if let Some(models) = tags_json.get("models").and_then(|m| m.as_array()) {
                        for m in models {
                            let name = m.get("name").and_then(|n| n.as_str()).unwrap_or("");
                            let model_name = m.get("model").and_then(|n| n.as_str()).unwrap_or("");
                            if name == tag_clone || name.starts_with(&format!("{}:", tag_clone)) || model_name == tag_clone || name.contains(&tag_clone) {
                                model_verified = true;
                                break;
                            }
                        }
                    }
                }
            }
            if model_verified {
                log_event(&app_clone, "INFO", "OLLAMA", &format!("Stage 2: Base model {} verified in local tags on attempt {}", tag_clone, attempt));
                break;
            }
        }
        if !model_verified {
            log_event(&app_clone, "WARN", "OLLAMA", &format!("Stage 2: Base model {} not yet detected in tags after 15s; proceeding with creation attempt", tag_clone));
        }

        // Stage 3: Modelfile Build
        let ollama_bin = get_ollama_binary();
        let modelfile_path_str = if cfg!(windows) {
            modelfile_path.to_string_lossy().replace('\\', "/")
        } else {
            modelfile_path.to_string_lossy().to_string()
        };
        log_event(&app_clone, "INFO", "OLLAMA", &format!("Stage 3: Creating frugallm-active model using binary {:?} and Modelfile {:?}", ollama_bin, modelfile_path_str));
        let mut cmd = tokio::process::Command::new(ollama_bin);
        cmd.current_dir(&models_dir)
            .arg("create")
            .arg("frugallm-active")
            .arg("-f")
            .arg(&modelfile_path_str)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        #[cfg(target_os = "windows")]
        {
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
                log_event(&app_clone, "INFO", "OLLAMA", "Stage 4: frugallm-active created successfully. Pre-warming and locking in VRAM for 60m...");
                let client = reqwest::Client::new();
                let warmup_payload = serde_json::json!({
                    "model": "frugallm-active",
                    "prompt": "hi",
                    "keep_alive": "60m"
                });
                
                let warmup_res = client.post("http://127.0.0.1:11434/api/generate")
                    .json(&warmup_payload)
                    .send()
                    .await;

                match warmup_res {
                    Ok(res) if res.status().is_success() => {
                        log_event(&app_clone, "INFO", "OLLAMA", "Warmup successful, frugallm-active locked in VRAM");
                    },
                    Ok(res) => {
                        log_event(&app_clone, "WARN", "OLLAMA", &format!("Warmup returned non-success status: {}", res.status()));
                    },
                    Err(e) => {
                        log_event(&app_clone, "WARN", "OLLAMA", &format!("Warmup request error: {}", e));
                    }
                }

                log_event(&app_clone, "INFO", "OLLAMA", "Local model deployment complete and ready for inference");
                let _ = app_clone.emit("model_deployment_complete", DeploymentResult { success: true, message: "Success".to_string() });
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

#[tauri::command(async)]
pub async fn delete_local_model(app: tauri::AppHandle) -> Result<(), String> {
    log_event(&app, "INFO", "OLLAMA", "delete_local_model requested: evicting VRAM and removing local model tags");
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let mut tags_to_delete: Vec<String> = vec![
        "frugallm-active".to_string(),
        "frugallm-active:latest".to_string(),
    ];

    // Read base tag from Modelfile before removing
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let modelfile_path = app_data_dir.join("models").join("Modelfile");
        if let Ok(content) = tokio::fs::read_to_string(&modelfile_path).await {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("FROM ") {
                    let base_tag = trimmed.trim_start_matches("FROM ").trim();
                    if !base_tag.is_empty() && !tags_to_delete.contains(&base_tag.to_string()) {
                        tags_to_delete.push(base_tag.to_string());
                    }
                }
            }
        }
    }

    // Inspect live /api/tags to identify any installed gemma4 or active models
    if let Ok(tags_res) = client.get("http://127.0.0.1:11434/api/tags").send().await {
        if let Ok(json) = tags_res.json::<serde_json::Value>().await {
            if let Some(models) = json.get("models").and_then(|m| m.as_array()) {
                for m in models {
                    let name = m.get("name").and_then(|n| n.as_str()).unwrap_or("");
                    let model_name = m.get("model").and_then(|n| n.as_str()).unwrap_or("");
                    for candidate in [name, model_name] {
                        if (candidate.contains("frugallm-active") || candidate.contains("gemma4")) && !candidate.is_empty() {
                            if !tags_to_delete.contains(&candidate.to_string()) {
                                tags_to_delete.push(candidate.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    // 1. Immediate VRAM Eviction
    for tag in &tags_to_delete {
        log_event(&app, "INFO", "OLLAMA", &format!("Evicting {} from VRAM (keep_alive: 0)", tag));
        let unload_payload = serde_json::json!({
            "model": tag,
            "keep_alive": 0
        });
        let _ = client.post("http://127.0.0.1:11434/api/generate")
            .json(&unload_payload)
            .send()
            .await;
    }

    // 2. Complete Tag Removal
    for tag in &tags_to_delete {
        log_event(&app, "INFO", "OLLAMA", &format!("Deleting tag {} from Ollama", tag));
        let delete_payload = serde_json::json!({
            "model": tag,
            "name": tag
        });
        let _ = client.request(reqwest::Method::DELETE, "http://127.0.0.1:11434/api/delete")
            .json(&delete_payload)
            .send()
            .await;
    }

    // 3. Disk Cleanup: delete Modelfile
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let modelfile_path = app_data_dir.join("models").join("Modelfile");
        let _ = tokio::fs::remove_file(&modelfile_path).await;
        let models_dir = app_data_dir.join("models");
        let _ = tokio::fs::remove_dir(&models_dir).await;
    }

    log_event(&app, "INFO", "OLLAMA", "Local model tags deleted and VRAM evicted successfully");
    Ok(())
}



