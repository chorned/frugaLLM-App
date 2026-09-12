import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Release Draft and Version Synchronization', () => {
  const rootDir = path.resolve(__dirname, '../..');

  it('synchronizes package.json and tauri.conf.json versions', () => {
    const packageJsonPath = path.join(rootDir, 'package.json');
    const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');

    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'));

    expect(pkg.version).toBeDefined();
    expect(tauriConf.version).toBe(pkg.version);
    expect(pkg.version).toBe('0.0.14');
  });

  it('synchronizes Cargo.toml and Cargo.lock versions with package.json', () => {
    const packageJsonPath = path.join(rootDir, 'package.json');
    const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
    const cargoLockPath = path.join(rootDir, 'src-tauri', 'Cargo.lock');

    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const cargoTomlContent = fs.readFileSync(cargoTomlPath, 'utf-8');
    const cargoLockContent = fs.readFileSync(cargoLockPath, 'utf-8');

    // Verify Cargo.toml version field
    const cargoVersionMatch = cargoTomlContent.match(/\[package\][\s\S]*?version\s*=\s*"([^"]+)"/);
    expect(cargoVersionMatch, 'Cargo.toml must have a package version').not.toBeNull();
    expect(cargoVersionMatch![1]).toBe(pkg.version);

    // Verify Cargo.lock contains frugallm-app package entry with matching version
    const cargoLockEntryMatch = cargoLockContent.match(/name\s*=\s*"frugallm-app"\s*\n\s*version\s*=\s*"([^"]+)"/);
    expect(cargoLockEntryMatch, 'Cargo.lock must have frugallm-app package version').not.toBeNull();
    expect(cargoLockEntryMatch![1]).toBe(pkg.version);
  });

  it('verifies production_artifacts/release_notes.md matches current release draft', () => {
    const packageJsonPath = path.join(rootDir, 'package.json');
    const releaseNotesPath = path.join(rootDir, 'production_artifacts', 'release_notes.md');

    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const notes = fs.readFileSync(releaseNotesPath, 'utf-8');

    // Title matches version
    expect(notes).toContain(`# FrugaLLM v${pkg.version} Release Notes`);

    // Required sections
    expect(notes).toContain('### 🚀 Features');
    expect(notes).toContain('### 🐛 Fixes');
    expect(notes).toContain('### 🔧 Under the Hood');
    expect(notes).toContain('### 📦 Downloads & Installation');

    // Download links for major platforms
    const expectedAssets = [
      `frugallm-app_${pkg.version}_universal.dmg`,
      `frugallm-app_${pkg.version}_x64-setup.exe`,
      `frugallm-app_${pkg.version}_amd64.deb`,
      `frugallm-app_${pkg.version}_amd64.AppImage`,
    ];

    for (const asset of expectedAssets) {
      expect(notes).toContain(asset);
      expect(notes).toContain(`https://github.com/chorned/frugaLLM-App/releases/download/v${pkg.version}/${asset}`);
    }
  });
});
