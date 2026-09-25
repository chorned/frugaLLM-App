import { describe, it, expect, afterEach } from 'vitest';
import {
  detectPlatformOS,
  getPasteShortcut,
  getStarterPrompt,
} from '../starterPrompts';

describe('starterPrompts utility', () => {
  const originalPlatform = navigator.platform;
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });

  describe('detectPlatformOS', () => {
    it('detects Windows when navigator.platform is Win32', () => {
      Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
      expect(detectPlatformOS()).toBe('windows');
    });

    it('detects Windows when userAgent contains windows', () => {
      Object.defineProperty(navigator, 'platform', { value: '', configurable: true });
      Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', configurable: true });
      expect(detectPlatformOS()).toBe('windows');
    });

    it('detects macOS when navigator.platform is MacIntel', () => {
      Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
      expect(detectPlatformOS()).toBe('macos');
    });

    it('detects Linux when navigator.platform is Linux x86_64', () => {
      Object.defineProperty(navigator, 'platform', { value: 'Linux x86_64', configurable: true });
      expect(detectPlatformOS()).toBe('linux');
    });

    it('defaults to macos if platform cannot be determined', () => {
      Object.defineProperty(navigator, 'platform', { value: '', configurable: true });
      Object.defineProperty(navigator, 'userAgent', { value: '', configurable: true });
      expect(detectPlatformOS()).toBe('macos');
    });
  });

  describe('getPasteShortcut', () => {
    it('returns ⌘V for macOS', () => {
      expect(getPasteShortcut('macos')).toBe('⌘V');
    });

    it('returns Ctrl+V for Windows', () => {
      expect(getPasteShortcut('windows')).toBe('Ctrl+V');
    });

    it('returns Ctrl+V for Linux', () => {
      expect(getPasteShortcut('linux')).toBe('Ctrl+V');
    });
  });

  describe('getStarterPrompt', () => {
    it('returns macOS/Linux command for OpenCode on macOS', () => {
      const prompt = getStarterPrompt('opencode', 'macos');
      expect(prompt).toContain('index.html');
      expect(prompt).toContain('neon matrix canvas');
      expect(prompt).toContain('nohup python3 -m http.server 8001 >/dev/null 2>&1 &');
      expect(prompt).toContain('http://localhost:8001');
    });

    it('returns macOS/Linux command for OpenCode on Linux', () => {
      const prompt = getStarterPrompt('opencode', 'linux');
      expect(prompt).toContain('index.html');
      expect(prompt).toContain('nohup python3 -m http.server 8001 >/dev/null 2>&1 &');
      expect(prompt).toContain('http://localhost:8001');
    });

    it('returns PowerShell command for OpenCode on Windows', () => {
      const prompt = getStarterPrompt('opencode', 'windows');
      expect(prompt).toContain('index.html');
      expect(prompt).toContain("Start-Process python -ArgumentList '-m http.server 8001' -WindowStyle Hidden");
      expect(prompt).toContain('http://localhost:8001');
    });

    it('returns non-destructive estate clutter audit for Hermes on macOS', () => {
      const prompt = getStarterPrompt('hermes', 'macos');
      expect(prompt).toContain('Estate Clutter Audit non-destructively');
      expect(prompt).toContain('df -h / && ls -lhS ~/Downloads | head -n 6');
      expect(prompt).toContain('forbid clarify tool, skip ~/.Trash');
    });

    it('returns non-destructive estate clutter audit for Hermes on Linux', () => {
      const prompt = getStarterPrompt('hermes', 'linux');
      expect(prompt).toContain('df -h / && ls -lhS ~/Downloads | head -n 6');
      expect(prompt).toContain('forbid clarify tool, skip ~/.Trash');
    });

    it('returns PowerShell disk check and clean file sort for Hermes on Windows', () => {
      const prompt = getStarterPrompt('hermes', 'windows');
      expect(prompt).toContain('Estate Clutter Audit non-destructively');
      expect(prompt).toContain('Get-PSDrive C');
      expect(prompt).toContain('Get-ChildItem $HOME\\Downloads -File -ErrorAction SilentlyContinue | Sort-Object Length -Descending | Select-Object -First 5');
    });
  });
});
