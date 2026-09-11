use crate::proxy::server::*;
use crate::state::*;
use std::collections::HashMap;
use tauri::{Emitter, Manager, State};

#[tauri::command]
pub async fn get_routing_chain(
    state: State<'_, DynamicRosterState>,
) -> Result<Vec<CloudModel>, String> {
    let chain = state.fallback_chain.read().await;
    Ok(chain.clone())
}

#[tauri::command]
pub async fn set_routing_chain(
    state: State<'_, DynamicRosterState>,
    new_chain: Vec<CloudModel>,
) -> Result<(), String> {
    let mut chain = state.fallback_chain.write().await;
    *chain = new_chain;
    Ok(())
}
#[tauri::command]
pub async fn set_model_override(
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
    *chain = new_chain;

    Ok(())
}

#[tauri::command]
pub async fn get_provider_statuses(
    state: State<'_, ProviderHealthState>,
) -> Result<HashMap<String, String>, String> {
    let statuses = state.live_statuses.read().await;
    Ok(statuses.clone())
}

#[tauri::command]
pub async fn refresh_routing_chain(
    state: State<'_, DynamicRosterState>,
    app: tauri::AppHandle,
) -> Result<Vec<CloudModel>, String> {
    let new_chain = fetch_live_routing_chain(&app).await;

    let mut chain = state.fallback_chain.write().await;
    *chain = new_chain.clone();

    Ok(new_chain)
}

#[tauri::command]
pub fn get_model_tag_for_vram(detected_vram_gb: f64) -> String {
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
