// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod telemetry;
mod model_db;
#[cfg(test)]
mod test_restart;

pub use telemetry::{HardwareProfile, MemorySegments, TelemetryPayload};

use std::env;
#[cfg(not(debug_assertions))]
use keyring::Entry;
use tauri::{Manager, State, Emitter};
use std::sync::{Arc, Mutex};

/// Holds the `ollama serve` child process for the lifetime of the application.
/// Stored in Tauri managed state so the handle is never dropped or leaked.
struct OllamaDaemonState {
    child: tokio::sync::Mutex<Option<tokio::process::Child>>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
pub struct CloudModel {
    pub model: String,
    pub provider: String,
    #[serde(default)]
    pub iq: f32,
}

struct DynamicRosterState {
    fallback_chain: Arc<tokio::sync::RwLock<Vec<CloudModel>>>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(default)]
pub struct FrugalConfig {
    pub port: u16,
    pub bind_all_interfaces: bool,
    pub api_password: Option<String>,
    pub input_tokens_session: u64,
    pub output_tokens_session: u64,
    pub input_tokens_lifetime: u64,
    pub output_tokens_lifetime: u64,
    pub opencode_workspace: Option<String>,
    pub hermes_workspace: Option<String>,
    #[serde(default)]
    pub start_minimized: bool,
    #[serde(default)]
    pub manual_model_overrides: Vec<String>,
    #[serde(default)]
    pub tool_enforcing_gateway: bool,
}

impl Default for FrugalConfig {
    fn default() -> Self {
        Self {
            port: 61721,
            bind_all_interfaces: false,
            api_password: None,
            input_tokens_session: 0,
            output_tokens_session: 0,
            input_tokens_lifetime: 0,
            output_tokens_lifetime: 0,
            opencode_workspace: Some("~/OpenCode".to_string()),
            hermes_workspace: Some("~/Hermes".to_string()),
            start_minimized: false,
            manual_model_overrides: Vec::new(),
            tool_enforcing_gateway: false,
        }
    }
}

pub struct FrugalConfigState {
    pub config: std::sync::Arc<tokio::sync::Mutex<FrugalConfig>>,
    pub server_abort_handle: std::sync::Arc<tokio::sync::Mutex<Option<tauri::async_runtime::JoinHandle<()>>>>,
    pub is_dirty: std::sync::Arc<std::sync::atomic::AtomicBool>,
}

#[derive(serde::Serialize)]
struct LaunchOptions {
    openrouter_key: Option<String>,
    local_llm_ip: Option<String>,
}

struct PtyState {
    writer: Arc<Mutex<std::collections::HashMap<String, Box<dyn std::io::Write + Send>>>>,
    master: Arc<Mutex<std::collections::HashMap<String, Box<dyn portable_pty::MasterPty + Send>>>>,
}

impl Default for PtyState {
    fn default() -> Self {
        Self {
            writer: Arc::new(Mutex::new(std::collections::HashMap::new())),
            master: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }
}

#[tauri::command]
fn get_launch_options() -> LaunchOptions {
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
fn set_credential(service: &str, secret: &str) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        let key = format!("{}_KEY", service.to_uppercase());
        let current_dir = std::env::current_dir().unwrap_or_default();
        let env_path = if current_dir.join(".env").exists() {
            current_dir.join(".env")
        } else if current_dir.join("src-tauri").join(".env").exists() {
            current_dir.join("src-tauri").join(".env")
        } else {
            current_dir.join(".env")
        };
        
        let contents = if env_path.exists() {
            std::fs::read_to_string(&env_path).unwrap_or_default()
        } else {
            String::new()
        };
        
        let mut updated = false;
        let mut new_contents = String::new();
        for line in contents.lines() {
            if line.starts_with(&format!("{}=", key)) {
                new_contents.push_str(&format!("{}={}\n", key, secret));
                updated = true;
            } else {
                new_contents.push_str(line);
                new_contents.push('\n');
            }
        }
        
        if !updated {
            new_contents.push_str(&format!("{}={}\n", key, secret));
        }
        
        std::fs::write(&env_path, new_contents).map_err(|e| e.to_string())?;
        std::env::set_var(key, secret);
        return Ok(());
    }

    #[cfg(not(debug_assertions))]
    {
        let entry = Entry::new("frugallm-app", service).map_err(|e| e.to_string())?;
        entry.set_password(secret).map_err(|e| e.to_string())?;
        return Ok(());
    }
}

#[tauri::command]
fn get_credential(service: &str) -> Result<String, String> {
    #[cfg(debug_assertions)]
    {
        let key = format!("{}_KEY", service.to_uppercase());
        if let Ok(val) = std::env::var(&key) {
            if !val.trim().is_empty() {
                return Ok(val);
            }
        }

        let current_dir = std::env::current_dir().unwrap_or_default();
        let env_candidates = [
            current_dir.join(".env"),
            current_dir.join("src-tauri").join(".env"),
            current_dir.parent().unwrap_or(&std::path::PathBuf::new()).join(".env"),
            current_dir.parent().unwrap_or(&std::path::PathBuf::new()).join("src-tauri").join(".env"),
        ];

        for env_path in &env_candidates {
            if env_path.exists() {
                if let Ok(contents) = std::fs::read_to_string(env_path) {
                    for line in contents.lines() {
                        let prefix = format!("{}=", key);
                        if let Some(stripped) = line.strip_prefix(&prefix) {
                            let val = stripped.trim().to_string();
                            if !val.is_empty() {
                                std::env::set_var(&key, &val);
                                return Ok(val);
                            }
                        }
                    }
                }
            }
        }

        return Err(format!("Credential for service '{}' not found", service));
    }

    #[cfg(not(debug_assertions))]
    {
        let entry = Entry::new("frugallm-app", service).map_err(|e| e.to_string())?;
        return entry.get_password().map_err(|e| e.to_string());
    }
}

#[tauri::command]
fn delete_credential(service: &str) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        let key = format!("{}_KEY", service.to_uppercase());
        std::env::remove_var(&key);

        let current_dir = std::env::current_dir().unwrap_or_default();
        let env_candidates = [
            current_dir.join(".env"),
            current_dir.join("src-tauri").join(".env"),
            current_dir.parent().unwrap_or(&std::path::PathBuf::new()).join(".env"),
            current_dir.parent().unwrap_or(&std::path::PathBuf::new()).join("src-tauri").join(".env"),
        ];

        for env_path in &env_candidates {
            if env_path.exists() {
                if let Ok(contents) = std::fs::read_to_string(env_path) {
                    let mut new_contents = String::new();
                    let prefix = format!("{}=", key);
                    for line in contents.lines() {
                        if !line.starts_with(&prefix) {
                            new_contents.push_str(line);
                            new_contents.push('\n');
                        }
                    }
                    let _ = std::fs::write(env_path, new_contents);
                }
            }
        }
        return Ok(());
    }

    #[cfg(not(debug_assertions))]
    {
        if let Ok(entry) = Entry::new("frugallm-app", service) {
            let _ = entry.delete_credential();
        }
        return Ok(());
    }
}

#[tauri::command]
fn wipe_credentials() -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        let current_dir = std::env::current_dir().unwrap_or_default();
        let env_candidates = [
            current_dir.join(".env"),
            current_dir.join("src-tauri").join(".env"),
        ];
        for env_path in &env_candidates {
            if env_path.exists() {
                let _ = std::fs::remove_file(env_path);
            }
        }
        // Also remove from current environment so it doesn't linger
        std::env::remove_var("OPENROUTER_KEY");
        std::env::remove_var("GOOGLE_KEY");
        std::env::remove_var("OLLAMA_KEY");
        return Ok(());
    }

    #[cfg(not(debug_assertions))]
    {
        for svc in &["openrouter", "google"] {
            if let Ok(entry) = Entry::new("frugallm-app", svc) {
                let _ = entry.delete_credential();
            }
        }
        return Ok(());
    }
}

fn is_hermes_installed(home: &std::path::Path) -> bool {
    let local_bin_hermes = home.join(".local").join("bin").join(if cfg!(windows) { "hermes.exe" } else { "hermes" });
    if local_bin_hermes.exists() {
        return true;
    }
    let hermes_path = home.join(".hermes").join("bin").join(if cfg!(windows) { "hermes.exe" } else { "hermes" });
    return hermes_path.exists();
}

#[tauri::command]
fn check_hermes_status(app: tauri::AppHandle) -> bool {
    if let Ok(home) = app.path().home_dir() {
        return is_hermes_installed(&home);
    }
    false
}

fn is_opencode_installed(home: &std::path::Path) -> bool {
    let local_bin_opencode = home.join(".local").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" });
    if local_bin_opencode.exists() {
        return true;
    }
    let opencode_path = home.join(".opencode").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" });
    return opencode_path.exists();
}

#[tauri::command]
fn check_opencode_status(app: tauri::AppHandle) -> bool {
    if let Ok(home) = app.path().home_dir() {
        return is_opencode_installed(&home);
    }
    false
}

fn get_ollama_binary() -> std::path::PathBuf {
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
    std::path::PathBuf::from("ollama")
}

fn is_ollama_in_paths(paths: &[&str]) -> bool {
    for p in paths.iter() {
        if std::path::Path::new(p).exists() {
            return true;
        }
    }
    false
}

#[tauri::command(async)]
async fn check_ollama_status() -> bool {
    // 1. Check if it's currently running via its local API
    if reqwest::get("http://127.0.0.1:11434/api/version").await.is_ok() {
        return true;
    }

    // 2. Check if the binary is in PATH or common paths
    let bin = get_ollama_binary();
    if bin != std::path::PathBuf::from("ollama") && bin.exists() {
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

#[tauri::command(async)]
async fn get_hermes_version(app: tauri::AppHandle) -> String {
    if let Ok(home) = app.path().home_dir() {
        if is_hermes_installed(&home) {
            let hermes_bin = home.join(".hermes").join("bin").join(if cfg!(windows) { "hermes.exe" } else { "hermes" });
            if let Ok(output) = tokio::process::Command::new(&hermes_bin).arg("--version").output().await {
                if output.status.success() {
                    let v = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !v.is_empty() {
                        return v;
                    }
                }
            }
            return "v0.3.1".to_string();
        }
    }
    "N/A".to_string()
}

#[tauri::command(async)]
async fn get_opencode_version(app: tauri::AppHandle) -> String {
    if let Ok(home) = app.path().home_dir() {
        if is_opencode_installed(&home) {
            let opencode_bin = home.join(".opencode").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" });
            if let Ok(output) = tokio::process::Command::new(&opencode_bin).arg("--version").output().await {
                if output.status.success() {
                    let v = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !v.is_empty() {
                        return v;
                    }
                }
            }
            let local_bin = home.join(".local").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" });
            if let Ok(output) = tokio::process::Command::new(&local_bin).arg("--version").output().await {
                if output.status.success() {
                    let v = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !v.is_empty() {
                        return v;
                    }
                }
            }
            return "v1.0.0".to_string();
        }
    }
    "N/A".to_string()
}

#[tauri::command(async)]
async fn uninstall_ollama(app: tauri::AppHandle) -> Result<(), String> {
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

    Ok(())
}

#[tauri::command(async)]
async fn check_tool_gateway_status(app: tauri::AppHandle) -> bool {
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
fn set_tool_gateway_installed(app: tauri::AppHandle, installed: bool) -> Result<(), String> {
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
    Ok(())
}

pub async fn get_hardware_profile() -> Result<HardwareProfile, String> {
    let is_unified: bool;
    let mut dedicated_vram: u64 = 0;
    let mut system_ram: u64 = 0;
    let os_architecture: String;

    #[cfg(target_os = "macos")]
    {
        let is_arm = std::env::consts::ARCH == "aarch64";
        os_architecture = format!("macos-{}", std::env::consts::ARCH);

        // Query total system RAM via sysctl hw.memsize
        if let Ok(output) = tokio::process::Command::new("sysctl").arg("-n").arg("hw.memsize").output().await {
            if output.status.success() {
                if let Ok(s) = String::from_utf8(output.stdout) {
                    if let Ok(bytes) = s.trim().parse::<u64>() {
                        system_ram = bytes;
                    }
                }
            }
        }

        if is_arm {
            // Apple Silicon Unified Memory: Do not differentiate RAM/VRAM
            is_unified = true;
            dedicated_vram = 0;
        } else {
            // Intel Mac: Detect discrete GPU via system_profiler
            is_unified = false;
            if let Ok(output) = tokio::process::Command::new("system_profiler").arg("SPDisplaysDataType").output().await {
                if output.status.success() {
                    if let Ok(prof_str) = String::from_utf8(output.stdout) {
                        let mut max_vram_mb: u64 = 0;
                        for line in prof_str.lines() {
                            if line.contains("VRAM (Total):") || line.contains("VRAM (Dynamic, Max):") {
                                let parts: Vec<&str> = line.split(':').collect();
                                if parts.len() > 1 {
                                    let val_str = parts[1].trim();
                                    let val_parts: Vec<&str> = val_str.split_whitespace().collect();
                                    if val_parts.len() == 2 {
                                        if let Ok(mut val) = val_parts[0].parse::<u64>() {
                                            if val_parts[1] == "GB" {
                                                val *= 1024;
                                            }
                                            if val > max_vram_mb {
                                                max_vram_mb = val;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        dedicated_vram = max_vram_mb * 1024 * 1024;
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        os_architecture = format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH);
        is_unified = false;

        let mut sys = sysinfo::System::new_all();
        sys.refresh_memory();
        system_ram = sys.total_memory();

        // NVIDIA NVML check
        use nvml_wrapper::Nvml;
        if let Ok(nvml) = Nvml::init() {
            if let Ok(device) = nvml.device_by_index(0) {
                if let Ok(memory) = device.memory_info() {
                    dedicated_vram = memory.total;
                }
            }
        }
    }

    let execution_ceiling = if is_unified {
        // Unified Memory minus ~2GB macOS reserve buffer
        system_ram.saturating_sub(2 * 1024 * 1024 * 1024)
    } else if dedicated_vram > 0 {
        dedicated_vram
    } else if system_ram > 0 {
        system_ram.saturating_sub(2 * 1024 * 1024 * 1024)
    } else {
        8 * 1024 * 1024 * 1024
    };

    Ok(HardwareProfile {
        is_unified,
        dedicated_vram,
        system_ram,
        execution_ceiling,
        os_architecture,
    })
}

#[tauri::command(async)]
async fn detect_hardware_profile() -> Result<HardwareProfile, String> {
    get_hardware_profile().await
}

#[tauri::command(async)]
async fn detect_vram() -> Result<u64, String> {
    let profile = get_hardware_profile().await?;
    if profile.is_unified {
        Ok(profile.execution_ceiling / 1024 / 1024)
    } else if profile.dedicated_vram > 0 {
        Ok(profile.dedicated_vram / 1024 / 1024)
    } else {
        Ok(profile.system_ram / 1024 / 1024)
    }
}

#[tauri::command]
fn spawn_pty(
    app: tauri::AppHandle,
    state: State<'_, PtyState>,
    session_id: String,
    command: Option<String>,
    args: Option<Vec<String>>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<(), String> {
    use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
    use std::io::Read;

    let pty_system = NativePtySystem::default();
    let pair = pty_system.openpty(PtySize {
        rows: rows.unwrap_or(24),
        cols: cols.unwrap_or(80),
        pixel_width: 0,
        pixel_height: 0,
    }).map_err(|e| e.to_string())?;

    let mut cmd = if let Some(c) = command {
        CommandBuilder::new(c)
    } else if cfg!(windows) {
        CommandBuilder::new("powershell.exe")
    } else {
        CommandBuilder::new("bash")
    };

    if let Some(a) = args {
        cmd.args(&a);
    }
    
    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    
    if let Ok(mut state_writer) = state.writer.lock() {
        state_writer.insert(session_id.clone(), writer);
    }
    
    if let Ok(mut state_master) = state.master.lock() {
        state_master.insert(session_id.clone(), pair.master);
    }

    let app_clone = app.clone();
    let session_id_clone = session_id.clone();
    std::thread::spawn(move || {
        if let Ok(status) = child.wait() {
            let exit_code = if status.success() { 0 } else { 1 };
            #[derive(serde::Serialize, Clone)]
            struct ExitPayload {
                session_id: String,
                exit_code: u32,
            }
            let _ = app_clone.emit("pty_exit", ExitPayload { session_id: session_id_clone, exit_code });
        }
    });

    std::thread::spawn(move || {
        let mut buf = [0u8; 1024];
        while let Ok(n) = reader.read(&mut buf) {
            if n == 0 { break; }
            let s = String::from_utf8_lossy(&buf[..n]);
            #[derive(serde::Serialize, Clone)]
            struct OutputPayload {
                session_id: String,
                data: String,
            }
            let _ = app.emit("pty_output", OutputPayload { session_id: session_id.clone(), data: s.into_owned() });
        }
    });

    Ok(())
}

#[tauri::command]
fn write_pty(state: State<'_, PtyState>, session_id: String, data: String) -> Result<(), String> {
    if let Ok(mut writers) = state.writer.lock() {
        if let Some(writer) = writers.get_mut(&session_id) {
            writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
            writer.flush().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn kill_pty(state: State<'_, PtyState>, session_id: String) -> Result<(), String> {
    if let Ok(mut writers) = state.writer.lock() {
        writers.remove(&session_id);
    }
    if let Ok(mut masters) = state.master.lock() {
        masters.remove(&session_id);
    }
    Ok(())
}

#[tauri::command]
fn resize_pty(state: State<'_, PtyState>, session_id: String, rows: u16, cols: u16) -> Result<(), String> {
    if let Ok(mut masters) = state.master.lock() {
        if let Some(master) = masters.get_mut(&session_id) {
            master.resize(portable_pty::PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            }).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

// -----------------------------------------------------------------------------
// FrugalLLM Core API Server (Axum)
// -----------------------------------------------------------------------------
use axum::{routing::{get, post}, Router, response::Json};
use serde_json::{json, Value};
use tokio::net::TcpListener;

async fn models() -> Json<Value> {
    Json(json!({
        "object": "list",
        "data": [
            {
                "id": "frugallm",
                "object": "model",
                "created": 1677610602,
                "owned_by": "frugallm"
            }
        ]
    }))
}

#[derive(serde::Serialize, Clone)]
struct ProxyActivityPayload {
    source: String,
    target: String,
    is_active: bool,
}

#[derive(serde::Serialize, Clone)]
struct ProxyModelErrorPayload {
    model: String,
    provider: String,
    error: String,
}

struct NotifyOnDrop {
    app: tauri::AppHandle,
    source: String,
    target: String,
    token_estimate: Arc<std::sync::atomic::AtomicUsize>,
    exact_output_tokens: Arc<std::sync::atomic::AtomicUsize>,
    exact_input_tokens: Arc<std::sync::atomic::AtomicUsize>,
    input_tokens_estimate: usize,
}
impl Drop for NotifyOnDrop {
    fn drop(&mut self) {
        let _ = self.app.emit("proxy_activity", ProxyActivityPayload {
            source: self.source.clone(),
            target: self.target.clone(),
            is_active: false,
        });

        let exact_out = self.exact_output_tokens.load(std::sync::atomic::Ordering::Acquire);
        let output_tokens = if exact_out > 0 { exact_out } else { self.token_estimate.load(std::sync::atomic::Ordering::Acquire) / 4 };
        
        let exact_in = self.exact_input_tokens.load(std::sync::atomic::Ordering::Acquire);
        let input_tokens = if exact_in > 0 { exact_in } else { self.input_tokens_estimate / 4 };
        
        if output_tokens > 0 || input_tokens > 0 {
            let app_handle = self.app.clone();
            tauri::async_runtime::spawn(async move {
                let state = app_handle.state::<FrugalConfigState>();
                {
                    let mut config = state.config.lock().await;
                    config.input_tokens_session += input_tokens as u64;
                    config.output_tokens_session += output_tokens as u64;
                    config.input_tokens_lifetime += input_tokens as u64;
                    config.output_tokens_lifetime += output_tokens as u64;
                }
                state.is_dirty.store(true, std::sync::atomic::Ordering::Release);
                let _ = app_handle.emit("frugallm_config_updated", ());
            });
        }
    }
}

fn process_stream_chunk_for_tokens(
    chunk_bytes: &[u8],
    drop_guard: &NotifyOnDrop,
) {
    if let Ok(text) = std::str::from_utf8(chunk_bytes) {
        for line in text.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            let json_candidate = if trimmed.starts_with("data:") {
                let data_str = trimmed["data:".len()..].trim();
                if data_str == "[DONE]" {
                    continue;
                }
                Some(data_str)
            } else if trimmed.starts_with('{') && trimmed.ends_with('}') {
                Some(trimmed)
            } else {
                None
            };

            if let Some(json_str) = json_candidate {
                if let Ok(json) = serde_json::from_str::<Value>(json_str) {
                    // 1. Native Ollama metrics (prompt_eval_count, eval_count)
                    if let Some(prompt_eval) = json.get("prompt_eval_count").and_then(|v| v.as_u64()) {
                        drop_guard.exact_input_tokens.store(prompt_eval as usize, std::sync::atomic::Ordering::Release);
                    }
                    if let Some(eval) = json.get("eval_count").and_then(|v| v.as_u64()) {
                        drop_guard.exact_output_tokens.store(eval as usize, std::sync::atomic::Ordering::Release);
                    }

                    // 2. OpenAI / Cloud usage metrics (usage.prompt_tokens, usage.completion_tokens)
                    if let Some(usage) = json.get("usage").and_then(|u| u.as_object()) {
                        if let Some(prompt) = usage.get("prompt_tokens").and_then(|t| t.as_u64()) {
                            drop_guard.exact_input_tokens.store(prompt as usize, std::sync::atomic::Ordering::Release);
                        }
                        if let Some(completion) = usage.get("completion_tokens").and_then(|t| t.as_u64()) {
                            drop_guard.exact_output_tokens.store(completion as usize, std::sync::atomic::Ordering::Release);
                        }
                    }

                    // 3. Fallback token estimation from content strings (not raw JSON wire bytes!)
                    if let Some(choices) = json.get("choices").and_then(|c| c.as_array()) {
                        for choice in choices {
                            if let Some(delta) = choice.get("delta") {
                                if let Some(content) = delta.get("content").and_then(|s| s.as_str()) {
                                    drop_guard.token_estimate.fetch_add(content.len(), std::sync::atomic::Ordering::Release);
                                }
                                if let Some(reasoning) = delta.get("reasoning_content").and_then(|s| s.as_str()) {
                                    drop_guard.token_estimate.fetch_add(reasoning.len(), std::sync::atomic::Ordering::Release);
                                }
                            }
                            if let Some(text_content) = choice.get("text").and_then(|s| s.as_str()) {
                                drop_guard.token_estimate.fetch_add(text_content.len(), std::sync::atomic::Ordering::Release);
                            }
                            if let Some(message) = choice.get("message") {
                                if let Some(content) = message.get("content").and_then(|s| s.as_str()) {
                                    drop_guard.token_estimate.fetch_add(content.len(), std::sync::atomic::Ordering::Release);
                                }
                            }
                        }
                    }

                    if let Some(message) = json.get("message") {
                        if let Some(content) = message.get("content").and_then(|s| s.as_str()) {
                            drop_guard.token_estimate.fetch_add(content.len(), std::sync::atomic::Ordering::Release);
                        }
                    }
                    if let Some(response) = json.get("response").and_then(|s| s.as_str()) {
                        drop_guard.token_estimate.fetch_add(response.len(), std::sync::atomic::Ordering::Release);
                    }
                }
            }
        }
    }
}

use futures_util::StreamExt;

async fn try_ollama(
    app: &tauri::AppHandle,
    client: &reqwest::Client,
    body: &Value,
    source: &str,
    ollama_model: &str,
) -> Result<axum::response::Response, String> {
    let mut body = body.clone();
    if let Some(model) = body.get_mut("model") {
        *model = json!(ollama_model);
    }
    
    let optimal_threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
    if let Some(obj) = body.as_object_mut() {
        if !obj.contains_key("options") {
            obj.insert("options".to_string(), json!({ "num_ctx": 131072, "num_thread": optimal_threads }));
        } else if let Some(options) = obj.get_mut("options").and_then(|o| o.as_object_mut()) {
            if !options.contains_key("num_ctx") {
                options.insert("num_ctx".to_string(), json!(131072));
            }
            if !options.contains_key("num_thread") {
                options.insert("num_thread".to_string(), json!(optimal_threads));
            }
        }
    }

    let _ = app.emit("proxy_activity", ProxyActivityPayload {
        source: source.to_string(),
        target: "ollama".to_string(),
        is_active: true,
    });

    let request_body_size = serde_json::to_string(&body).map(|s| s.len()).unwrap_or(0);
    
    let token_estimate = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let exact_output_tokens = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let exact_input_tokens = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let drop_guard = NotifyOnDrop {
        app: app.clone(),
        source: source.to_string(),
        target: "ollama".to_string(),
        token_estimate: token_estimate.clone(),
        exact_output_tokens: exact_output_tokens.clone(),
        exact_input_tokens: exact_input_tokens.clone(),
        input_tokens_estimate: request_body_size,
    };

    let res = client.post("http://127.0.0.1:11434/v1/chat/completions")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if res.status().is_success() {
        let mut builder = axum::response::Response::builder()
            .status(res.status())
            .header("Cache-Control", "no-cache")
            .header("Connection", "keep-alive")
            .header("X-Accel-Buffering", "no");

        for (key, value) in res.headers() {
            if key != axum::http::header::CONTENT_LENGTH {
                builder = builder.header(key.clone(), value.clone());
            }
        }
        let app_clone = app.clone();
        let source_clone = source.to_string();
        let stream = res.bytes_stream().inspect(move |chunk| {
            let _ = &drop_guard;
            if let Ok(bytes) = chunk {
                process_stream_chunk_for_tokens(bytes, &drop_guard);
            }
            let _ = app_clone.emit("proxy_activity", ProxyActivityPayload {
                source: source_clone.clone(),
                target: "ollama".to_string(),
                is_active: true,
            });
        });
        Ok(builder.body(axum::body::Body::from_stream(stream)).unwrap())
    } else {
        Err(format!("Ollama API error: HTTP {}", res.status()))
    }
}

async fn try_cloud_provider(
    app: &tauri::AppHandle,
    client: &reqwest::Client,
    body: &Value,
    source: &str,
    cloud_model: &CloudModel,
) -> Result<axum::response::Response, String> {
    let mut body = body.clone();
    if let Some(obj) = body.as_object_mut() {
        if obj.get("stream").and_then(|v| v.as_bool()).unwrap_or(false) {
            obj.insert("stream_options".to_string(), json!({ "include_usage": true }));
        }
    }
    
    let (url, auth_header) = match cloud_model.provider.as_str() {
        "google" => {
            let key = crate::get_credential("google")
                .map_err(|_| "Google AI Studio API key not found".to_string())?;
            let url = "https://generativelanguage.googleapis.com/v1beta/chat/completions".to_string();
            let auth = format!("Bearer {}", key);
            if let Some(obj) = body.as_object_mut() {
                obj.insert("model".to_string(), json!(cloud_model.model));
            }
            (url, auth)
        },
        _ => {
            let key = crate::get_credential("openrouter")
                .map_err(|_| "OpenRouter API key not found".to_string())?;
            let url = "https://openrouter.ai/api/v1/chat/completions".to_string();
            let auth = format!("Bearer {}", key);
            if let Some(obj) = body.as_object_mut() {
                obj.insert("model".to_string(), json!(cloud_model.model));
                obj.remove("models");
                obj.remove("reasoning_effort");
            }
            (url, auth)
        }
    };

    let _ = app.emit("proxy_activity", ProxyActivityPayload {
        source: source.to_string(),
        target: cloud_model.provider.clone(),
        is_active: true,
    });

    let request_body_size = serde_json::to_string(&body).map(|s| s.len()).unwrap_or(0);
    
    let token_estimate = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let exact_output_tokens = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let exact_input_tokens = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    
    let drop_guard = NotifyOnDrop {
        app: app.clone(),
        source: source.to_string(),
        target: cloud_model.provider.clone(),
        token_estimate: token_estimate.clone(),
        exact_output_tokens: exact_output_tokens.clone(),
        exact_input_tokens: exact_input_tokens.clone(),
        input_tokens_estimate: request_body_size,
    };

    let res = client.post(&url)
        .header("Authorization", auth_header)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if res.status().is_success() {
        let mut builder = axum::response::Response::builder().status(res.status());
        for (key, value) in res.headers() {
            builder = builder.header(key.clone(), value.clone());
        }
        let app_clone = app.clone();
        let source_clone = source.to_string();
        let provider_clone = cloud_model.provider.clone();
        
        let stream = res.bytes_stream().inspect(move |chunk| {
            let _ = &drop_guard;
            if let Ok(bytes) = chunk {
                process_stream_chunk_for_tokens(bytes, &drop_guard);
            }
            let _ = app_clone.emit("proxy_activity", ProxyActivityPayload {
                source: source_clone.clone(),
                target: provider_clone.clone(),
                is_active: true,
            });
        });
        Ok(builder.body(axum::body::Body::from_stream(stream)).unwrap())
    } else {
        let status = res.status();
        let error_body = res.text().await.unwrap_or_else(|_| "Could not read error body".to_string());
        
        let debug_info = format!("Status: {}\nRequest Body: {}\nError Body: {}\n", status, serde_json::to_string_pretty(&body).unwrap_or_default(), error_body);
        let _ = std::fs::write(format!("/tmp/frugallm_{}_error.txt", cloud_model.provider), debug_info);
        
        println!("{} API error ({}): {}", cloud_model.provider, status, error_body);
        Err(format!("{} API error: HTTP {} - {}", cloud_model.provider, status, error_body))
    }
}

async fn chat_completions(
    axum::extract::State(app): axum::extract::State<std::sync::Arc<tauri::AppHandle>>,
    headers: axum::http::HeaderMap,
    Json(body): Json<Value>
) -> axum::response::Response {
    let state = app.state::<FrugalConfigState>();
    let expected_password = {
        let config = state.config.lock().await;
        config.api_password.clone()
    };
    if let Some(password) = expected_password {
        if !password.is_empty() {
            let auth_header = headers.get("authorization").and_then(|h| h.to_str().ok()).unwrap_or("");
            if auth_header != format!("Bearer {}", password) {
                return axum::response::Response::builder()
                    .status(401)
                    .body(axum::body::Body::from("Unauthorized"))
                    .unwrap();
            }
        }
    }

    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .tcp_keepalive(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    
    // Determine if Ollama is viable and running
    let mut ollama_running = false;
    let mut ollama_viable = false;
    let mut ollama_model = "llama3:8b".to_string();
    
    if let Ok(tags_res) = client.get("http://127.0.0.1:11434/api/tags").timeout(std::time::Duration::from_secs(2)).send().await {
        if tags_res.status().is_success() {
            ollama_running = true;
            if let Ok(tags_json) = tags_res.json::<Value>().await {
                if let Some(models) = tags_json.get("models").and_then(|m| m.as_array()) {
                    for model in models {
                        if let Some(name) = model.get("name").and_then(|n| n.as_str()) {
                            if !name.contains("frugallm-active") {
                                ollama_model = name.to_string();
                                break;
                            }
                        }
                    }
                    if !models.is_empty() {
                        ollama_viable = true;
                    }
                }
            }
        }
    }
    
    if ollama_running {
        if let Ok(ps_res) = client.get("http://127.0.0.1:11434/api/ps").timeout(std::time::Duration::from_secs(2)).send().await {
            if let Ok(ps_json) = ps_res.json::<Value>().await {
                if let Some(models) = ps_json.get("models").and_then(|m| m.as_array()) {
                    if let Some(first) = models.first() {
                        if let Some(name) = first.get("name").and_then(|n| n.as_str()) {
                            if !name.is_empty() {
                                ollama_viable = true;
                            }
                        }
                    }
                }
            }
        }
    }

    let original_model = body.get("model").and_then(|m| m.as_str()).unwrap_or("");
    let user_agent = headers.get("user-agent").and_then(|h| h.to_str().ok()).unwrap_or("").to_lowercase();
    
    let source = if original_model.contains("opencode") || original_model.contains("litellm") || user_agent.contains("opencode") {
        "opencode".to_string()
    } else {
        "hermes".to_string()
    };

    let mut order = Vec::new();
    if ollama_viable {
        order.push("ollama");
        order.push("cloud");
    } else {
        order.push("cloud");
        if ollama_running {
            order.push("ollama");
        }
    }

    let mut errors = Vec::new();

    for provider in order {
        match provider {
            "ollama" => {
                match try_ollama(&app, &client, &body, &source, &ollama_model).await {
                    Ok(response) => return response,
                    Err(e) => errors.push(format!("Ollama failed: {}", e)),
                }
            }
            "cloud" => {
                let chain = {
                    let fallback_chain = app.state::<DynamicRosterState>().fallback_chain.clone();
                    let guard = fallback_chain.read().await;
                    guard.clone()
                };
                
                let mut skip_google = false;
                
                for cloud_model in chain {
                    if skip_google && cloud_model.provider == "google" {
                        continue;
                    }
                    match try_cloud_provider(&app, &client, &body, &source, &cloud_model).await {
                        Ok(response) => return response,
                        Err(e) => {
                            let _ = app.emit("proxy_model_error", ProxyModelErrorPayload {
                                model: cloud_model.model.clone(),
                                provider: cloud_model.provider.clone(),
                                error: e.clone(),
                            });
                            
                            errors.push(format!("{} ({}) failed: {}", cloud_model.provider, cloud_model.model, e));
                            if e.contains("HTTP 429") {
                                if cloud_model.provider == "google" && (e.contains("quota metric") || e.contains("free_tier_requests") || e.contains("Quota exceeded")) {
                                    skip_google = true;
                                }
                                continue;
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }

    // If both fail, return an aggregated 500 error
    axum::response::Response::builder()
        .status(500)
        .body(axum::body::Body::from(format!(
            "All upstream providers failed:\n{}",
            errors.join("\n")
        )))
        .unwrap()
}

fn get_config_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if !app_data_dir.exists() {
        std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    }
    Ok(app_data_dir.join("frugal_config.json"))
}

#[tauri::command]
async fn get_frugallm_config(state: State<'_, FrugalConfigState>) -> Result<FrugalConfig, String> {
    let config = state.config.lock().await;
    Ok(config.clone())
}

#[tauri::command]
async fn set_frugallm_config(app: tauri::AppHandle, state: State<'_, FrugalConfigState>, new_config: FrugalConfig) -> Result<(), String> {
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
    state.is_dirty.store(false, std::sync::atomic::Ordering::Release);

    if port_changed || ip_changed {
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



#[tauri::command]
async fn get_routing_chain(state: State<'_, DynamicRosterState>) -> Result<Vec<CloudModel>, String> {
    let chain = state.fallback_chain.read().await;
    Ok(chain.clone())
}

#[tauri::command]
async fn set_routing_chain(state: State<'_, DynamicRosterState>, new_chain: Vec<CloudModel>) -> Result<(), String> {
    let mut chain = state.fallback_chain.write().await;
    *chain = new_chain;
    Ok(())
}
#[tauri::command]
async fn set_model_override(
    app: tauri::AppHandle,
    state: State<'_, FrugalConfigState>,
    overrides: Vec<String>,
) -> Result<(), String> {
    {
        let mut config = state.config.lock().await;
        config.manual_model_overrides = overrides;
        
        let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
        let config_path = config_dir.join("frugal_config.json");
        let config_str = serde_json::to_string_pretty(&*config).map_err(|e| e.to_string())?;
        std::fs::write(&config_path, config_str).map_err(|e| e.to_string())?;
        
        app.emit("frugallm_config_updated", &*config).unwrap_or(());
    }
    
    // Auto-refresh the chain
    let new_chain = fetch_live_routing_chain(&app).await;
    let dynamic_state = app.state::<DynamicRosterState>();
    let mut chain = dynamic_state.fallback_chain.write().await;
    *chain = new_chain.clone();
    
    Ok(())
}




struct RankedModel {
    model: CloudModel,
    priority: f32,
}

async fn fetch_live_routing_chain(app: &tauri::AppHandle) -> Vec<CloudModel> {
    let overrides = {
        let state = app.state::<FrugalConfigState>();
        let config = state.config.lock().await;
        config.manual_model_overrides.clone()
    };
    
    let mut ranked_chain: Vec<RankedModel> = Vec::new();
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build() {
            Ok(c) => c,
            Err(_) => return Vec::new(),
        };

    // 1. Fetch from Ollama
    if let Ok(resp) = client.get("http://127.0.0.1:11434/api/tags").send().await {
        if let Ok(json) = resp.json::<serde_json::Value>().await {
            if let Some(models) = json.get("models").and_then(|m| m.as_array()) {
                for m in models {
                    if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                        let priority = crate::model_db::MODEL_REGISTRY.get_score(name);
                        ranked_chain.push(RankedModel {
                            model: CloudModel {
                                model: name.to_string(),
                                provider: "ollama".to_string(),
                                iq: priority,
                            },
                            priority,
                        });
                    }
                }
            }
        }
    }

    // 2. Fetch from Google AI Studio
    if let Ok(key) = crate::get_credential("google") {
        let url = format!("https://generativelanguage.googleapis.com/v1beta/models?key={}", key);
        if let Ok(resp) = client.get(&url).send().await {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(models) = json.get("models").and_then(|m| m.as_array()) {
                    for m in models {
                        if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                            let clean_name = name.strip_prefix("models/").unwrap_or(name);
                            
                            let is_valid_family = clean_name.starts_with("gemini-") || clean_name.starts_with("gemma-");
                            
                            let mut is_junk = false;
                            let junk_keywords = [
                                "image", "audio", "tts", "transcribe", "embedding", 
                                "veo", "aqa", "clip", "robotics", "live", "nano-banana"
                            ];
                            for kw in junk_keywords.iter() {
                                if clean_name.contains(kw) {
                                    is_junk = true;
                                    break;
                                }
                            }
                            
                            // Check supported generation methods for 'generateContent'
                            let mut supports_chat = false;
                            if let Some(methods) = m.get("supportedGenerationMethods").and_then(|sm| sm.as_array()) {
                                if methods.iter().any(|meth| meth.as_str() == Some("generateContent")) {
                                    supports_chat = true;
                                }
                            }
                            
                            if supports_chat && !is_junk && is_valid_family {
                                let priority = crate::model_db::MODEL_REGISTRY.get_score(name);
                                ranked_chain.push(RankedModel {
                                    model: CloudModel {
                                        model: clean_name.to_string(),
                                        provider: "google".to_string(),
                                        iq: priority,
                                    },
                                    priority,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. Fetch from OpenRouter
    if let Ok(key) = crate::get_credential("openrouter") {
        if let Ok(resp) = client.get("https://openrouter.ai/api/v1/models")
            .header("Authorization", format!("Bearer {}", key))
            .send().await {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(models) = json.get("data").and_then(|m| m.as_array()) {
                    for m in models {
                        if let Some(id) = m.get("id").and_then(|i| i.as_str()) {
                            let mut is_free = false;
                            
                            // Check if model explicitly ends in :free
                            if id.ends_with(":free") {
                                is_free = true;
                            } else if let Some(pricing) = m.get("pricing") {
                                // Or check if pricing explicitly states 0
                                let prompt = pricing.get("prompt").and_then(|p| p.as_str()).unwrap_or("1");
                                let completion = pricing.get("completion").and_then(|c| c.as_str()).unwrap_or("1");
                                if prompt == "0" && (completion == "0" || completion == "0.0") {
                                    is_free = true;
                                }
                            }

                            if is_free {
                                let mut supports_tools = false;
                                if let Some(params) = m.get("supported_parameters").and_then(|p| p.as_array()) {
                                    for p in params {
                                        if let Some(ps) = p.as_str() {
                                            if ps == "tools" || ps == "tool_choice" {
                                                supports_tools = true;
                                            }
                                        }
                                    }
                                }
                                
                                if supports_tools {
                                    let _ctx = m.get("context_length").and_then(|c| c.as_u64()).unwrap_or(8192);
                                    let priority = crate::model_db::MODEL_REGISTRY.get_score(id); println!("Score for {} is {}", id, priority);
                                    ranked_chain.push(RankedModel {
                                        model: CloudModel {
                                            model: id.to_string(),
                                            provider: "openrouter".to_string(),
                                            iq: priority,
                                        },
                                        priority,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 4. Sort and apply overrides using exact index mapping
    ranked_chain.sort_by(|a, b| b.priority.total_cmp(&a.priority));

    let mut final_chain = Vec::new();
    
    for override_id in overrides.iter() {
        if override_id.is_empty() {
            // Unpinned slot: pop the highest priority model that isn't explicitly pinned elsewhere
            let mut found_idx = None;
            for (i, rm) in ranked_chain.iter().enumerate() {
                if !overrides.contains(&rm.model.model) {
                    found_idx = Some(i);
                    break;
                }
            }
            if let Some(idx) = found_idx {
                final_chain.push(ranked_chain.remove(idx).model);
            }
        } else {
            // Pinned slot
            if let Some(idx) = ranked_chain.iter().position(|rm| rm.model.model == *override_id) {
                final_chain.push(ranked_chain.remove(idx).model);
            }
        }
    }
    
    // Add all remaining unpinned dynamic models
    for rm in ranked_chain {
        if !overrides.contains(&rm.model.model) {
            final_chain.push(rm.model);
        }
    }

    final_chain.truncate(150);
    final_chain
}

#[tauri::command]
async fn refresh_routing_chain(state: State<'_, DynamicRosterState>, app: tauri::AppHandle) -> Result<Vec<CloudModel>, String> {
    let new_chain = fetch_live_routing_chain(&app).await;
    
    let mut chain = state.fallback_chain.write().await;
    *chain = new_chain.clone();
    
    Ok(new_chain)
}

async fn start_frugallm_server(app: tauri::AppHandle) {
    let app_state = std::sync::Arc::new(app.clone());
    let router = Router::new()
        .route("/v1/models", get(models))
        .route("/v1/chat/completions", post(chat_completions))
        .with_state(app_state);

    let (port, bind_all) = {
        let state = app.state::<FrugalConfigState>();
        let config = state.config.lock().await;
        (config.port, config.bind_all_interfaces)
    };
    
    let ip = if bind_all { "0.0.0.0" } else { "127.0.0.1" };
    let addr = format!("{}:{}", ip, port);

    if let Ok(listener) = TcpListener::bind(&addr).await {
        if let Ok(local_addr) = listener.local_addr() {
            println!("FrugalLLM core server listening on {}", local_addr);
            if port == 0 {
                let state = app.state::<FrugalConfigState>();
                let mut config = state.config.lock().await;
                config.port = local_addr.port();
                if let Ok(path) = get_config_path(&app) {
                    if let Ok(json) = serde_json::to_string_pretty(&*config) {
                        let _ = std::fs::write(path, json);
                    }
                }
            }
        }
        
        let _ = axum::serve(listener, router).await;
    } else {
        eprintln!("Failed to bind FrugalLLM server to {}", addr);
        let _ = app.emit("frugallm_port_error", port);
    }
}

// -----------------------------------------------------------------------------

#[tauri::command]
async fn configure_hermes_defaults(app: tauri::AppHandle, state: tauri::State<'_, FrugalConfigState>) -> Result<(), String> {
    let port = state.config.lock().await.port;
    if let Ok(home) = app.path().home_dir() {
        let hermes_dir = home.join(".hermes");
        if !hermes_dir.exists() {
            std::fs::create_dir_all(&hermes_dir).map_err(|e| e.to_string())?;
        }
        
        let config_path = hermes_dir.join("config.yaml");
        let config_content = format!("model:\n  default: \"frugallm\"\n  provider: \"custom\"\n  base_url: \"http://127.0.0.1:{}/v1\"\n", port);
        std::fs::write(&config_path, config_content).map_err(|e| e.to_string())?;

        let soul_path = hermes_dir.join("soul.md");
        let soul_content = r#"# IDENTITY AND PURPOSE
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
- Never state in conversational text that you have "started a background process" or promise to "notify them soon" unless you have explicitly called a specific tool (like a cronjob utility) in the same turn to handle it."#;
        std::fs::write(&soul_path, soul_content).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn edit_hermes_soul(app: tauri::AppHandle) -> Result<(), String> {
    if let Ok(home) = app.path().home_dir() {
        let soul_path = home.join(".hermes").join("soul.md");
        if soul_path.exists() {
            #[cfg(target_os = "macos")]
            let _ = std::process::Command::new("open").arg(&soul_path).spawn();
            #[cfg(target_os = "windows")]
            let _ = std::process::Command::new("cmd").args(["/C", "start", "", &soul_path.to_string_lossy()]).spawn();
            #[cfg(target_os = "linux")]
            let _ = std::process::Command::new("xdg-open").arg(&soul_path).spawn();
        } else {
            return Err("soul.md does not exist yet. Please initialize Hermes first.".to_string());
        }
    }
    Ok(())
}


#[tauri::command]
async fn configure_opencode_defaults(app: tauri::AppHandle, state: tauri::State<'_, FrugalConfigState>) -> Result<(), String> {
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

async fn ensure_ollama_installed(app: &tauri::AppHandle) -> Result<(), String> {
    // Check if the binary already exists on PATH or common paths
    if check_ollama_status().await {
        return Ok(());
    }

    let _ = app.emit("installing_ollama", ());

    #[cfg(not(target_os = "windows"))]
    {
        // CRITICAL: Set OLLAMA_NO_START=1 so install.sh does not fail on `open -a Ollama`.
        // The background daemon will be started cleanly by `start_ollama_daemon`.
        let mut child = tokio::process::Command::new("sh")
            .arg("-c")
            .arg("export OLLAMA_NO_START=1 && curl -fsSL https://ollama.com/install.sh | sh")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| e.to_string())?;
            
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
            return Err("Failed to install Ollama".to_string());
        }
    }

    #[cfg(target_os = "windows")]
    {
        use tokio::io::AsyncWriteExt;
        let temp_dir = std::env::temp_dir();
        let installer_path = temp_dir.join("OllamaSetup.exe");
        
        let client = reqwest::Client::new();
        let mut response = client.get("https://ollama.com/download/OllamaSetup.exe").send().await.map_err(|e| e.to_string())?;
        
        if !response.status().is_success() {
            return Err(format!("Failed to download Ollama installer: HTTP {}", response.status()));
        }

        let mut file = tokio::fs::File::create(&installer_path).await.map_err(|e| e.to_string())?;
        while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
            file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        }
        file.flush().await.map_err(|e| e.to_string())?;

        let status = tokio::process::Command::new(&installer_path)
            .arg("/SILENT")
            .status()
            .await
            .map_err(|e| e.to_string())?;
            
        if !status.success() {
            return Err("Failed to run Ollama installer".to_string());
        }
    }

    Ok(())
}

async fn start_ollama_daemon(app: &tauri::AppHandle) -> Result<(), String> {
    let daemon_state = app.state::<OllamaDaemonState>();

    // Check if already responding
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .map_err(|e| e.to_string())?;

    if client.get("http://127.0.0.1:11434/api/tags").send().await.is_ok() {
        let _ = app.emit("download_progress", DownloadProgress {
            status: "Ollama daemon already running.".to_string(),
        });
        return Ok(());
    }

    let ollama_bin = get_ollama_binary();

    // Spawn daemon in background — pipe stderr so we can stream boot logs
    let mut child = tokio::process::Command::new(ollama_bin)
        .arg("serve")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(false)
        .spawn()
        .map_err(|e| format!("Failed to spawn Ollama daemon: {}", e))?;

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

    Err("Timed out waiting for Ollama daemon to start after 10 seconds".into())
}

#[derive(Debug, Clone, Copy)]
pub struct ModelProfile {
    pub tag: &'static str,
    pub weights_gb: f64,
    pub kv_cache_gb: f64, // Calculated using the Gemma 5:1 sliding window logic
}

// 500 MB static execution graph buffer
pub const GRAPH_OVERHEAD_GB: f64 = 0.5;

// Sorted largest to smallest
pub const AVAILABLE_MODELS: &[ModelProfile] = &[
    // 31B Dense (~33G weights + ~10.36G cache)
    ModelProfile { tag: "gemma4:31b", weights_gb: 33.0, kv_cache_gb: 10.36 },
    // 26B MoE (~28G weights + ~4.16G cache)
    ModelProfile { tag: "gemma4:26b", weights_gb: 28.0, kv_cache_gb: 4.16 },
    // 12B Unified (~13G weights + ~3.63G cache)
    ModelProfile { tag: "gemma4:12b", weights_gb: 13.0, kv_cache_gb: 3.63 },
    // 4.5B (~4.9G weights + ~3.10G cache)
    ModelProfile { tag: "gemma4:e4b", weights_gb: 4.9, kv_cache_gb: 3.10 },
    // 2.3B (~1.4G weights + ~1.29G cache)
    ModelProfile { tag: "gemma4:e2b", weights_gb: 1.4, kv_cache_gb: 1.29 },
];

#[tauri::command]
fn get_model_tag_for_vram(detected_vram_gb: f64) -> String {
    for model in AVAILABLE_MODELS {
        let total_footprint = model.weights_gb + model.kv_cache_gb + GRAPH_OVERHEAD_GB;
        if total_footprint <= detected_vram_gb {
            return model.tag.to_string();
        }
    }

    // Fallback if VRAM is severely limited (e.g., 2GB or 4GB GPUs)
    // We default to the smallest model available and accept the inevitable spillover.
    "gemma4:e2b".to_string()
}

#[derive(serde::Serialize, Clone)]
struct DownloadProgress {
    status: String,
}

#[derive(serde::Serialize, Clone)]
struct ModelProgressPayload {
    percent: u32,
    completed: u64,
    total: u64,
    speed_bytes_per_sec: f64,
    eta_seconds: u64,
}

#[derive(serde::Serialize, Clone)]
struct DeploymentResult {
    success: bool,
    message: String,
}

#[tauri::command(async)]
async fn deploy_local_model(app: tauri::AppHandle) -> Result<(), String> {
    ensure_ollama_installed(&app).await?;
    start_ollama_daemon(&app).await?;

    let vram_mb = detect_vram().await?;
    let detected_vram_gb = vram_mb as f64 / 1024.0;
    let tag = get_model_tag_for_vram(detected_vram_gb);

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let models_dir = app_data_dir.join("models");
    if !models_dir.exists() {
        std::fs::create_dir_all(&models_dir).map_err(|e| e.to_string())?;
    }

    // Generate Modelfile
    let modelfile_path = models_dir.join("Modelfile");
    let modelfile_content = format!("FROM {}\nPARAMETER num_ctx 131072\n", tag);
    println!("--- DEBUG Modelfile ---");
    println!("{}", modelfile_content);
    println!("-----------------------");
    std::fs::write(&modelfile_path, modelfile_content).map_err(|e| e.to_string())?;

    let app_clone = app.clone();
    let tag_clone = tag.clone();
    tauri::async_runtime::spawn(async move {
        let _ = app_clone.emit("model_provisioning_started", ());

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
                let _ = app_clone.emit("model_deployment_complete", DeploymentResult { success: false, message: format!("API pull failed: {}", e) });
                return;
            }
        }


        let ollama_bin = get_ollama_binary();
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

                let _ = app_clone.emit("model_deployment_complete", DeploymentResult { success: true, message: "Success".to_string() });
            },
            Ok(status) => {
                let _ = app_clone.emit("model_deployment_complete", DeploymentResult { success: false, message: format!("Ollama create failed with status: {}", status) });
            },
            Err(e) => {
                let _ = app_clone.emit("model_deployment_complete", DeploymentResult { success: false, message: e.to_string() });
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn is_wipe_mode() -> bool {
    std::env::args().any(|arg| arg == "--wipe")
}

#[tauri::command]
fn get_local_ips() -> Vec<String> {
    let mut ips = vec!["127.0.0.1".to_string()];
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if let Ok(_) = socket.connect("8.8.8.8:80") {
            if let Ok(addr) = socket.local_addr() {
                let ip = addr.ip().to_string();
                if ip != "127.0.0.1" && !ips.contains(&ip) {
                    ips.push(ip);
                }
            }
        }
    }
    ips
}

#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

fn main() {
    #[cfg(debug_assertions)]
    dotenvy::dotenv().ok();
    let args: Vec<String> = env::args().collect();
    
    if args.contains(&"--wipe".to_string()) {
        println!("Wiping credentials and store...");
        let _ = wipe_credentials();
    }

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"])
        ))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(PtyState::default())
        .manage(OllamaDaemonState { child: tokio::sync::Mutex::new(None) })
        .setup(|app| {
            let app_handle = app.handle().clone();
            
            // Load Frugal Config
            let mut frugal_config = FrugalConfig::default();
            let is_wipe = env::args().any(|arg| arg == "--wipe");
            if !is_wipe {
                if let Ok(path) = get_config_path(&app_handle) {
                    if let Ok(json) = std::fs::read_to_string(path) {
                        if let Ok(parsed) = serde_json::from_str::<FrugalConfig>(&json) {
                            frugal_config = parsed;
                            frugal_config.input_tokens_session = 0;
                            frugal_config.output_tokens_session = 0;
                        }
                    }
                }
            }
            let start_minimized = frugal_config.start_minimized;
            let config_arc = Arc::new(tokio::sync::Mutex::new(frugal_config));
            
            let server_abort_handle = Arc::new(tokio::sync::Mutex::new(None));
            let is_dirty = Arc::new(std::sync::atomic::AtomicBool::new(false));
            app.manage(FrugalConfigState {
                config: config_arc.clone(),
                server_abort_handle: server_abort_handle.clone(),
                is_dirty: is_dirty.clone(),
            });

            // Background task: persist config to disk if dirty every 3 seconds (decoupled from proxy stream path)
            let app_handle_flush = app_handle.clone();
            let config_arc_flush = config_arc.clone();
            let is_dirty_flush = is_dirty.clone();
            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(std::time::Duration::from_secs(3));
                loop {
                    interval.tick().await;
                    if is_dirty_flush.swap(false, std::sync::atomic::Ordering::AcqRel) {
                        let config_clone = {
                            let config = config_arc_flush.lock().await;
                            config.clone()
                        };
                        if let Ok(path) = get_config_path(&app_handle_flush) {
                            if let Ok(json) = serde_json::to_string_pretty(&config_clone) {
                                let _ = std::fs::write(path, json);
                            }
                        }
                    }
                }
            });

            let dynamic_roster_state = DynamicRosterState {
                fallback_chain: Arc::new(tokio::sync::RwLock::new(vec![
                    CloudModel { model: "openrouter/auto".to_string(), provider: "openrouter".to_string(), iq: 50.0 }
                ])),
            };
            let fallback_chain_clone = dynamic_roster_state.fallback_chain.clone();
            app.manage(dynamic_roster_state);

            // Spawn FrugalLLM Core Server
            let app_handle_clone = app_handle.clone();
            let abort_handle = tauri::async_runtime::spawn(async move {
                let initial_chain = fetch_live_routing_chain(&app_handle_clone).await;
                if !initial_chain.is_empty() {
                    let mut guard = fallback_chain_clone.write().await;
                    *guard = initial_chain;
                }
                start_frugallm_server(app_handle).await;
            });
            
            tauri::async_runtime::block_on(async {
                *server_abort_handle.lock().await = Some(abort_handle);
            });
            
            telemetry::start_telemetry_loop(app.handle().clone());
            
            if env::args().any(|arg| arg == "--wipe") {
                if let Ok(app_data_dir) = app.path().app_data_dir() {
                    let store_path = app_data_dir.join("store.json");
                    if store_path.exists() {
                        let _ = std::fs::remove_file(store_path);
                        println!("store.json wiped.");
                    }
                    
                    let config_path = app_data_dir.join("frugal_config.json");
                    if config_path.exists() {
                        let _ = std::fs::remove_file(config_path);
                        println!("frugal_config.json wiped.");
                    }
                }
                if let Ok(home) = app.path().home_dir() {
                    let hermes_dir = home.join(".hermes");
                    if hermes_dir.exists() {
                        // Kill any running hermes processes first
                        #[cfg(windows)]
                        let _ = std::process::Command::new("taskkill").args(&["/IM", "hermes.exe", "/F"]).status();
                        #[cfg(not(windows))]
                        let _ = std::process::Command::new("killall").arg("hermes").status();
                        
                        let _ = std::fs::remove_dir_all(hermes_dir);
                        println!(".hermes directory wiped.");
                    }
                    
                    let local_bin_hermes = home.join(".local").join("bin").join(if cfg!(windows) { "hermes.exe" } else { "hermes" });
                    if local_bin_hermes.exists() {
                        let _ = std::fs::remove_file(local_bin_hermes);
                        println!("local bin hermes wiped.");
                    }

                    let opencode_dir = home.join(".opencode");
                    if opencode_dir.exists() {
                        #[cfg(windows)]
                        let _ = std::process::Command::new("taskkill").args(&["/IM", "opencode.exe", "/F"]).status();
                        #[cfg(not(windows))]
                        let _ = std::process::Command::new("killall").arg("opencode").status();
                        
                        let _ = std::fs::remove_dir_all(opencode_dir);
                        println!(".opencode directory wiped.");
                    }
                    
                    let local_bin_opencode = home.join(".local").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" });
                    if local_bin_opencode.exists() {
                        let _ = std::fs::remove_file(local_bin_opencode);
                        println!("local bin opencode wiped.");
                    }

                    let ollama_dir = home.join(".ollama");
                    if ollama_dir.exists() {
                        #[cfg(windows)]
                        let _ = std::process::Command::new("taskkill").args(&["/IM", "ollama.exe", "/F"]).status();
                        #[cfg(not(windows))]
                        let _ = std::process::Command::new("killall").arg("ollama").status();
                        
                        let _ = std::fs::remove_dir_all(ollama_dir);
                        println!(".ollama directory wiped.");
                    }

                    // Attempt to wipe the actual Ollama binaries for a true fresh start during dev
                    #[cfg(target_os = "macos")]
                    {
                        let ollama_app = std::path::Path::new("/Applications/Ollama.app");
                        if ollama_app.exists() {
                            let _ = std::fs::remove_dir_all(ollama_app);
                            println!("Ollama.app wiped.");
                        }
                    }

                    #[cfg(any(target_os = "macos", target_os = "linux"))]
                    {
                        let ollama_bin = std::path::Path::new("/usr/local/bin/ollama");
                        if ollama_bin.exists() {
                            // If this fails due to permissions, the developer might need to run sudo rm manually
                            let _ = std::fs::remove_file(ollama_bin);
                            println!("Ollama binary wiped.");
                        }
                    }
                }
            }

            if env::args().any(|arg| arg == "--minimized") || start_minimized {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_model_override,
            get_launch_options,
            set_credential,
            get_credential,
            delete_credential,
            wipe_credentials,
            check_hermes_status,
            check_opencode_status,
            check_ollama_status,
            get_hermes_version,
            get_opencode_version,
            uninstall_ollama,
            detect_vram,
            detect_hardware_profile,
            spawn_pty,
            write_pty,
            kill_pty,
            resize_pty,
            configure_hermes_defaults,
            configure_opencode_defaults,
            deploy_local_model,
            get_frugallm_config,
            set_frugallm_config,
            edit_hermes_soul,
            is_wipe_mode,
            get_local_ips,
            restart_app,
            get_routing_chain,
            set_routing_chain,
            refresh_routing_chain,
            check_tool_gateway_status,
            set_tool_gateway_installed,
            get_model_tag_for_vram
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");
        
    app.run(|app_handle, event| {
        match event {
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                let state = app_handle.state::<FrugalConfigState>();
                if state.is_dirty.swap(false, std::sync::atomic::Ordering::AcqRel) {
                    let config_clone = if let Ok(guard) = state.config.try_lock() {
                        guard.clone()
                    } else {
                        tauri::async_runtime::block_on(async {
                            let guard = state.config.lock().await;
                            guard.clone()
                        })
                    };
                    if let Ok(path) = get_config_path(app_handle) {
                        if let Ok(json) = serde_json::to_string_pretty(&config_clone) {
                            let _ = std::fs::write(path, json);
                        }
                    }
                }
            }
            tauri::RunEvent::WindowEvent { event: tauri::WindowEvent::CloseRequested { .. }, .. } => {
                let state = app_handle.state::<FrugalConfigState>();
                if state.is_dirty.swap(false, std::sync::atomic::Ordering::AcqRel) {
                    let config_clone = if let Ok(guard) = state.config.try_lock() {
                        guard.clone()
                    } else {
                        tauri::async_runtime::block_on(async {
                            let guard = state.config.lock().await;
                            guard.clone()
                        })
                    };
                    if let Ok(path) = get_config_path(app_handle) {
                        if let Ok(json) = serde_json::to_string_pretty(&config_clone) {
                            let _ = std::fs::write(path, json);
                        }
                    }
                }
            }
            _ => {}
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_is_hermes_installed_mocked() {
        let temp_dir = tempfile::tempdir().unwrap();
        let home = temp_dir.path();
        
        // Initially not installed
        assert_eq!(is_hermes_installed(home), false);
        
        // Mock installation in .hermes/bin
        let bin_dir = home.join(".hermes").join("bin");
        fs::create_dir_all(&bin_dir).unwrap();
        
        let exe_name = if cfg!(windows) { "hermes.exe" } else { "hermes" };
        let hermes_exe = bin_dir.join(exe_name);
        fs::File::create(&hermes_exe).unwrap();
        
        assert_eq!(is_hermes_installed(home), true);
    }

    #[test]
    fn test_is_opencode_installed_mocked() {
        let temp_dir = tempfile::tempdir().unwrap();
        let home = temp_dir.path();
        
        assert_eq!(is_opencode_installed(home), false);
        
        let bin_dir = home.join(".local").join("bin");
        fs::create_dir_all(&bin_dir).unwrap();
        
        let exe_name = if cfg!(windows) { "opencode.exe" } else { "opencode" };
        let opencode_exe = bin_dir.join(exe_name);
        fs::File::create(&opencode_exe).unwrap();
        
        assert_eq!(is_opencode_installed(home), true);
    }

    #[test]
    fn test_is_ollama_in_paths() {
        let temp_dir = tempfile::tempdir().unwrap();
        
        let mock_ollama_path = temp_dir.path().join("mock_ollama");
        fs::File::create(&mock_ollama_path).unwrap();
        
        let path_str = mock_ollama_path.to_str().unwrap();
        let paths = vec![path_str];
        
        assert_eq!(is_ollama_in_paths(&paths), true);
        assert_eq!(is_ollama_in_paths(&["/invalid/nonexistent/path/to/ollama"]), false);
    }

    #[test]
    fn test_dummy_pty_execution() {
        use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
        use std::io::Read;

        let pty_system = NativePtySystem::default();
        let pair = pty_system.openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        }).unwrap();

        let mut cmd = if cfg!(windows) {
            CommandBuilder::new("powershell.exe")
        } else {
            CommandBuilder::new("bash")
        };
        
        // Simulating the 'install' command string passed by the frontend
        if cfg!(windows) {
            cmd.args(["-Command", "Write-Output 'Installing Ollama...'"]);
        } else {
            cmd.args(["-c", "echo 'Installing Ollama...'"]);
        }

        let mut child = pair.slave.spawn_command(cmd).unwrap();
        drop(pair.slave); // close slave so reader gets EOF when child exits

        let mut reader = pair.master.try_clone_reader().unwrap();
        
        std::thread::spawn(move || {
            let _ = child.wait();
        });

        let mut output = String::new();
        let mut buf = [0u8; 128];
        for _ in 0..100 {
            if let Ok(n) = reader.read(&mut buf) {
                if n > 0 {
                    output.push_str(&String::from_utf8_lossy(&buf[..n]));
                    if output.contains("Installing Ollama...") {
                        break;
                    }
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        
        assert!(output.contains("Installing Ollama..."));
    }

    #[test]
    fn test_calculate_gemma_128k_q8_kv_cache() {
        use crate::telemetry::calculate_gemma_128k_q8_kv_cache;

        // gemma4:e2b (26 layers, 4 kv heads, head_dim 256):
        // 5 global layers (128k), 21 sliding layers (1024), bytes_per_value = 1
        let kv_e2b = calculate_gemma_128k_q8_kv_cache(26, 4, 256);
        assert_eq!(kv_e2b, 1_386_217_472); // ~1.29 GB

        // gemma4:e4b (32 layers, 8 kv heads, head_dim 256):
        // 6 global layers (128k), 26 sliding layers (1024), bytes_per_value = 1
        let kv_e4b = calculate_gemma_128k_q8_kv_cache(32, 8, 256);
        assert_eq!(kv_e4b, 3_330_277_376); // ~3.10 GB
    }

    #[test]
    fn test_compute_memory_segments_discrete_gpu_spillover() {
        use crate::telemetry::{compute_memory_segments, HardwareProfile, OllamaState};

        // 8GB Dedicated VRAM, 32GB System RAM (e.g. Intel MacBook / PC)
        let profile = HardwareProfile {
            is_unified: false,
            dedicated_vram: 8 * 1024 * 1024 * 1024,
            system_ram: 32 * 1024 * 1024 * 1024,
            execution_ceiling: 8 * 1024 * 1024 * 1024,
            os_architecture: "macos-x86_64".into(),
        };

        let ollama = OllamaState::default(); // Pre-flight
        let segments = compute_memory_segments(&profile, &ollama, "gemma4:e4b");

        assert_eq!(segments.phase, "preflight");
        assert_eq!(segments.execution_ceiling_bytes, 8 * 1024 * 1024 * 1024);
        assert!(segments.total_projected_bytes > segments.execution_ceiling_bytes);
        assert_eq!(segments.spillover_type, "system_ram");
        assert!(segments.triggers_warning);
        assert!(segments.warning_message.contains("Model & 128k context exceed Dedicated VRAM"));
    }

    #[test]
    fn test_compute_memory_segments_apple_silicon_unified() {
        use crate::telemetry::{compute_memory_segments, HardwareProfile, OllamaState};

        // 16GB Unified RAM (Available: 14GB after 2GB reserve)
        let profile = HardwareProfile {
            is_unified: true,
            dedicated_vram: 0,
            system_ram: 16 * 1024 * 1024 * 1024,
            execution_ceiling: 14 * 1024 * 1024 * 1024,
            os_architecture: "macos-arm64".into(),
        };

        // 1. gemma4:e2b fits inside 14GB
        let ollama = OllamaState::default();
        let segments_e2b = compute_memory_segments(&profile, &ollama, "gemma4:e2b");
        assert_eq!(segments_e2b.phase, "preflight");
        assert_eq!(segments_e2b.spillover_bytes, 0);
        assert_eq!(segments_e2b.spillover_type, "none");
        assert!(!segments_e2b.triggers_warning);

        // 2. gemma4:31b overflows 14GB unified memory -> SSD swap warning
        let segments_31b = compute_memory_segments(&profile, &ollama, "gemma4:31b");
        assert!(segments_31b.spillover_bytes > 0);
        assert_eq!(segments_31b.spillover_type, "ssd_swap");
        assert!(segments_31b.triggers_warning);
        assert!(segments_31b.warning_message.contains("Memory exceeds available Unified Memory"));
    }

    #[test]
    fn test_get_model_tag_for_vram_zero_spillover() {
        // 8.0 GB VRAM -> must return gemma4:e2b (~3.19 GB footprint). (gemma4:e4b is ~8.50 GB and must fail).
        assert_eq!(get_model_tag_for_vram(8.0), "gemma4:e2b");

        // 12.0 GB VRAM -> must return gemma4:e4b (~8.50 GB footprint).
        assert_eq!(get_model_tag_for_vram(12.0), "gemma4:e4b");

        // 24.0 GB VRAM -> must return gemma4:12b (~17.13 GB footprint).
        assert_eq!(get_model_tag_for_vram(24.0), "gemma4:12b");

        // 40.0 GB VRAM (e.g. A6000) -> must return gemma4:26b (~32.66 GB footprint).
        assert_eq!(get_model_tag_for_vram(40.0), "gemma4:26b");

        // 48.0 GB+ VRAM -> must return gemma4:31b (~43.86 GB footprint).
        assert_eq!(get_model_tag_for_vram(48.0), "gemma4:31b");
        assert_eq!(get_model_tag_for_vram(64.0), "gemma4:31b");

        // Fallback for severely limited VRAM (e.g., 2GB or 4GB)
        assert_eq!(get_model_tag_for_vram(2.0), "gemma4:e2b");
        assert_eq!(get_model_tag_for_vram(4.0), "gemma4:e2b");
    }
}
