use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::env;
use std::fs::File;
use std::io::Write;
use std::path::Path;

#[derive(Serialize, Deserialize)]
struct ModelScore {
    score: f32,
}

fn main() {
    tauri_build::build();

    let out_dir = env::var("OUT_DIR").unwrap();
    let dest_path = Path::new(&out_dir).join("model_db.json");

    let mut scores: HashMap<String, ModelScore> = HashMap::new();

    if let Ok(api_key) = env::var("OPENROUTER_API_KEY") {
        if !api_key.trim().is_empty() {
            let client = reqwest::blocking::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap();

            if let Ok(resp) = client
                .get("https://openrouter.ai/api/v1/benchmarks?task_type=intelligence")
                .header("Authorization", format!("Bearer {}", api_key))
                .send()
            {
                if let Ok(json) = resp.json::<Value>() {
                    if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                        let mut temp_scores: HashMap<String, Vec<f32>> = HashMap::new();

                        for item in data {
                            if let Some(slug) = item.get("model_permaslug").and_then(|s| s.as_str())
                            {
                                if let Some(ii) =
                                    item.get("intelligence_index").and_then(|v| v.as_f64())
                                {
                                    temp_scores
                                        .entry(slug.to_string())
                                        .or_default()
                                        .push(ii as f32);
                                }
                            }
                        }

                        for (slug, vals) in temp_scores {
                            if vals.is_empty() {
                                continue;
                            }
                            let avg = vals.iter().sum::<f32>() / (vals.len() as f32);
                            if avg >= 30.0 {
                                scores.insert(slug, ModelScore { score: avg });
                            }
                        }
                    }
                }
            }
        }
    }

    if let Ok(mut f) = File::create(&dest_path) {
        let _ = f.write_all(serde_json::to_string(&scores).unwrap().as_bytes());
    }

    println!("cargo:rerun-if-env-changed=OPENROUTER_API_KEY");
    println!("cargo:rerun-if-changed=build.rs");
}
