# FrugaLLM

[![Release](https://github.com/chorned/frugallm-app/actions/workflows/release.yml/badge.svg)](https://github.com/chorned/frugallm-app/actions/workflows/release.yml)

FrugaLLM is a sophisticated, local-first proxy application and AI router built on the Tauri framework (Rust backend + React/Vite frontend). It features a visual, node-based UI (Hub, Hardware, Cloud, OpenCode, Hermes, Ollama nodes) that allows users to route LLM requests efficiently.

## Features

- **Visual Node-based UI**: Connect and manage AI providers visually.
- **Local-first Architecture**: Runs securely on your own hardware, supporting local daemons like Ollama alongside cloud APIs.
- **Advanced Model Routing**: Rank models dynamically with fallback capabilities to maximize uptime and minimize costs.
- **Cross-platform**: Available on macOS, Windows, and Linux.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
