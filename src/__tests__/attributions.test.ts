import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Open Source Compliance and Attributions (CHO-87)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const thirdPartyPath = path.join(rootDir, 'THIRDPARTY.md');
  const readmePath = path.join(rootDir, 'README.md');
  const mainRustPath = path.join(rootDir, 'src-tauri/src/main.rs');

  it('THIRDPARTY.md exists and contains Frontend and Backend dependencies with licenses', () => {
    expect(fs.existsSync(thirdPartyPath)).toBe(true);
    const content = fs.readFileSync(thirdPartyPath, 'utf8');

    // Verify main headings
    expect(content).toMatch(/# (Third-Party Licenses|Third Party Attributions|Dependencies)/i);
    expect(content).toMatch(/##\s+Frontend Dependencies/i);
    expect(content).toMatch(/##\s+Backend Dependencies/i);

    // Verify key frontend dependencies are listed with licenses
    expect(content).toMatch(/react/i);
    expect(content).toMatch(/@tauri-apps\/api/i);
    expect(content).toMatch(/MIT/i);

    // Verify key backend Rust crates are listed with licenses
    expect(content).toMatch(/axum/i);
    expect(content).toMatch(/tokio/i);
    expect(content).toMatch(/serde/i);
  });

  it('README.md contains Acknowledgements with Core Architecture, Development Tools, and Supported Models', () => {
    expect(fs.existsSync(readmePath)).toBe(true);
    const content = fs.readFileSync(readmePath, 'utf8');

    // Acknowledgements section
    expect(content).toMatch(/##\s+Acknowledgements/i);

    // Core Architecture mentioning LiteLLM with repo link
    expect(content).toMatch(/###\s+Core Architecture/i);
    expect(content).toMatch(/LiteLLM/i);
    expect(content).toContain('https://github.com/BerriAI/litellm');

    // Development Tools mentioning Hermes Agent and Google Antigravity
    expect(content).toMatch(/###\s+Development Tools/i);
    expect(content).toMatch(/Hermes Agent/i);
    expect(content).toMatch(/Google Antigravity/i);

    // Supported Models disclaimer with exact phrase
    expect(content).toMatch(/###\s+Supported Models/i);
    expect(content).toMatch(/Ollama/i);
    expect(content).toContain(
      'All models downloaded on-demand remain the property of their respective creators and are subject to their own distinct licensing terms and acceptable use policies.'
    );

    // Open Source & Core Technologies gratitude subsection
    expect(content).toMatch(/###\s+(Core Technologies|Technology Stack|Open Source Technologies|Open Source Ecosystem)/i);
    expect(content).toMatch(/Tauri/i);
    expect(content).toMatch(/Rust/i);
    expect(content).toMatch(/Axum/i);
    expect(content).toMatch(/Tokio/i);
    expect(content).toMatch(/React/i);
    expect(content).toMatch(/Vite/i);
    expect(content).toMatch(/sysinfo/i);
    expect(content).toMatch(/Transformers\.js|Hugging Face|ONNX/i);

    // Agent Ecosystem & AI Providers gratitude
    expect(content).toMatch(/OpenRouter/i);
    expect(content).toMatch(/OpenCode/i);
    expect(content).toMatch(/Gemini/i);
    expect(content).toMatch(/Gemma/i);
    expect(content).toMatch(/ONNX/i);

    // Terminal, Security, and UI motion dependencies
    expect(content).toMatch(/xterm/i);
    expect(content).toMatch(/portable-pty/i);
    expect(content).toMatch(/keyring/i);
    expect(content).toMatch(/Framer Motion/i);
  });

  it('Rust source files contain LiteLLM derivative works notice header', () => {
    const mainRustPath = path.join(rootDir, 'src-tauri/src/main.rs');
    const modelDbRustPath = path.join(rootDir, 'src-tauri/src/model_db.rs');
    const notice = 'Notice: Portions of this file are derivative works based on the LiteLLM project, originally licensed under the MIT License.';

    expect(fs.existsSync(mainRustPath)).toBe(true);
    const mainContent = fs.readFileSync(mainRustPath, 'utf8');
    expect(mainContent).toContain(notice);

    expect(fs.existsSync(modelDbRustPath)).toBe(true);
    const modelDbContent = fs.readFileSync(modelDbRustPath, 'utf8');
    expect(modelDbContent).toContain(notice);
  });
});
