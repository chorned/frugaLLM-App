# Playwright E2E Tests for FrugaLLM

This directory contains the End-to-End test suite for the FrugalLLM frontend UI rewrite. These tests are built with Playwright and use the Page Object Model (POM) pattern to isolate UI selectors from testing logic.

## Overview of Tests

The E2E suite is designed to ensure functional parity with the v1 application without requiring a running Rust backend. We achieve this by injecting a custom `window.__TAURI_INTERNALS__` mock that intercepts IPC events and simulates backend states.

### 1. Main Canvas (`main-canvas.spec.ts`)
Validates the core application workspace:
- Confirms the canvas renders correctly and nodes initialize with their default labels (FrugaLLM Hub, Hardware, OpenRouter, OpenCode, Hermes, Ollama).
- Tests node interactions, ensuring that clicking a node opens the correct configuration panel.
- Validates the zoom and pan controls.

### 2. Node Configuration (`node-config.spec.ts`)
Validates the data entry forms and property sheets for nodes:
- Verifies that form inputs correspond to the underlying React state.
- Tests that saving configuration fields correctly updates the properties.
- Ensures edge cases (like the FrugalLLM Hub's "Bind all interfaces" toggle) behave correctly.

### 3. Terminal Runner (`terminal-runner.spec.ts`)
Tests the embedded terminal and provisioning views (xterm.js integration):
- Intercepts Tauri PTY commands (`spawn_pty`, `resize_pty`, `kill_pty`, `write_pty`).
- Validates that triggering the installation flow mounts the terminal, resizes the PTY to fit the window, and gracefully sends a termination signal upon exit.

### 4. Hardware Telemetry (`hardware-telemetry.spec.ts`)
Validates the real-time hardware monitoring widget:
- **Offline States:** Asserts default fallback states (CPU load and System RAM).
- **GPU Telemetry:** Injects active `telemetry_update` streams to ensure the UI switches to GPU usage/VRAM metrics.
- **Throughput Calculation:** Simulates `pty_bytes` events to test the rolling token generation average, asserting that the UI correctly switches into "THINKING" state when token generation exceeds 0.0 t/s.

## How to Run the Tests

The tests rely on Vite running the application locally. By default, Playwright is configured (`playwright.config.ts`) to start the development server automatically on port `1420` before executing the suite.

### Run all tests headlessly (Default)
```bash
npx playwright test
```

### Run tests with the browser visible (Headed mode)
Useful for debugging and watching the test execution live:
```bash
npx playwright test --headed
```

### Run a specific test file
```bash
npx playwright test tests/e2e/hardware-telemetry.spec.ts
```

### Open the Playwright UI Inspector
Provides an interactive environment to debug selectors, step through tests, and view traces:
```bash
npx playwright test --ui
```

### View Test Reports
If any tests fail, Playwright generates an HTML report. You can view it by running:
```bash
npx playwright show-report
```

## Writing New Tests

If you are adding new features, please adhere to the POM (Page Object Model) pattern.
1. Add element selectors and page interactions to a new or existing file in `tests/pages/`.
2. Write your test logic in `tests/e2e/`.
3. Use `page.addInitScript` to mock any new Tauri IPC commands introduced in the frontend.
