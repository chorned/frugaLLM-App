import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import semver from 'semver';

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { checkForAppUpdates } from '../utils/updateChecker';

describe('Release Integrity & Version Synchronization (v0.0.12)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const pkgJsonPath = path.join(rootDir, 'package.json');
  const cargoTomlPath = path.join(rootDir, 'src-tauri/Cargo.toml');
  const cargoLockPath = path.join(rootDir, 'src-tauri/Cargo.lock');
  const tauriConfPath = path.join(rootDir, 'src-tauri/tauri.conf.json');
  const releaseNotesPath = path.join(rootDir, 'production_artifacts/release_notes.md');

  it('verifies all declarative manifests share the exact same valid SemVer version', () => {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
    const cargoTomlContent = fs.readFileSync(cargoTomlPath, 'utf8');
    const cargoLockContent = fs.readFileSync(cargoLockPath, 'utf8');

    const expectedVersion = pkgJson.version;
    expect(semver.valid(expectedVersion)).toBeTruthy();
    expect(expectedVersion).toBe('0.0.12');

    // Tauri config version
    expect(tauriConf.version).toBe(expectedVersion);

    // Cargo.toml package version
    const cargoVersionMatch = cargoTomlContent.match(/\[package\][\s\S]*?version\s*=\s*"([^"]+)"/);
    expect(cargoVersionMatch).not.toBeNull();
    expect(cargoVersionMatch![1]).toBe(expectedVersion);

    // Cargo.lock package version for frugallm-app
    const cargoLockMatch = cargoLockContent.match(/\[\[package\]\]\s+name\s*=\s*"frugallm-app"\s+version\s*=\s*"([^"]+)"/);
    expect(cargoLockMatch).not.toBeNull();
    expect(cargoLockMatch![1]).toBe(expectedVersion);
  });

  it('validates production release notes contract and direct download asset URLs', () => {
    expect(fs.existsSync(releaseNotesPath)).toBe(true);
    const notes = fs.readFileSync(releaseNotesPath, 'utf8');

    // Title specifies the target version
    expect(notes).toContain('# FrugaLLM v0.0.12 Release Notes');

    // Key release sections present
    expect(notes).toContain('### 🚀 Features');
    expect(notes).toContain('### 🐛 Fixes');
    expect(notes).toContain('### 🔧 Under the Hood');
    expect(notes).toContain('### 📦 Downloads & Installation');

    // Verify all 4 primary platform artifacts are linked to v0.0.12 release
    const expectedAssets = [
      'https://github.com/chorned/frugaLLM-App/releases/download/v0.0.12/frugallm-app_0.0.12_universal.dmg',
      'https://github.com/chorned/frugaLLM-App/releases/download/v0.0.12/frugallm-app_0.0.12_x64-setup.exe',
      'https://github.com/chorned/frugaLLM-App/releases/download/v0.0.12/frugallm-app_0.0.12_amd64.deb',
      'https://github.com/chorned/frugaLLM-App/releases/download/v0.0.12/frugallm-app_0.0.12_amd64.AppImage',
    ];

    for (const assetUrl of expectedAssets) {
      expect(notes).toContain(assetUrl);
    }
  });

  it('exercises update checker with the current 0.0.12 release baseline', async () => {
    vi.mocked(invoke).mockResolvedValue(false);
    vi.mocked(getVersion).mockResolvedValue('0.0.12');

    // When upstream matches current version (0.0.12), hasUpdate must be false
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: 'v0.0.12',
        html_url: 'https://github.com/chorned/frugaLLM-App/releases/tag/v0.0.12',
      }),
    } as any);

    const resultCurrent = await checkForAppUpdates('chorned', 'frugaLLM-App');
    expect(resultCurrent.hasUpdate).toBe(false);
    expect(resultCurrent.currentVersion).toBe('0.0.12');
    expect(resultCurrent.latestVersion).toBe('0.0.12');

    // When upstream publishes v0.0.13, hasUpdate must be true
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: 'v0.0.13',
        html_url: 'https://github.com/chorned/frugaLLM-App/releases/tag/v0.0.13',
      }),
    } as any);

    const resultNew = await checkForAppUpdates('chorned', 'frugaLLM-App');
    expect(resultNew.hasUpdate).toBe(true);
    expect(resultNew.latestVersion).toBe('0.0.13');
    expect(resultNew.currentVersion).toBe('0.0.12');
  });
});
