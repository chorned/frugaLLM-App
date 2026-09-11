# FrugaLLM v0.0.13 Release Notes

### 🚀 Features
- **Fresh-Install Dark Mode Default:** Application boots immediately into dark mode (`theme-ebony`) on clean installations when no prior theme preferences are detected in local storage, providing a streamlined, developer-first experience out of the box.
- **Calibrated Local vs. Cloud Model Guidance:** Local model selection guidance in node settings has been calibrated to clearly articulate trade-offs between parameter tiers (2B–4B vs. 26B–31B) and benchmark expectations against frontier cloud endpoints (Claude 3.5 Sonnet, Gemini 1.5 Pro).
- **Unified Interactive Canvas Tooltips:** Standardized hover tooltips across core FrugaLLM node parameters (Routing Mode, Tool Routing, Model Filtering, and Auto-Failover), ensuring consistent guidance across canvas topologies.
- **In-App Issue Reporter Integration:** Diagnostic feedback reporting modal embedded across the footer, settings drawer, and node configuration panels with automatic log sanitization.

### 🐛 Fixes
- **Node Configuration Layout Streamlining:** Removed bulky multi-card info panels from Ollama settings, keeping node panels uncluttered and responsive while delegating parameter descriptions to field-level tooltips.
- **Pruned Obsolete Quick Start Guides:** Removed deprecated guide files and the legacy `GuidesModal` component in favor of unified in-canvas contextual documentation.
- **Canvas Node Geometry Cleanups:** Pruned redundant canvas height constants in favor of dynamic card sizing and balanced symmetrical canvas padding.

### 🔧 Under the Hood
- **Dependency Maintenance & PR Consolidation:** Upgraded WebdriverIO testing dependencies to 9.31.6 and resolved peer dependency constraints, addressing and closing open Dependabot maintenance updates (#34, #35, #36, #37).
- **Full Test Pyramid Gate Validation:** Validated 100% green coverage across all testing tiers: 57 Rust backend unit tests, 35 Vitest suites (227 tests), 45 Playwright E2E browser flows, and production bundling.
- **Extended Model Pricing & Gating Logic:** Added support for token pricing structures and 128k context-window gating across both local and cloud routing candidates.

### 📦 Downloads & Installation

| Platform | Variant / Architecture | Direct Download |
| :--- | :--- | :--- |
| **macOS** | Universal (Apple Silicon & Intel) | [frugallm-app_0.0.13_universal.dmg](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.13/frugallm-app_0.0.13_universal.dmg) |
| **Windows** | Standard Installer (`.exe`) | [frugallm-app_0.0.13_x64-setup.exe](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.13/frugallm-app_0.0.13_x64-setup.exe) |
| **Ubuntu** | Debian Installer (`.deb`) | [frugallm-app_0.0.13_amd64.deb](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.13/frugallm-app_0.0.13_amd64.deb) |
| **SteamOS** | Universal Portable (`.AppImage`) | [frugallm-app_0.0.13_amd64.AppImage](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.13/frugallm-app_0.0.13_amd64.AppImage) |
