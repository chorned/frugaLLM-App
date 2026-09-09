import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Backend Architecture Modularization (CHO-118)', () => {
  const mainRsPath = path.resolve(__dirname, '../../src-tauri/src/main.rs');

  it('verifies src-tauri/src/main.rs is decomposed to under 250 lines', () => {
    expect(fs.existsSync(mainRsPath)).toBe(true);
    const content = fs.readFileSync(mainRsPath, 'utf-8');
    const lineCount = content.split('\n').length;
    expect(lineCount).toBeLessThan(250);
  });

  it('verifies domain module boundaries exist under src-tauri/src/', () => {
    const srcTauriSrc = path.resolve(__dirname, '../../src-tauri/src');
    expect(fs.existsSync(path.join(srcTauriSrc, 'state.rs'))).toBe(true);
    expect(fs.existsSync(path.join(srcTauriSrc, 'commands'))).toBe(true);
    expect(fs.existsSync(path.join(srcTauriSrc, 'proxy'))).toBe(true);
    expect(fs.existsSync(path.join(srcTauriSrc, 'db.rs')) || fs.existsSync(path.join(srcTauriSrc, 'db'))).toBe(true);
  });
});
