use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use lazy_static::lazy_static;

lazy_static! {
    pub static ref MODEL_REGISTRY: ModelIntelligenceRegistry = ModelIntelligenceRegistry::new();
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModelScore {
    pub score: f32,
}

#[derive(Clone)]
pub struct ModelIntelligenceRegistry {
    scores: Arc<RwLock<HashMap<String, ModelScore>>>,
}

impl ModelIntelligenceRegistry {
    #[allow(dead_code)]
    pub fn new() -> Self {
        let json_str = include_str!(concat!(env!("OUT_DIR"), "/model_db.json"));
        let mut db: HashMap<String, ModelScore> = serde_json::from_str(json_str).unwrap_or_default();

        // Seed default foundational intelligence benchmarks to guarantee baseline scores
        let seed_models = [
            ("google/gemma-4-31b-it", 63.2),
            ("google/gemma-4-26b-a4b-it", 56.2),
            ("google/gemma-4-12b-it", 48.5),
            ("google/gemma-4-e4b-it", 42.0),
            ("google/gemma-4-e2b-it", 36.5),
            ("google/gemini-2.5-flash", 65.1),
            ("google/gemini-2.5-pro", 75.5),
            ("google/gemini-2.5-flash-lite", 50.8),
            ("anthropic/claude-3.5-sonnet", 85.0),
            ("anthropic/claude-3.5-haiku", 58.0),
            ("meta-llama/llama-3.3-70b-instruct", 62.0),
            ("z-ai/glm-5.2", 52.6),
            ("minimax/minimax-m3", 45.4),
            ("minimax/minimax-m2.7", 38.9),
            ("thinkingmachines/inkling", 42.3),
            ("thinkingmachines/inkling-small", 41.2),
            ("nvidia/nemotron-3-ultra-550b-a55b", 38.3),
        ];

        for (model, score) in seed_models {
            db.entry(model.to_string()).or_insert(ModelScore { score });
        }

        Self {
            scores: Arc::new(RwLock::new(db)),
        }
    }

    pub fn normalize_model_id(raw_id: &str) -> String {
        let mut id = raw_id.to_lowercase();
        
        // Handle Google AI Studio prefix (models/...)
        if let Some(stripped) = id.strip_prefix("models/") {
            id = format!("google/{}", stripped);
        }

        // Strip OpenRouter tier suffixes like :free, :nitro, :extended
        if let Some(base) = id.split(':').next() {
            id = base.to_string();
        }
        
        id
    }

    pub fn get_score(&self, model_id: &str) -> f32 {
        let lookup_id = model_id.trim_end_matches(":free");
        let normalized = Self::normalize_model_id(lookup_id);
        let guard = self.scores.read().unwrap();
        
        // 1. Exact match on normalized ID
        if let Some(s) = guard.get(&normalized) {
            return s.score;
        }

        // 2. Exact match on raw lookup ID
        if let Some(s) = guard.get(lookup_id) {
            return s.score;
        }

        // 3. Exact match against normalized registry keys
        for (k, v) in guard.iter() {
            let k_norm = Self::normalize_model_id(k);
            if k_norm == normalized {
                return v.score;
            }
        }

        // 4. Fuzzy match: If the query is "minimax/minimax-m3", it should match "minimax/minimax-m3-20260531"
        for (k, v) in guard.iter() {
            let k_norm = Self::normalize_model_id(k);
            if k_norm.starts_with(&normalized) {
                if k_norm.len() == normalized.len() || k_norm.as_bytes().get(normalized.len()) == Some(&b'-') {
                    return v.score;
                }
            }
        }

        // 5. Reverse fuzzy match: If query has date suffix "google/gemma-4-31b-it-20260402", matches "google/gemma-4-31b-it"
        for (k, v) in guard.iter() {
            let k_norm = Self::normalize_model_id(k);
            if normalized.starts_with(&k_norm) {
                if normalized.len() == k_norm.len() || normalized.as_bytes().get(k_norm.len()) == Some(&b'-') {
                    return v.score;
                }
            }
        }
        
        // Return 0.0 for unbenchmarked models so they fall below proven models
        0.0
    }

    #[allow(dead_code)]
    pub fn sort_models_by_intelligence<T, F>(&self, models: &mut [T], id_extractor: F)
    where
        F: Fn(&T) -> &str,
    {
        models.sort_by(|a, b| {
            let score_a = self.get_score(id_extractor(a));
            let score_b = self.get_score(id_extractor(b));
            score_b.partial_cmp(&score_a).unwrap_or(std::cmp::Ordering::Equal)
        });
    }

    #[allow(dead_code)]
    pub fn update_scores(&self, new_scores: HashMap<String, ModelScore>) {
        let mut guard = self.scores.write().unwrap();
        for (k, v) in new_scores {
            guard.insert(k, v);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_model_id_google_prefix() {
        assert_eq!(
            ModelIntelligenceRegistry::normalize_model_id("models/gemini-2.5-flash"),
            "google/gemini-2.5-flash"
        );
        assert_eq!(
            ModelIntelligenceRegistry::normalize_model_id("MODELS/GEMINI-PRO"),
            "google/gemini-pro"
        );
    }

    #[test]
    fn test_normalize_model_id_strip_colon_suffixes() {
        assert_eq!(
            ModelIntelligenceRegistry::normalize_model_id("anthropic/claude-3.5-sonnet:free"),
            "anthropic/claude-3.5-sonnet"
        );
        assert_eq!(
            ModelIntelligenceRegistry::normalize_model_id("google/gemma-4-26b-a4b-it:free"),
            "google/gemma-4-26b-a4b-it"
        );
        assert_eq!(
            ModelIntelligenceRegistry::normalize_model_id("google/gemma-4-31b-it:free"),
            "google/gemma-4-31b-it"
        );
        assert_eq!(
            ModelIntelligenceRegistry::normalize_model_id("meta-llama/llama-3.3-70b-instruct:nitro"),
            "meta-llama/llama-3.3-70b-instruct"
        );
    }

    #[test]
    fn test_registry_fuzzy_matching_and_scoring() {
        let registry = ModelIntelligenceRegistry {
            scores: Arc::new(RwLock::new(HashMap::new())),
        };

        let mut test_scores = HashMap::new();
        test_scores.insert("anthropic/claude-3.5-sonnet".to_string(), ModelScore { score: 92.5 });
        test_scores.insert("google/gemma-4-26b-a4b-it".to_string(), ModelScore { score: 78.4 });
        test_scores.insert("google/gemma-4-31b-it".to_string(), ModelScore { score: 81.2 });
        test_scores.insert("minimax/minimax-m3-20260531".to_string(), ModelScore { score: 85.0 });
        registry.update_scores(test_scores);

        // Exact match with suffix stripped
        assert_eq!(registry.get_score("anthropic/claude-3.5-sonnet:free"), 92.5);
        assert_eq!(registry.get_score("google/gemma-4-26b-a4b-it:free"), 78.4);
        assert_eq!(registry.get_score("google/gemma-4-31b-it:free"), 81.2);

        // Fuzzy match on prefix with dash
        assert_eq!(registry.get_score("minimax/minimax-m3"), 85.0);

        // Unknown model returns 0.0
        assert_eq!(registry.get_score("unrecognized/custom-model"), 0.0);
    }

    #[test]
    fn test_sort_models_by_intelligence() {
        let registry = ModelIntelligenceRegistry {
            scores: Arc::new(RwLock::new(HashMap::new())),
        };

        let mut test_scores = HashMap::new();
        test_scores.insert("model-high".to_string(), ModelScore { score: 98.0 });
        test_scores.insert("model-mid".to_string(), ModelScore { score: 75.0 });
        test_scores.insert("model-low".to_string(), ModelScore { score: 40.0 });
        registry.update_scores(test_scores);

        let mut models = vec!["model-low", "model-high", "model-mid", "model-unknown"];
        registry.sort_models_by_intelligence(&mut models, |m| m);

        assert_eq!(models, vec!["model-high", "model-mid", "model-low", "model-unknown"]);
    }

    #[test]
    fn test_dual_id_mapping_and_free_model_score_resolution() {
        // Mock OpenRouter API response payload containing :free endpoints
        let openrouter_json = serde_json::json!({
            "data": [
                {
                    "id": "google/gemma-4-31b-it:free",
                    "pricing": {
                        "prompt": "0",
                        "completion": "0"
                    },
                    "supported_parameters": ["tools", "tool_choice"]
                },
                {
                    "id": "google/gemma-4-26b-a4b-it:free",
                    "pricing": {
                        "prompt": "0",
                        "completion": "0"
                    },
                    "supported_parameters": ["tools"]
                }
            ]
        });

        // Initialize registry with base model scores
        let registry = ModelIntelligenceRegistry {
            scores: Arc::new(RwLock::new(HashMap::new())),
        };
        let mut base_scores = HashMap::new();
        base_scores.insert("google/gemma-4-31b-it".to_string(), ModelScore { score: 63.2 });
        base_scores.insert("google/gemma-4-26b-a4b-it".to_string(), ModelScore { score: 56.2 });
        registry.update_scores(base_scores);

        let models = openrouter_json["data"].as_array().unwrap();
        let mut mapped_results = Vec::new();

        for m in models {
            let inference_id = m.get("id").unwrap().as_str().unwrap();
            let lookup_id = inference_id.trim_end_matches(":free");
            let score = registry.get_score(lookup_id);

            mapped_results.push((inference_id.to_string(), score));
        }

        // 1. Assert inference IDs strictly preserve the original :free suffix for LLM routing
        assert_eq!(mapped_results[0].0, "google/gemma-4-31b-it:free");
        assert_eq!(mapped_results[1].0, "google/gemma-4-26b-a4b-it:free");

        // 2. Assert that attached scores are strictly > 0.0, mapped directly from the base models
        assert!(mapped_results[0].1 > 0.0, "Score for {} was 0.0, expected > 0.0", mapped_results[0].0);
        assert_eq!(mapped_results[0].1, 63.2);

        assert!(mapped_results[1].1 > 0.0, "Score for {} was 0.0, expected > 0.0", mapped_results[1].0);
        assert_eq!(mapped_results[1].1, 56.2);
    }
}
