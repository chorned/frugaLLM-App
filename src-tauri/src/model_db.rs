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
        let db: HashMap<String, ModelScore> = serde_json::from_str(json_str).unwrap_or_default();
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
        let normalized = Self::normalize_model_id(model_id);
        let guard = self.scores.read().unwrap();
        
        // Exact match
        if let Some(s) = guard.get(&normalized) {
            return s.score;
        }

        // Fuzzy match: If the query is "minimax/minimax-m3", it should match "minimax/minimax-m3-20260531"
        for (k, v) in guard.iter() {
            if k.starts_with(&normalized) {
                if k.len() == normalized.len() || k.as_bytes().get(normalized.len()) == Some(&b'-') {
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
