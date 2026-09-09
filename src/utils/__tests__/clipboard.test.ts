import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copyToClipboard, formatApiBaseUrl } from '../clipboard';

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn(),
}));

import { writeText } from '@tauri-apps/plugin-clipboard-manager';

describe('clipboard utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatApiBaseUrl', () => {
    it('formats default loopback address with /v1 suffix (Option A)', () => {
      const url = formatApiBaseUrl({ ip: '127.0.0.1', port: 61721, bind_all_interfaces: false });
      expect(url).toBe('http://127.0.0.1:61721/v1');
    });

    it('formats bind_all_interfaces as 0.0.0.0 with /v1 suffix', () => {
      const url = formatApiBaseUrl({ ip: '127.0.0.1', port: 61721, bind_all_interfaces: true });
      expect(url).toBe('http://0.0.0.0:61721/v1');
    });

    it('handles custom port and custom IP', () => {
      const url = formatApiBaseUrl({ ip: '192.168.1.100', port: 8080, bind_all_interfaces: false });
      expect(url).toBe('http://192.168.1.100:8080/v1');
    });
  });

  describe('copyToClipboard', () => {
    it('uses Tauri writeText when successful', async () => {
      vi.mocked(writeText).mockResolvedValue(undefined);

      const success = await copyToClipboard('http://127.0.0.1:61721/v1');
      expect(success).toBe(true);
      expect(writeText).toHaveBeenCalledWith('http://127.0.0.1:61721/v1');
    });

    it('falls back to navigator.clipboard.writeText if Tauri writeText fails', async () => {
      vi.mocked(writeText).mockRejectedValue(new Error('Tauri clipboard unavailable'));

      const mockNavigatorWrite = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: mockNavigatorWrite,
        },
      });

      const success = await copyToClipboard('http://127.0.0.1:61721/v1');
      expect(success).toBe(true);
      expect(mockNavigatorWrite).toHaveBeenCalledWith('http://127.0.0.1:61721/v1');
    });

    it('returns false gracefully when both Tauri and navigator.clipboard fail', async () => {
      vi.mocked(writeText).mockRejectedValue(new Error('Tauri failed'));

      const mockNavigatorWrite = vi.fn().mockRejectedValue(new Error('Browser blocked'));
      Object.assign(navigator, {
        clipboard: {
          writeText: mockNavigatorWrite,
        },
      });

      const success = await copyToClipboard('test');
      expect(success).toBe(false);
    });
  });
});
