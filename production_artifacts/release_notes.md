# FrugaLLM v0.0.11 Release Notes

### 🚀 Features
- **Upstream Failover Circuit-Breaker & Reactive Provider Status (CHO-105):** Integrated live provider HTTP status tracking in the proxy core. Upstream failures (`403`, `503`, `timeout`, `offline`) immediately update the visual status indicators with prominent red badges and remain visible until a genuine `200 OK` response is received.
- **Dynamic Candidate Pruning & Cooldowns:** Fatal permission errors (such as GCP project billing restrictions on Google AI Studio) automatically trigger a 10-minute circuit-breaker cooldown. Transient errors (503 Service Overloaded or streaming timeouts) trigger a 60-second cooldown on the specific model, routing requests immediately to responsive candidates.
- **Smart Low-Cost Paid Fallbacks & Agentic Harness Gates:** When an OpenRouter API key has available credits, the proxy automatically appends ultra-low-cost production models (`google/gemini-2.5-flash`, `anthropic/claude-3.5-haiku`, `openai/gpt-4o-mini`) to prevent fallback deadlocks. OpenRouter requests now transmit standard `HTTP-Referer` and `X-Title` headers to bypass agentic harness gates on free models.
- **Automated App Store Screenshot Mode & Spec:** Added dedicated screenshot automation mode with believable production telemetry and Playwright E2E automation for capturing native-resolution screenshots across all key node configurations.

### 🐛 Fixes
- **Eliminated Cascading 550B Free-Tier Latency Hangs:** Enforced a strict 12-second Time-To-First-Token (TTFT) ceiling on heavy reasoning models (e.g. `nemotron-3-ultra-550b`) across both HTTP dispatch and streaming chunk arrival, plus a -15.0 dynamic ranking penalty, eliminating 100s–180s latency spikes.
- **Provider Status Indicator Accuracy:** Fixed an issue where provider nodes displayed a false `200 OK` green badge during active generation failures. Statuses now reflect true backend responses via event-driven synchronization without polling timers.
- **CI Build & Workflow Stability:** Resolved security scan toolchain inputs, enabled graceful scorecard reporting on private repositories, and resolved WebDriver test runner lifecycle cleanup.

### 🔧 Under the Hood
- **Stateful Backend Health Architecture:** Implemented `ProviderHealthState` in Rust managing thread-safe live statuses, provider cooldowns, model cooldowns, and pruned gated models.
- **Robust Unit & Integration Coverage:** Added dedicated tests for reactive provider status transitions, startup state hydration, circuit-breakers, and ranking penalties, with 36 Rust tests and 176 Vitest tests passing.
- **Automated Dependency Maintenance:** Applied automated security updates across GitHub actions workflows and Cargo backend dependencies.

### 📦 Downloads & Installation

| Platform | Variant / Architecture | Direct Download |
| :--- | :--- | :--- |
| **macOS** | Universal (Apple Silicon & Intel) | [frugallm-app_0.0.11_universal.dmg](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.11/frugallm-app_0.0.11_universal.dmg) |
| **Windows** | Standard Installer (`.exe`) | [frugallm-app_0.0.11_x64-setup.exe](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.11/frugallm-app_0.0.11_x64-setup.exe) |
| **Ubuntu** | Debian Installer (`.deb`) | [frugallm-app_0.0.11_amd64.deb](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.11/frugallm-app_0.0.11_amd64.deb) |
| **SteamOS** | Universal Portable (`.AppImage`) | [frugallm-app_0.0.11_amd64.AppImage](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.11/frugallm-app_0.0.11_amd64.AppImage) |
