use std::sync::Arc;
use std::collections::HashSet;
use axum::{
    routing::{get, post},
    Router, Json,
};
use serde_json::{Value, json};
use futures_util::StreamExt;
use tauri::{Manager, Emitter};
use tokio::net::TcpListener;
use crate::state::*;
use crate::commands::*;


pub const TOOL_ENFORCEMENT_DIRECTIVE: &str =
    "\n[TOOL ENFORCEMENT DIRECTIVE]: Strict tool calling is required. If you describe actions, plan tool execution, or state that you will read/edit files or run commands, you MUST execute the matching tool call immediately. Do not state conversational promises without invoking the tool.";


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

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ExtractedTokenMetrics {
    pub input_tokens: Option<usize>,
    pub output_tokens: Option<usize>,
    pub cached_tokens: Option<usize>,
}

pub fn extract_token_metrics_from_value(json: &Value) -> ExtractedTokenMetrics {
    let mut metrics = ExtractedTokenMetrics::default();

    // 1. Native Ollama metrics (prompt_eval_count, eval_count)
    if let Some(prompt_eval) = json.get("prompt_eval_count").and_then(|v| v.as_u64()) {
        metrics.input_tokens = Some(prompt_eval as usize);
    }
    if let Some(eval) = json.get("eval_count").and_then(|v| v.as_u64()) {
        metrics.output_tokens = Some(eval as usize);
    }

    // 2. OpenAI / Cloud usage metrics (usage.prompt_tokens, usage.completion_tokens, cached_tokens)
    if let Some(usage) = json.get("usage").and_then(|u| u.as_object()) {
        let mut cached_count = 0u64;

        // OpenAI / OpenRouter prompt_tokens_details.cached_tokens
        if let Some(details) = usage.get("prompt_tokens_details").and_then(|d| d.as_object()) {
            if let Some(c) = details.get("cached_tokens").and_then(|v| v.as_u64()) {
                cached_count = cached_count.max(c);
            }
        }

        // Top-level cached_tokens (OpenRouter / vLLM)
        if let Some(c) = usage.get("cached_tokens").and_then(|v| v.as_u64()) {
            cached_count = cached_count.max(c);
        }

        // Anthropic Claude cache_read_input_tokens
        if let Some(c) = usage.get("cache_read_input_tokens").and_then(|v| v.as_u64()) {
            cached_count = cached_count.max(c);
        }

        if cached_count > 0 {
            metrics.cached_tokens = Some(cached_count as usize);
        }

        if let Some(prompt) = usage.get("prompt_tokens").and_then(|t| t.as_u64()) {
            // In OpenAI specification, prompt_tokens represents total prompt tokens (cached + uncached).
            // We separate out uncached input tokens:
            let uncached = prompt.saturating_sub(cached_count);
            metrics.input_tokens = Some(uncached as usize);
        } else if let Some(input) = usage.get("input_tokens").and_then(|t| t.as_u64()) {
            // In Anthropic specification, input_tokens already represents non-cached tokens:
            metrics.input_tokens = Some(input as usize);
        }

        if let Some(completion) = usage.get("completion_tokens").or_else(|| usage.get("output_tokens")).and_then(|t| t.as_u64()) {
            metrics.output_tokens = Some(completion as usize);
        }
    }

    metrics
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
                    let metrics = extract_token_metrics_from_value(&json);
                    if let Some(cached) = metrics.cached_tokens {
                        drop_guard.exact_cached_tokens.store(cached, std::sync::atomic::Ordering::Release);
                    }
                    if let Some(input) = metrics.input_tokens {
                        drop_guard.exact_input_tokens.store(input, std::sync::atomic::Ordering::Release);
                        drop_guard.has_exact_input.store(true, std::sync::atomic::Ordering::Release);
                    }
                    if let Some(output) = metrics.output_tokens {
                        drop_guard.exact_output_tokens.store(output, std::sync::atomic::Ordering::Release);
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

fn sanitize_reprimand_chunk(bytes: &[u8], app: &tauri::AppHandle) -> axum::body::Bytes {
    if let Ok(text) = std::str::from_utf8(bytes) {
        if text.contains("[SYSTEM REPRIMAND:") {
            log_event(
                app,
                "WARN",
                "GATEWAY",
                "Silently suppressed system reprimand from user-facing stream to maintain clean context",
            );
            let cleaned = text.replace(
                "[SYSTEM REPRIMAND: You detailed a plan and informed the user you were taking action, but failed to output the corresponding JSON tool call. Do not apologize. Output the required tool call immediately.]",
                "",
            );
            return axum::body::Bytes::from(cleaned);
        }
    }
    axum::body::Bytes::copy_from_slice(bytes)
}

async fn try_ollama(
    app: &tauri::AppHandle,
    client: &reqwest::Client,
    body: &Value,
    source: &str,
    ollama_model: &str,
    ttft_limit: std::time::Duration,
) -> Result<axum::response::Response, String> {
    let mut body = body.clone();

    // If frugallm-active is running/loaded in Ollama, and the requested model is its base model (e.g. gemma4:e2b),
    // target frugallm-active under the hood to leverage the prewarmed 128k context instance without cold reloads.
    let mut resolved_model = ollama_model.to_string();
    if resolved_model != "frugallm-active" {
        if let Ok(ps_res) = client.get("http://127.0.0.1:11434/api/ps").timeout(std::time::Duration::from_millis(500)).send().await {
            if let Ok(ps_json) = ps_res.json::<Value>().await {
                if let Some(loaded) = ps_json.get("models").and_then(|m| m.as_array()) {
                    if loaded.iter().any(|m| m.get("name").and_then(|n| n.as_str()).map(|n| n.starts_with("frugallm-active")).unwrap_or(false)) {
                        resolved_model = "frugallm-active".to_string();
                    }
                }
            }
        }
    }

    if let Some(model) = body.get_mut("model") {
        *model = json!(resolved_model);
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
    let exact_cached_tokens = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let has_exact_input = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let drop_guard = NotifyOnDrop {
        app: app.clone(),
        source: source.to_string(),
        target: "ollama".to_string(),
        token_estimate: token_estimate.clone(),
        exact_output_tokens: exact_output_tokens.clone(),
        exact_input_tokens: exact_input_tokens.clone(),
        exact_cached_tokens: exact_cached_tokens.clone(),
        has_exact_input: has_exact_input.clone(),
        input_tokens_estimate: request_body_size,
    };

    let start_time = std::time::Instant::now();
    let send_fut = client.post("http://127.0.0.1:11434/v1/chat/completions")
        .json(&body)
        .send();

    let res = match tokio::time::timeout(ttft_limit, send_fut).await {
        Ok(Ok(r)) => r,
        Ok(Err(e)) => {
            update_provider_status(app, "ollama", "offline").await;
            return Err(format!("Network error: {}", e));
        }
        Err(_) => {
            update_provider_status(app, "ollama", "timeout").await;
            if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                let mut m_cooldowns = health_state.model_cooldowns.write().await;
                m_cooldowns.insert(ollama_model.to_string(), std::time::Instant::now() + COOLDOWN_PENALTY_DURATION);
            }
            return Err(format!("ollama API error: HTTP timeout - TTFT connection timeout ({}s) on model '{}'", ttft_limit.as_secs(), ollama_model));
        }
    };

    if res.status().is_success() {
        update_provider_status(app, "ollama", "200 OK").await;
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
        let is_streaming = body.get("stream").and_then(|v| v.as_bool()).unwrap_or(true);

        if is_streaming {
            let elapsed = start_time.elapsed();
            let remaining_ttft = ttft_limit.checked_sub(elapsed).unwrap_or(std::time::Duration::from_millis(100));
            let mut byte_stream = res.bytes_stream();
            let first_chunk = match tokio::time::timeout(remaining_ttft, byte_stream.next()).await {
                Ok(Some(Ok(bytes))) => bytes,
                Ok(Some(Err(e))) => {
                    update_provider_status(app, "ollama", "503").await;
                    return Err(format!("ollama stream read error: {}", e));
                }
                Ok(None) => axum::body::Bytes::new(),
                Err(_) => {
                    update_provider_status(app, "ollama", "timeout").await;
                    if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                        let mut m_cooldowns = health_state.model_cooldowns.write().await;
                        m_cooldowns.insert(ollama_model.to_string(), std::time::Instant::now() + COOLDOWN_PENALTY_DURATION);
                    }
                    return Err(format!("ollama API error: HTTP timeout - Exceeded TTFT timeout ({}s) waiting for first token on model '{}'", ttft_limit.as_secs(), ollama_model));
                }
            };

            let _ = &drop_guard;
            process_stream_chunk_for_tokens(&first_chunk, &drop_guard);
            let sanitized_first = sanitize_reprimand_chunk(&first_chunk, &app_clone);

            let chained_stream = futures_util::stream::once(async move {
                Ok::<axum::body::Bytes, reqwest::Error>(sanitized_first)
            }).chain(byte_stream.map(move |chunk| {
                match chunk {
                    Ok(bytes) => {
                        let _ = &drop_guard;
                        process_stream_chunk_for_tokens(&bytes, &drop_guard);
                        let _ = app_clone.emit("proxy_activity", ProxyActivityPayload {
                            source: source_clone.clone(),
                            target: "ollama".to_string(),
                            is_active: true,
                        });
                        let sanitized = sanitize_reprimand_chunk(&bytes, &app_clone);
                        Ok::<axum::body::Bytes, reqwest::Error>(sanitized)
                    }
                    Err(e) => Err(e),
                }
            }));
            log_event(
                app,
                "INFO",
                "OLLAMA",
                &format!("Stream connected successfully for model '{}'", ollama_model),
            );
            Ok(builder.body(axum::body::Body::from_stream(chained_stream)).unwrap())
        } else {
            let bytes = res.bytes().await.map_err(|e| format!("Ollama network read error: {}", e))?;
            process_stream_chunk_for_tokens(&bytes, &drop_guard);
            log_event(
                app,
                "INFO",
                "OLLAMA",
                &format!("Request succeeded for model '{}'", ollama_model),
            );
            Ok(builder.body(axum::body::Body::from(bytes)).unwrap())
        }
    } else {
        let status = res.status();
        let status_code_str = if status.as_u16() == 503 {
            "503"
        } else {
            status.as_str()
        };
        update_provider_status(app, "ollama", status_code_str).await;
        if status.as_u16() == 503 {
            if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                let mut m_cooldowns = health_state.model_cooldowns.write().await;
                m_cooldowns.insert(ollama_model.to_string(), std::time::Instant::now() + std::time::Duration::from_secs(60));
            }
        }
        log_event(
            app,
            "ERROR",
            "OLLAMA",
            &format!("API error HTTP {} for model '{}'", res.status(), ollama_model),
        );
        Err(format!("Ollama API error: HTTP {}", res.status()))
    }
}

async fn try_cloud_provider(
    app: &tauri::AppHandle,
    client: &reqwest::Client,
    body: &Value,
    source: &str,
    cloud_model: &CloudModel,
    ttft_limit: std::time::Duration,
) -> Result<axum::response::Response, String> {
    let mut body = body.clone();
    let is_streaming = body.get("stream").and_then(|v| v.as_bool()).unwrap_or(false);
    if let Some(obj) = body.as_object_mut() {
        if is_streaming {
            obj.insert("stream_options".to_string(), json!({ "include_usage": true }));
        }
    }

    let start_time = std::time::Instant::now();
    
    let (url, auth_header, is_openrouter) = match cloud_model.provider.as_str() {
        "google" => {
            let key = crate::get_credential("google")
                .map_err(|_| "Google AI Studio API key not found".to_string())?;
            let url = "https://generativelanguage.googleapis.com/v1beta/chat/completions".to_string();
            let auth = format!("Bearer {}", key);
            if let Some(obj) = body.as_object_mut() {
                obj.insert("model".to_string(), json!(cloud_model.model));
            }
            (url, auth, false)
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
            (url, auth, true)
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
    let exact_cached_tokens = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let has_exact_input = Arc::new(std::sync::atomic::AtomicBool::new(false));
    
    let drop_guard = NotifyOnDrop {
        app: app.clone(),
        source: source.to_string(),
        target: cloud_model.provider.clone(),
        token_estimate: token_estimate.clone(),
        exact_output_tokens: exact_output_tokens.clone(),
        exact_input_tokens: exact_input_tokens.clone(),
        exact_cached_tokens: exact_cached_tokens.clone(),
        has_exact_input: has_exact_input.clone(),
        input_tokens_estimate: request_body_size,
    };

    let mut req = client.post(&url)
        .header("Authorization", auth_header);

    if is_openrouter {
        req = req
            .header("HTTP-Referer", "https://github.com/chorned/frugaLLM")
            .header("X-Title", "FrugaLLM");
    }

    let send_fut = req.json(&body).send();
    let res = match tokio::time::timeout(ttft_limit, send_fut).await {
        Ok(Ok(response)) => response,
        Ok(Err(e)) => {
            update_provider_status(app, &cloud_model.provider, "offline").await;
            return Err(format!("Network error: {}", e));
        }
        Err(_) => {
            update_provider_status(app, &cloud_model.provider, "timeout").await;
            if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                let mut m_cooldowns = health_state.model_cooldowns.write().await;
                m_cooldowns.insert(cloud_model.model.clone(), std::time::Instant::now() + COOLDOWN_PENALTY_DURATION);
            }
            return Err(format!("{} API error: HTTP timeout - TTFT connection timeout ({}s) on model '{}'", cloud_model.provider, ttft_limit.as_secs(), cloud_model.model));
        }
    };

    if res.status().is_success() {
        let mut builder = axum::response::Response::builder().status(res.status());
        for (key, value) in res.headers() {
            builder = builder.header(key.clone(), value.clone());
        }
        let app_clone = app.clone();
        let source_clone = source.to_string();
        let provider_clone = cloud_model.provider.clone();
        
        if is_streaming {
            let elapsed = start_time.elapsed();
            let remaining_ttft = ttft_limit.checked_sub(elapsed).unwrap_or(std::time::Duration::from_millis(100));
            let mut byte_stream = res.bytes_stream();
            let first_chunk = match tokio::time::timeout(remaining_ttft, byte_stream.next()).await {
                Ok(Some(Ok(bytes))) => bytes,
                Ok(Some(Err(e))) => {
                    update_provider_status(app, &cloud_model.provider, "503").await;
                    if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                        let mut m_cooldowns = health_state.model_cooldowns.write().await;
                        m_cooldowns.insert(cloud_model.model.clone(), std::time::Instant::now() + std::time::Duration::from_secs(60));
                    }
                    return Err(format!("{} stream read error: {}", cloud_model.provider, e));
                }
                Ok(None) => {
                    axum::body::Bytes::new()
                }
                Err(_) => {
                    update_provider_status(app, &cloud_model.provider, "timeout").await;
                    if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                        let mut m_cooldowns = health_state.model_cooldowns.write().await;
                        m_cooldowns.insert(cloud_model.model.clone(), std::time::Instant::now() + COOLDOWN_PENALTY_DURATION);
                    }
                    return Err(format!("{} API error: HTTP timeout - Exceeded TTFT timeout ({}s) waiting for first token on model '{}'", cloud_model.provider, ttft_limit.as_secs(), cloud_model.model));
                }
            };

            update_provider_status(app, &cloud_model.provider, "200 OK").await;
            if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                let mut p_cooldowns = health_state.provider_cooldowns.write().await;
                p_cooldowns.remove(&cloud_model.provider);
            }

            let _ = &drop_guard;
            process_stream_chunk_for_tokens(&first_chunk, &drop_guard);
            let sanitized_first = sanitize_reprimand_chunk(&first_chunk, &app_clone);

            let chained_stream = futures_util::stream::once(async move {
                Ok::<axum::body::Bytes, reqwest::Error>(sanitized_first)
            }).chain(byte_stream.map(move |chunk| {
                match chunk {
                    Ok(bytes) => {
                        let _ = &drop_guard;
                        process_stream_chunk_for_tokens(&bytes, &drop_guard);
                        let _ = app_clone.emit("proxy_activity", ProxyActivityPayload {
                            source: source_clone.clone(),
                            target: provider_clone.clone(),
                            is_active: true,
                        });
                        let sanitized = sanitize_reprimand_chunk(&bytes, &app_clone);
                        Ok::<axum::body::Bytes, reqwest::Error>(sanitized)
                    }
                    Err(e) => Err(e),
                }
            }));

            log_event(
                app,
                "INFO",
                &cloud_model.provider.to_uppercase(),
                &format!("Stream connected successfully for model '{}'", cloud_model.model),
            );
            Ok(builder.body(axum::body::Body::from_stream(chained_stream)).unwrap())
        } else {
            let bytes = res.bytes().await.map_err(|e| format!("Network read error: {}", e))?;
            process_stream_chunk_for_tokens(&bytes, &drop_guard);
            update_provider_status(app, &cloud_model.provider, "200 OK").await;
            if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                let mut p_cooldowns = health_state.provider_cooldowns.write().await;
                p_cooldowns.remove(&cloud_model.provider);
            }
            log_event(
                app,
                "INFO",
                &cloud_model.provider.to_uppercase(),
                &format!("Request succeeded for model '{}'", cloud_model.model),
            );
            Ok(builder.body(axum::body::Body::from(bytes)).unwrap())
        }
    } else {
        let status = res.status();
        let error_body = res.text().await.unwrap_or_else(|_| "Could not read error body".to_string());
        
        let status_code_str = if status.as_u16() == 403 {
            "403"
        } else if status.as_u16() == 429 {
            "429"
        } else if status.as_u16() == 503 {
            "503"
        } else {
            status.as_str()
        };

        if error_body.contains("Gate Free Endpoints by Agentic Harness") || error_body.contains("only available on agentic harnesses") {
            if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                let mut gated = health_state.gated_models.write().await;
                gated.insert(cloud_model.model.clone());
                log_event(
                    app,
                    "WARN",
                    "ROUTER",
                    &format!("Model '{}' permanently gated by agentic harness requirement during session.", cloud_model.model),
                );
            }
        }

        if status.as_u16() == 404 || error_body.contains("NOT_FOUND") || error_body.contains("no longer available") {
            if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                let mut gated = health_state.gated_models.write().await;
                gated.insert(cloud_model.model.clone());
                log_event(
                    app,
                    "WARN",
                    "ROUTER",
                    &format!("Model '{}' permanently gated due to 404 (model retired/discontinued by provider).", cloud_model.model),
                );
            }
        }

        if status.as_u16() == 403 || error_body.contains("PERMISSION_DENIED") || error_body.contains("denied access") {
            if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                let mut p_cooldowns = health_state.provider_cooldowns.write().await;
                p_cooldowns.insert(cloud_model.provider.clone(), std::time::Instant::now() + std::time::Duration::from_secs(600));
                log_event(
                    app,
                    "WARN",
                    "ROUTER",
                    &format!("Provider '{}' circuit breaker engaged for 10 minutes due to 403 Forbidden.", cloud_model.provider),
                );
            }
        }

        if status.as_u16() == 429 || error_body.contains("RESOURCE_EXHAUSTED") || error_body.contains("rate limit") {
            if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                let mut m_cooldowns = health_state.model_cooldowns.write().await;
                m_cooldowns.insert(cloud_model.model.clone(), std::time::Instant::now() + std::time::Duration::from_secs(60));
                log_event(
                    app,
                    "WARN",
                    "ROUTER",
                    &format!("Model '{}' placed on 60s cooldown due to 429 Rate Limit. Seamlessly falling back to next candidate.", cloud_model.model),
                );
            }
        }

        if status.as_u16() == 503 || error_body.contains("503") || error_body.contains("temporarily overloaded") {
            if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                let mut m_cooldowns = health_state.model_cooldowns.write().await;
                m_cooldowns.insert(cloud_model.model.clone(), std::time::Instant::now() + std::time::Duration::from_secs(60));
                log_event(
                    app,
                    "WARN",
                    "ROUTER",
                    &format!("Model '{}' placed on 60s cooldown due to 503 Service Overloaded.", cloud_model.model),
                );
            }
        }

        if status.as_u16() == 500 || status.as_u16() == 502 || status.as_u16() == 504 {
            if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                let mut m_cooldowns = health_state.model_cooldowns.write().await;
                m_cooldowns.insert(cloud_model.model.clone(), std::time::Instant::now() + std::time::Duration::from_secs(60));
                log_event(
                    app,
                    "WARN",
                    "ROUTER",
                    &format!("Model '{}' placed on 60s cooldown due to transient HTTP {} server error.", cloud_model.model, status),
                );
            }
        }

        refresh_provider_status_for_next_call(app, &cloud_model.provider, Some(status_code_str)).await;

        log_event(
            app,
            "ERROR",
            &cloud_model.provider.to_uppercase(),
            &format!("API error (HTTP {}): {} (model: {})", status, error_body, cloud_model.model),
        );
        
        println!("{} API error ({}): {}", cloud_model.provider, status, error_body);
        Err(format!("{} API error: HTTP {} - {}", cloud_model.provider, status, error_body))
    }
}

async fn chat_completions(
    axum::extract::State(app): axum::extract::State<std::sync::Arc<tauri::AppHandle>>,
    headers: axum::http::HeaderMap,
    Json(mut body): Json<Value>
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

    let (tool_gateway_config, _) = {
        let config = state.config.lock().await;
        (config.tool_enforcing_gateway, config.port)
    };
    let is_tool_gateway_active = tool_gateway_config || check_tool_gateway_status(app.as_ref().clone()).await;

    let has_tools = body.get("tools").and_then(|t| t.as_array()).map(|a| !a.is_empty()).unwrap_or(false)
        || body.get("functions").and_then(|f| f.as_array()).map(|a| !a.is_empty()).unwrap_or(false);

    log_event(
        &app,
        "INFO",
        "ROUTER",
        &format!(
            "Received request from '{}' (requested model: '{}') | Tool Enforcing Gateway: {} (tools in payload: {})",
            source,
            original_model,
            if is_tool_gateway_active { "ACTIVE" } else { "DISABLED" },
            has_tools
        ),
    );

    if is_tool_gateway_active && has_tools {
        log_event(
            &app,
            "INFO",
            "GATEWAY",
            "Tool Enforcing Gateway: Active with tools in payload. Applying silent upstream enforcement directive (isolated from user view).",
        );
        if let Some(messages) = body.get_mut("messages").and_then(|m| m.as_array_mut()) {
            let mut found_system = false;
            for msg in messages.iter_mut() {
                if msg.get("role").and_then(|r| r.as_str()) == Some("system") {
                    if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
                        let updated = format!("{}\n{}", content, TOOL_ENFORCEMENT_DIRECTIVE);
                        if let Some(obj) = msg.as_object_mut() {
                            obj.insert("content".to_string(), json!(updated));
                        }
                        found_system = true;
                        break;
                    }
                }
            }
            if !found_system {
                messages.insert(0, json!({
                    "role": "system",
                    "content": TOOL_ENFORCEMENT_DIRECTIVE.trim()
                }));
            }
        }
    }

    let mut chain = {
        let fallback_chain = app.state::<DynamicRosterState>().fallback_chain.clone();
        let guard = fallback_chain.read().await;
        guard.clone()
    };

    // Self-healing fallback: If roster is empty on incoming request, discover on-demand
    if chain.is_empty() {
        log_event(
            &app,
            "WARN",
            "ROUTER",
            "Dynamic roster empty on incoming request; attempting on-demand discovery...",
        );
        let live_chain = fetch_live_routing_chain(&app).await;
        if !live_chain.is_empty() {
            let fallback_chain = app.state::<DynamicRosterState>().fallback_chain.clone();
            let mut guard = fallback_chain.write().await;
            *guard = live_chain.clone();
            chain = live_chain;
        }
    }

    let mut errors = Vec::new();
    let mut skip_google = false;

    let (healthy_candidates, mut cooldown_candidates) = if let Some(health_state) = app.try_state::<ProviderHealthState>() {
        let now = std::time::Instant::now();
        let p_guard = health_state.provider_cooldowns.read().await;
        let g_guard = health_state.gated_models.read().await;
        let m_guard = health_state.model_cooldowns.read().await;
        partition_candidates(&chain, &p_guard, &g_guard, &m_guard, now)
    } else {
        (chain.clone(), Vec::new())
    };

    // ─────────────────────────────────────────────────────────────
    // PHASE 1: Fast-Pass SLA (Strict TTFT Limit: 10s)
    // ─────────────────────────────────────────────────────────────
    for target_model in &healthy_candidates {
        if target_model.provider == "google" && skip_google {
            continue;
        }

        // Check if provider circuit breaker became active during turn
        if let Some(health_state) = app.try_state::<ProviderHealthState>() {
            let now = std::time::Instant::now();
            let p_cooldowns = health_state.provider_cooldowns.read().await;
            if let Some(expiry) = p_cooldowns.get(&target_model.provider) {
                if *expiry > now {
                    log_event(
                        &app,
                        "WARN",
                        "ROUTER",
                        &format!("Skipping provider '{}' (circuit breaker active for another {}s)", target_model.provider, (*expiry - now).as_secs()),
                    );
                    continue;
                }
            }
        }

        log_event(
            &app,
            "INFO",
            "ROUTER",
            &format!("Phase 1 (Fast-Pass SLA): Attempting route to [{}] via {} (TTFT limit: {}s)", target_model.model, target_model.provider, FAST_TTFT_LIMIT.as_secs()),
        );

        if target_model.provider == "ollama" {
            if !ollama_running {
                continue;
            }
            match try_ollama(&app, &client, &body, &source, &target_model.model, FAST_TTFT_LIMIT).await {
                Ok(response) => return response,
                Err(e) => {
                    let _ = app.emit("proxy_model_error", ProxyModelErrorPayload {
                        model: target_model.model.clone(),
                        provider: "ollama".to_string(),
                        error: e.clone(),
                    });
                    log_event(
                        &app,
                        "WARN",
                        "ROUTER",
                        &format!("ollama ({}) failed Phase 1: {}", target_model.model, e),
                    );
                    errors.push(format!("ollama ({}) failed: {}", target_model.model, e));
                    if !cooldown_candidates.iter().any(|m| m.model == target_model.model) {
                        cooldown_candidates.push(target_model.clone());
                    }
                }
            }
        } else {
            match try_cloud_provider(&app, &client, &body, &source, target_model, FAST_TTFT_LIMIT).await {
                Ok(response) => return response,
                Err(e) => {
                    let _ = app.emit("proxy_model_error", ProxyModelErrorPayload {
                        model: target_model.model.clone(),
                        provider: target_model.provider.clone(),
                        error: e.clone(),
                    });
                    log_event(
                        &app,
                        "WARN",
                        "ROUTER",
                        &format!("{} ({}) failed Phase 1: {}", target_model.provider, target_model.model, e),
                    );
                    errors.push(format!("{} ({}) failed: {}", target_model.provider, target_model.model, e));
                    if e.contains("HTTP 403") && target_model.provider == "google" {
                        skip_google = true;
                    }
                    if e.contains("HTTP 429") {
                        if target_model.provider == "google" && (e.contains("quota metric") || e.contains("free_tier_requests") || e.contains("Quota exceeded")) {
                            skip_google = true;
                        }
                        continue;
                    }
                    if e.contains("HTTP timeout") || e.contains("503") {
                        if !cooldown_candidates.iter().any(|m| m.model == target_model.model) {
                            cooldown_candidates.push(target_model.clone());
                        }
                    }
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // PHASE 2: Last Resort Escalation (Extended TTFT Limit: 120s)
    // ─────────────────────────────────────────────────────────────
    if !cooldown_candidates.is_empty() {
        log_event(
            &app,
            "INFO",
            "ROUTER",
            &format!("Fast-pass candidates exhausted. Entering Phase 2: Last Resort Mode (extended TTFT: {}s) across {} candidate(s).", LAST_RESORT_LIMIT.as_secs(), cooldown_candidates.len()),
        );

        for target_model in &cooldown_candidates {
            if target_model.provider == "google" && skip_google {
                continue;
            }

            // Check if provider circuit breaker is active (403) or permanently gated
            if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                let now = std::time::Instant::now();
                let p_cooldowns = health_state.provider_cooldowns.read().await;
                if let Some(expiry) = p_cooldowns.get(&target_model.provider) {
                    if *expiry > now {
                        continue;
                    }
                }
                let gated = health_state.gated_models.read().await;
                if gated.contains(&target_model.model) {
                    continue;
                }
            }

            log_event(
                &app,
                "INFO",
                "ROUTER",
                &format!("Phase 2 (Last Resort): Attempting [{}] via {} (extended TTFT limit: {}s)", target_model.model, target_model.provider, LAST_RESORT_LIMIT.as_secs()),
            );

            if target_model.provider == "ollama" {
                if !ollama_running {
                    continue;
                }
                match try_ollama(&app, &client, &body, &source, &target_model.model, LAST_RESORT_LIMIT).await {
                    Ok(response) => {
                        if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                            let mut m_cooldowns = health_state.model_cooldowns.write().await;
                            m_cooldowns.remove(&target_model.model);
                        }
                        log_event(
                            &app,
                            "INFO",
                            "ROUTER",
                            &format!("Model '{}' succeeded in Last Resort Mode. Cooldown cleared.", target_model.model),
                        );
                        return response;
                    }
                    Err(e) => {
                        errors.push(format!("Last Resort ollama ({}) failed: {}", target_model.model, e));
                    }
                }
            } else {
                match try_cloud_provider(&app, &client, &body, &source, target_model, LAST_RESORT_LIMIT).await {
                    Ok(response) => {
                        if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                            let mut m_cooldowns = health_state.model_cooldowns.write().await;
                            m_cooldowns.remove(&target_model.model);
                        }
                        log_event(
                            &app,
                            "INFO",
                            "ROUTER",
                            &format!("Model '{}' succeeded in Last Resort Mode. Cooldown cleared.", target_model.model),
                        );
                        return response;
                    }
                    Err(e) => {
                        errors.push(format!("Last Resort {} ({}) failed: {}", target_model.provider, target_model.model, e));
                    }
                }
            }
        }
    }

    if chain.is_empty() && ollama_viable {
        // Fallback when dynamic roster chain is empty on cold start
        match try_ollama(&app, &client, &body, &source, &ollama_model, FAST_TTFT_LIMIT).await {
            Ok(response) => return response,
            Err(_) => {
                match try_ollama(&app, &client, &body, &source, &ollama_model, LAST_RESORT_LIMIT).await {
                    Ok(response) => return response,
                    Err(e) => errors.push(format!("Ollama cold fallback failed: {}", e)),
                }
            }
        }
    }

    log_event(
        &app,
        "ERROR",
        "ROUTER",
        &format!("All upstream providers failed for request from '{}'", source),
    );

    // If both fail, return an aggregated 500 error
    axum::response::Response::builder()
        .status(500)
        .body(axum::body::Body::from(format!(
            "All upstream providers failed:\n{}",
            errors.join("\n")
        )))
        .unwrap()
}

pub fn parse_google_models(json: &serde_json::Value) -> Vec<RankedModel> {
    let mut ranked = Vec::new();
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

                // Minimum context limit: must be >= 128k (128,000 tokens)
                let input_token_limit = m.get("inputTokenLimit").and_then(|t| t.as_u64()).unwrap_or(0);
                
                if supports_chat && !is_junk && is_valid_family && input_token_limit >= MIN_CONTEXT_WINDOW {
                    let priority = crate::model_db::MODEL_REGISTRY.get_score(name);
                    ranked.push(RankedModel {
                        model: CloudModel {
                            model: clean_name.to_string(),
                            provider: "google".to_string(),
                            iq: priority,
                            context_length: Some(input_token_limit),
                        },
                        priority,
                    });
                }
            }
        }
    }
    ranked
}

pub fn evaluate_probe_response(status_code: u16, err_text: &str) -> ProbeStepOutcome {
    if (200..300).contains(&status_code) {
        ProbeStepOutcome::Success
    } else if status_code == 403 || err_text.contains("PERMISSION_DENIED") || err_text.contains("denied access") {
        ProbeStepOutcome::PermissionDenied403
    } else if status_code == 429 || err_text.contains("RESOURCE_EXHAUSTED") {
        ProbeStepOutcome::RateLimited429
    } else if status_code == 503 || err_text.contains("503") || err_text.contains("high demand") || err_text.contains("temporarily overloaded") {
        ProbeStepOutcome::ServiceUnavailable503
    } else {
        ProbeStepOutcome::OtherError(status_code.to_string())
    }
}

pub async fn probe_google_service_health(
    client: &reqwest::Client,
    key: &str,
    candidate_models: &[String],
    app: &tauri::AppHandle,
) -> (String, bool) {
    let mut saw_429 = false;
    let mut saw_503 = false;
    let mut last_err_status = "offline".to_string();

    let probe_body = serde_json::json!({
        "contents": [{"parts": [{"text": "ping"}]}],
        "generationConfig": {"maxOutputTokens": 1}
    });

    let mut tried = 0;
    for candidate in candidate_models {
        if tried >= 5 {
            break;
        }
        let clean_model = candidate.strip_prefix("models/").unwrap_or(candidate);
        tried += 1;

        let probe_url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            clean_model, key
        );

        match client.post(&probe_url).json(&probe_body).send().await {
            Ok(p_resp) => {
                let p_stat = p_resp.status().as_u16();
                let err_text = if (200..300).contains(&p_stat) {
                    String::new()
                } else {
                    p_resp.text().await.unwrap_or_default()
                };

                match evaluate_probe_response(p_stat, &err_text) {
                    ProbeStepOutcome::Success => {
                        if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                            let mut m_cooldowns = health_state.model_cooldowns.write().await;
                            m_cooldowns.remove(clean_model);
                            let mut p_cooldowns = health_state.provider_cooldowns.write().await;
                            p_cooldowns.remove("google");
                        }
                        log_event(
                            app,
                            "INFO",
                            "ROUTER",
                            &format!("Google AI Studio service verified healthy on model '{}'.", clean_model),
                        );
                        return ("200 OK".to_string(), false);
                    }
                    ProbeStepOutcome::PermissionDenied403 => {
                        if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                            let mut p_cooldowns = health_state.provider_cooldowns.write().await;
                            p_cooldowns.insert("google".to_string(), std::time::Instant::now() + std::time::Duration::from_secs(600));
                        }
                        log_event(
                            app,
                            "WARN",
                            "ROUTER",
                            &format!("Google AI Studio API key denied permission (HTTP 403) on '{}'. Circuit breaker engaged.", clean_model),
                        );
                        return ("403".to_string(), true);
                    }
                    ProbeStepOutcome::RateLimited429 => {
                        saw_429 = true;
                        last_err_status = "429".to_string();
                        if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                            let mut m_cooldowns = health_state.model_cooldowns.write().await;
                            m_cooldowns.insert(clean_model.to_string(), std::time::Instant::now() + std::time::Duration::from_secs(60));
                        }
                        log_event(
                            app,
                            "WARN",
                            "ROUTER",
                            &format!("Model '{}' returned 429 quota exhausted. Testing next candidate model to verify service health.", clean_model),
                        );
                    }
                    ProbeStepOutcome::ServiceUnavailable503 => {
                        saw_503 = true;
                        if !saw_429 {
                            last_err_status = "503".to_string();
                        }
                        if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                            let mut m_cooldowns = health_state.model_cooldowns.write().await;
                            m_cooldowns.insert(clean_model.to_string(), std::time::Instant::now() + std::time::Duration::from_secs(60));
                        }
                        log_event(
                            app,
                            "WARN",
                            "ROUTER",
                            &format!("Model '{}' returned 503 service overloaded. Testing next candidate model.", clean_model),
                        );
                    }
                    ProbeStepOutcome::OtherError(code) => {
                        if code == "404" || err_text.contains("NOT_FOUND") || err_text.contains("no longer available") {
                            if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                                let mut gated = health_state.gated_models.write().await;
                                gated.insert(clean_model.to_string());
                                log_event(
                                    app,
                                    "WARN",
                                    "ROUTER",
                                    &format!("Model '{}' permanently gated during health probe (HTTP 404). Testing next candidate.", clean_model),
                                );
                            }
                        } else if code == "500" || code == "502" || code == "504" {
                            if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                                let mut m_cooldowns = health_state.model_cooldowns.write().await;
                                m_cooldowns.insert(clean_model.to_string(), std::time::Instant::now() + std::time::Duration::from_secs(60));
                            }
                        }
                        last_err_status = code;
                    }
                }
            }
            Err(e) => {
                last_err_status = if e.is_timeout() { "timeout".to_string() } else { "offline".to_string() };
            }
        }
    }

    let final_status = if saw_429 {
        "429".to_string()
    } else if saw_503 {
        "503".to_string()
    } else {
        last_err_status
    };

    (final_status, false)
}

pub fn parse_openrouter_models(json: &serde_json::Value, gated_set: &HashSet<String>) -> Vec<RankedModel> {
    let mut ranked = Vec::new();
    if let Some(models) = json.get("data").and_then(|m| m.as_array()) {
        for m in models {
            if let Some(id) = m.get("id").and_then(|i| i.as_str()) {
                // Filter out openrouter:free / openrouter/free router model alias
                if is_openrouter_free_alias(id) {
                    continue;
                }

                // Filter out models permanently gated by agentic harness requirement
                if gated_set.contains(id) {
                    continue;
                }

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
                        let ctx = m.get("context_length").and_then(|c| c.as_u64()).unwrap_or(0);
                        if ctx >= MIN_CONTEXT_WINDOW {
                            let inference_id = id.to_string();
                            let lookup_id = id.trim_end_matches(":free");
                            let is_heavy_550b = inference_id.contains("550b") || inference_id.contains("nemotron-3-ultra-550b");
                            let raw_score = crate::model_db::MODEL_REGISTRY.get_score(lookup_id);
                            let priority = if is_heavy_550b {
                                (raw_score - 15.0).max(1.0)
                            } else {
                                raw_score
                            };
                            println!("Score for {} (lookup: {}) is {}", inference_id, lookup_id, priority);
                            ranked.push(RankedModel {
                                model: CloudModel {
                                    model: inference_id,
                                    provider: "openrouter".to_string(),
                                    iq: raw_score,
                                    context_length: Some(ctx),
                                },
                                priority,
                            });
                        }
                    }
                }
            }
        }
    }
    ranked
}

pub fn parse_ollama_models(json: &serde_json::Value) -> Vec<RankedModel> {
    let mut ranked = Vec::new();
    if let Some(models) = json.get("models").and_then(|m| m.as_array()) {
        let raw_names: Vec<String> = models
            .iter()
            .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
            .collect();

        let has_base_models = raw_names.iter().any(|n| !n.starts_with("frugallm-active"));
        let target_names: Vec<String> = if has_base_models {
            raw_names.into_iter().filter(|n| !n.starts_with("frugallm-active")).collect()
        } else {
            // Only frugallm-active exists; inspect details.parent_model or fallback to gemma4:e2b
            let parent = models.iter().find_map(|m| {
                let n = m.get("name").and_then(|n| n.as_str()).unwrap_or("");
                if n.starts_with("frugallm-active") {
                    m.get("details")
                        .and_then(|d| d.get("parent_model"))
                        .and_then(|p| p.as_str())
                        .filter(|p| !p.is_empty())
                        .map(|s| s.to_string())
                } else {
                    None
                }
            });
            vec![parent.unwrap_or_else(|| "gemma4:e2b".to_string())]
        };

        let mut seen = std::collections::HashSet::new();
        for name in target_names {
            if !seen.insert(name.clone()) {
                continue;
            }
            let iq = crate::model_db::MODEL_REGISTRY.get_score(&name);
            // Ollama models default below cloud models (-10.0 baseline) unless pinned
            let priority = -10.0 + (iq / 1000.0);
            ranked.push(RankedModel {
                model: CloudModel {
                    model: name,
                    provider: "ollama".to_string(),
                    iq,
                    context_length: Some(131_072),
                },
                priority,
            });
        }
    }
    ranked
}

pub async fn fetch_live_routing_chain(app: &tauri::AppHandle) -> Vec<CloudModel> {
    let (enable_paid_fallback, overrides) = {
        let state = app.state::<FrugalConfigState>();
        let config = state.config.lock().await;
        (config.enable_paid_fallback, config.manual_model_overrides.clone())
    };

    let gated_set: HashSet<String> = if let Some(health_state) = app.try_state::<ProviderHealthState>() {
        let guard = health_state.gated_models.read().await;
        guard.clone()
    } else {
        HashSet::new()
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
            ranked_chain.extend(parse_ollama_models(&json));
        }
    }

    // 2. Fetch from Google AI Studio
    if let Ok(key) = crate::get_credential("google") {
        if !key.trim().is_empty() {
            let url = format!("https://generativelanguage.googleapis.com/v1beta/models?key={}", key);
            match client.get(&url).send().await {
                Ok(resp) => {
                    let status = resp.status();
                    if status.is_success() {
                        let models_json = resp.json::<serde_json::Value>().await.ok();
                        let mut google_models = Vec::new();
                        if let Some(ref json) = models_json {
                            google_models = parse_google_models(json);
                        }

                        // Collect candidate names to probe
                        let mut candidate_names: Vec<String> = google_models.iter().map(|m| m.model.model.clone()).collect();
                        for fallback in &["gemini-flash-latest", "gemini-3.5-flash", "gemma-4-26b-a4b-it"] {
                            if !candidate_names.contains(&fallback.to_string()) {
                                candidate_names.push(fallback.to_string());
                            }
                        }

                        let (gen_status, is_403) = probe_google_service_health(&client, &key, &candidate_names, app).await;
                        update_provider_status(app, "google", &gen_status).await;

                        if !is_403 {
                            ranked_chain.extend(google_models);
                        } else {
                            log_event(
                                app,
                                "WARN",
                                "ROUTER",
                                &format!("Google AI Studio API key denied permission (HTTP 403). Models not loaded."),
                            );
                        }
                    } else {
                        let status_code_str = if status.as_u16() == 403 {
                            "403"
                        } else if status.as_u16() == 429 {
                            "429"
                        } else {
                            status.as_str()
                        };
                        update_provider_status(app, "google", status_code_str).await;
                        log_event(
                            app,
                            "WARN",
                            "ROUTER",
                            &format!("Failed to fetch Google models (HTTP {}).", status),
                        );
                    }
                }
                Err(e) => {
                    let err_status = if e.is_timeout() { "timeout" } else { "offline" };
                    update_provider_status(app, "google", err_status).await;
                }
            }
        }
    }

    // 3. Fetch from OpenRouter
    if let Ok(key) = crate::get_credential("openrouter") {
        if !key.trim().is_empty() {
            let mut openrouter_has_credits = false;
            
            // First probe OpenRouter auth with a lightweight GET /auth/key
            let auth_ok = match client.get("https://openrouter.ai/api/v1/auth/key")
                .header("Authorization", format!("Bearer {}", key))
                .header("HTTP-Referer", "https://github.com/chorned/frugaLLM")
                .header("X-Title", "FrugaLLM")
                .send().await {
                Ok(resp) => {
                    let status = resp.status();
                    if status.is_success() {
                        true
                    } else {
                        let status_code_str = if status.as_u16() == 401 || status.as_u16() == 403 {
                            "403"
                        } else if status.as_u16() == 429 {
                            "429"
                        } else {
                            status.as_str()
                        };
                        update_provider_status(app, "openrouter", status_code_str).await;
                        false
                    }
                }
                Err(e) => {
                    let err_status = if e.is_timeout() { "timeout" } else { "offline" };
                    update_provider_status(app, "openrouter", err_status).await;
                    false
                }
            };

            if auth_ok {
                match client.get("https://openrouter.ai/api/v1/models")
                    .header("Authorization", format!("Bearer {}", key))
                    .header("HTTP-Referer", "https://github.com/chorned/frugaLLM")
                    .header("X-Title", "FrugaLLM")
                    .send().await {
                    Ok(resp) => {
                        let status = resp.status();
                        if status.is_success() {
                            update_provider_status(app, "openrouter", "200 OK").await;
                            if let Ok(json) = resp.json::<serde_json::Value>().await {
                                let or_models = parse_openrouter_models(&json, &gated_set);
                                ranked_chain.extend(or_models);
                            }
                        } else {
                            let status_code_str = if status.as_u16() == 401 || status.as_u16() == 403 {
                                "403"
                            } else if status.as_u16() == 429 {
                                "429"
                            } else {
                                status.as_str()
                            };
                            update_provider_status(app, "openrouter", status_code_str).await;
                            log_event(
                                app,
                                "WARN",
                                "ROUTER",
                                &format!("Failed to fetch OpenRouter models (HTTP {}).", status),
                            );
                        }
                    }
                    Err(e) => {
                        let err_status = if e.is_timeout() { "timeout" } else { "offline" };
                        update_provider_status(app, "openrouter", err_status).await;
                    }
                }

                // Check OpenRouter credits if paid fallback is enabled
                if enable_paid_fallback {
                    if let Ok(resp) = client.get("https://openrouter.ai/api/v1/credits")
                        .header("Authorization", format!("Bearer {}", key))
                        .header("HTTP-Referer", "https://github.com/chorned/frugaLLM")
                        .header("X-Title", "FrugaLLM")
                        .send().await {
                        if resp.status().is_success() {
                            if let Ok(json) = resp.json::<serde_json::Value>().await {
                                if let Some(data) = json.get("data") {
                                    let total_credits = data.get("total_credits").and_then(|c| c.as_f64()).unwrap_or(0.0);
                                    let total_usage = data.get("total_usage").and_then(|u| u.as_f64()).unwrap_or(0.0);
                                    if total_credits > total_usage {
                                        openrouter_has_credits = true;
                                    }
                                }
                            }
                        }
                    }

                    if openrouter_has_credits {
                        let paid_models = [
                            ("google/gemini-2.5-flash", 1_048_576),
                            ("anthropic/claude-3.5-haiku", 200_000),
                            ("openai/gpt-4o-mini", 128_000),
                        ];
                        for (paid_id, paid_ctx) in paid_models {
                            if !ranked_chain.iter().any(|rm| rm.model.model == paid_id) {
                                let score = crate::model_db::MODEL_REGISTRY.get_score(paid_id);
                                ranked_chain.push(RankedModel {
                                    model: CloudModel {
                                        model: paid_id.to_string(),
                                        provider: "openrouter".to_string(),
                                        iq: score,
                                        context_length: Some(paid_ctx),
                                    },
                                    priority: score,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    sort_and_apply_overrides(ranked_chain, &overrides)
}

pub fn sort_and_apply_overrides(
    mut ranked_chain: Vec<RankedModel>,
    overrides: &[String],
) -> Vec<CloudModel> {
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

pub async fn check_and_retry_providers(app: &tauri::AppHandle, client: &reqwest::Client) {
    // 1. Google AI Studio
    if let Ok(key) = crate::get_credential("google") {
        if !key.trim().is_empty() {
            let is_currently_error = {
                if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                    let statuses = health_state.live_statuses.read().await;
                    statuses.get("google").map(|s| s != "200 OK").unwrap_or(false)
                } else { false }
            };

            let url = format!("https://generativelanguage.googleapis.com/v1beta/models?key={}", key);
            match client.get(&url).send().await {
                Ok(resp) => {
                    let status = resp.status();
                    if status.is_success() {
                        // If provider was in an error state, probe generateContent before clearing error
                        let gen_ok = if is_currently_error {
                            let candidate_names = if let Some(roster) = app.try_state::<DynamicRosterState>() {
                                let guard = roster.fallback_chain.read().await;
                                let list: Vec<String> = guard.iter().filter(|m| m.provider == "google").map(|m| m.model.clone()).collect();
                                if list.is_empty() {
                                    vec!["gemini-flash-latest".to_string(), "gemini-3.5-flash".to_string(), "gemma-4-26b-a4b-it".to_string()]
                                } else {
                                    list
                                }
                            } else {
                                vec!["gemini-flash-latest".to_string(), "gemini-3.5-flash".to_string(), "gemma-4-26b-a4b-it".to_string()]
                            };

                            let (gen_status, is_403) = probe_google_service_health(client, &key, &candidate_names, app).await;
                            if is_403 || gen_status != "200 OK" {
                                update_provider_status(app, "google", &gen_status).await;
                                false
                            } else {
                                true
                            }
                        } else {
                            true
                        };

                        if gen_ok {
                            let was_error = {
                                if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                                    let mut p_cooldowns = health_state.provider_cooldowns.write().await;
                                    p_cooldowns.remove("google");
                                    let statuses = health_state.live_statuses.read().await;
                                    statuses.get("google").map(|s| s != "200 OK").unwrap_or(false)
                                } else { false }
                            };
                            update_provider_status(app, "google", "200 OK").await;
                            let is_chain_empty = if let Some(roster) = app.try_state::<DynamicRosterState>() {
                                roster.fallback_chain.read().await.is_empty()
                            } else {
                                false
                            };

                            if was_error || is_chain_empty {
                                if let Some(roster) = app.try_state::<DynamicRosterState>() {
                                    let new_chain = fetch_live_routing_chain(app).await;
                                    let mut guard = roster.fallback_chain.write().await;
                                    *guard = new_chain;
                                }
                            }
                        }
                    } else {
                        let code = if status.as_u16() == 403 {
                            "403"
                        } else if status.as_u16() == 429 {
                            "429"
                        } else {
                            status.as_str()
                        };
                        update_provider_status(app, "google", code).await;
                    }
                }
                Err(e) => {
                    let err_status = if e.is_timeout() { "timeout" } else { "offline" };
                    update_provider_status(app, "google", err_status).await;
                }
            }
        }
    }

    // 2. OpenRouter
    if let Ok(key) = crate::get_credential("openrouter") {
        if !key.trim().is_empty() {
            match client.get("https://openrouter.ai/api/v1/auth/key")
                .header("Authorization", format!("Bearer {}", key))
                .header("HTTP-Referer", "https://github.com/chorned/frugaLLM")
                .header("X-Title", "FrugaLLM")
                .send().await {
                Ok(resp) => {
                    let status = resp.status();
                    if status.is_success() {
                        let was_error = {
                            if let Some(health_state) = app.try_state::<ProviderHealthState>() {
                                let mut p_cooldowns = health_state.provider_cooldowns.write().await;
                                p_cooldowns.remove("openrouter");
                                let statuses = health_state.live_statuses.read().await;
                                statuses.get("openrouter").map(|s| s != "200 OK").unwrap_or(false)
                            } else { false }
                        };
                        update_provider_status(app, "openrouter", "200 OK").await;
                        let is_chain_empty = if let Some(roster) = app.try_state::<DynamicRosterState>() {
                            roster.fallback_chain.read().await.is_empty()
                        } else {
                            false
                        };

                        if was_error || is_chain_empty {
                            if let Some(roster) = app.try_state::<DynamicRosterState>() {
                                let new_chain = fetch_live_routing_chain(app).await;
                                let mut guard = roster.fallback_chain.write().await;
                                *guard = new_chain;
                            }
                        }
                    } else {
                        let code = if status.as_u16() == 401 || status.as_u16() == 403 {
                            "403"
                        } else if status.as_u16() == 429 {
                            "429"
                        } else {
                            status.as_str()
                        };
                        update_provider_status(app, "openrouter", code).await;
                    }
                }
                Err(e) => {
                    let err_status = if e.is_timeout() { "timeout" } else { "offline" };
                    update_provider_status(app, "openrouter", err_status).await;
                }
            }
        }
    }
}

pub fn start_provider_health_loop(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let client = match reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build() {
                Ok(c) => c,
                Err(_) => return,
            };

        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
            check_and_retry_providers(&app, &client).await;
        }
    });
}

pub async fn start_frugallm_server(app: tauri::AppHandle) {
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

    match TcpListener::bind(&addr).await {
        Ok(listener) => {
            let actual_port = match listener.local_addr() {
                Ok(local_addr) => {
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
                    local_addr.port()
                }
                Err(_) => port,
            };

            let running_status = ServerStatus::Running {
                port: actual_port,
                ip: ip.to_string(),
            };
            {
                let state = app.state::<FrugalConfigState>();
                let mut status = state.server_status.write().await;
                *status = running_status.clone();
            }
            let _ = app.emit("frugallm_server_status", running_status);

            let is_tool_gateway_active = check_tool_gateway_status(app.clone()).await;
            log_event(
                &app,
                "INFO",
                "INIT",
                &format!(
                    "FrugaLLM core server listening on {}:{} | Tool Enforcing Gateway: {}",
                    ip,
                    actual_port,
                    if is_tool_gateway_active { "ACTIVE" } else { "DISABLED" }
                ),
            );

            let _ = axum::serve(listener, router).await;
        }
        Err(e) => {
            eprintln!("Failed to bind FrugalLLM server to {}: {}", addr, e);
            let conflict_msg = format!("Close the service currently using port [{}] and restart the app, or choose a different port.", port);
            let conflict_status = ServerStatus::PortConflict {
                port,
                ip: ip.to_string(),
                message: conflict_msg,
            };
            {
                let state = app.state::<FrugalConfigState>();
                let mut status = state.server_status.write().await;
                *status = conflict_status.clone();
            }
            let _ = app.emit("frugallm_port_error", port);
            let _ = app.emit("frugallm_server_status", conflict_status);
        }
    }
}

