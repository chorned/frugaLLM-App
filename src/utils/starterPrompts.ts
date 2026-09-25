export type PlatformOS = 'macos' | 'windows' | 'linux';
export type CompanionTool = 'opencode' | 'hermes';

/**
 * Detects the host operating system at runtime.
 */
export function detectPlatformOS(): PlatformOS {
  if (typeof navigator !== 'undefined') {
    const platform = (navigator.platform || '').toLowerCase();
    const userAgent = (navigator.userAgent || '').toLowerCase();

    if (platform.includes('win') || userAgent.includes('windows')) {
      return 'windows';
    }
    if (platform.includes('linux') || userAgent.includes('linux') || platform.includes('x11')) {
      return 'linux';
    }
    if (platform.includes('mac') || userAgent.includes('macintosh') || userAgent.includes('mac os')) {
      return 'macos';
    }
  }
  return 'macos';
}

/**
 * Returns the platform-specific paste shortcut string.
 */
export function getPasteShortcut(os: PlatformOS = detectPlatformOS()): string {
  return os === 'macos' ? '⌘V' : 'Ctrl+V';
}

/**
 * Generates an optimized, actionable starter prompt for the specified companion tool and host OS.
 */
export function getStarterPrompt(tool: CompanionTool, os: PlatformOS = detectPlatformOS()): string {
  if (tool === 'opencode') {
    if (os === 'windows') {
      return "Scaffold index.html with a neon matrix canvas, launch via PowerShell (Start-Process python -ArgumentList '-m http.server 8001' -WindowStyle Hidden), and output http://localhost:8001.";
    }
    return 'Scaffold index.html with a neon matrix canvas, launch a detached background server (nohup python3 -m http.server 8001 >/dev/null 2>&1 &), and output http://localhost:8001.';
  }

  // Hermes
  if (os === 'windows') {
    return 'Run an Estate Clutter Audit non-destructively: Get-PSDrive C and clean file sort (Get-ChildItem $HOME\\Downloads -File -ErrorAction SilentlyContinue | Sort-Object Length -Descending | Select-Object -First 5).';
  }
  return 'Run an Estate Clutter Audit non-destructively: df -h / && ls -lhS ~/Downloads | head -n 6 (forbid clarify tool, skip ~/.Trash).';
}
