# Changelog

All notable changes to the **FrugaLLM** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.0.16] - 2026-09-15

### Added
- **Dependency Provenance Tracking**: Implemented tracking for installation provenance across external agents and runtimes (`is_managed` vs preinstalled `is_installed`) to guard uninstallation and lifecycle workflows across platforms.
- **OpenSSF Best Practices Integration**: Registered project metadata and added the OpenSSF Best Practices badge to documentation.
- **Issue Diagnostics Tooltip**: Added an explanatory help tooltip for the diagnostic report inclusion checkbox in the issue submission modal.

### Fixed
- **Credential Scrubbing in Wipe Routine**: Enhanced `--wipe` credential cleanup to detect and scrub API key aliases and parent `.env` candidates.
- **Windows Path Lookup**: Removed redundant directory check in `local_app_data` resolution for the OpenCode command runner.

### Security
- **GitHub Actions Hardening**: Pinned all GitHub Actions workflows to immutable commit SHAs with semantic version comments.
- **Least-Privilege CI Permissions**: Explicitly configured minimal token permissions across all workflows and automated security audits.

### Changed
- **Workflow Telemetry & Run Names**: Added dynamic descriptive `run-name` headers across PR Gatekeeper, Security Audit, and Release workflows.
- **Repository Hygiene**: Removed untracked `production_artifacts` directory and cleaned up root documentation.

---

## [0.0.15] - 2026-09-15

### Added
- **Full Windows Gemma 4 Zero-Spillover Parity**: Complete native Windows integration for local Gemma 4 model deployment with automatic VRAM fitting, discrete GPU telemetry, and 60-minute VRAM memory locking.
- **Deep Clean Agent Uninstallation & Wiping**: Introduced a deep `--wipe` routine for uninstallation and lifecycle management, safely stripping local models, roaming application state, registry entries, and orphaned binaries for Ollama, OpenCode, and Hermes.
- **Real-Time Download Progress & Diagnostics**: Real-time download streaming with instantaneous transfer rate calculation, remaining ETA, and dedicated daemon log redirection (`server.log`) to prevent console bleed.
- **Automated Windows Lifecycle Management**: Comprehensive handling for background daemons, automated process tree termination, and robust PowerShell runner routines across all supported agents.
- **SLSA Build Provenance Attestation**: Integrated cryptographic SLSA build provenance generation into the release pipeline for all multi-platform build artifacts.
- **OpenSSF Scorecard & CodeQL Automated Analysis**: Supply-chain and SAST security analysis workflows configured on push and scheduled triggers.

### Fixed
- **Silent Process Tree Termination**: Silenced `taskkill` stderr output (`Stdio::null()`) during shutdown and wipe routines to prevent noisy process cleanup errors when terminating child processes.
- **ConPTY Non-Blocking Streams**: Hardened pseudo-terminal execution on Windows to prevent EOF read thread blocking, ensuring snappy terminal launch and teardown.
- **Ollama Daemon Startup Stability**: Increased startup timeout to 120 seconds with robust process table polling and suppressed background log noise.
- **Dual OpenAI Base URL Configuration**: Enhanced agent configuration to provide both `OPENAI_BASE_URL` and `OPENAI_API_BASE` environment variables for full compatibility with older and newer agent CLI frameworks.
- **Cross-Platform Compiler Warning Cleanups**: Resolved non-Windows variable warnings and ensured zero compiler warnings across all platforms.
- **API Key Masking & Vault Storage**: Enforced secure OS-level keychain storage via `keyring-rs` and masked API key visualization in configuration dialogs.

### Changed
- **Windows Engineering Skill & Architecture Manifesto**: Added comprehensive documentation enforcing strict isolation of OS-specific logic behind conditional compilation flags (`#[cfg(target_os = "windows")]`).
- **Expanded Test Coverage**: Expanded test suites to 96 passing backend Rust tests and 259 passing Vitest frontend unit tests verifying cross-platform terminal, process lifecycle, and memory allocation edge cases.
- **Automated Multi-Platform Release Pipeline**: Configured GitHub Actions matrix for macOS (Universal Apple Silicon & Intel), Windows (x64 setup installer), Ubuntu (Debian `.deb`), and SteamOS (`.AppImage`).

---

## [0.0.14] - 2026-09-10

### Added
- **Two-Phase TTFT Fast-Pass Routing**: Intelligently route initial model queries based on Time-to-First-Token SLAs with automatic penalty-box cooldowns.
- **Cached Token Metric Tracking**: Integrated upstream cache hit detection across OpenRouter and cloud providers.
- **Granular Provider Error Telemetry**: Added clear error state badges and 429 quota isolation in the central routing hub.

### Fixed
- Fixed API key replacement edge cases in the Node configuration panel.
- Resolved local Ollama launch detection when pre-installed on the host system.

---

## [0.0.1] - 2026-09-01

### Added
- Initial open-source release of FrugaLLM.
- Visual node-based topology canvas for AI provider routing.
- Local-first proxy router written in Rust (Tauri v2 + Tokio + Axum).
- Support for Ollama, OpenRouter, Google AI Studio, Hermes, and OpenCode runtimes.
