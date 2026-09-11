use std::sync::Arc;
use tauri::{Manager, State, Emitter};
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

#[tauri::command(async)]
pub async fn check_ollama_status() -> bool {
    // 1. Check if it's currently running via its local API
    if reqwest::get("http://127.0.0.1:11434/api/version").await.is_ok() {
        return true;
    }

    // 2. Check if the binary is found and executes successfully
    let bin = get_ollama_binary();
    if bin.exists() || bin.file_name().is_some() {
        if std::process::Command::new(&bin)
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
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
            "/Applications/Ollama.app"
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
            if let Ok(output) = tokio::process::Command::new(&opencode_bin).arg("--version").output().await {
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
        let _ = tokio::process::Command::new("taskkill").args(["/F", "/IM", "ollama.exe", "/T"]).output().await;
        let _ = tokio::process::Command::new("taskkill").args(["/F", "/IM", "ollama app.exe", "/T"]).output().await;
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let p = std::path::PathBuf::from(local_app_data).join("Programs").join("Ollama");
            let _ = tokio::fs::remove_dir_all(&p).await;
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
            std::fs::write(&soul_path, &soul_content).map_err(|e| e.to_string())?;
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
                let _ = std::fs::write(win_hermes_dir.join("soul.md"), &soul_content);
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
        
        std::fs::write(&config_path, serde_json::to_string_pretty(&config_content).unwrap()).map_err(|e| e.to_string())?;
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
        use tokio::io::AsyncWriteExt;
        let temp_dir = std::env::temp_dir();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let installer_path = temp_dir.join(format!("OllamaSetup_{}_{}.exe", std::process::id(), timestamp));
        
        log_event(app, "INFO", "OLLAMA", &format!("Downloading Ollama Windows installer from ollama.com to {:?}", installer_path));
        
        let client = reqwest::Client::new();
        let mut response = client.get("https://ollama.com/download/OllamaSetup.exe")
            .send()
            .await
            .map_err(|e| {
                let err = format!("Failed to download Ollama installer: {}", e);
                log_event(app, "ERROR", "OLLAMA", &err);
                err
            })?;
        
        if !response.status().is_success() {
            let err = format!("Failed to download Ollama installer: HTTP {}", response.status());
            log_event(app, "ERROR", "OLLAMA", &err);
            return Err(err);
        }

        // Scope the file handle so it is fully flushed, shut down, and dropped before executing.
        // In Windows, attempting to execute a binary with an active write handle fails with
        // ERROR_SHARING_VIOLATION (os error 32).
        {
            let mut file = tokio::fs::File::create(&installer_path).await.map_err(|e| {
                let err = format!("Failed to create temporary installer file {:?}: {}", installer_path, e);
                log_event(app, "ERROR", "OLLAMA", &err);
                err
            })?;
            while let Some(chunk) = response.chunk().await.map_err(|e| {
                let err = format!("Error reading installer download stream: {}", e);
                log_event(app, "ERROR", "OLLAMA", &err);
                err
            })? {
                file.write_all(&chunk).await.map_err(|e| {
                    let err = format!("Error writing installer data to disk: {}", e);
                    log_event(app, "ERROR", "OLLAMA", &err);
                    err
                })?;
            }
            file.flush().await.map_err(|e| {
                let err = format!("Failed to flush installer file: {}", e);
                log_event(app, "ERROR", "OLLAMA", &err);
                err
            })?;
            let _ = file.shutdown().await;
        }

        log_event(app, "INFO", "OLLAMA", &format!("Running silent installer at {:?}", installer_path));

        let status = tokio::process::Command::new(&installer_path)
            .args(["/VERYSILENT", "/NORESTART", "/CLOSEAPPLICATIONS", "/SUPPRESSMSGBOXES"])
            .status()
            .await
            .map_err(|e| {
                let err = format!("Failed to execute Ollama installer: {}", e);
                log_event(app, "ERROR", "OLLAMA", &err);
                err
            })?;

        let _ = tokio::fs::remove_file(&installer_path).await;

        if !status.success() {
            let err = format!("Ollama installer exited with error code: {:?}", status.code());
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

    if client.get("http://127.0.0.1:11434/api/tags").send().await.is_ok() {
        log_event(app, "INFO", "OLLAMA", "Ollama daemon already responding on port 11434");
        let _ = app.emit("download_progress", DownloadProgress {
            status: "Ollama daemon already running.".to_string(),
        });
        return Ok(());
    }

    let ollama_bin = get_ollama_binary();
    log_event(app, "INFO", "OLLAMA", &format!("Spawning Ollama daemon with binary {:?}", ollama_bin));

    // Spawn daemon in background — pipe stderr so we can stream boot logs
    let mut child = tokio::process::Command::new(ollama_bin)
        .arg("serve")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(false)
        .spawn()
        .map_err(|e| {
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
    // This prevents tokio from reaping or signaling the process when the handle is dropped.
    {
        let mut guard = daemon_state.child.lock().await;
        *guard = Some(child);
    }

    // Poll for readiness — 500ms intervals, 10s timeout
    let _ = app.emit("download_progress", DownloadProgress {
        status: "Waiting for Ollama daemon to start...".to_string(),
    });

    for i in 0..20 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        if client.get("http://127.0.0.1:11434/api/tags").send().await.is_ok() {
            log_event(app, "INFO", "OLLAMA", &format!("Ollama daemon ready ({}ms)", (i + 1) * 500));
            let _ = app.emit("download_progress", DownloadProgress {
                status: format!("Ollama daemon ready ({}ms).", (i + 1) * 500),
            });

            // Boot buffer: Ollama's GPU discovery on macOS takes additional time
            // after the HTTP endpoint is live. Wait 2s before issuing model commands.
            let _ = app.emit("download_progress", DownloadProgress {
                status: "Waiting for GPU backend initialization...".to_string(),
            });
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;

            return Ok(());
        }
    }

    let err = "Timed out waiting for Ollama daemon to start after 10 seconds".to_string();
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

        let ollama_bin = get_ollama_binary();
        log_event(&app_clone, "INFO", "OLLAMA", &format!("Creating frugallm-active model using binary {:?}", ollama_bin));
        let child_res = tokio::process::Command::new(ollama_bin)
            .current_dir(&models_dir)
            .arg("create")
            .arg("frugallm-active")
            .arg("-f")
            .arg("./Modelfile")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn();

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
                log_event(&app_clone, "INFO", "OLLAMA", "frugallm-active model created successfully. Pre-warming model...");
                // Hot loading dummy API call
                let client = reqwest::Client::new();
                let hot_load_payload = serde_json::json!({
                    "model": "frugallm-active",
                    "prompt": "",
                    "keep_alive": -1
                });
                
                let _ = client.post("http://127.0.0.1:11434/api/generate")
                    .json(&hot_load_payload)
                    .send()
                    .await;

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


