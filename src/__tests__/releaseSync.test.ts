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
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
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

    expect(fs.existsSync(releaseNotesPath), `Expected ${releaseNotesPath} to exist for release synchronization`).toBe(true);

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

  it('validates CHANGELOG.md Keep a Changelog format, SemVer ordering, and release entries', () => {
    const packageJsonPath = path.join(rootDir, 'package.json');
    const changelogPath = path.join(rootDir, 'CHANGELOG.md');

    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const changelogContent = fs.readFileSync(changelogPath, 'utf-8');

    // Header validation
    expect(changelogContent).toContain('# Changelog');
    expect(changelogContent).toContain('Keep a Changelog');
    expect(changelogContent).toContain('Semantic Versioning');

    // Extract all version entries: ## [X.Y.Z] - YYYY-MM-DD
    const versionHeaderRegex = /^## \[(\d+\.\d+\.\d+)\]\s*-\s*(\d{4}-\d{2}-\d{2})$/gm;
    const entries: { version: string; date: string; index: number }[] = [];
    let match;

    while ((match = versionHeaderRegex.exec(changelogContent)) !== null) {
      entries.push({
        version: match[1],
        date: match[2],
        index: match.index,
      });
    }

    expect(entries.length).toBeGreaterThanOrEqual(4);

    // Latest version matches package.json
    expect(entries[0].version).toBe(pkg.version);

    // Verify specifically documented releases: 0.0.18, 0.0.17, and 0.0.16
    const versions = entries.map((e) => e.version);
    expect(versions).toContain('0.0.18');
    expect(versions).toContain('0.0.17');
    expect(versions).toContain('0.0.16');

    // Verify descending SemVer ordering
    for (let i = 0; i < entries.length - 1; i++) {
      const vCurrent = entries[i].version.split('.').map(Number);
      const vNext = entries[i + 1].version.split('.').map(Number);

      const isGreater =
        vCurrent[0] > vNext[0] ||
        (vCurrent[0] === vNext[0] && vCurrent[1] > vNext[1]) ||
        (vCurrent[0] === vNext[0] && vCurrent[1] === vNext[1] && vCurrent[2] > vNext[2]);

      expect(isGreater, `Version ${entries[i].version} must be greater than ${entries[i + 1].version}`).toBe(true);
    }

    // Verify valid standard section headers (Added, Fixed, Changed) for documented releases
    const expectedSections = ['### Added', '### Fixed', '### Changed'];
    for (const v of ['0.0.18', '0.0.17', '0.0.16']) {
      const sectionStart = changelogContent.indexOf(`## [${v}]`);
      expect(sectionStart).toBeGreaterThan(-1);

      const nextSectionStart = changelogContent.indexOf('## [', sectionStart + 10);
      const releaseBlock = changelogContent.substring(
        sectionStart,
        nextSectionStart !== -1 ? nextSectionStart : undefined
      );

      const hasValidSubheading = expectedSections.some((heading) => releaseBlock.includes(heading));
      expect(hasValidSubheading, `Release ${v} must contain standard Keep a Changelog subheadings`).toBe(true);

      // Verify list items exist in the release block
      expect(releaseBlock).toMatch(/- \*\*[^*]+\*\*:/);
    }
  });
});
