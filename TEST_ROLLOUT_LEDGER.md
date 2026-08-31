# TEST_ROLLOUT_LEDGER

## Testing Rollout State Machine

This ledger tracks the comprehensive unit and integration test coverage implementation across the FrugaLLM architecture.

### Global Test Runners
- **Frontend Runner:** `npm run test:unit` (Vitest + React Testing Library, jsdom)
- **Frontend Coverage:** `npm run test:coverage` (V8, lcov, JUnit XML)
- **Backend Runner:** `npm run test:rust` (`cargo test` with dedicated target directory)
- **Quality Gate:** `no-mistakes` review remote + `cargo test` + `vitest run`

---

### Backend Modules (`src-tauri/src/`)

| Status | File | Test Type | Coverage Focus | Result Summary |
| :--- | :--- | :--- | :--- | :--- |
| `[PASS]` | `src-tauri/src/model_db.rs` | Unit / Integration | Model metadata catalog, prefix normalizer, fuzzy matching, intelligence scoring | Pass: Tests validate Google prefix mapping, suffix stripping, intelligence sorting, and unbenchmarked fallbacks |
| `[PASS]` | `src-tauri/src/telemetry.rs` | Unit / Integration | Cross-platform RAM/VRAM polling, KV cache math, memory segments, spillover warnings | Pass: Tests validate 5:1 interleaved Q8 KV cache calculation, unified SSD swap warning, and discrete PCIe spillover |
| `[PASS]` | `src-tauri/src/lib.rs` | Unit / Integration | Tauri command handlers, greeting payload formatting | Pass: Tests validate `greet` command and Tauri handler initialization |
| `[PASS]` | `src-tauri/src/test_restart.rs` | Unit | Safe process restart signature presence and linkage | Pass: Tests validate restart helper signature and app handle binding |

---

### Frontend Services & Logic (`src/services/`, `src/`)

| Status | File | Test Type | Coverage Focus | Result Summary |
| :--- | :--- | :--- | :--- | :--- |
| `[PASS]` | `src/services/memoryCalculator.ts` | Unit | Memory math, VRAM estimation, context window thresholds, boundary value analysis | Pass: 13/13 tests passing covering model lookups, KV cache math, spillover warnings, and ceiling fallbacks |
| `[PASS]` | `src/services/onnxGateway.ts` | Unit / Integration | Model gateway, tokenizers, error handling, mock HuggingFace/ONNX endpoints | Pass: 9/9 tests passing covering pipeline caching, model classification, edge case fallbacks, and download tracking |
| `[PASS]` | `src/router.ts` | Unit / Integration | Request routing, local/cloud fallback, payload translation, OpenRouter API client | Pass: 6/6 tests passing covering model fetching, context window sorting, pricing calculation, and network error handling |

---

### Frontend Context & Hooks (`src/context/`, `src/hooks/`)

| Status | File | Test Type | Coverage Focus | Result Summary |
| :--- | :--- | :--- | :--- | :--- |
| `[PASS]` | `src/context/MemoryContext.tsx` | Unit / Integration | Memory provider state machine, allocation updates, telemetry event integration | Pass: 6/6 tests passing covering provider initialization, custom model override hooks, and telemetry updates |
| `[PASS]` | `src/hooks/useCanvasLogic.ts` | Unit / Integration | Node positioning, zoom/pan bounds, drag handlers, node selection, edge routing | Pass: 5/5 tests passing covering pan/zoom clamping, click threshold detection, and node selection callbacks |
| `[PASS]` | `src/hooks/useOnboarding.ts` | Unit | Multi-step onboarding state transitions, decision branching, store persistence | Pass: 5/5 tests passing covering wipe mode detection, decision handlers, and localStorage synchronization |

---

### Frontend Components (`src/components/`, `src/`)

| Status | File | Test Type | Coverage Focus | Result Summary |
| :--- | :--- | :--- | :--- | :--- |
| `[PASS]` | `src/components/HardwareTelemetryWidget.tsx` | Unit / RTL | RAM/VRAM gauges, thinking state pulse, offline state rendering, overflow handling | Pass: 6/6 tests passing covering gauge meters, hardware chip badges, offline fallbacks, and thinking pulse states |
| `[PASS]` | `src/components/MemoryPipelineWidget.tsx` | Unit / RTL | Memory pipeline breakdown, token throughput meters, visual telemetry updates | Pass: 6/6 tests passing covering bar segmentation, 128k context indicators, spillover warnings, and throughput counters |
| `[PASS]` | `src/components/CloudRoutingPanel.tsx` | Unit / RTL | Cloud provider toggles, fallback selection, API key masking, disabled states | Pass: 5/5 tests passing covering provider list rendering, model reordering, manual pin overrides, and API key masking |
| `[PASS]` | `src/components/NodeWidgets.tsx` | Unit / RTL | Node rendering (Hub, Hardware, Cloud, OpenCode, Hermes, Ollama), port connections | Pass: 8/8 tests passing covering status indicators, copyable fields, toggles, and hardware node subheaders |
| `[PASS]` | `src/components/OnboardingDecision.tsx` | Unit / RTL | Interactive decision cards, keyboard navigation, selection dispatch | Pass: 3/3 tests passing covering card options, click dispatches, and responsive layout structure |
| `[PASS]` | `src/components/OnboardingOverlay.tsx` | Unit / RTL | Modal overlay backdrop, step indicators, dismiss/next button workflows | Pass: 3/3 tests passing covering spotlight cutout positioning, step advances, and tour completion events |
| `[PASS]` | `src/components/TerminalLoader.tsx` | Unit / RTL | Loading spinner, log stream rendering, empty state handling | Pass: 2/2 tests passing covering boot log stream rendering, cursor blinking, and logo presentation |
| `[PASS]` | `src/App.tsx` | Integration / RTL | Main app canvas shell, node layout rendering, panel transitions, error boundaries | Pass: 3/3 tests passing covering boot loader sequence, onboarding tour branching, and node property panel modal interactions |
