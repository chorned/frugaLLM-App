# FrugaLLM

[![Release](https://github.com/chorned/frugallm-app/actions/workflows/release.yml/badge.svg)](https://github.com/chorned/frugallm-app/actions/workflows/release.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/chorned/frugaLLM-App/badge)](https://scorecard.dev/viewer/?uri=github.com/chorned/frugaLLM-App)
[![CodeQL](https://github.com/chorned/frugaLLM-App/actions/workflows/security.yml/badge.svg?branch=main&job=codeql-analysis)](https://github.com/chorned/frugaLLM-App/actions/workflows/security.yml)
[![Security Audit](https://github.com/chorned/frugaLLM-App/actions/workflows/security.yml/badge.svg?branch=main&job=dependency-audit)](https://github.com/chorned/frugaLLM-App/actions/workflows/security.yml)
[![Dependabot](https://img.shields.io/badge/Dependabot-active-025E8C?logo=dependabot&logoColor=white)](https://github.com/chorned/frugaLLM-App/network/updates)

FrugaLLM is a sophisticated, local-first proxy application and AI router built on the Tauri framework (Rust backend + React/Vite frontend). It features a visual, node-based UI (Hub, Hardware, Cloud, OpenCode, Hermes, Ollama nodes) that allows users to route LLM requests efficiently.

## Features

- **Visual Node-based UI**: Connect and manage AI providers visually.
- **Local-first Architecture**: Runs securely on your own hardware, supporting local daemons like Ollama alongside cloud APIs.
- **Advanced Model Routing**: Rank models dynamically with fallback capabilities to maximize uptime and minimize costs.
- **Cross-platform**: Available on macOS, Windows, and Linux.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Acknowledgements

### Core Architecture
The core Rust routing implementation was heavily inspired by, and in some cases ported from, the Python-based [LiteLLM](https://github.com/BerriAI/litellm) project.

### Agent Ecosystem & Integrated Runtimes
FrugaLLM integrates and orchestrates specialized autonomous agent runtimes:
- **[Hermes](https://nousresearch.com/)** (Nous Research): Powering the autonomous agent node, Hermes Gateway, and local desktop execution layer.
- **[OpenCode](https://github.com/anomaly/opencode)**: Providing our integrated code execution interpreter and autonomous development agent runtime.

### AI Providers & Model Routing
- **[OpenRouter](https://openrouter.ai/)**: Serving as our unified model routing gateway, providing real-time model catalog access, dynamic pricing metrics, and transparent fallback routing across hundreds of LLMs.
- **Google Cloud & [Gemini](https://deepmind.google/technologies/gemini/)**: Powering scalable cloud inference and state-of-the-art multimodal frontier intelligence.
- **[Gemma](https://ai.google.dev/gemma)** (Google DeepMind): Google's lightweight open model family (including Gemma 4 and optimized KV-cache memory telemetry) running locally on user hardware.

### Development Tools
This project was built and refactored with the assistance of autonomous AI agents, specifically Hermes Agent and Google Antigravity.

### Supported Models
The application orchestrates local model downloads via Ollama. All models downloaded on-demand remain the property of their respective creators and are subject to their own distinct licensing terms and acceptable use policies.

### Embedded Terminal & System Runtimes
- **[xterm.js](https://xtermjs.org/)** (`@xterm/xterm` & `@xterm/addon-fit`): Driving the embedded terminal emulator and real-time ANSI stream rendering for Hermes and OpenCode.
- **[portable-pty](https://github.com/wez/wezterm/tree/main/pty)**: Providing cross-platform pseudo-terminal creation and control across macOS, Windows, and Linux.
- **[keyring-rs](https://github.com/hwchen/keyring-rs)**: Securing sensitive API keys within native OS credential vaults (Apple Keychain, Windows Credential Manager, and Linux Secret Service).
- **[nvml-wrapper](https://github.com/cmyr/nvml-wrapper)**: Powering low-level NVIDIA GPU VRAM and compute telemetry polling.

### UI Animation, Interaction & Visual Primitives
- **[Framer Motion](https://www.framer.com/motion/)** & **[@formkit/auto-animate](https://auto-animate.formkit.com/)**: Orchestrating fluid spring physics, canvas layout transitions, and interactive node animations.
- **[Tailwind CSS](https://tailwindcss.com/)** & **[Lucide Icons](https://lucide.dev/)**: Delivering our streamlined visual aesthetics, design system, and iconography.
- **[React Markdown](https://github.com/remarkjs/react-markdown)**: Rendering rich Markdown formatting for model responses and guides.
- **[canvas-confetti](https://github.com/catdad/canvas-confetti)**: Micro-interaction animations on successful configuration saves.

### Core Technologies & Open Source Ecosystem
FrugaLLM is built upon the shoulders of remarkable open-source projects and communities. We express our sincere gratitude to:
- **[Tauri](https://tauri.app/)** & **[Rust](https://www.rust-lang.org/)**: Providing foundational security, minimal memory footprint, and high-performance desktop execution.
- **[Axum](https://github.com/tokio-rs/axum)**, **[Tokio](https://tokio.rs/)**, & **[Tower](https://github.com/tower-rs/tower)**: Powering our asynchronous proxy server, middleware pipeline, and resilient streaming engine.
- **[React](https://react.dev/)** & **[Vite](https://vitejs.dev/)**: Enabling our responsive, reactive visual canvas and rapid frontend build workflows.
- **[Ollama](https://ollama.com/)**: Pioneering accessible local LLM execution and model orchestration directly on user hardware.
- **[ONNX](https://onnx.ai/) & [ONNX Runtime](https://onnxruntime.ai/)** (via **[Hugging Face Transformers.js](https://huggingface.co/docs/transformers.js)**): Empowering client-side intent classification, tokenization, and on-device neural network inference with zero cloud roundtrips.
- **[sysinfo](https://github.com/GuillaumeGomez/sysinfo)**: Providing accurate, cross-platform hardware telemetry, CPU tracking, and memory monitoring across macOS, Windows, and Linux.

### Testing & Quality Assurance
- **[Vitest](https://vitest.dev/)** & **[@testing-library](https://testing-library.com/)**: Fast unit testing and reactive component verification.
- **[Playwright](https://playwright.dev/)**: End-to-End browser automation and visual regression testing.
- **[WebdriverIO](https://webdriver.io/)**: Cross-platform desktop smoke testing.

