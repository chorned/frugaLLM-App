use std::env;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::collections::HashMap;

#[derive(serde::Deserialize, Debug)]
struct OpenRouterBenchmark {
    model_permaslug: String,
    intelligence_index: Option<f32>,
}

#[derive(serde::Deserialize, Debug)]
struct OpenRouterResponse {
    data: Vec<OpenRouterBenchmark>,
}

fn main() {
    tauri_build::build();

    let out_dir = env::var("OUT_DIR").expect("OUT_DIR not set");
    let dest_path = Path::new(&out_dir).join("model_db.json");

    let api_key = env::var("OPENROUTER_API_KEY")
        .unwrap_or_else(|_| "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".to_string());

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .expect("Failed to build reqwest client");

    let mut model_scores: HashMap<String, f32> = HashMap::new();

    if let Ok(response) = client
        .get("https://openrouter.ai/api/v1/benchmarks")
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
    {
        if let Ok(json) = response.json::<OpenRouterResponse>() {
            for benchmark in json.data {
                if let Some(score) = benchmark.intelligence_index {
                    if score >= 30.0 {
                        model_scores.insert(benchmark.model_permaslug, score);
                    }
                }
            }
        } else {
            println!("cargo:warning=Failed to parse OpenRouter benchmarks JSON.");
        }
    } else {
        println!("cargo:warning=Failed to fetch OpenRouter benchmarks.");
    }

    // Write to OUT_DIR
    let json_str = serde_json::to_string(&model_scores).expect("Failed to serialize model DB");
    let mut file = File::create(&dest_path).expect("Failed to create model_db.json");
    file.write_all(json_str.as_bytes()).expect("Failed to write to model_db.json");
}
