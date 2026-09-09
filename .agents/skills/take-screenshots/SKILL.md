---
name: take-screenshots
description: Boots FrugaLLM in automated App Store screenshot mode, overrides strings with believable production copy (strictly no "EXAMPLE" or "PLACEHOLDER"), captures pixel-perfect Retina screenshots of all key screens and node configurations at native viewport resolution (1024x768), and verifies 100% tree-shaking from production builds.
license: Apache-2.0
metadata:
  version: v1
  author: FrugaLLM Lead Architect
---

# Take Screenshots Skill

This skill automates the capture of high-resolution, App Store-ready marketing screenshots of FrugaLLM across all key app screens and node configurations.

## Key Principles & Mandates

1. **Believable, Professional Copy (Anti-Placeholder Rule):**
   - Strictly forbidden from using strings like `"EXAMPLE"`, `"PLACEHOLDER"`, `"TEST"`, or `"Lorem Ipsum"`.
   - Every label, log line, workspace path, and token metric must reflect authentic production engineering usage (e.g. real model identifiers like `anthropic/claude-3.5-sonnet`, real hardware telemetry like `Apple M3 Max`, and authentic boot logs).

2. **Native Viewport Precision:**
   - Captured at the native application viewport size defined in `src-tauri/tauri.conf.json`: `1024 x 768`.
   - Rendered with `deviceScaleFactor: 2` to produce crisp, high-DPI Retina assets.

3. **Strict Production Tree-Shaking:**
   - All screenshot harnesses, mocks, and demo fixtures live under `src/dev/screenshotMode.ts`.
   - Code is conditionally loaded strictly via `if (import.meta.env.DEV)` with dynamic imports (`await import('./dev/screenshotMode')`).
   - The production bundler (`npm run build`) strips 100% of the screenshot code and fixtures from `dist/`.

## Captured Screen Catalog

The test suite generates 8 screenshots saved to `production_artifacts/screenshots/`:

| Index | Artifact Name | Description | Key Visible Data |
|-------|---------------|-------------|-------------------|
| `01` | `01_boot_screen.png` | Native boot screen with realistic system diagnostics | Hardware topology, VRAM detection, daemon checks, listening port 8080 |
| `02` | `02_landing_page_connected.png` | Main canvas with all 6 nodes active and connected | Active green node indicators, telemetry metrics, symmetrically positioned |
| `03` | `03_node_frugallm_hub.png` | FrugaLLM Core Gateway configuration modal | Port 8080, API key masking, Global Routing Pool with real models & scores |
| `04` | `04_node_ollama_local.png` | Ollama Local Accelerator configuration modal | Port 11434, multi-color memory segment bar (`gemma4:e4b`), Tool Enforcing Gateway |
| `05` | `05_node_openrouter_cloud.png` | OpenRouter Cloud Multiplexer modal | Tier 3 authenticated key, provider description, disconnect action |
| `06` | `06_node_aistudio_google.png` | Google AI Studio Gemini modal | Configured Gemini API key, frontier reasoning description, status |
| `07` | `07_node_hermes_agent.png` | Hermes Autonomous Agent modal | Active daemon, workspace path, Soul.md editor, gateway/app controls |
| `08` | `08_node_opencode_agent.png` | OpenCode Autonomous Coding Engine modal | Active coding engine daemon, workspace path, WebUI controls |

## How to Execute

### 1. Slash Command
Invoke directly via:
```text
/take-screenshots
```

### 2. Manual CLI Invocation
Ensure the Vite development server is running on `http://localhost:1420`:
```bash
npm run tauri dev # or npm run dev
```

Run the Playwright screenshot capture suite:
```bash
npm run screenshots
```

Verify production tree-shaking:
```bash
npm run build
grep -rn "APPSTORE_BOOT_LOGS" dist/ || echo "Tree-shaking verified: Zero dev strings leaked."
```

Verify test suite integrity:
```bash
npm run test:unit
```
