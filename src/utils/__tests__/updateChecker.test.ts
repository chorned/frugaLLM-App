import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkForAppUpdates, isMockUpdateMode } from '../updateChecker';

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';

describe('updateChecker utility', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue(false);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('detects an update when GitHub release version is higher than local version', async () => {
    vi.mocked(getVersion).mockResolvedValue('0.0.9');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: 'v0.1.0',
        html_url: 'https://github.com/chorned/frugaLLM-App/releases/tag/v0.1.0',
      }),
    } as any);

    const result = await checkForAppUpdates('chorned', 'frugaLLM-App');

    expect(result).toEqual({
      hasUpdate: true,
      latestVersion: '0.1.0',
      currentVersion: '0.0.9',
      htmlUrl: 'https://github.com/chorned/frugaLLM-App/releases/tag/v0.1.0',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/chorned/frugaLLM-App/releases/latest',
      expect.any(Object)
    );
  });

  it('returns hasUpdate: false when local version is up to date', async () => {
    vi.mocked(getVersion).mockResolvedValue('0.1.0');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: 'v0.1.0',
        html_url: 'https://github.com/chorned/frugaLLM-App/releases/tag/v0.1.0',
      }),
    } as any);

    const result = await checkForAppUpdates('chorned', 'frugaLLM-App');

    expect(result).toEqual({
      hasUpdate: false,
      latestVersion: '0.1.0',
      currentVersion: '0.1.0',
      htmlUrl: 'https://github.com/chorned/frugaLLM-App/releases/tag/v0.1.0',
    });
  });

  it('returns hasUpdate: false when local version is newer than latest release', async () => {
    vi.mocked(getVersion).mockResolvedValue('0.2.0');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: 'v0.1.0',
        html_url: 'https://github.com/chorned/frugaLLM-App/releases/tag/v0.1.0',
      }),
    } as any);

    const result = await checkForAppUpdates('chorned', 'frugaLLM-App');

    expect(result).toEqual({
      hasUpdate: false,
      latestVersion: '0.1.0',
      currentVersion: '0.2.0',
      htmlUrl: 'https://github.com/chorned/frugaLLM-App/releases/tag/v0.1.0',
    });
  });

  it('handles network fetch rejection gracefully without throwing', async () => {
    vi.mocked(getVersion).mockResolvedValue('0.0.9');
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch / network offline'));

    const result = await checkForAppUpdates('chorned', 'frugaLLM-App');

    expect(result).toEqual({
      hasUpdate: false,
      latestVersion: null,
      currentVersion: '0.0.9',
      htmlUrl: null,
    });
  });

  it('handles non-200 HTTP responses gracefully', async () => {
    vi.mocked(getVersion).mockResolvedValue('0.0.9');
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not Found' }),
    } as any);

    const result = await checkForAppUpdates('chorned', 'frugaLLM-App');

    expect(result).toEqual({
      hasUpdate: false,
      latestVersion: null,
      currentVersion: '0.0.9',
      htmlUrl: null,
    });
  });

  it('handles malformed tag names safely without throwing', async () => {
    vi.mocked(getVersion).mockResolvedValue('0.0.9');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: 'not-a-valid-semver',
        html_url: 'https://github.com/chorned/frugaLLM-App/releases/tag/invalid',
      }),
    } as any);

    const result = await checkForAppUpdates('chorned', 'frugaLLM-App');

    expect(result).toEqual({
      hasUpdate: false,
      latestVersion: null,
      currentVersion: '0.0.9',
      htmlUrl: null,
    });
  });

  it('handles getVersion IPC failure gracefully and falls back to package or null version', async () => {
    vi.mocked(getVersion).mockRejectedValue(new Error('IPC unavailable'));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: 'v1.0.0',
        html_url: 'https://github.com/chorned/frugaLLM-App/releases/tag/v1.0.0',
      }),
    } as any);

    const result = await checkForAppUpdates('chorned', 'frugaLLM-App');

    expect(result).toBeDefined();
    expect(result.hasUpdate).toBe(false);
  });

  it('returns mock update when --mockUpdate CLI startup argument is active via is_mock_update_mode', async () => {
    vi.mocked(getVersion).mockResolvedValue('0.0.9');
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === 'is_mock_update_mode') return Promise.resolve(true);
      return Promise.resolve(false);
    });

    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const result = await checkForAppUpdates('chorned', 'frugaLLM-App');

    expect(result.hasUpdate).toBe(true);
    expect(result.latestVersion).toBe('0.1.0');
    expect(result.currentVersion).toBe('0.0.9');
    expect(result.htmlUrl).toBe('https://github.com/chorned/frugaLLM-App/releases/latest');
    // In mock mode, external GitHub API is bypassed
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('detects mock update mode via URL search parameters in web environments', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...originalLocation, search: '?mockUpdate=true' },
    });

    expect(await isMockUpdateMode()).toBe(true);

    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: originalLocation,
    });
  });
});
