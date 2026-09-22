import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

export interface BuildCredentials {
  openrouterKey?: string;
  googleKey?: string;
}

/**
 * Loads credentials from local .env.build if present, falling back to process.env.
 * Sanitizes and trims values without logging or exposing secrets.
 */
export function getBuildCredentials(): BuildCredentials {
  const envMap: Record<string, string> = {};
  const envPath = path.resolve(projectRoot, '.env.build');

  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
          envMap[k] = v;
        }
      }
    } catch (err) {
      console.warn('[EnvLoader] Failed to read .env.build:', err);
    }
  }

  const openrouterKey =
    process.env.OPENROUTER_API_KEY ||
    envMap.OPENROUTER_API_KEY ||
    process.env.OPENROUTER_KEY ||
    envMap.OPENROUTER_KEY;

  const googleKey =
    process.env.GOOGLE_API_KEY ||
    envMap.GOOGLE_API_KEY ||
    process.env.AI_STUDIO_KEY ||
    envMap.AI_STUDIO_KEY ||
    process.env.GEMINI_API_KEY ||
    envMap.GEMINI_API_KEY;

  return { openrouterKey, googleKey };
}
