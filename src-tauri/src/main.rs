// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use keyring::Entry;
use tauri::{Manager, State, Emitter};
use std::sync::{Arc, Mutex};

/// Holds the `ollama serve` child process for the lifetime of the application.
/// Stored in Tauri managed state so the handle is never dropped or leaked.
struct OllamaDaemonState {
    child: tokio::sync::Mutex<Option<tokio::process::Child>>,
}

#[derive(serde::Serialize)]
struct LaunchOptions {
    openrouter_key: Option<String>,
    local_llm_ip: Option<String>,
}

struct PtyState {
    writer: Arc<Mutex<Option<Box<dyn std::io::Write + Send>>>>,
    master: Arc<Mutex<Option<Box<dyn portable_pty::MasterPty + Send>>>>,
    child: Arc<Mutex<Option<Box<dyn portable_pty::Child + Send + Sync>>>>,
}

impl Default for PtyState {
    fn default() -> Self {
        Self {
            writer: Arc::new(Mutex::new(None)),
            master: Arc::new(Mutex::new(None)),
            child: Arc::new(Mutex::new(None)),
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
        let hermes_path = home.join(".hermes").join("bin").join(if cfg!(windows) { "hermes.exe" } else { "hermes" });
        return hermes_path.exists();
    }
    false
}

#[tauri::command]
fn check_opencode_status(app: tauri::AppHandle) -> bool {
    if let Ok(home) = app.path().home_dir() {
        let opencode_path = home.join(".opencode").join("bin").join(if cfg!(windows) { "opencode.exe" } else { "opencode" });
        return opencode_path.exists();
    }
    false
}

#[tauri::command]
fn check_ollama_status() -> bool {
    std::process::Command::new("ollama")
        .arg("--version")
        .output()
        .is_ok()
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
        *state_writer = Some(writer);
    }
    
    if let Ok(mut state_master) = state.master.lock() {
        *state_master = Some(pair.master);
    }

    let app_clone = app.clone();
    std::thread::spawn(move || {
        if let Ok(status) = child.wait() {
            let exit_code = if status.success() { 0 } else { 1 };
            #[derive(serde::Serialize, Clone)]
            struct ExitPayload {
                exit_code: u32,
            }
            let _ = app_clone.emit("pty_exit", ExitPayload { exit_code });
        }
    });

    std::thread::spawn(move || {
        let mut buf = [0u8; 1024];
        while let Ok(n) = reader.read(&mut buf) {
            if n == 0 { break; }
            let s = String::from_utf8_lossy(&buf[..n]);
            let _ = app.emit("pty_output", s.into_owned());
        }
    });

    Ok(())
}

#[tauri::command]
fn write_pty(state: State<'_, PtyState>, data: String) -> Result<(), String> {
    if let Ok(mut writer_opt) = state.writer.lock() {
        if let Some(writer) = writer_opt.as_mut() {
            writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
            writer.flush().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn kill_pty(state: State<'_, PtyState>) -> Result<(), String> {
    if let Ok(mut writer_opt) = state.writer.lock() {
        *writer_opt = None;
    }
    if let Ok(mut master_opt) = state.master.lock() {
        *master_opt = None;
    }
    Ok(())
}

#[tauri::command]
fn resize_pty(state: State<'_, PtyState>, rows: u16, cols: u16) -> Result<(), String> {
    if let Ok(mut master_opt) = state.master.lock() {
        if let Some(master) = master_opt.as_mut() {
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

async fn chat_completions(Json(mut body): Json<Value>) -> axum::response::Response {
    let client = reqwest::Client::new();
    
    // Attempt Ollama first
    let mut ollama_model = "llama3:8b".to_string();
    if let Ok(tags_res) = client.get("http://127.0.0.1:11434/api/tags").send().await {
        if let Ok(tags_json) = tags_res.json::<Value>().await {
            if let Some(models) = tags_json.get("models").and_then(|m| m.as_array()) {
                if let Some(first_model) = models.first() {
                    if let Some(name) = first_model.get("name").and_then(|n| n.as_str()) {
                        ollama_model = name.to_string();
                    }
                }
            }
        }
    }

    let original_model = body.get("model").cloned().unwrap_or(json!(""));
    if let Some(model) = body.get_mut("model") {
        *model = json!(ollama_model);
    }

    // Inject num_ctx to support 128k context window for Ollama
    if let Some(obj) = body.as_object_mut() {
        if !obj.contains_key("options") {
            obj.insert("options".to_string(), json!({ "num_ctx": 131072 }));
        } else if let Some(options) = obj.get_mut("options").and_then(|o| o.as_object_mut()) {
            if !options.contains_key("num_ctx") {
                options.insert("num_ctx".to_string(), json!(131072));
            }
        }
    }
    
    let ollama_res = client.post("http://127.0.0.1:11434/v1/chat/completions")
        .json(&body)
        .send()
        .await;

    if let Ok(response) = ollama_res {
        if response.status().is_success() {
            let mut builder = axum::response::Response::builder()
                .status(response.status());
            for (key, value) in response.headers() {
                builder = builder.header(key.clone(), value.clone());
            }
            let stream = response.bytes_stream();
            let body = axum::body::Body::from_stream(stream);
            return builder.body(body).unwrap();
        }
    }

    // Fallback to OpenRouter
    let openrouter_key = match crate::get_credential("openrouter") {
        Ok(k) => k,
        Err(_) => return axum::response::Response::builder()
            .status(500)
            .body(axum::body::Body::from("OpenRouter API key not found and Ollama is not running. Please connect a provider in the FrugalLLM UI."))
            .unwrap(),
    };
    
    if let Some(model) = body.get_mut("model") {
        *model = json!("anthropic/claude-3-haiku");
    }

    let res = client.post("https://openrouter.ai/api/v1/chat/completions")
        .bearer_auth(openrouter_key)
        .json(&body)
        .send()
        .await;

    match res {
        Ok(response) => {
            let mut builder = axum::response::Response::builder()
                .status(response.status());
            
            for (key, value) in response.headers() {
                builder = builder.header(key.clone(), value.clone());
            }
            
            let stream = response.bytes_stream();
            let body = axum::body::Body::from_stream(stream);
            builder.body(body).unwrap()
        }
        Err(e) => {
            axum::response::Response::builder()
                .status(500)
                .body(axum::body::Body::from(format!("Failed to proxy to OpenRouter: {}", e)))
                .unwrap()
        }
    }
}

async fn start_frugallm_server() {
    let app = Router::new()
        .route("/v1/models", get(models))
        .route("/v1/chat/completions", post(chat_completions));

    if let Ok(listener) = TcpListener::bind("127.0.0.1:8080").await {
        println!("FrugalLLM core server listening on 127.0.0.1:8080");
        let _ = axum::serve(listener, app).await;
    } else {
        eprintln!("Failed to bind FrugalLLM server to 127.0.0.1:8080");
    }
}

// -----------------------------------------------------------------------------

#[tauri::command]
fn configure_hermes_defaults(app: tauri::AppHandle) -> Result<(), String> {
    if let Ok(home) = app.path().home_dir() {
        let hermes_dir = home.join(".hermes");
        if !hermes_dir.exists() {
            std::fs::create_dir_all(&hermes_dir).map_err(|e| e.to_string())?;
        }
        
        let config_path = hermes_dir.join("config.yaml");
        let config_content = "model:\n  default: \"frugallm\"\n  provider: \"custom\"\n  base_url: \"http://127.0.0.1:8080/v1\"\n";
        std::fs::write(&config_path, config_content).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn configure_opencode_defaults(app: tauri::AppHandle) -> Result<(), String> {
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
                        "baseURL": "http://127.0.0.1:8080/v1",
                        "apiKey": "sk-frugallm"
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
        .manage(PtyState::default())
        .manage(OllamaDaemonState { child: tokio::sync::Mutex::new(None) })
        .setup(|app| {
            // Spawn FrugalLLM Core Server
            tauri::async_runtime::spawn(async move {
                start_frugallm_server().await;
            });
            
            if env::args().any(|arg| arg == "--wipe") {
                if let Ok(app_data_dir) = app.path().app_data_dir() {
                    let store_path = app_data_dir.join("store.json");
                    if store_path.exists() {
                        let _ = std::fs::remove_file(store_path);
                        println!("store.json wiped.");
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

                    let opencode_dir = home.join(".opencode");
                    if opencode_dir.exists() {
                        #[cfg(windows)]
                        let _ = std::process::Command::new("taskkill").args(&["/IM", "opencode.exe", "/F"]).status();
                        #[cfg(not(windows))]
                        let _ = std::process::Command::new("killall").arg("opencode").status();
                        
                        let _ = std::fs::remove_dir_all(opencode_dir);
                        println!(".opencode directory wiped.");
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
            deploy_local_model
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");
        
    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            let child_arc = app_handle.state::<PtyState>().child.clone();
            let mut child_to_kill = None;
            if let Ok(mut child_opt) = child_arc.lock() {
                child_to_kill = child_opt.take();
            }
            if let Some(mut child) = child_to_kill {
                let _ = child.kill();
            }
        }
    });
}
