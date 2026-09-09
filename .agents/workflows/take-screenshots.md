---
description: Boot the app in screenshot mode and capture high-resolution App Store homepage screenshots for all key screens.
---

When the user types `/take-screenshots`, execute the automated App Store screenshot capture pipeline:

### Execution Sequence:

1. **Pre-flight & App Startup:**
   - Verify that the Vite development server is running on `http://localhost:1420` (or boot it if not active).
   - Ensure the app is running in dev mode (`src/dev/screenshotMode.ts`).

2. **Screenshot Capture:**
   - Run the automated Playwright screenshot suite:
     ```bash
     npm run screenshots
     ```
   - This captures pixel-perfect, 2x Retina resolution screenshots at the native app viewport (`1024x768`) into `production_artifacts/screenshots/`:
     1. `01_boot_screen.png`: Boot sequence with authentic system telemetry checks and neural proxy initialization.
     2. `02_landing_page_connected.png`: Full canvas landing page with all 6 nodes active, connected, and reporting telemetry.
     3. `03_node_frugallm_hub.png`: FrugaLLM Core Gateway settings with Global Routing Pool models and scores.
     4. `04_node_ollama_local.png`: Ollama Local Accelerator with live memory segmentation bar (weights, KV cache, overhead) and Tool Enforcing Gateway.
     5. `05_node_openrouter_cloud.png`: OpenRouter Global Multiplexer credentials and status.
     6. `06_node_aistudio_google.png`: Google AI Studio Gemini frontier pipeline credentials and status.
     7. `07_node_hermes_agent.png`: Hermes Autonomous Agent workspace, processes, and tools.
     8. `08_node_opencode_agent.png`: OpenCode Autonomous Coding Engine workspace, WebUI, and tools.

3. **Production Tree-Shaking Audit:**
   - Verify that production build (`npm run build`) completely strips all screenshot assets, mocks, and copy.

4. **Report & Summary:**
   - Present the captured screenshots with artifact paths and file sizes to the user.
