// Unit tests for FrugaLLM backend
use super::*;
use std::fs;
use std::collections::{HashMap, HashSet};


    #[test]
    fn test_is_hermes_installed_mocked() {
        let temp_dir = tempfile::tempdir().unwrap();
        let home = temp_dir.path();
        
        // Initially not installed
        assert_eq!(is_hermes_installed(home), false);
        
        // Mock installation in .hermes/bin
        let bin_dir = home.join(".hermes").join("bin");
        fs::create_dir_all(&bin_dir).unwrap();
        
        let exe_name = if cfg!(windows) { "hermes.exe" } else { "hermes" };
        let hermes_exe = bin_dir.join(exe_name);
        fs::File::create(&hermes_exe).unwrap();
        
        assert_eq!(is_hermes_installed(home), true);
        assert_eq!(get_hermes_source_path(home), Some(hermes_exe));
    }

    #[test]
    fn test_is_hermes_installed_local_bin() {
        let temp_dir = tempfile::tempdir().unwrap();
        let home = temp_dir.path();
        
        assert_eq!(is_hermes_installed(home), false);
        assert_eq!(get_hermes_source_path(home), None);
        
        // Mock installation in .local/bin (standard install script path)
        let bin_dir = home.join(".local").join("bin");
        fs::create_dir_all(&bin_dir).unwrap();
        
        let exe_name = if cfg!(windows) { "hermes.exe" } else { "hermes" };
        let hermes_exe = bin_dir.join(exe_name);
        fs::File::create(&hermes_exe).unwrap();
        
        assert_eq!(is_hermes_installed(home), true);
        assert_eq!(get_hermes_source_path(home), Some(hermes_exe));
    }

    #[test]
    fn test_is_opencode_installed_mocked() {
        let temp_dir = tempfile::tempdir().unwrap();
        let home = temp_dir.path();
        
        assert_eq!(is_opencode_installed(home), false);
        
        let bin_dir = home.join(".local").join("bin");
        fs::create_dir_all(&bin_dir).unwrap();
        
        let exe_name = if cfg!(windows) { "opencode.exe" } else { "opencode" };
        let opencode_exe = bin_dir.join(exe_name);
        fs::File::create(&opencode_exe).unwrap();
        
        assert_eq!(is_opencode_installed(home), true);
    }

    #[test]
    fn test_is_ollama_in_paths() {
        let temp_dir = tempfile::tempdir().unwrap();
        
        let mock_ollama_path = temp_dir.path().join("mock_ollama");
        fs::File::create(&mock_ollama_path).unwrap();
        
        let path_str = mock_ollama_path.to_str().unwrap();
        let paths = vec![path_str];
        
        assert_eq!(is_ollama_in_paths(&paths), true);
        assert_eq!(is_ollama_in_paths(&["/invalid/nonexistent/path/to/ollama"]), false);
    }

    #[test]
    fn test_dummy_pty_execution() {
        use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
        use std::io::Read;

        let pty_system = NativePtySystem::default();
        let pair = pty_system.openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        }).unwrap();

        let mut cmd = if cfg!(windows) {
            CommandBuilder::new("powershell.exe")
        } else {
            CommandBuilder::new("bash")
        };
        
        // Simulating the 'install' command string passed by the frontend
        if cfg!(windows) {
            cmd.args(["-Command", "Write-Output 'Installing Ollama...'"]);
        } else {
            cmd.args(["-c", "echo 'Installing Ollama...'"]);
        }

        let mut child = pair.slave.spawn_command(cmd).unwrap();
        drop(pair.slave); // close slave so reader gets EOF when child exits

        let mut reader = pair.master.try_clone_reader().unwrap();
        
        std::thread::spawn(move || {
            let _ = child.wait();
        });

        let mut output = String::new();
        let mut buf = [0u8; 128];
        for _ in 0..100 {
            if let Ok(n) = reader.read(&mut buf) {
                if n > 0 {
                    output.push_str(&String::from_utf8_lossy(&buf[..n]));
                    if output.contains("Installing Ollama...") {
                        break;
                    }
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        
        assert!(output.contains("Installing Ollama..."));
    }

    #[test]
    fn test_calculate_gemma_128k_q8_kv_cache() {
        use crate::telemetry::calculate_gemma_128k_q8_kv_cache;

        // gemma4:e2b (26 layers, 4 kv heads, head_dim 256):
        // 5 global layers (128k), 21 sliding layers (1024), bytes_per_value = 1
        let kv_e2b = calculate_gemma_128k_q8_kv_cache(26, 4, 256);
        assert_eq!(kv_e2b, 1_386_217_472); // ~1.29 GB

        // gemma4:e4b (32 layers, 8 kv heads, head_dim 256):
        // 6 global layers (128k), 26 sliding layers (1024), bytes_per_value = 1
        let kv_e4b = calculate_gemma_128k_q8_kv_cache(32, 8, 256);
        assert_eq!(kv_e4b, 3_330_277_376); // ~3.10 GB
    }

    #[test]
    fn test_compute_memory_segments_discrete_gpu_spillover() {
        use crate::telemetry::{compute_memory_segments, HardwareProfile, OllamaState};

        // 8GB Dedicated VRAM, 32GB System RAM (e.g. Intel MacBook / PC)
        let profile = HardwareProfile {
            is_unified: false,
            dedicated_vram: 8 * 1024 * 1024 * 1024,
            system_ram: 32 * 1024 * 1024 * 1024,
            execution_ceiling: 8 * 1024 * 1024 * 1024,
            os_architecture: "macos-x86_64".into(),
        };

        let ollama = OllamaState::default(); // Pre-flight
        let segments = compute_memory_segments(&profile, &ollama, "gemma4:e4b");

        assert_eq!(segments.phase, "preflight");
        assert_eq!(segments.execution_ceiling_bytes, 8 * 1024 * 1024 * 1024);
        assert!(segments.total_projected_bytes > segments.execution_ceiling_bytes);
        assert_eq!(segments.spillover_type, "system_ram");
        assert!(segments.triggers_warning);
        assert!(segments.warning_message.contains("Model & 128k context exceed Dedicated VRAM"));
    }

    #[test]
    fn test_compute_memory_segments_apple_silicon_unified() {
        use crate::telemetry::{compute_memory_segments, HardwareProfile, OllamaState};

        // 16GB Unified RAM (Available: 14GB after 2GB reserve)
        let profile = HardwareProfile {
            is_unified: true,
            dedicated_vram: 0,
            system_ram: 16 * 1024 * 1024 * 1024,
            execution_ceiling: 14 * 1024 * 1024 * 1024,
            os_architecture: "macos-arm64".into(),
        };

        // 1. gemma4:e2b fits inside 14GB
        let ollama = OllamaState::default();
        let segments_e2b = compute_memory_segments(&profile, &ollama, "gemma4:e2b");
        assert_eq!(segments_e2b.phase, "preflight");
        assert_eq!(segments_e2b.spillover_bytes, 0);
        assert_eq!(segments_e2b.spillover_type, "none");
        assert!(!segments_e2b.triggers_warning);

        // 2. gemma4:31b overflows 14GB unified memory -> SSD swap warning
        let segments_31b = compute_memory_segments(&profile, &ollama, "gemma4:31b");
        assert!(segments_31b.spillover_bytes > 0);
        assert_eq!(segments_31b.spillover_type, "ssd_swap");
        assert!(segments_31b.triggers_warning);
        assert!(segments_31b.warning_message.contains("Memory exceeds available Unified Memory"));
    }

    #[test]
    fn test_get_model_tag_for_vram_zero_spillover() {
        // 8.0 GB VRAM -> must return gemma4:e2b (~3.19 GB footprint). (gemma4:e4b is ~8.50 GB and must fail).
        assert_eq!(get_model_tag_for_vram(8.0), "gemma4:e2b");

        // 12.0 GB VRAM -> must return gemma4:e4b (~8.50 GB footprint).
        assert_eq!(get_model_tag_for_vram(12.0), "gemma4:e4b");

        // 24.0 GB VRAM -> must return gemma4:12b (~17.13 GB footprint).
        assert_eq!(get_model_tag_for_vram(24.0), "gemma4:12b");

        // 40.0 GB VRAM (e.g. A6000) -> must return gemma4:26b (~32.66 GB footprint).
        assert_eq!(get_model_tag_for_vram(40.0), "gemma4:26b");

        // 48.0 GB+ VRAM -> must return gemma4:31b (~43.86 GB footprint).
        assert_eq!(get_model_tag_for_vram(48.0), "gemma4:31b");
        assert_eq!(get_model_tag_for_vram(64.0), "gemma4:31b");

        // Fallback for severely limited VRAM (e.g., 2GB or 4GB)
        assert_eq!(get_model_tag_for_vram(2.0), "gemma4:e2b");
        assert_eq!(get_model_tag_for_vram(4.0), "gemma4:e2b");
    }

    #[test]
    fn test_server_status_serialization() {
        let running = ServerStatus::Running {
            port: 61721,
            ip: "127.0.0.1".to_string(),
        };
        let json = serde_json::to_string(&running).expect("serialize running");
        assert!(json.contains("\"status\":\"Running\""));
        assert!(json.contains("\"port\":61721"));

        let conflict = ServerStatus::PortConflict {
            port: 5050,
            ip: "127.0.0.1".to_string(),
            message: "Close the service currently using port [5050] and restart the app".to_string(),
        };
        let conflict_json = serde_json::to_string(&conflict).expect("serialize conflict");
        assert!(conflict_json.contains("\"status\":\"PortConflict\""));
        assert!(conflict_json.contains("5050"));
        assert!(conflict_json.contains("Close the service currently using port [5050] and restart the app"));
    }

    #[test]
    fn test_should_show_window_logic() {
        // 1. Manual launch by user (no --silent or --minimized flag) -> Always show window
        assert!(should_show_window(false, false));
        assert!(should_show_window(false, true));

        // 2. OS launch on boot (--silent flag) with start_minimized = true -> Keep hidden
        assert!(!should_show_window(true, true));

        // 3. OS launch on boot (--silent flag) with start_minimized = false -> Show window
        assert!(should_show_window(true, false));
    }

    #[test]
    fn test_child_process_manager_lifecycle() {
        let pm = ChildProcessManager::new();
        assert!(!pm.has_active_services());
        assert_eq!(pm.active_service_names().len(), 0);

        pm.register("hermes-dashboard".to_string(), 99999);
        assert!(pm.has_active_services());
        assert_eq!(pm.active_service_names(), vec!["hermes-dashboard".to_string()]);

        pm.unregister("hermes-dashboard");
        assert!(!pm.has_active_services());
        assert_eq!(pm.active_service_names().len(), 0);
    }

    #[test]
    fn test_hermes_process_aliases() {
        let pm = ChildProcessManager::new();
        pm.register("hermes-gateway".to_string(), 12345);
        pm.register("hermes-dashboard".to_string(), 12346);
        assert!(pm.has_active_services());
        assert_eq!(pm.active_service_names().len(), 2);

        pm.unregister("hermes-gateway");
        assert!(pm.has_active_services());
        assert_eq!(pm.active_service_names(), vec!["hermes-dashboard".to_string()]);

        pm.unregister("hermes-dashboard");
        assert!(!pm.has_active_services());
    }

    #[test]
    fn test_mock_update_arg_detection() {
        let args_camel = vec!["frugallm".to_string(), "--mockUpdate".to_string()];
        assert!(check_mock_update_arg(args_camel.into_iter()));

        let args_kebab = vec!["frugallm".to_string(), "--mock-update".to_string()];
        assert!(check_mock_update_arg(args_kebab.into_iter()));

        let args_none = vec!["frugallm".to_string(), "--verbose".to_string()];
        assert!(!check_mock_update_arg(args_none.into_iter()));

        std::env::set_var("MOCK_UPDATE", "1");
        let empty_args = vec!["frugallm".to_string()];
        assert!(check_mock_update_arg(empty_args.into_iter()));
        std::env::remove_var("MOCK_UPDATE");
    }

    #[test]
    fn test_remove_path_block() {
        let original = "export FOO=1\n# >>> FrugaLLM CLI PATH >>>\nexport PATH=\"$HOME/.local/bin:$PATH\"\n# <<< FrugaLLM CLI PATH <<<\nexport BAR=2\n";
        let cleaned = remove_path_block(original);
        assert_eq!(cleaned, "export FOO=1\nexport BAR=2\n");
    }

    #[test]
    fn test_update_shell_config_idempotency() {
        let temp_dir = tempfile::tempdir().unwrap();
        let home = temp_dir.path();
        let zshrc = home.join(".zshrc");
        std::fs::write(&zshrc, "export EXISTING=1\n").unwrap();

        // Enable
        update_shell_config_path(home, true).unwrap();
        let c1 = std::fs::read_to_string(&zshrc).unwrap();
        assert!(c1.contains(FRUGALLM_PATH_BLOCK_START));
        assert!(c1.contains("export EXISTING=1"));

        // Enable again (idempotent)
        update_shell_config_path(home, true).unwrap();
        let c2 = std::fs::read_to_string(&zshrc).unwrap();
        assert_eq!(c1, c2);

        // Disable
        update_shell_config_path(home, false).unwrap();
        let c3 = std::fs::read_to_string(&zshrc).unwrap();
        assert!(!c3.contains(FRUGALLM_PATH_BLOCK_START));
        assert!(c3.contains("export EXISTING=1"));
    }

    #[test]
    fn test_is_openrouter_free_alias() {
        assert!(is_openrouter_free_alias("openrouter/free"));
        assert!(is_openrouter_free_alias("openrouter:free"));
        assert!(is_openrouter_free_alias("OpenRouter/Free"));
        assert!(is_openrouter_free_alias("OPENROUTER:FREE"));
        assert!(is_openrouter_free_alias("  openrouter/free  "));
        assert!(!is_openrouter_free_alias("openrouter/auto"));
        assert!(!is_openrouter_free_alias("google/gemma-4-31b-it:free"));
        assert!(!is_openrouter_free_alias("meta-llama/llama-3.3-70b-instruct:free"));
    }

    #[test]
    fn test_ollama_defaults_below_cloud_unless_pinned() {
        let candidates = vec![
            RankedModel {
                model: CloudModel {
                    model: "llama3:8b".to_string(),
                    provider: "ollama".to_string(),
                    iq: 45.0,
                    context_length: None,
                },
                priority: -10.0,
            },
            RankedModel {
                model: CloudModel {
                    model: "gemini-2.5-pro".to_string(),
                    provider: "google".to_string(),
                    iq: 75.5,
                    context_length: Some(2_097_152),
                },
                priority: 75.5,
            },
            RankedModel {
                model: CloudModel {
                    model: "meta-llama/llama-3.3-70b-instruct:free".to_string(),
                    provider: "openrouter".to_string(),
                    iq: 62.0,
                    context_length: Some(128_000),
                },
                priority: 62.0,
            },
        ];

        // 1. Unpinned queue: cloud models must prioritize ahead of Ollama
        let unpinned_overrides = vec!["".to_string(), "".to_string(), "".to_string()];
        let chain = sort_and_apply_overrides(candidates.clone(), &unpinned_overrides);
        assert_eq!(chain.len(), 3);
        assert_eq!(chain[0].provider, "google");
        assert_eq!(chain[0].model, "gemini-2.5-pro");
        assert_eq!(chain[1].provider, "openrouter");
        assert_eq!(chain[2].provider, "ollama");
        assert_eq!(chain[2].model, "llama3:8b");

        // 2. Pinned slot: when user overrides slot 0 with Ollama, it must sit in slot 0
        let pinned_overrides = vec!["llama3:8b".to_string(), "".to_string(), "".to_string()];
        let pinned_chain = sort_and_apply_overrides(candidates, &pinned_overrides);
        assert_eq!(pinned_chain[0].provider, "ollama");
        assert_eq!(pinned_chain[0].model, "llama3:8b");
        assert_eq!(pinned_chain[1].provider, "google");
        assert_eq!(pinned_chain[2].provider, "openrouter");
    }

    #[test]
    fn test_get_ollama_chat_model_selection() {
        // 1. With frugallm-active present
        let json_with_active = serde_json::json!({
            "models": [
                { "name": "llama3:8b" },
                { "name": "frugallm-active:latest" }
            ]
        });
        assert_eq!(resolve_ollama_chat_model_from_tags(&json_with_active), "frugallm-active");

        // 2. Pre-installed Ollama with llama3:8b, but no frugallm-active
        let json_preinstalled = serde_json::json!({
            "models": [
                { "name": "llama3:8b" },
                { "name": "mistral:latest" }
            ]
        });
        assert_eq!(resolve_ollama_chat_model_from_tags(&json_preinstalled), "llama3:8b");

        // 3. Empty models
        let json_empty = serde_json::json!({ "models": [] });
        assert_eq!(resolve_ollama_chat_model_from_tags(&json_empty), "frugallm-active");
    }

    #[test]
    fn test_parse_ollama_models_deduplication_and_context_length() {
        // 1. Both frugallm-active:latest and gemma4:e2b returned: must deduplicate and retain only gemma4:e2b
        let json_both = serde_json::json!({
            "models": [
                {
                    "name": "frugallm-active:latest",
                    "details": { "parent_model": "gemma4:e2b" }
                },
                {
                    "name": "gemma4:e2b",
                    "details": { "parent_model": "" }
                }
            ]
        });

        let models = parse_ollama_models(&json_both);
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].model.model, "gemma4:e2b");
        assert_eq!(models[0].model.provider, "ollama");
        assert_eq!(models[0].model.context_length, Some(131_072));
        assert!(models[0].model.iq > 0.0);

        // 2. Only frugallm-active:latest returned: must resolve parent model as gemma4:e2b
        let json_active_only = serde_json::json!({
            "models": [
                {
                    "name": "frugallm-active:latest",
                    "details": { "parent_model": "gemma4:e2b" }
                }
            ]
        });

        let models_active = parse_ollama_models(&json_active_only);
        assert_eq!(models_active.len(), 1);
        assert_eq!(models_active[0].model.model, "gemma4:e2b");
        assert_eq!(models_active[0].model.context_length, Some(131_072));

        // 3. User custom model without frugallm-active
        let json_custom = serde_json::json!({
            "models": [
                {
                    "name": "llama3:8b",
                    "details": { "parent_model": "" }
                }
            ]
        });

        let models_custom = parse_ollama_models(&json_custom);
        assert_eq!(models_custom.len(), 1);
        assert_eq!(models_custom[0].model.model, "llama3:8b");
        assert_eq!(models_custom[0].model.context_length, Some(131_072));
    }

    #[test]
    fn test_frugallm_logger_writes_and_formats() {
        let entry = format_log_entry("INFO", "ROUTER", "Attempt 1/2: Model=gemini-2.5-pro");
        assert!(entry.contains("[INFO]"));
        assert!(entry.contains("[ROUTER]"));
        assert!(entry.contains("Attempt 1/2: Model=gemini-2.5-pro"));

        let temp_dir = tempfile::tempdir().unwrap();
        let log_dir = temp_dir.path().join("logs");
        let log_path = log_dir.join("frugallm.log");

        append_log_entry_to_path(&log_path, "INFO", "PROXY", "Test line 1").unwrap();
        append_log_entry_to_path(&log_path, "ERROR", "ROUTER", "Test error 2").unwrap();

        let contents = std::fs::read_to_string(&log_path).unwrap();
        assert!(contents.contains("[PROXY] Test line 1"));
        assert!(contents.contains("[ROUTER] Test error 2"));
    }

    #[test]
    fn test_reprimand_sanitizer_removes_leakage() {
        let chunk_with_reprimand = b"data: {\"content\":\"Here is my plan. [SYSTEM REPRIMAND: You detailed a plan and informed the user you were taking action, but failed to output the corresponding JSON tool call. Do not apologize. Output the required tool call immediately.] Let me now execute the tool.\"}\n\n";
        let text = std::str::from_utf8(chunk_with_reprimand).unwrap();
        let cleaned = text.replace(
            "[SYSTEM REPRIMAND: You detailed a plan and informed the user you were taking action, but failed to output the corresponding JSON tool call. Do not apologize. Output the required tool call immediately.]",
            "",
        );
        assert!(!cleaned.contains("[SYSTEM REPRIMAND:"));
        assert!(cleaned.contains("Here is my plan. "));
        assert!(cleaned.contains(" Let me now execute the tool."));
    }

    #[test]
    fn test_tool_enforcement_directive_format() {
        assert!(TOOL_ENFORCEMENT_DIRECTIVE.contains("[TOOL ENFORCEMENT DIRECTIVE]"));
        assert!(TOOL_ENFORCEMENT_DIRECTIVE.contains("Strict tool calling is required"));
    }

    #[test]
    fn test_parse_agent_version() {
        // Multi-line Hermes Agent output
        let hermes_raw = "Hermes Agent v0.21.1 (2026.9.7) · upstream 72a3277c\nInstall directory: /Users/chorned/.hermes/hermes-agent\nPython: 3.11.15\n";
        assert_eq!(parse_agent_version(hermes_raw), Some("v0.21.1".to_string()));

        // Clean semver with and without v
        assert_eq!(parse_agent_version("1.18.29\n"), Some("v1.18.29".to_string()));
        assert_eq!(parse_agent_version("v0.3.1"), Some("v0.3.1".to_string()));
        assert_eq!(parse_agent_version("OpenCode 2.0.4"), Some("v2.0.4".to_string()));
    }

    #[tokio::test]
    async fn test_provider_health_state_circuit_breaker_and_cooldowns() {
        let state = ProviderHealthState::default();

        // 1. Initial state has no cooldowns and empty statuses
        {
            let statuses = state.live_statuses.read().await;
            assert!(statuses.is_empty());
            let p_cooldowns = state.provider_cooldowns.read().await;
            assert!(p_cooldowns.is_empty());
            let m_cooldowns = state.model_cooldowns.read().await;
            assert!(m_cooldowns.is_empty());
            let gated = state.gated_models.read().await;
            assert!(gated.is_empty());
        }

        // 2. 403 Forbidden puts provider on cooldown
        let now = std::time::Instant::now();
        {
            let mut p_cooldowns = state.provider_cooldowns.write().await;
            p_cooldowns.insert("google".to_string(), now + std::time::Duration::from_secs(600));
            let mut statuses = state.live_statuses.write().await;
            statuses.insert("google".to_string(), "403".to_string());
        }
        {
            let p_cooldowns = state.provider_cooldowns.read().await;
            let expiry = p_cooldowns.get("google").expect("google cooldown");
            assert!(*expiry > std::time::Instant::now());

            let statuses = state.live_statuses.read().await;
            assert_eq!(statuses.get("google"), Some(&"403".to_string()));
        }

        // 3. 503 / Timeout puts model on 60s cooldown
        {
            let mut m_cooldowns = state.model_cooldowns.write().await;
            m_cooldowns.insert("nvidia/nemotron-3-ultra-550b:free".to_string(), now + std::time::Duration::from_secs(60));
            let mut statuses = state.live_statuses.write().await;
            statuses.insert("openrouter".to_string(), "503".to_string());
        }
        {
            let m_cooldowns = state.model_cooldowns.read().await;
            let expiry = m_cooldowns.get("nvidia/nemotron-3-ultra-550b:free").expect("nemotron cooldown");
            assert!(*expiry > std::time::Instant::now());

            let statuses = state.live_statuses.read().await;
            assert_eq!(statuses.get("openrouter"), Some(&"503".to_string()));
        }

        // 4. Agentic harness gating prunes model into gated_models
        {
            let mut gated = state.gated_models.write().await;
            gated.insert("thinkingmachines/inkling-small:free".to_string());
        }
        {
            let gated = state.gated_models.read().await;
            assert!(gated.contains("thinkingmachines/inkling-small:free"));
        }
    }

    #[test]
    fn test_frugal_config_enable_paid_fallback_default() {
        let config = FrugalConfig::default();
        assert!(config.enable_paid_fallback);

        // Deserializing without enable_paid_fallback field defaults to true
        let json = r#"{"port": 61721}"#;
        let parsed: FrugalConfig = serde_json::from_str(json).unwrap();
        assert!(parsed.enable_paid_fallback);
    }

    #[test]
    fn test_550b_penalty_in_ranking() {
        let nemotron_score = crate::model_db::MODEL_REGISTRY.get_score("nvidia/nemotron-3-ultra-550b-a55b");
        assert!(nemotron_score > 0.0);

        let is_heavy = "nvidia/nemotron-3-ultra-550b-a55b-20260604:free".contains("550b");
        assert!(is_heavy);

        let penalized = (nemotron_score - 15.0).max(1.0);
        assert!(penalized < nemotron_score);
    }

    #[test]
    fn test_ttft_sla_constants() {
        assert_eq!(FAST_TTFT_LIMIT, std::time::Duration::from_secs(10));
        assert_eq!(LAST_RESORT_LIMIT, std::time::Duration::from_secs(120));
        assert_eq!(COOLDOWN_PENALTY_DURATION, std::time::Duration::from_secs(300));
    }

    #[test]
    fn test_classify_candidate_tiers() {
        let healthy_model = CloudModel {
            model: "google/gemma-4-31b-it:free".to_string(),
            provider: "openrouter".to_string(),
            iq: 81.0,
            context_length: Some(128_000),
        };
        let cooling_model = CloudModel {
            model: "nvidia/nemotron-3-ultra-550b:free".to_string(),
            provider: "openrouter".to_string(),
            iq: 85.0,
            context_length: Some(128_000),
        };
        let circuit_broken_model = CloudModel {
            model: "gemini-2.5-flash".to_string(),
            provider: "google".to_string(),
            iq: 90.0,
            context_length: Some(1_048_576),
        };
        let gated_model = CloudModel {
            model: "thinkingmachines/inkling-small:free".to_string(),
            provider: "openrouter".to_string(),
            iq: 70.0,
            context_length: Some(128_000),
        };

        let now = std::time::Instant::now();
        let mut provider_cooldowns = HashMap::new();
        provider_cooldowns.insert("google".to_string(), now + std::time::Duration::from_secs(600));

        let mut gated_models = HashSet::new();
        gated_models.insert("thinkingmachines/inkling-small:free".to_string());

        let mut model_cooldowns = HashMap::new();
        model_cooldowns.insert("nvidia/nemotron-3-ultra-550b:free".to_string(), now + std::time::Duration::from_secs(300));

        // 1. Healthy model
        assert_eq!(
            classify_candidate(&healthy_model, &provider_cooldowns, &gated_models, &model_cooldowns, now),
            CandidateTier::Healthy
        );

        // 2. Cooling-down model in penalty box
        match classify_candidate(&cooling_model, &provider_cooldowns, &gated_models, &model_cooldowns, now) {
            CandidateTier::Cooldown(rem) => assert!(rem.as_secs() <= 300 && rem.as_secs() > 0),
            other => panic!("Expected Cooldown tier, got {:?}", other),
        }

        // 3. Provider with active circuit breaker
        assert_eq!(
            classify_candidate(&circuit_broken_model, &provider_cooldowns, &gated_models, &model_cooldowns, now),
            CandidateTier::CircuitBreakerActive
        );

        // 4. Permanently gated model
        assert_eq!(
            classify_candidate(&gated_model, &provider_cooldowns, &gated_models, &model_cooldowns, now),
            CandidateTier::PermanentlyGated
        );

        // 5. Expired cooldowns transition back to Healthy
        let future = now + std::time::Duration::from_secs(301);
        assert_eq!(
            classify_candidate(&cooling_model, &provider_cooldowns, &gated_models, &model_cooldowns, future),
            CandidateTier::Healthy
        );
    }

    #[test]
    fn test_classify_candidate_gates_models_below_128k_context() {
        let under_128k_model = CloudModel {
            model: "gemma-2-9b-it".to_string(),
            provider: "google".to_string(),
            iq: 50.0,
            context_length: Some(8_192),
        };
        let exactly_128k_model = CloudModel {
            model: "meta-llama/llama-3.3-70b-instruct:free".to_string(),
            provider: "openrouter".to_string(),
            iq: 80.0,
            context_length: Some(128_000),
        };

        let now = std::time::Instant::now();
        let provider_cooldowns = HashMap::new();
        let gated_models = HashSet::new();
        let model_cooldowns = HashMap::new();

        assert_eq!(
            classify_candidate(&under_128k_model, &provider_cooldowns, &gated_models, &model_cooldowns, now),
            CandidateTier::PermanentlyGated
        );
        assert_eq!(
            classify_candidate(&exactly_128k_model, &provider_cooldowns, &gated_models, &model_cooldowns, now),
            CandidateTier::Healthy
        );
    }

    #[test]
    fn test_parse_google_models_enforces_128k_minimum_context() {
        let json = serde_json::json!({
            "models": [
                {
                    "name": "models/gemini-2.0-flash",
                    "supportedGenerationMethods": ["generateContent", "countTokens"],
                    "inputTokenLimit": 1048576
                },
                {
                    "name": "models/gemini-1.5-pro",
                    "supportedGenerationMethods": ["generateContent"],
                    "inputTokenLimit": 2097152
                },
                {
                    // Gemma 2 with 8k context window - must be excluded!
                    "name": "models/gemma-2-9b-it",
                    "supportedGenerationMethods": ["generateContent"],
                    "inputTokenLimit": 8192
                },
                {
                    // Embedding junk model - must be excluded!
                    "name": "models/text-embedding-004",
                    "supportedGenerationMethods": ["embedContent"],
                    "inputTokenLimit": 128000
                },
                {
                    // Missing inputTokenLimit - must be excluded!
                    "name": "models/gemini-unknown",
                    "supportedGenerationMethods": ["generateContent"]
                }
            ]
        });

        let parsed = parse_google_models(&json);
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].model.model, "gemini-2.0-flash");
        assert_eq!(parsed[0].model.context_length, Some(1048576));
        assert_eq!(parsed[1].model.model, "gemini-1.5-pro");
        assert_eq!(parsed[1].model.context_length, Some(2097152));
    }

    #[test]
    fn test_parse_openrouter_models_enforces_128k_minimum_context() {
        let json = serde_json::json!({
            "data": [
                {
                    "id": "meta-llama/llama-3.3-70b-instruct:free",
                    "supported_parameters": ["tools", "temperature"],
                    "pricing": { "prompt": "0", "completion": "0" },
                    "context_length": 128000
                },
                {
                    "id": "deepseek/deepseek-chat:free",
                    "supported_parameters": ["tools"],
                    "pricing": { "prompt": "0", "completion": "0" },
                    "context_length": 200000
                },
                {
                    // 32k context model - must be excluded!
                    "id": "mistralai/mistral-7b-instruct:free",
                    "supported_parameters": ["tools"],
                    "pricing": { "prompt": "0", "completion": "0" },
                    "context_length": 32000
                },
                {
                    // 8k context model - must be excluded!
                    "id": "qwen/qwen-2.5-7b-instruct:free",
                    "supported_parameters": ["tools"],
                    "pricing": { "prompt": "0", "completion": "0" },
                    "context_length": 8192
                },
                {
                    // Free router alias - must be excluded!
                    "id": "openrouter/free",
                    "supported_parameters": ["tools"],
                    "pricing": { "prompt": "0", "completion": "0" },
                    "context_length": 200000
                },
                {
                    // Paid model - must be excluded!
                    "id": "anthropic/claude-3.5-sonnet",
                    "supported_parameters": ["tools"],
                    "pricing": { "prompt": "0.003", "completion": "0.015" },
                    "context_length": 200000
                }
            ]
        });

        let gated_set = HashSet::new();
        let parsed = parse_openrouter_models(&json, &gated_set);
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].model.model, "meta-llama/llama-3.3-70b-instruct:free");
        assert_eq!(parsed[0].model.context_length, Some(128000));
        assert_eq!(parsed[1].model.model, "deepseek/deepseek-chat:free");
        assert_eq!(parsed[1].model.context_length, Some(200000));
    }

    #[test]
    fn test_two_phase_partition_candidates() {
        let m1 = CloudModel {
            model: "google/gemma-4-31b-it:free".to_string(),
            provider: "openrouter".to_string(),
            iq: 81.0,
            context_length: Some(128_000),
        };
        let m2_nemotron = CloudModel {
            model: "nvidia/nemotron-3-ultra-550b:free".to_string(),
            provider: "openrouter".to_string(),
            iq: 85.0,
            context_length: Some(128_000),
        };
        let m3_circuit_broken = CloudModel {
            model: "gemini-2.5-flash".to_string(),
            provider: "google".to_string(),
            iq: 90.0,
            context_length: Some(1_048_576),
        };
        let m4_healthy = CloudModel {
            model: "meta-llama/llama-3.3-70b-instruct:free".to_string(),
            provider: "openrouter".to_string(),
            iq: 83.0,
            context_length: Some(128_000),
        };
        let m5_gated = CloudModel {
            model: "thinkingmachines/inkling-small:free".to_string(),
            provider: "openrouter".to_string(),
            iq: 70.0,
            context_length: Some(128_000),
        };

        let chain = vec![
            m1.clone(),
            m2_nemotron.clone(),
            m3_circuit_broken.clone(),
            m4_healthy.clone(),
            m5_gated.clone(),
        ];

        let now = std::time::Instant::now();
        let mut provider_cooldowns = HashMap::new();
        provider_cooldowns.insert("google".to_string(), now + std::time::Duration::from_secs(600));

        let mut gated_models = HashSet::new();
        gated_models.insert("thinkingmachines/inkling-small:free".to_string());

        let mut model_cooldowns = HashMap::new();
        model_cooldowns.insert("nvidia/nemotron-3-ultra-550b:free".to_string(), now + std::time::Duration::from_secs(300));

        let (healthy, cooldown) = partition_candidates(&chain, &provider_cooldowns, &gated_models, &model_cooldowns, now);

        // Phase 1 candidates: only m1 and m4
        assert_eq!(healthy.len(), 2);
        assert_eq!(healthy[0].model, "google/gemma-4-31b-it:free");
        assert_eq!(healthy[1].model, "meta-llama/llama-3.3-70b-instruct:free");

        // Phase 2 Last Resort candidates: m2_nemotron
        assert_eq!(cooldown.len(), 1);
        assert_eq!(cooldown[0].model, "nvidia/nemotron-3-ultra-550b:free");
    }

    #[tokio::test]
    async fn test_self_healing_clears_cooldown_on_last_resort_success() {
        let state = ProviderHealthState::default();
        let nemotron = CloudModel {
            model: "nvidia/nemotron-3-ultra-550b:free".to_string(),
            provider: "openrouter".to_string(),
            iq: 85.0,
            context_length: Some(128_000),
        };

        let now = std::time::Instant::now();
        // 1. Nemotron enters 5-minute penalty box cooldown
        {
            let mut m_cooldowns = state.model_cooldowns.write().await;
            m_cooldowns.insert(nemotron.model.clone(), now + COOLDOWN_PENALTY_DURATION);
        }

        // Verify it is categorized as Cooldown
        {
            let p_guard = state.provider_cooldowns.read().await;
            let g_guard = state.gated_models.read().await;
            let m_guard = state.model_cooldowns.read().await;
            assert!(matches!(
                classify_candidate(&nemotron, &p_guard, &g_guard, &m_guard, now),
                CandidateTier::Cooldown(_)
            ));
        }

        // 2. In Last Resort mode, Nemotron succeeds -> Cooldown cleared
        {
            let mut m_cooldowns = state.model_cooldowns.write().await;
            m_cooldowns.remove(&nemotron.model);
        }

        // Verify self-healing: model is immediately Healthy again
        {
            let p_guard = state.provider_cooldowns.read().await;
            let g_guard = state.gated_models.read().await;
            let m_guard = state.model_cooldowns.read().await;
            assert_eq!(
                classify_candidate(&nemotron, &p_guard, &g_guard, &m_guard, now),
                CandidateTier::Healthy
            );
        }
    }

    #[tokio::test]
    async fn test_rate_limit_429_provider_cooldown_and_recovery() {
        let state = ProviderHealthState::default();
        let google_model = CloudModel {
            model: "gemini-2.5-flash".to_string(),
            provider: "google".to_string(),
            iq: 88.0,
            context_length: Some(1_048_576),
        };

        let now = std::time::Instant::now();
        // 1. Google receives a 429 Rate Limit error -> 60s cooldown applied
        {
            let mut p_cooldowns = state.provider_cooldowns.write().await;
            p_cooldowns.insert(google_model.provider.clone(), now + std::time::Duration::from_secs(60));
            let mut statuses = state.live_statuses.write().await;
            statuses.insert(google_model.provider.clone(), "429".to_string());
        }

        // Verify provider is circuit broken / cooling down and status is 429
        {
            let p_guard = state.provider_cooldowns.read().await;
            let g_guard = state.gated_models.read().await;
            let m_guard = state.model_cooldowns.read().await;
            assert_eq!(
                classify_candidate(&google_model, &p_guard, &g_guard, &m_guard, now),
                CandidateTier::CircuitBreakerActive
            );
            let statuses = state.live_statuses.read().await;
            assert_eq!(statuses.get("google").map(|s| s.as_str()), Some("429"));
        }

        // 2. Cooldown expires / self heals with 200 OK
        {
            let mut p_cooldowns = state.provider_cooldowns.write().await;
            p_cooldowns.remove(&google_model.provider);
            let mut statuses = state.live_statuses.write().await;
            statuses.insert(google_model.provider.clone(), "200 OK".to_string());
        }

        // Verify model is Healthy again
        {
            let p_guard = state.provider_cooldowns.read().await;
            let g_guard = state.gated_models.read().await;
            let m_guard = state.model_cooldowns.read().await;
            assert_eq!(
                classify_candidate(&google_model, &p_guard, &g_guard, &m_guard, now),
                CandidateTier::Healthy
            );
            let statuses = state.live_statuses.read().await;
            assert_eq!(statuses.get("google").map(|s| s.as_str()), Some("200 OK"));
        }
    }

    #[tokio::test]
    async fn test_rate_limit_429_model_level_cooldown_and_failover() {
        let state = ProviderHealthState::default();
        let flash_model = CloudModel {
            model: "gemini-flash-latest".to_string(),
            provider: "google".to_string(),
            iq: 85.0,
            context_length: Some(1_048_576),
        };
        let pro_model = CloudModel {
            model: "gemini-2.5-pro".to_string(),
            provider: "google".to_string(),
            iq: 92.0,
            context_length: Some(2_097_152),
        };

        let now = std::time::Instant::now();
        // 1. gemini-flash-latest receives a 429 Rate Limit error -> 60s model-level cooldown applied
        {
            let mut m_cooldowns = state.model_cooldowns.write().await;
            m_cooldowns.insert(flash_model.model.clone(), now + std::time::Duration::from_secs(60));
            let mut statuses = state.live_statuses.write().await;
            statuses.insert("google".to_string(), "429".to_string());
        }

        // Verify flash_model is in Cooldown, but sibling pro_model remains Healthy!
        {
            let p_guard = state.provider_cooldowns.read().await;
            let g_guard = state.gated_models.read().await;
            let m_guard = state.model_cooldowns.read().await;

            match classify_candidate(&flash_model, &p_guard, &g_guard, &m_guard, now) {
                CandidateTier::Cooldown(_) => {}
                other => panic!("Expected Cooldown for flash_model, got {:?}", other),
            }

            assert_eq!(
                classify_candidate(&pro_model, &p_guard, &g_guard, &m_guard, now),
                CandidateTier::Healthy
            );

            // Verify partition_candidates places pro_model in healthy roster and flash_model in cooldown
            let chain = vec![flash_model.clone(), pro_model.clone()];
            let (healthy, cooldown) = partition_candidates(&chain, &p_guard, &g_guard, &m_guard, now);
            assert_eq!(healthy.len(), 1);
            assert_eq!(healthy[0].model, "gemini-2.5-pro");
            assert_eq!(cooldown.len(), 1);
            assert_eq!(cooldown[0].model, "gemini-flash-latest");
        }

        // 2. Cooldown expires
        {
            let future = now + std::time::Duration::from_secs(61);
            let p_guard = state.provider_cooldowns.read().await;
            let g_guard = state.gated_models.read().await;
            let m_guard = state.model_cooldowns.read().await;

            assert_eq!(
                classify_candidate(&flash_model, &p_guard, &g_guard, &m_guard, future),
                CandidateTier::Healthy
            );
        }
    }

    #[test]
    fn test_evaluate_probe_response_status_codes() {
        assert_eq!(evaluate_probe_response(200, ""), ProbeStepOutcome::Success);
        assert_eq!(evaluate_probe_response(403, "PERMISSION_DENIED"), ProbeStepOutcome::PermissionDenied403);
        assert_eq!(evaluate_probe_response(403, "denied access"), ProbeStepOutcome::PermissionDenied403);
        assert_eq!(evaluate_probe_response(429, "RESOURCE_EXHAUSTED"), ProbeStepOutcome::RateLimited429);
        assert_eq!(evaluate_probe_response(429, "You exceeded your current quota"), ProbeStepOutcome::RateLimited429);
        assert_eq!(evaluate_probe_response(503, "high demand"), ProbeStepOutcome::ServiceUnavailable503);
        assert_eq!(evaluate_probe_response(500, "Internal error"), ProbeStepOutcome::OtherError("500".to_string()));
    }

    #[test]
    fn test_sanitize_diagnostic_logs() {
        let sample = "Error with key sk-proj-1234567890abcdefghijklmn and header Bearer eyJhbGciOiJIUzI1NiJ9.test and Google AI Studio key AIzaSyD849aFk2cL30198qZmbXeR5-u in https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyMockGoogleKey123 and normal text";
        let sanitized = sanitize_diagnostic_logs(sample);
        assert_eq!(sanitized, "Error with key [REDACTED_API_KEY] and header [REDACTED_API_KEY] and Google AI Studio key [REDACTED_API_KEY] in https://generativelanguage.googleapis.com/v1beta/models?key=[REDACTED_API_KEY] and normal text");
        assert!(!sanitized.contains("sk-proj"));
        assert!(!sanitized.contains("eyJhbGci"));
        assert!(!sanitized.contains("AIzaSyD849aF"));
        assert!(!sanitized.contains("AIzaSyMock"));

        assert_eq!(sanitize_diagnostic_logs(""), "");
        assert_eq!(sanitize_diagnostic_logs("Clean logs without tokens"), "Clean logs without tokens");
    }

    #[tokio::test]
    async fn test_submit_issue_report_command() {
        let payload = SubmitIssuePayload {
            access_key: Some("4864c240-bf9b-40cf-82b3-e24c1766a559".to_string()),
            subject: "[FrugaLLM] Automated Unit Test".to_string(),
            from_name: "FrugaLLM Test".to_string(),
            email: "test@frugallm.internal".to_string(),
            message: "Automated test verifying Rust dispatch to Web3Forms".to_string(),
        };

        // Always verify local payload serialization & validation offline
        let serialized = serde_json::to_string(&payload);
        assert!(serialized.is_ok(), "Payload serialization failed");

        // Gate live network submission strictly to CI / GitHub Actions or explicit opt-in
        let is_github_actions = std::env::var("GITHUB_ACTIONS")
            .map(|v| v == "true" || v == "1")
            .unwrap_or(false);
        let is_explicit = std::env::var("RUN_LIVE_ISSUE_TEST")
            .map(|v| v == "true" || v == "1")
            .unwrap_or(false);

        if !is_github_actions && !is_explicit {
            println!("Skipping live Web3Forms issue submission during local test run (runs in GitHub Actions or with RUN_LIVE_ISSUE_TEST=1)");
            return;
        }

        let res = submit_issue_report(payload).await;
        assert!(res.is_ok(), "submit_issue_report failed: {:?}", res);
    }

    #[test]
    fn test_evaluate_next_call_status_scenarios() {
        let now = std::time::Instant::now();
        let mut provider_cooldowns = HashMap::new();
        let mut gated_models = HashSet::new();
        let mut model_cooldowns = HashMap::new();

        let model_a = CloudModel {
            model: "gemini-2.5-flash".to_string(),
            provider: "Google AI Studio".to_string(),
            iq: 75.0,
            context_length: Some(1000000),
        };

        let model_b = CloudModel {
            model: "gemini-3.5-flash".to_string(),
            provider: "Google AI Studio".to_string(),
            iq: 72.0,
            context_length: Some(1000000),
        };

        let chain = vec![model_a.clone(), model_b.clone()];

        // 1. Both models healthy -> 200 OK
        let status = evaluate_next_call_status(
            "Google AI Studio",
            &chain,
            &provider_cooldowns,
            &gated_models,
            &model_cooldowns,
            None,
            now,
        );
        assert_eq!(status, "200 OK");

        // 2. Model A gets 404 and is permanently gated in gated_models,
        // but Model B is healthy -> Next upcoming call will route to Model B, so status remains "200 OK"!
        gated_models.insert("gemini-2.5-flash".to_string());
        let status = evaluate_next_call_status(
            "Google AI Studio",
            &chain,
            &provider_cooldowns,
            &gated_models,
            &model_cooldowns,
            Some("404"),
            now,
        );
        assert_eq!(status, "200 OK");

        // 3. Model B gets 500 error and is placed in model_cooldowns (transient exhaustion),
        // Model A is gated -> no healthy models left, but Model B is in cooldown.
        // Status should be yellow ("500") for the next call!
        model_cooldowns.insert(
            "gemini-3.5-flash".to_string(),
            now + std::time::Duration::from_secs(60),
        );
        let status = evaluate_next_call_status(
            "Google AI Studio",
            &chain,
            &provider_cooldowns,
            &gated_models,
            &model_cooldowns,
            Some("500"),
            now,
        );
        assert_eq!(status, "500");

        // 4. If last error was 429 quota exhaustion instead:
        let status_429 = evaluate_next_call_status(
            "Google AI Studio",
            &chain,
            &provider_cooldowns,
            &gated_models,
            &model_cooldowns,
            Some("429"),
            now,
        );
        assert_eq!(status_429, "429");

        // 5. All models for provider are permanently gated (404) -> returns "404" (Red)
        gated_models.insert("gemini-3.5-flash".to_string());
        let status_dead = evaluate_next_call_status(
            "Google AI Studio",
            &chain,
            &provider_cooldowns,
            &gated_models,
            &model_cooldowns,
            Some("404"),
            now,
        );
        assert_eq!(status_dead, "404");

        // 6. Circuit breaker active on provider (403 Forbidden) -> returns "403" (Red)
        provider_cooldowns.insert(
            "Google AI Studio".to_string(),
            now + std::time::Duration::from_secs(300),
        );
        let status_403 = evaluate_next_call_status(
            "Google AI Studio",
            &chain,
            &provider_cooldowns,
            &gated_models,
            &model_cooldowns,
            Some("403"),
            now,
        );
        assert_eq!(status_403, "403");
    }


