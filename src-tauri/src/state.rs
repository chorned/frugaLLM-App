use std::sync::{Arc, Mutex};
use std::collections::{HashMap, HashSet};
use tauri::{Manager, Emitter};

/// Holds the `ollama serve` child process for the lifetime of the application.
/// Stored in Tauri managed state so the handle is never dropped or leaked.
pub struct OllamaDaemonState {
    pub child: tokio::sync::Mutex<Option<tokio::process::Child>>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
pub struct ProviderStatusPayload {
    pub provider: String,
    pub status: String,
}

pub struct ProviderHealthState {
    pub live_statuses: Arc<tokio::sync::RwLock<HashMap<String, String>>>,
    pub provider_cooldowns: Arc<tokio::sync::RwLock<HashMap<String, std::time::Instant>>>,
    pub model_cooldowns: Arc<tokio::sync::RwLock<HashMap<String, std::time::Instant>>>,
    pub gated_models: Arc<tokio::sync::RwLock<HashSet<String>>>,
}

impl Default for ProviderHealthState {
    fn default() -> Self {
        Self {
            live_statuses: Arc::new(tokio::sync::RwLock::new(HashMap::new())),
            provider_cooldowns: Arc::new(tokio::sync::RwLock::new(HashMap::new())),
            model_cooldowns: Arc::new(tokio::sync::RwLock::new(HashMap::new())),
            gated_models: Arc::new(tokio::sync::RwLock::new(HashSet::new())),
        }
    }
}

pub async fn update_provider_status(
    app: &tauri::AppHandle,
    provider: &str,
    status: &str,
) {
    if let Some(health_state) = app.try_state::<ProviderHealthState>() {
        let mut statuses = health_state.live_statuses.write().await;
        statuses.insert(provider.to_string(), status.to_string());
    }
    let _ = app.emit("provider_status", ProviderStatusPayload {
        provider: provider.to_string(),
        status: status.to_string(),
    });
}

pub const MIN_CONTEXT_WINDOW: u64 = 128_000;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
pub struct CloudModel {
    pub model: String,
    pub provider: String,
    #[serde(default)]
    pub iq: f32,
    #[serde(default)]
    pub context_length: Option<u64>,
}

pub const FAST_TTFT_LIMIT: std::time::Duration = std::time::Duration::from_secs(10);
pub const LAST_RESORT_LIMIT: std::time::Duration = std::time::Duration::from_secs(120);
pub const COOLDOWN_PENALTY_DURATION: std::time::Duration = std::time::Duration::from_secs(300);

#[derive(Debug, Clone, PartialEq)]
pub enum CandidateTier {
    Healthy,
    Cooldown(std::time::Duration),
    CircuitBreakerActive,
    PermanentlyGated,
}

pub fn classify_candidate(
    model: &CloudModel,
    provider_cooldowns: &HashMap<String, std::time::Instant>,
    gated_models: &HashSet<String>,
    model_cooldowns: &HashMap<String, std::time::Instant>,
    now: std::time::Instant,
) -> CandidateTier {
    if let Some(ctx) = model.context_length {
        if ctx < MIN_CONTEXT_WINDOW {
            return CandidateTier::PermanentlyGated;
        }
    }
    if let Some(expiry) = provider_cooldowns.get(&model.provider) {
        if *expiry > now {
            return CandidateTier::CircuitBreakerActive;
        }
    }
    if gated_models.contains(&model.model) {
        return CandidateTier::PermanentlyGated;
    }
    if let Some(expiry) = model_cooldowns.get(&model.model) {
        if *expiry > now {
            return CandidateTier::Cooldown(*expiry - now);
        }
    }
    CandidateTier::Healthy
}

pub fn partition_candidates(
    chain: &[CloudModel],
    provider_cooldowns: &HashMap<String, std::time::Instant>,
    gated_models: &HashSet<String>,
    model_cooldowns: &HashMap<String, std::time::Instant>,
    now: std::time::Instant,
) -> (Vec<CloudModel>, Vec<CloudModel>) {
    let mut healthy = Vec::new();
    let mut cooldown = Vec::new();

    for model in chain {
        match classify_candidate(model, provider_cooldowns, gated_models, model_cooldowns, now) {
            CandidateTier::Healthy => healthy.push(model.clone()),
            CandidateTier::Cooldown(_) => cooldown.push(model.clone()),
            CandidateTier::CircuitBreakerActive | CandidateTier::PermanentlyGated => {}
        }
    }

    (healthy, cooldown)
}

pub fn evaluate_next_call_status(
    provider: &str,
    chain: &[CloudModel],
    provider_cooldowns: &HashMap<String, std::time::Instant>,
    gated_models: &HashSet<String>,
    model_cooldowns: &HashMap<String, std::time::Instant>,
    last_error_status: Option<&str>,
    now: std::time::Instant,
) -> String {
    // 1. If provider circuit breaker is active (e.g. 403 Forbidden)
    if let Some(expiry) = provider_cooldowns.get(provider) {
        if *expiry > now {
            return "403".to_string();
        }
    }

    let provider_models: Vec<&CloudModel> = chain.iter().filter(|m| m.provider == provider).collect();
    if provider_models.is_empty() {
        return last_error_status.unwrap_or("offline").to_string();
    }

    // 2. Check candidate states for this provider
    let mut has_healthy = false;
    let mut has_cooldown = false;
    let mut all_gated = true;

    for m in &provider_models {
        match classify_candidate(m, provider_cooldowns, gated_models, model_cooldowns, now) {
            CandidateTier::Healthy => {
                has_healthy = true;
                all_gated = false;
                break;
            }
            CandidateTier::Cooldown(_) => {
                has_cooldown = true;
                all_gated = false;
            }
            CandidateTier::CircuitBreakerActive => {
                return "403".to_string();
            }
            CandidateTier::PermanentlyGated => {}
        }
    }

    if has_healthy {
        "200 OK".to_string()
    } else if has_cooldown {
        if let Some(err) = last_error_status {
            if err == "429" || err == "500" || err == "503" || err == "timeout" {
                return err.to_string();
            }
        }
        "429".to_string()
    } else if all_gated {
        "404".to_string()
    } else {
        last_error_status.unwrap_or("200 OK").to_string()
    }
}

pub async fn refresh_provider_status_for_next_call(
    app: &tauri::AppHandle,
    provider: &str,
    last_error_status: Option<&str>,
) -> String {
    use tauri::Manager;
    if let (Some(health_state), Some(roster)) = (app.try_state::<ProviderHealthState>(), app.try_state::<DynamicRosterState>()) {
        let now = std::time::Instant::now();
        let chain_guard = roster.fallback_chain.read().await;
        let p_guard = health_state.provider_cooldowns.read().await;
        let g_guard = health_state.gated_models.read().await;
        let m_guard = health_state.model_cooldowns.read().await;

        let status = evaluate_next_call_status(
            provider,
            &chain_guard,
            &p_guard,
            &g_guard,
            &m_guard,
            last_error_status,
            now,
        );
        drop(p_guard);
        drop(g_guard);
        drop(m_guard);
        drop(chain_guard);

        update_provider_status(app, provider, &status).await;
        status
    } else {
        let fallback = last_error_status.unwrap_or("200 OK");
        update_provider_status(app, provider, fallback).await;
        fallback.to_string()
    }
}

pub struct DynamicRosterState {
    pub fallback_chain: Arc<tokio::sync::RwLock<Vec<CloudModel>>>,
}

pub fn default_true() -> bool {
    true
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(default)]
pub struct FrugalConfig {
    pub port: u16,
    pub bind_all_interfaces: bool,
    pub api_password: Option<String>,
    pub input_tokens_session: u64,
    pub output_tokens_session: u64,
    #[serde(default)]
    pub cached_tokens_session: u64,
    pub input_tokens_lifetime: u64,
    pub output_tokens_lifetime: u64,
    #[serde(default)]
    pub cached_tokens_lifetime: u64,
    pub opencode_workspace: Option<String>,
    pub hermes_workspace: Option<String>,
    #[serde(default)]
    pub start_minimized: bool,
    #[serde(default)]
    pub manual_model_overrides: Vec<String>,
    #[serde(default)]
    pub tool_enforcing_gateway: bool,
    #[serde(default = "default_true")]
    pub enable_paid_fallback: bool,
}

impl Default for FrugalConfig {
    fn default() -> Self {
        Self {
            port: 61721,
            bind_all_interfaces: false,
            api_password: None,
            input_tokens_session: 0,
            output_tokens_session: 0,
            cached_tokens_session: 0,
            input_tokens_lifetime: 0,
            output_tokens_lifetime: 0,
            cached_tokens_lifetime: 0,
            opencode_workspace: Some("~/OpenCode".to_string()),
            hermes_workspace: Some("~/Hermes".to_string()),
            start_minimized: false,
            manual_model_overrides: Vec::new(),
            tool_enforcing_gateway: false,
            enable_paid_fallback: true,
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "status", content = "data")]
pub enum ServerStatus {
    Starting,
    Running { port: u16, ip: String },
    PortConflict { port: u16, ip: String, message: String },
    Error { message: String },
}

pub struct FrugalConfigState {
    pub config: std::sync::Arc<tokio::sync::Mutex<FrugalConfig>>,
    pub server_abort_handle: std::sync::Arc<tokio::sync::Mutex<Option<tauri::async_runtime::JoinHandle<()>>>>,
    pub is_dirty: std::sync::Arc<std::sync::atomic::AtomicBool>,
    pub server_status: std::sync::Arc<tokio::sync::RwLock<ServerStatus>>,
}


pub struct PtyState {
    pub writer: Arc<Mutex<std::collections::HashMap<String, Box<dyn std::io::Write + Send>>>>,
    pub master: Arc<Mutex<std::collections::HashMap<String, Box<dyn portable_pty::MasterPty + Send>>>>,
}

impl Default for PtyState {
    fn default() -> Self {
        Self {
            writer: Arc::new(Mutex::new(std::collections::HashMap::new())),
            master: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }
}



#[derive(serde::Serialize, Clone, Debug)]
pub struct LaunchOptions {
    pub openrouter_key: Option<String>,
    pub local_llm_ip: Option<String>,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct ProxyActivityPayload {
    pub source: String,
    pub target: String,
    pub is_active: bool,
}

#[derive(serde::Serialize, Clone)]
pub struct ProxyModelErrorPayload {
    pub model: String,
    pub provider: String,
    pub error: String,
}

pub struct NotifyOnDrop {
    pub app: tauri::AppHandle,
    pub source: String,
    pub target: String,
    pub token_estimate: Arc<std::sync::atomic::AtomicUsize>,
    pub exact_output_tokens: Arc<std::sync::atomic::AtomicUsize>,
    pub exact_input_tokens: Arc<std::sync::atomic::AtomicUsize>,
    pub exact_cached_tokens: Arc<std::sync::atomic::AtomicUsize>,
    pub has_exact_input: Arc<std::sync::atomic::AtomicBool>,
    pub input_tokens_estimate: usize,
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
        let has_exact_in = self.has_exact_input.load(std::sync::atomic::Ordering::Acquire);
        let input_tokens = if has_exact_in {
            exact_in
        } else if exact_in > 0 {
            exact_in
        } else {
            self.input_tokens_estimate / 4
        };

        let cached_tokens = self.exact_cached_tokens.load(std::sync::atomic::Ordering::Acquire);
        
        if output_tokens > 0 || input_tokens > 0 || cached_tokens > 0 {
            let app_handle = self.app.clone();
            tauri::async_runtime::spawn(async move {
                let state = app_handle.state::<FrugalConfigState>();
                {
                    let mut config = state.config.lock().await;
                    config.input_tokens_session += input_tokens as u64;
                    config.output_tokens_session += output_tokens as u64;
                    config.cached_tokens_session += cached_tokens as u64;
                    config.input_tokens_lifetime += input_tokens as u64;
                    config.output_tokens_lifetime += output_tokens as u64;
                    config.cached_tokens_lifetime += cached_tokens as u64;
                }
                state.is_dirty.store(true, std::sync::atomic::Ordering::Release);
                let _ = app_handle.emit("frugallm_config_updated", ());
            });
        }
    }
}

pub fn get_config_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if !app_data_dir.exists() {
        std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    }
    Ok(app_data_dir.join("frugal_config.json"))
}

pub fn is_openrouter_free_alias(id: &str) -> bool {
    let lower = id.to_lowercase();
    let trimmed = lower.trim();
    trimmed == "openrouter/free" || trimmed == "openrouter:free"
}

#[derive(Clone, Debug, PartialEq)]
pub struct RankedModel {
    pub model: CloudModel,
    pub priority: f32,
}

#[derive(Clone, Debug, PartialEq)]
pub enum ProbeStepOutcome {
    Success,
    PermissionDenied403,
    RateLimited429,
    ServiceUnavailable503,
    OtherError(String),
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct DiagnosticPayload {
    pub app_version: String,
    pub os_info: String,
    pub logs: String,
}

#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
pub struct SubmitIssuePayload {
    pub access_key: Option<String>,
    pub subject: String,
    pub from_name: String,
    pub email: String,
    pub message: String,
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

#[derive(serde::Serialize, Clone)]
pub struct DownloadProgress {
    pub status: String,
}

#[derive(serde::Serialize, Clone)]
pub struct ModelProgressPayload {
    pub percent: u32,
    pub completed: u64,
    pub total: u64,
    pub speed_bytes_per_sec: f64,
    pub eta_seconds: u64,
}

#[derive(serde::Serialize, Clone)]
pub struct DeploymentResult {
    pub success: bool,
    pub message: String,
}
