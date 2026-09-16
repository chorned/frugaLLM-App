use std::collections::HashMap;
use std::env;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize)]
struct ModelScore {
    score: f32,
}

fn find_openrouter_key() -> Option<String> {
    if let Ok(key) = env::var("OPENROUTER_API_KEY") {
        let trimmed = key.trim().to_string();
        if !trimmed.is_empty() {
            return Some(trimmed);
        }
    }
    if let Ok(key) = env::var("OPENROUTER_KEY") {
        let trimmed = key.trim().to_string();
        if !trimmed.is_empty() {
            return Some(trimmed);
        }
    }

    let cwd = env::current_dir().unwrap_or_default();
    let candidates = [
        cwd.join(".env.build"),
        cwd.join(".env"),
        cwd.join("src-tauri").join(".env.build"),
        cwd.join("src-tauri").join(".env"),
        cwd.parent().map(|p| p.join(".env.build")).unwrap_or_default(),
        cwd.parent().map(|p| p.join(".env")).unwrap_or_default(),
        cwd.parent().map(|p| p.join("src-tauri").join(".env.build")).unwrap_or_default(),
        cwd.parent().map(|p| p.join("src-tauri").join(".env")).unwrap_or_default(),
    ];

    for path in &candidates {
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(path) {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with('#') {
                        continue;
                    }
                    if let Some(rest) = trimmed.strip_prefix("OPENROUTER_API_KEY=") {
                        let val = rest.trim().trim_matches('"').trim_matches('\'');
                        if !val.is_empty() {
                            return Some(val.to_string());
                        }
                    }
                    if let Some(rest) = trimmed.strip_prefix("OPENROUTER_KEY=") {
                        let val = rest.trim().trim_matches('"').trim_matches('\'');
                        if !val.is_empty() {
                            return Some(val.to_string());
                        }
                    }
                }
            }
        }
    }

    None
}

fn main() {
    tauri_build::build();

    let out_dir = env::var("OUT_DIR").expect("OUT_DIR must be set by Cargo");
    let dest_path = Path::new(&out_dir).join("model_db.json");

    let offline_allowed = env::var("FRUGAL_OFFLINE_BUILD").map(|v| v == "1").unwrap_or(false);

    let api_key = match find_openrouter_key() {
        Some(k) => k,
        None => {
            if offline_allowed {
                println!("cargo:warning=FRUGAL_OFFLINE_BUILD=1 active: Skipping live benchmark fetch due to missing OPENROUTER_API_KEY.");
                let fallback = include_bytes!("model_db_fallback.json");
                let _ = File::create(&dest_path).and_then(|mut f| f.write_all(fallback));
                println!("cargo:rerun-if-env-changed=OPENROUTER_API_KEY");
                println!("cargo:rerun-if-env-changed=OPENROUTER_KEY");
                println!("cargo:rerun-if-env-changed=FRUGAL_OFFLINE_BUILD");
                println!("cargo:rerun-if-changed=model_db_fallback.json");
                println!("cargo:rerun-if-changed=.env");
                println!("cargo:rerun-if-changed=.env.build");
                println!("cargo:rerun-if-changed=src-tauri/.env");
                println!("cargo:rerun-if-changed=src-tauri/.env.build");
                println!("cargo:rerun-if-changed=build.rs");
                return;
            }
            panic!(
                "\n\n================================================================================\n\
                 BUILD FAILURE: OPENROUTER_API_KEY is missing!\n\
                 A functioning OpenRouter API key is required to build FrugaLLM and populate\n\
                 model intelligence benchmark rankings.\n\
                 Please set OPENROUTER_API_KEY in your environment or add it to .env.\n\
                 ================================================================================\n\n"
            );
        }
    };

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .expect("Failed to create HTTP client in build.rs");

    let resp = match client
        .get("https://openrouter.ai/api/v1/benchmarks?task_type=intelligence")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("HTTP-Referer", "https://github.com/chorned/frugaLLM")
        .header("X-Title", "FrugaLLM")
        .send()
    {
        Ok(r) => r,
        Err(e) => {
            println!("cargo:warning=OpenRouter benchmarks API request failed or timed out ({}). Using cached fallback.", e);
            let fallback = include_bytes!("model_db_fallback.json");
            let _ = File::create(&dest_path).and_then(|mut f| f.write_all(fallback));
            return;
        }
    };

    let status = resp.status();
    if status.as_u16() == 401 || status.as_u16() == 403 {
        panic!(
            "\n\n================================================================================\n\
             BUILD FAILURE: OpenRouter benchmarks API returned HTTP {} (Unauthorized/Forbidden)!\n\
             Please verify that your OPENROUTER_API_KEY is active and valid.\n\
             ================================================================================\n\n",
            status
        );
    }
    if !status.is_success() {
        println!("cargo:warning=OpenRouter benchmarks API returned HTTP {}. Using cached fallback.", status);
        let fallback = include_bytes!("model_db_fallback.json");
        let _ = File::create(&dest_path).and_then(|mut f| f.write_all(fallback));
        return;
    }

    fn strip_date_suffix(slug: &str) -> Option<&str> {
        // -YYYYMMDD (e.g. -20260902)
        if slug.len() > 9 {
            let suffix = &slug[slug.len() - 9..];
            if suffix.starts_with('-') && suffix[1..].chars().all(|c| c.is_ascii_digit()) {
                return Some(&slug[..slug.len() - 9]);
            }
        }
        // -YYYY-MM-DD (e.g. -2024-08-06)
        if slug.len() > 11 {
            let suffix = &slug[slug.len() - 11..];
            let parts: Vec<&str> = suffix.split('-').collect();
            if parts.len() == 4
                && parts[0].is_empty()
                && parts[1].len() == 4 && parts[1].chars().all(|c| c.is_ascii_digit())
                && parts[2].len() == 2 && parts[2].chars().all(|c| c.is_ascii_digit())
                && parts[3].len() == 2 && parts[3].chars().all(|c| c.is_ascii_digit())
            {
                return Some(&slug[..slug.len() - 11]);
            }
        }
        None
    }

    fn insert_score_with_collision_handling(
        scores: &mut HashMap<String, ModelScore>,
        key: &str,
        score: f32,
    ) {
        if let Some(existing) = scores.get_mut(key) {
            if score > existing.score {
                existing.score = score;
            }
        } else {
            scores.insert(key.to_string(), ModelScore { score });
        }
    }

    let mut scores: HashMap<String, ModelScore> = HashMap::new();
    let json: Value = match resp.json() {
        Ok(j) => j,
        Err(e) => {
            println!("cargo:warning=Failed to parse OpenRouter benchmarks JSON response: {}. Using fallback.", e);
            let fallback = include_bytes!("model_db_fallback.json");
            let _ = File::create(&dest_path).and_then(|mut f| f.write_all(fallback));
            return;
        }
    };

    if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
        let mut temp_scores: HashMap<String, Vec<f32>> = HashMap::new();

        for item in data {
            if let Some(slug) = item.get("model_permaslug").and_then(|s| s.as_str()) {
                if let Some(ii) = item.get("intelligence_index").and_then(|v| v.as_f64()) {
                    temp_scores.entry(slug.to_string()).or_default().push(ii as f32);
                }
            }
        }

        for (slug, vals) in temp_scores {
            if vals.is_empty() { continue; }
            let avg = vals.iter().sum::<f32>() / (vals.len() as f32);
            if avg >= 30.0 {
                // 1. Store full raw permaslug
                insert_score_with_collision_handling(&mut scores, &slug, avg);

                // 2. Strip date suffix and store normalized version with collision handling
                if let Some(stripped) = strip_date_suffix(&slug) {
                    insert_score_with_collision_handling(&mut scores, stripped, avg);
                    if let Some(bare) = stripped.split('/').nth(1) {
                        insert_score_with_collision_handling(&mut scores, bare, avg);
                    }
                }

                // 3. Store unprefixed bare name if provider prefix exists
                if let Some(bare) = slug.split('/').nth(1) {
                    insert_score_with_collision_handling(&mut scores, bare, avg);
                }
            }
        }
    }

    if scores.is_empty() {
        println!("cargo:warning=Zero benchmark scores parsed from API. Using fallback.");
        let fallback = include_bytes!("model_db_fallback.json");
        let _ = File::create(&dest_path).and_then(|mut f| f.write_all(fallback));
        return;
    }

    if let Ok(mut f) = File::create(&dest_path) {
        let _ = f.write_all(serde_json::to_string(&scores).unwrap().as_bytes());
    }

    println!("cargo:rerun-if-env-changed=OPENROUTER_API_KEY");
    println!("cargo:rerun-if-env-changed=OPENROUTER_KEY");
    println!("cargo:rerun-if-changed=.env");
    println!("cargo:rerun-if-changed=.env.build");
    println!("cargo:rerun-if-changed=../.env");
    println!("cargo:rerun-if-changed=../.env.build");
    println!("cargo:rerun-if-changed=src-tauri/.env");
    println!("cargo:rerun-if-changed=src-tauri/.env.build");
    println!("cargo:rerun-if-changed=build.rs");
}
