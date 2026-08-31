# FrugaLLM v0.0.6

This release delivers an enterprise-grade unit, integration, and backend testing infrastructure, strengthening reliability and deterministic test coverage across all proxy routing, memory calculation, ONNX gateway, and hardware telemetry modules.

## Features
- **Comprehensive Automated Test Suite**: Integrated Vitest test runners and assertions across frontend state managers, custom hooks (`useCanvasLogic`, `useOnboarding`), and component widgets (`CloudRoutingPanel`, `HardwareTelemetryWidget`, `MemoryPipelineWidget`, `TerminalLoader`, `NodeWidgets`).
- **Rust Backend Test Coverage**: Added dedicated unit test suites for model database indexing, telemetry polling, and server lifecycle restart handling.
- **Deterministic Mocking**: Implemented isolated IPC mocking harness for Tauri event streams and runtime listeners.

## Fixes
- **CI/CD Quality Gate**: Hardened GitHub Actions release workflow to enforce full Rust and Vitest test matrix completion prior to multi-platform Tauri compilation.
- **Memory & Telemetry Guardrails**: Verified edge-case handling in memory allocation calculations, KV cache estimations, and hardware utilization fallbacks.

## Under the Hood
- **Test Rollout Documentation**: Added `TEST_SUMMARY.md` and `TEST_ROLLOUT_LEDGER.md` for continuous verification tracking.
- **Release Matrix Hardening**: Streamlined packaging and build verification for macOS, Linux, and Windows desktop distributions.
