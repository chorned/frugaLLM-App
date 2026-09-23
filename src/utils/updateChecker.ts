import semver from 'semver';
import { getVersion } from '@tauri-apps/api/app';
export interface UpdateCheckResult {
  hasUpdate: boolean;
  latestVersion: string | null;
  currentVersion: string | null;
  htmlUrl: string | null;
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
