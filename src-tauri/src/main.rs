// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod telemetry;

use std::env;
use keyring::Entry;
use tauri::{Manager, State, Emitter};
use std::sync::{Arc, Mutex};

/// Holds the `ollama serve` child process for the lifetime of the application.
/// Stored in Tauri managed state so the handle is never dropped or leaked.
struct OllamaDaemonState {
    child: tokio::sync::Mutex<Option<tokio::process::Child>>,
}

struct DynamicRosterState {
    fallback_chain: Arc<tokio::sync::RwLock<Vec<serde_json::Value>>>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(default)]
pub struct FrugalConfig {
    pub port: u16,
    pub bind_all_interfaces: bool,
    pub api_password: Option<String>,
    pub tokens_used_session: u64,
    pub tokens_used_lifetime: u64,
    pub opencode_workspace: Option<String>,
    pub hermes_workspace: Option<String>,
}

impl Default for FrugalConfig {
    fn default() -> Self {
        Self {
            port: 0,
            bind_all_interfaces: false,
            api_password: None,
            tokens_used_session: 0,
            tokens_used_lifetime: 0,
            opencode_workspace: None,
            hermes_workspace: None,
        }
    }
}

pub struct FrugalConfigState {
    pub config: std::sync::Arc<tokio::sync::Mutex<FrugalConfig>>,
    pub server_abort_handle: std::sync::Arc<tokio::sync::Mutex<Option<tauri::async_runtime::JoinHandle<()>>>>,
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
    let entry = Entry::new("frugallm-app", service).map_err(|e| e.to_string())?;
    entry.set_password(secret).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_credential(service: &str) -> Result<String, String> {
    let entry = Entry::new("frugallm-app", service).map_err(|e| e.to_string())?;
    entry.get_password().map_err(|e| e.to_string())
}

#[tauri::command]
fn wipe_credentials() -> Result<(), String> {
    if let Ok(entry) = Entry::new("frugallm-app", "openrouter") {
        let _ = entry.delete_credential();
    }
    Ok(())
}

#[tauri::command]
fn check_hermes_status(app: tauri::AppHandle) -> bool {
    if let Ok(home) = app.path().home_dir() {
        let local_bin_hermes = home.join(".local").join("bin").join(if cfg!(windows) { "hermes.exe" } else { "hermes" });
        if local_bin_hermes.exists() {
            return true;
        }
        let hermes_path = home.join(".hermes").join("bin").join(if cfg!(windows) { "hermes.exe" } else { "hermes" });
        return hermes_path.exists();
    }
    false
}

#[tauri::command]
fn check_opencode_status(app: tauri::AppHandle) -> bool {
    if let Ok(home) = app.path().home_dir() {
        let local_bin_opencode = home.join(".local").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" });
        if local_bin_opencode.exists() {
            return true;
        }
        let opencode_path = home.join(".opencode").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" });
        return opencode_path.exists();
    }
    false
}

#[tauri::command(async)]
async fn check_ollama_status() -> bool {
    // 1. Check if it's currently running via its local API
    if reqwest::get("http://127.0.0.1:11434/api/version").await.is_ok() {
        return true;
    }

    // 2. Check if the binary is in PATH
    if std::process::Command::new("ollama")
        .arg("--version")
        .output()
        .is_ok()
    {
        return true;
    }
    
    // 3. Fallback: check common installation paths
    let paths = [
        "/usr/local/bin/ollama", 
        "/opt/homebrew/bin/ollama", 
        "/usr/bin/ollama",
        "/Applications/Ollama.app/Contents/MacOS/Ollama"
    ];
    for p in paths.iter() {
        if std::path::Path::new(p).exists() {
            return true;
        }
    }
    
    false
}

#[tauri::command(async)]
async fn detect_vram() -> Result<u64, String> {
    // Step 1: NVIDIA via NVML
    #[cfg(not(target_os = "macos"))]
    {
        use nvml_wrapper::Nvml;
        if let Ok(nvml) = Nvml::init() {
            if let Ok(device) = nvml.device_by_index(0) {
                if let Ok(memory) = device.memory_info() {
                    return Ok(memory.total / 1024 / 1024);
                }
            }
        }
    }

    // Step 2: Apple Silicon / Mac OS
    #[cfg(target_os = "macos")]
    {
        // Try Apple Silicon first
        if let Ok(output) = tokio::process::Command::new("sysctl").arg("-n").arg("iogpu.wired_limit_mb").output().await {
            if output.status.success() {
                if let Ok(mem_str) = String::from_utf8(output.stdout) {
                    if let Ok(mem_mb) = mem_str.trim().parse::<u64>() {
                        if mem_mb > 0 {
                            return Ok(mem_mb);
                        }
                    }
                }
            }
        }
        
        // Fallback to Intel Mac (system_profiler)
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
                    if max_vram_mb > 0 {
                        return Ok(max_vram_mb);
                    }
                }
            }
        }
    }

    // Step 3: Fallback (CPU-only / Unknown)
    Ok(0)
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

struct NotifyOnDrop {
    app: tauri::AppHandle,
    source: String,
    target: String,
    token_estimate: Arc<std::sync::atomic::AtomicUsize>,
}
impl Drop for NotifyOnDrop {
    fn drop(&mut self) {
        let _ = self.app.emit("proxy_activity", ProxyActivityPayload {
            source: self.source.clone(),
            target: self.target.clone(),
            is_active: false,
        });

        let tokens = self.token_estimate.load(std::sync::atomic::Ordering::Relaxed);
        if tokens > 0 {
            let app_handle = self.app.clone();
            tauri::async_runtime::spawn(async move {
                let state = app_handle.state::<FrugalConfigState>();
                let mut config = state.config.lock().await;
                config.tokens_used_session += tokens as u64;
                config.tokens_used_lifetime += tokens as u64;
                if let Ok(path) = get_config_path(&app_handle) {
                    if let Ok(json) = serde_json::to_string_pretty(&*config) {
                        let _ = std::fs::write(path, json);
                    }
                }
                let _ = app_handle.emit("frugallm_config_updated", ());
            });
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
    if let Some(obj) = body.as_object_mut() {
        if !obj.contains_key("options") {
            obj.insert("options".to_string(), json!({ "num_ctx": 131072 }));
        } else if let Some(options) = obj.get_mut("options").and_then(|o| o.as_object_mut()) {
            if !options.contains_key("num_ctx") {
                options.insert("num_ctx".to_string(), json!(131072));
            }
        }
    }

    let _ = app.emit("proxy_activity", ProxyActivityPayload {
        source: source.to_string(),
        target: "ollama".to_string(),
        is_active: true,
    });

    let token_estimate = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let drop_guard = NotifyOnDrop {
        app: app.clone(),
        source: source.to_string(),
        target: "ollama".to_string(),
        token_estimate: token_estimate.clone(),
    };

    let res = client.post("http://127.0.0.1:11434/v1/chat/completions")
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
        let stream = res.bytes_stream().inspect(move |chunk| {
            let _ = &drop_guard;
            if let Ok(bytes) = chunk {
                let tokens = bytes.len() / 4;
                drop_guard.token_estimate.fetch_add(tokens, std::sync::atomic::Ordering::Relaxed);
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

async fn try_openrouter(
    app: &tauri::AppHandle,
    client: &reqwest::Client,
    body: &Value,
    source: &str,
) -> Result<axum::response::Response, String> {
    let openrouter_key = crate::get_credential("openrouter")
        .map_err(|_| "OpenRouter API key not found".to_string())?;

    let mut body = body.clone();
    
    let fallback_models = {
        let state = app.state::<DynamicRosterState>();
        let chain = state.fallback_chain.read().await;
        chain.clone()
    };
    
    let primary_model = fallback_models.first().cloned().unwrap_or(serde_json::json!("openrouter/auto"));
    
    if let Some(obj) = body.as_object_mut() {
        obj.insert("model".to_string(), primary_model);
        obj.insert("models".to_string(), serde_json::json!(fallback_models));
        // Strip reasoning_effort as it causes OpenRouter to return 400 Bad Request for non-reasoning models
        obj.remove("reasoning_effort");
    }

    let _ = app.emit("proxy_activity", ProxyActivityPayload {
        source: source.to_string(),
        target: "openrouter".to_string(),
        is_active: true,
    });

    let token_estimate = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let drop_guard = NotifyOnDrop {
        app: app.clone(),
        source: source.to_string(),
        target: "openrouter".to_string(),
        token_estimate: token_estimate.clone(),
    };

    let res = client.post("https://openrouter.ai/api/v1/chat/completions")
        .bearer_auth(openrouter_key)
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
        let stream = res.bytes_stream().inspect(move |chunk| {
            let _ = &drop_guard;
            if let Ok(bytes) = chunk {
                let tokens = bytes.len() / 4;
                drop_guard.token_estimate.fetch_add(tokens, std::sync::atomic::Ordering::Relaxed);
            }
            let _ = app_clone.emit("proxy_activity", ProxyActivityPayload {
                source: source_clone.clone(),
                target: "openrouter".to_string(),
                is_active: true,
            });
        });
        Ok(builder.body(axum::body::Body::from_stream(stream)).unwrap())
    } else {
        let status = res.status();
        let error_body = res.text().await.unwrap_or_else(|_| "Could not read error body".to_string());
        
        // Log to file for debugging
        let debug_info = format!("Status: {}\nRequest Body: {}\nError Body: {}\n", status, serde_json::to_string_pretty(&body).unwrap_or_default(), error_body);
        let _ = std::fs::write("/tmp/frugallm_openrouter_error.txt", debug_info);
        
        println!("OpenRouter API error ({}): {}", status, error_body);
        Err(format!("OpenRouter API error: HTTP {} - {}", status, error_body))
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

    let client = reqwest::Client::new();
    
    // Determine if Ollama is viable (skip if CPU-only)
    let mut ollama_running = false;
    let mut ollama_viable = false;
    let mut ollama_model = "llama3:8b".to_string();
    
    if let Ok(tags_res) = client.get("http://127.0.0.1:11434/api/tags").send().await {
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
                }
            }
        }
    }
    
    if ollama_running {
        if let Ok(ps_res) = client.get("http://127.0.0.1:11434/api/ps").send().await {
            if let Ok(ps_json) = ps_res.json::<Value>().await {
                if let Some(models) = ps_json.get("models").and_then(|m| m.as_array()) {
                    if let Some(first) = models.first() {
                        let size = first.get("size").and_then(|s| s.as_u64()).unwrap_or(0);
                        let size_vram = first.get("size_vram").and_then(|s| s.as_u64()).unwrap_or(0);
                        // Only prefer Ollama if it's using GPU/Hybrid (size_vram > 0) or if size is unknown
                        if size_vram > 0 || size == 0 {
                            ollama_viable = true;
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
        order.push("openrouter");
    } else {
        order.push("openrouter");
        // Only fallback to ollama if we know it's running (even if CPU only or idle)
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
            "openrouter" => {
                match try_openrouter(&app, &client, &body, &source).await {
                    Ok(response) => return response,
                    Err(e) => errors.push(format!("OpenRouter failed: {}", e)),
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
    updated_config.tokens_used_lifetime = config.tokens_used_lifetime;
    updated_config.tokens_used_session = config.tokens_used_session;
    
    let port_changed = config.port != updated_config.port;
    let ip_changed = config.bind_all_interfaces != updated_config.bind_all_interfaces;
    
    *config = updated_config.clone();
    
    let path = get_config_path(&app)?;
    if let Ok(json) = serde_json::to_string_pretty(&*config) {
        let _ = std::fs::write(path, json);
    }

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

fn extract_parameter_count(id: &str) -> f64 {
    let lower = id.to_lowercase();
    let mut max_params = 0.0;
    
    let chars: Vec<char> = lower.chars().collect();
    for (i, &c) in chars.iter().enumerate() {
        if c == 'b' && i > 0 {
            let mut num_str = String::new();
            let mut j = i - 1;
            while j < chars.len() && (chars[j].is_ascii_digit() || chars[j] == '.') {
                num_str.insert(0, chars[j]);
                if j == 0 { break; }
                j -= 1;
            }
            if let Ok(val) = num_str.parse::<f64>() {
                let valid_prefix = if num_str.len() == i {
                    true
                } else {
                    let prefix_char = chars[i - num_str.len() - 1];
                    !prefix_char.is_alphabetic()
                };
                
                if valid_prefix && val > max_params {
                    max_params = val;
                }
            }
        }
    }
    max_params
}

async fn fetch_dynamic_roster(client: &reqwest::Client) -> Result<Vec<serde_json::Value>, String> {
    let res = client.get("https://openrouter.ai/api/v1/models").send().await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    let mut free_models = Vec::new();
    
    if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
        for model in data {
            let is_free = model.get("pricing").and_then(|p| {
                let prompt = p.get("prompt").and_then(|pr| {
                    if let Some(s) = pr.as_str() { s.parse::<f64>().ok() }
                    else if let Some(n) = pr.as_f64() { Some(n) }
                    else { None }
                }).unwrap_or(1.0);
                let completion = p.get("completion").and_then(|c| {
                    if let Some(s) = c.as_str() { s.parse::<f64>().ok() }
                    else if let Some(n) = c.as_f64() { Some(n) }
                    else { None }
                }).unwrap_or(1.0);
                Some(prompt == 0.0 && completion == 0.0)
            }).unwrap_or(false);
            
            if !is_free { continue; }
            
            let has_tools = model.get("supported_parameters").and_then(|params| params.as_array()).map(|params| {
                params.iter().any(|p| p.as_str() == Some("tools"))
            }).unwrap_or(false);
            
            if !has_tools { continue; }
            free_models.push(model.clone());
        }
    }
    
    free_models.sort_by(|a, b| {
        let a_id = a.get("id").and_then(|i| i.as_str()).unwrap_or("");
        let b_id = b.get("id").and_then(|i| i.as_str()).unwrap_or("");
        
        let a_params = extract_parameter_count(a_id);
        let b_params = extract_parameter_count(b_id);
        
        match b_params.partial_cmp(&a_params) {
            Some(std::cmp::Ordering::Equal) | None => {
                let a_created = a.get("created").and_then(|c| c.as_u64()).unwrap_or(0);
                let b_created = b.get("created").and_then(|c| c.as_u64()).unwrap_or(0);
                b_created.cmp(&a_created)
            }
            Some(ordering) => ordering,
        }
    });
    
    let ids: Vec<serde_json::Value> = free_models.into_iter().filter_map(|m| {
        m.get("id").cloned()
    }).collect();
    
    Ok(ids)
}

async fn start_dynamic_roster_poll(state: Arc<tokio::sync::RwLock<Vec<serde_json::Value>>>) {
    let client = reqwest::Client::new();
    loop {
        if let Ok(mut roster) = fetch_dynamic_roster(&client).await {
            if !roster.is_empty() {
                if !roster.contains(&serde_json::json!("openrouter/auto")) {
                    roster.push(serde_json::json!("openrouter/auto"));
                }
                *state.write().await = roster;
                println!("Dynamic OpenRouter roster updated.");
            }
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(300)).await;
    }
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
    // Check if the binary already exists on PATH
    if tokio::process::Command::new("ollama")
        .arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false)
    {
        return Ok(());
    }

    let _ = app.emit("installing_ollama", ());

    #[cfg(not(target_os = "windows"))]
    {
        // CRITICAL: Use .status() instead of .output().
        // The Ollama install script on macOS spawns a background daemon that
        // inherits stdout/stderr. If we waited for pipes to close (e.g. using .output()),
        // it would hang indefinitely. Instead, we use .spawn() and child.wait() which
        // only waits for the shell process to exit, while the piped readers run independently.
        let mut child = tokio::process::Command::new("sh")
            .arg("-c")
            .arg("curl -fsSL https://ollama.com/install.sh | sh")
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

        let status = child.wait().await.map_err(|e| e.to_string())?;

        if !status.success() {
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

    // Spawn daemon in background — pipe stderr so we can stream boot logs
    let mut child = tokio::process::Command::new("ollama")
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

fn get_model_tag_for_vram(vram_mb: u64) -> Result<&'static str, String> {
    if vram_mb >= 32000 {
        Ok("gemma4:31b")
    } else if vram_mb >= 24000 {
        Ok("gemma4:26b")
    } else if vram_mb >= 12000 {
        Ok("gemma4:12b")
    } else if vram_mb >= 8000 {
        Ok("gemma4:e4b")
    } else if vram_mb >= 4000 {
        Ok("gemma4:e2b")
    } else {
        Err("Hardware does not meet minimum requirements (< 4GB VRAM).".into())
    }
}

#[derive(serde::Serialize, Clone)]
struct DownloadProgress {
    status: String,
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
    let tag = get_model_tag_for_vram(vram_mb)?.to_string();

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
                                            if now.duration_since(last_emit) > tokio::time::Duration::from_millis(100) || percent == 100 {
                                                let _ = app_clone.emit("model_download_progress", percent);
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


        let child_res = tokio::process::Command::new("ollama")
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

fn main() {
    let args: Vec<String> = env::args().collect();
    
    if args.contains(&"--wipe".to_string()) {
        println!("Wiping credentials and store...");
        let _ = wipe_credentials();
    }

    let app = tauri::Builder::default()
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
            if let Ok(path) = get_config_path(&app_handle) {
                if let Ok(json) = std::fs::read_to_string(path) {
                    if let Ok(parsed) = serde_json::from_str::<FrugalConfig>(&json) {
                        frugal_config = parsed;
                        frugal_config.tokens_used_session = 0;
                    }
                }
            }
            let config_arc = Arc::new(tokio::sync::Mutex::new(frugal_config));
            
            let server_abort_handle = Arc::new(tokio::sync::Mutex::new(None));
            app.manage(FrugalConfigState {
                config: config_arc.clone(),
                server_abort_handle: server_abort_handle.clone(),
            });

            let dynamic_roster_state = DynamicRosterState {
                fallback_chain: Arc::new(tokio::sync::RwLock::new(vec![serde_json::json!("openrouter/auto")])),
            };
            let roster_chain = dynamic_roster_state.fallback_chain.clone();
            app.manage(dynamic_roster_state);

            tauri::async_runtime::spawn(async move {
                start_dynamic_roster_poll(roster_chain).await;
            });

            // Spawn FrugalLLM Core Server
            let abort_handle = tauri::async_runtime::spawn(async move {
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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_launch_options,
            set_credential,
            get_credential,
            wipe_credentials,
            check_hermes_status,
            check_opencode_status,
            check_ollama_status,
            detect_vram,
            spawn_pty,
            write_pty,
            kill_pty,
            resize_pty,
            configure_hermes_defaults,
            configure_opencode_defaults,
            deploy_local_model,
            get_frugallm_config,
            set_frugallm_config,
            edit_hermes_soul
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");
        
    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            // Child processes spawned via PTY will be killed by OS or by SIGHUP when master PTYs drop.
        }
    });
}
