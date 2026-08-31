use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::time::{sleep, Duration};
use reqwest::Client;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct HardwareProfile {
    pub is_unified: bool,
    pub dedicated_vram: u64, // bytes (0 on Apple Silicon unified)
    pub system_ram: u64,     // bytes
    pub execution_ceiling: u64, // bytes (unified available or dedicated_vram)
    pub os_architecture: String,
}

impl Default for HardwareProfile {
    fn default() -> Self {
        Self {
            is_unified: false,
            dedicated_vram: 0,
            system_ram: 0,
            execution_ceiling: 0,
            os_architecture: "unknown".into(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Debug, Default)]
pub struct MemorySegments {
    pub phase: String, // "preflight" | "live"
    pub weights_bytes: u64,
    pub context_128k_bytes: u64,
    pub overhead_bytes: u64,
    pub total_projected_bytes: u64,
    pub execution_ceiling_bytes: u64,
    pub spillover_bytes: u64,
    pub spillover_type: String, // "none" | "system_ram" | "ssd_swap"
    pub triggers_warning: bool,
    pub warning_message: String,
}

/// Computes KV cache footprint for Gemma architecture with 5:1 interleaved local/global attention.
/// - 1/6th of transformer layers attend across the full 128k context window (131,072 tokens).
/// - 5/6th of transformer layers attend across a 1,024-token local sliding window.
/// - KV multiplier: 2 (Key + Value) * bytes_per_value (1 byte for Q8) * num_kv_heads * head_dim.
pub fn calculate_gemma_128k_q8_kv_cache(layers: u32, num_kv_heads: u32, head_dim: u32) -> u64 {
    let bytes_per_value: u64 = 1; // Q8 quantization multiplier = 1 byte per value
    let global_tokens: u64 = 131_072;
    let sliding_tokens: u64 = 1_024;

    // 5:1 interleaved attention ratio (1 global layer for every 5 sliding-window layers)
    let global_layers = (layers as f64 / 6.0).ceil() as u64;
    let sliding_layers = (layers as u64).saturating_sub(global_layers);

    let bytes_per_token_per_layer = 2 * bytes_per_value * (num_kv_heads as u64) * (head_dim as u64);

    let global_cache = global_layers * global_tokens * bytes_per_token_per_layer;
    let sliding_cache = sliding_layers * sliding_tokens * bytes_per_token_per_layer;

    global_cache + sliding_cache
}

pub fn compute_memory_segments(
    profile: &HardwareProfile,
    ollama: &OllamaState,
    target_model_tag: &str,
) -> MemorySegments {
    let overhead_bytes: u64 = 524_288_000; // ~500 MB graph buffer & activations
    let ceiling = if profile.execution_ceiling > 0 {
        profile.execution_ceiling
    } else if profile.dedicated_vram > 0 {
        profile.dedicated_vram
    } else if profile.system_ram > 0 {
        profile.system_ram.saturating_sub(2 * 1024 * 1024 * 1024)
    } else {
        8 * 1024 * 1024 * 1024
    };

    let is_live = ollama.status == "active" && ollama.total_size > 0;
    let phase = if is_live { "live" } else { "preflight" };

    let effective_tag = if is_live && !ollama.model_name.is_empty() && ollama.model_name != "Unknown" {
        ollama.model_name.as_str()
    } else {
        target_model_tag
    };

    // Pre-flight weights & 128k Q8 context based on Gemma 4 5:1 interleaved architecture
    let (preflight_weights, preflight_context_128k) = match effective_tag {
        t if t.contains("31b") => (
            20_937_965_568u64,
            calculate_gemma_128k_q8_kv_cache(56, 16, 256),
        ),
        t if t.contains("26b") => (
            17_716_740_096u64,
            calculate_gemma_128k_q8_kv_cache(48, 8, 256),
        ),
        t if t.contains("12b") => (
            8_053_063_680u64,
            calculate_gemma_128k_q8_kv_cache(40, 8, 256),
        ),
        t if t.contains("e2b") => (
            1_717_986_918u64,
            calculate_gemma_128k_q8_kv_cache(26, 4, 256),
        ),
        _ => (
            5_261_335_552u64,
            calculate_gemma_128k_q8_kv_cache(32, 8, 256),
        ),
    };

    let weights_bytes = if is_live {
        ollama.total_size
    } else {
        preflight_weights
    };

    let context_128k_bytes = preflight_context_128k;
    let total_projected_bytes = weights_bytes.saturating_add(context_128k_bytes).saturating_add(overhead_bytes);

    let mut spillover_bytes: u64 = 0;
    let mut spillover_type = "none".to_string();
    let mut triggers_warning = false;
    let mut warning_message = String::new();

    if total_projected_bytes > ceiling {
        spillover_bytes = total_projected_bytes.saturating_sub(ceiling);
        if profile.is_unified {
            spillover_type = "ssd_swap".to_string();
            triggers_warning = true;
            warning_message = "Memory exceeds available Unified Memory. Severe disk paging & performance degradation will occur.".to_string();
        } else {
            spillover_type = "system_ram".to_string();
            triggers_warning = true;
            warning_message = "Model & 128k context exceed Dedicated VRAM. Spillover will route across PCIe into System RAM.".to_string();
        }
    }

    MemorySegments {
        phase: phase.to_string(),
        weights_bytes,
        context_128k_bytes,
        overhead_bytes,
        total_projected_bytes,
        execution_ceiling_bytes: ceiling,
        spillover_bytes,
        spillover_type,
        triggers_warning,
        warning_message,
    }
}

#[derive(Clone, Serialize, Default)]
pub struct TelemetryPayload {
    pub ollama: OllamaState,
    pub hardware: HardwareState,
    pub hardware_profile: HardwareProfile,
    pub segments: MemorySegments,
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

        let profile = crate::get_hardware_profile().await.unwrap_or_default();

        loop {
            // Hardware polling (every 1 second)
            let mut hw_state = HardwareState::default();
            
            sys.refresh_cpu_usage();
            hw_state.cpu_utilization = sys.global_cpu_usage() as f64;
            hw_state.vram_total = profile.execution_ceiling;

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
                if !profile.is_unified && profile.dedicated_vram > 0 {
                    hw_state.vram_total = profile.dedicated_vram;
                }
            }

            // Ollama polling (every 2 seconds)
            if tick_counter % 2 == 0 {
                let mut new_ollama_state = OllamaState::default();
                
                if let Ok(resp) = client.get("http://127.0.0.1:11434/api/ps").send().await {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        new_ollama_state.status = "idle".into();
                        if let Some(models) = json.get("models").and_then(|m| m.as_array()) {
                            // Find the first model that isn't the proxy dummy model
                            let active_model = models.iter().find(|m| {
                                let name = m.get("name").and_then(|n| n.as_str()).unwrap_or("");
                                !name.contains("frugallm-active")
                            }).or_else(|| models.first());

                            if let Some(model) = active_model {
                                new_ollama_state.status = "active".into();
                                let raw_name = model.get("name").and_then(|n| n.as_str()).unwrap_or("Unknown");
                                let clean_name = if raw_name.contains("frugallm-active") {
                                    "gemma4".to_string()
                                } else {
                                    raw_name.trim_start_matches("library/").trim_end_matches(":latest").to_string()
                                };
                                new_ollama_state.model_name = clean_name;
                                
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
                        new_ollama_state.status = "offline".into();
                    }
                } else {
                    new_ollama_state.status = "offline".into();
                }
                
                last_ollama_state = new_ollama_state;
            }

            // Dynamically determine the recommended model based on detected VRAM
            // using the same zero-spillover logic as get_model_tag_for_vram
            let vram_gb = (profile.execution_ceiling as f64) / 1024.0 / 1024.0 / 1024.0;
            let recommended_tag = {
                let mut tag = "gemma4:e2b";
                for model in crate::AVAILABLE_MODELS {
                    let total_footprint = model.weights_gb + model.kv_cache_gb + crate::GRAPH_OVERHEAD_GB;
                    if total_footprint <= vram_gb {
                        tag = model.tag;
                        break;
                    }
                }
                tag
            };

            let segments = compute_memory_segments(&profile, &last_ollama_state, recommended_tag);

            let payload = TelemetryPayload {
                ollama: last_ollama_state.clone(),
                hardware: hw_state,
                hardware_profile: profile.clone(),
                segments,
            };

            let _ = app.emit("telemetry_update", payload);

            tick_counter += 1;
            sleep(Duration::from_secs(1)).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_gemma_128k_q8_kv_cache_formula() {
        // Gemma 4 12B configuration: 40 layers, 8 KV heads, head_dim 256
        let cache_12b = calculate_gemma_128k_q8_kv_cache(40, 8, 256);
        // layers: 40, global_layers = ceil(40/6) = 7, sliding_layers = 33
        // bytes_per_token_per_layer = 2 * 1 * 8 * 256 = 4096
        // global = 7 * 131072 * 4096 = 3,758,096,384
        // sliding = 33 * 1024 * 4096 = 138,412,032
        // total = 3,896,508,416 (~3.63 GB)
        assert_eq!(cache_12b, 3_896_508_416);
    }

    #[test]
    fn test_compute_memory_segments_preflight_no_spillover() {
        let profile = HardwareProfile {
            is_unified: false,
            dedicated_vram: 24 * 1024 * 1024 * 1024, // 24 GB
            system_ram: 32 * 1024 * 1024 * 1024,
            execution_ceiling: 24 * 1024 * 1024 * 1024,
            os_architecture: "macos-x86_64".into(),
        };
        let ollama = OllamaState::default(); // offline

        let segments = compute_memory_segments(&profile, &ollama, "gemma4:12b");
        assert_eq!(segments.phase, "preflight");
        assert_eq!(segments.spillover_bytes, 0);
        assert_eq!(segments.spillover_type, "none");
        assert!(!segments.triggers_warning);
        assert_eq!(segments.execution_ceiling_bytes, 24 * 1024 * 1024 * 1024);
    }

    #[test]
    fn test_compute_memory_segments_live_state_with_spillover() {
        let profile = HardwareProfile {
            is_unified: false,
            dedicated_vram: 8 * 1024 * 1024 * 1024, // 8 GB
            system_ram: 32 * 1024 * 1024 * 1024,
            execution_ceiling: 8 * 1024 * 1024 * 1024,
            os_architecture: "linux-x86_64".into(),
        };
        let ollama = OllamaState {
            status: "active".into(),
            model_name: "gemma4:26b".into(),
            location_state: "hybrid".into(),
            hybrid_percent: 50.0,
            total_size: 17_716_740_096,
            vram_size: 8_589_934_592,
        };

        let segments = compute_memory_segments(&profile, &ollama, "gemma4:26b");
        assert_eq!(segments.phase, "live");
        assert!(segments.spillover_bytes > 0);
        assert_eq!(segments.spillover_type, "system_ram");
        assert!(segments.triggers_warning);
        assert!(segments.warning_message.contains("System RAM"));
    }

    #[test]
    fn test_compute_memory_segments_unified_apple_silicon_warning() {
        let profile = HardwareProfile {
            is_unified: true,
            dedicated_vram: 0,
            system_ram: 16 * 1024 * 1024 * 1024,
            execution_ceiling: 11 * 1024 * 1024 * 1024, // 11 GB ceiling
            os_architecture: "macos-arm64".into(),
        };
        let ollama = OllamaState::default();

        let segments = compute_memory_segments(&profile, &ollama, "gemma4:31b");
        assert_eq!(segments.spillover_type, "ssd_swap");
        assert!(segments.triggers_warning);
        assert!(segments.warning_message.contains("Unified Memory"));
    }
}

