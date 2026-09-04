import semver from 'semver';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  latestVersion: string | null;
  currentVersion: string | null;
  htmlUrl: string | null;
}

/**
 * Checks if mock update mode is active via `--mockUpdate`/`--mock-update` CLI argument
 * (via Tauri IPC `is_mock_update_mode`), or query parameter `?mockUpdate=true` in web environments.
 */
export async function isMockUpdateMode(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.location?.search) {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('mockUpdate') === 'true' ||
      params.has('mockUpdate') ||
      params.get('mock-update') === 'true' ||
      params.has('mock-update')
    ) {
      return true;
    }
  }

  if (import.meta.env?.VITE_MOCK_UPDATE === 'true' || import.meta.env?.VITE_MOCK_UPDATE === '1') {
    return true;
  }

  try {
    const isMock = await invoke<boolean>('is_mock_update_mode');
    if (typeof isMock === 'boolean') {
      return isMock;
    }
  } catch {
    // IPC offline or running in standard browser/test environment
  }

  return false;
}

/**
 * Checks public GitHub releases for application updates.
 *
 * @param owner GitHub repository owner (e.g. 'chorned')
 * @param repo GitHub repository name (e.g. 'frugaLLM-App')
 * @returns UpdateCheckResult with status and metadata
 */
export async function checkForAppUpdates(
  owner = 'chorned',
  repo = 'frugaLLM-App'
): Promise<UpdateCheckResult> {
  let currentVersion: string | null = null;

  try {
    currentVersion = await getVersion();
  } catch (error) {
    console.warn('[updateChecker] Unable to resolve local app version via Tauri IPC:', error);
  }

  const effectiveCurrent = currentVersion || '0.0.9';

  // Check if mock update mode was passed via CLI flags or URL query
  if (await isMockUpdateMode()) {
    const cleanCurrent = semver.clean(effectiveCurrent) || semver.valid(semver.coerce(effectiveCurrent)) || '0.0.9';
    const mockLatest = semver.inc(cleanCurrent, 'minor') || '1.0.0';
    return {
      hasUpdate: true,
      latestVersion: mockLatest,
      currentVersion: cleanCurrent,
      htmlUrl: `https://github.com/${owner}/${repo}/releases/latest`,
    };
  }

  const fallbackResult: UpdateCheckResult = {
    hasUpdate: false,
    latestVersion: null,
    currentVersion,
    htmlUrl: null,
  };

  if (!currentVersion) {
    return fallbackResult;
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      console.warn(`[updateChecker] GitHub release fetch returned status ${response.status}`);
      return fallbackResult;
    }

    const data = await response.json();
    const rawTag = data?.tag_name;
    const htmlUrl = typeof data?.html_url === 'string' ? data.html_url : null;

    if (!rawTag || typeof rawTag !== 'string') {
      return fallbackResult;
    }

    const cleanReleaseVersion = semver.clean(rawTag) || semver.valid(semver.coerce(rawTag));
    const cleanCurrentVersion = semver.clean(currentVersion) || semver.valid(semver.coerce(currentVersion));

    if (!cleanReleaseVersion || !cleanCurrentVersion) {
      console.warn('[updateChecker] Could not parse semver tags:', { rawTag, currentVersion });
      return fallbackResult;
    }

    const hasUpdate = semver.gt(cleanReleaseVersion, cleanCurrentVersion);

    return {
      hasUpdate,
      latestVersion: cleanReleaseVersion,
      currentVersion: cleanCurrentVersion,
      htmlUrl,
    };
  } catch (error) {
    console.warn('[updateChecker] Network or parsing error checking updates:', error);
    return fallbackResult;
  }
}
