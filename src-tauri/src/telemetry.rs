use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::time::{sleep, Duration};
use reqwest::Client;

#[derive(Clone, Serialize, Default)]
pub struct TelemetryPayload {
    pub ollama: OllamaState,
    pub hardware: HardwareState,
}

#[derive(Clone, Serialize)]
pub struct OllamaState {
    pub status: String, // "offline", "idle", "active"
    pub model_name: String,
    pub location_state: String, // "cpu", "gpu", "hybrid", "unknown"
    pub hybrid_percent: f64,
    pub total_size: u64,
    pub vram_size: u64,
}

impl Default for OllamaState {
    fn default() -> Self {
        Self {
            status: "offline".into(),
            model_name: "".into(),
            location_state: "unknown".into(),
            hybrid_percent: 0.0,
            total_size: 0,
            vram_size: 0,
        }
    }
}

#[derive(Clone, Serialize, Default)]
pub struct HardwareState {
    pub cpu_utilization: f64, // percentage 0-100
    pub gpu_utilization: f64, // percentage 0-100
    pub vram_used: u64,       // bytes
    pub vram_total: u64,      // bytes
}

pub fn start_telemetry_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let client = Client::builder()
            .timeout(Duration::from_millis(1500))
            .build()
            .unwrap_or_default();
            
        #[cfg(not(target_os = "macos"))]
        let mut nvml = nvml_wrapper::Nvml::init().ok();

        let mut sys = sysinfo::System::new_all();
        sys.refresh_cpu_usage();

        let mut tick_counter = 0;
        let mut last_ollama_state = OllamaState::default();

        loop {
            // Hardware polling (every 1 second)
            let mut hw_state = HardwareState::default();
            
            sys.refresh_cpu_usage();
            hw_state.cpu_utilization = sys.global_cpu_usage() as f64;

            #[cfg(not(target_os = "macos"))]
            {
                if let Some(ref mut nvml_inst) = nvml {
                    if let Ok(device) = nvml_inst.device_by_index(0) {
                        if let Ok(util) = device.utilization_rates() {
                            hw_state.gpu_utilization = util.gpu as f64;
                        }
                        if let Ok(mem) = device.memory_info() {
                            hw_state.vram_used = mem.used;
                            hw_state.vram_total = mem.total;
                        }
                    }
                }
            }
            #[cfg(target_os = "macos")]
            {
                // Getting live GPU utilization on macOS from unprivileged CLI is limited.
                // We leave it at 0 for now as graceful degradation, or parse powermetrics if root.
                // In a production app, we'd use IOKit or Metal APIs via Objective-C bindings.
            }

            // Ollama polling (every 2 seconds)
            if tick_counter % 2 == 0 {
                let mut new_ollama_state = OllamaState::default();
                
                if let Ok(resp) = client.get("http://127.0.0.1:11434/api/ps").send().await {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        new_ollama_state.status = "idle".into();
                        if let Some(models) = json.get("models").and_then(|m| m.as_array()) {
                            if let Some(model) = models.first() {
                                new_ollama_state.status = "active".into();
                                new_ollama_state.model_name = model.get("name").and_then(|n| n.as_str()).unwrap_or("Unknown").to_string();
                                
                                let size = model.get("size").and_then(|s| s.as_u64()).unwrap_or(0);
                                let size_vram = model.get("size_vram").and_then(|s| s.as_u64()).unwrap_or(0);
                                
                                new_ollama_state.total_size = size;
                                new_ollama_state.vram_size = size_vram;

                                if size == 0 {
                                    new_ollama_state.location_state = "unknown".into();
                                } else if size_vram == size {
                                    new_ollama_state.location_state = "gpu".into();
                                } else if size_vram > 0 && size_vram < size {
                                    new_ollama_state.location_state = "hybrid".into();
                                    new_ollama_state.hybrid_percent = (size_vram as f64 / size as f64) * 100.0;
                                } else {
                                    new_ollama_state.location_state = "cpu".into();
                                }
                            }
                        }
                    } else {
                        // Responded, but invalid JSON -> maybe offline or error
                        new_ollama_state.status = "offline".into();
                    }
                } else {
                    // Daemon unreachable
                    new_ollama_state.status = "offline".into();
                }
                
                last_ollama_state = new_ollama_state;
            }

            let payload = TelemetryPayload {
                ollama: last_ollama_state.clone(),
                hardware: hw_state,
            };

            let _ = app.emit("telemetry_update", payload);

            tick_counter += 1;
            sleep(Duration::from_secs(1)).await;
        }
    });
}
