# FrugaLLM Comprehensive Unit & Integration Testing Suite

## Summary

This pull request introduces an enterprise-grade unit and integration testing suite for both the React frontend and Rust backend of **FrugaLLM**. The suite provides deterministic validation across core subsystems (hardware telemetry, memory calculation, ONNX intelligence classifier, OpenRouter dynamic routing, and the node-based canvas workspace) without altering runtime application logic.

---

## 🚀 Key Highlights & Architecture

### 1. Frontend Test Infrastructure
- **Runner:** Vitest with React Testing Library (`@testing-library/react`), `@testing-library/jest-dom`, and `@testing-library/user-event` running on a clean `jsdom` environment.
- **Reporting & Telemetry:** Configured JUnit XML output (`./junit-report.xml`) and V8 code coverage reports (`./coverage/`) with `lcov`, `text`, and `json-summary`.
- **Global Mock Harness (`src/test/setup.ts`):** Complete deterministic polyfills for `window.__TAURI_INTERNALS__`, `localStorage`, `ResizeObserver`, and `@huggingface/transformers` to isolate tests from hardware/OS side effects.
- **Playwright Separation:** Excluded E2E directories from the unit runner while strictly targeting `src/**/*.{test,spec}.{ts,tsx}`.

### 2. Backend Test Infrastructure (`src-tauri`)
- **Isolation & Concurrency Safety:** Native `#[cfg(test)]` modules executed with `CARGO_TARGET_DIR=target_test` to prevent file lock contention with running background development servers.
- **Cross-Platform Verification:** Strict adherence to cross-platform compatibility across macOS (Intel x86_64), Linux, and Windows.

---

## 📊 Coverage & Test Breakdown

| Subsystem / Layer | Target File(s) | Tests | Coverage Focus | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Backend: Model Intelligence** | `src-tauri/src/model_db.rs` | 4 tests | Model ID prefix normalization, Google namespace routing, fuzzy intelligence scoring, unbenchmarked model fallbacks | `PASS` |
| **Backend: Hardware Telemetry** | `src-tauri/src/telemetry.rs` | 4 tests | 5:1 interleaved Q8 KV cache calculation, discrete PCIe spillover vs Unified SSD swap detection, live/preflight phase detection | `PASS` |
| **Backend: Core & Subsystems** | `src-tauri/src/lib.rs`, `test_restart.rs`, `main.rs` | 9 tests | Tauri IPC commands (`greet`), restart helper signatures, sysinfo mocking, zero-spillover heuristics | `PASS` |
| **Frontend: Memory Services** | `src/services/memoryCalculator.ts` | 13 tests | VRAM ceiling allocation math, Gemma 4 5:1 interleaved KV cache formulas, boundary values, zero-spillover warnings | `PASS` |
| **Frontend: ONNX Gateway** | `src/services/onnxGateway.ts` | 9 tests | HuggingFace pipeline loader, cache persistence, classification output extraction, fallback handling | `PASS` |
| **Frontend: API Router** | `src/router.ts` | 6 tests | OpenRouter API client, context window sorting, pricing calculation, network retry and timeout handling | `PASS` |
| **Frontend: Context & Hooks** | `src/context/MemoryContext.tsx`, `useCanvasLogic.ts`, `useOnboarding.ts` | 16 tests | Memory state machine, zoom/pan bounds, drag threshold detection, wipe mode onboarding transitions | `PASS` |
| **Frontend: UI Widgets** | `HardwareTelemetryWidget.tsx`, `MemoryPipelineWidget.tsx`, `CloudRoutingPanel.tsx`, `NodeWidgets.tsx` | 25 tests | RAM/VRAM gauges, thinking pulse, 128k context indicators, provider reordering, API key masking, hardware nodes | `PASS` |
| **Frontend: Modals & Shell** | `OnboardingDecision.tsx`, `OnboardingOverlay.tsx`, `TerminalLoader.tsx`, `App.tsx` | 11 tests | Boot loader streaming sequence, onboarding decision tree, interactive spotlight tour, node property modal | `PASS` |

**Total Suite Size:** **97 Unit & Integration Tests (80 Frontend + 17 Backend)** — **100% Passing.**

---

## 🧪 Verification Commands

```bash
# Run all unit tests (Rust + React)
npm run test

# Run frontend unit tests only
npm run test:unit

# Run frontend coverage report
npm run test:coverage

# Run backend Rust tests
npm run test:rust
```
