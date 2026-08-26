use serde_json::Value;

#[tauri::command]
async fn refresh_routing_chain(state: tauri::State<'_, DynamicRosterState>) -> Result<Vec<CloudModel>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let mut new_chain: Vec<CloudModel> = Vec::new();

    // 1. Fetch from Ollama
    if let Ok(resp) = client.get("http://127.0.0.1:11434/api/tags").send().await {
        if let Ok(json) = resp.json::<Value>().await {
            if let Some(models) = json.get("models").and_then(|m| m.as_array()) {
                for m in models {
                    if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                        new_chain.push(CloudModel {
                            model: name.to_string(),
                            provider: "ollama".to_string(),
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
            if let Ok(json) = resp.json::<Value>().await {
                if let Some(models) = json.get("models").and_then(|m| m.as_array()) {
                    for m in models {
                        if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                            let clean_name = name.strip_prefix("models/").unwrap_or(name);
                            if clean_name.contains("gemini-1.5") { // Filter to relevant text models if desired, or all
                                new_chain.push(CloudModel {
                                    model: clean_name.to_string(),
                                    provider: "google".to_string(),
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
            if let Ok(json) = resp.json::<Value>().await {
                if let Some(models) = json.get("data").and_then(|m| m.as_array()) {
                    for m in models {
                        if let Some(id) = m.get("id").and_then(|i| i.as_str()) {
                            // Optionally, limit the number of openrouter models to top 50 to avoid massive lists
                            new_chain.push(CloudModel {
                                model: id.to_string(),
                                provider: "openrouter".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    // Limit to 50 models max to prevent the UI from freezing? Or just let it be. Let's limit to 100
    new_chain.truncate(100);

    let mut chain = state.fallback_chain.write().await;
    *chain = new_chain.clone();
    
    Ok(new_chain)
}
