import { writeText } from '@tauri-apps/plugin-clipboard-manager';

export interface ApiEndpointOptions {
  ip?: string;
  port?: number | string;
  bind_all_interfaces?: boolean;
}

/**
 * Formats the canonical OpenAI-compatible API base URL (Option A: http://<ip>:<port>/v1).
 */
export function formatApiBaseUrl(options: ApiEndpointOptions): string {
  const host = options.bind_all_interfaces ? '0.0.0.0' : (options.ip || '127.0.0.1');
  const port = options.port || 61721;
  return `http://${host}:${port}/v1`;
}

/**
 * Robust cross-platform clipboard copy with fallback to browser navigator.clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await writeText(text);
    return true;
  } catch (err) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (browserErr) {
        console.warn('[clipboard] Browser fallback failed:', browserErr);
      }
    }
    console.warn('[clipboard] Tauri writeText failed:', err);
    return false;
  }
}
