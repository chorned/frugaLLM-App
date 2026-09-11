import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { isWindowsPlatform, TerminalView } from '../components/TerminalView';
import * as tauriService from '../services/tauri';

// Mock dependencies
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

let mockWriteln = vi.fn();
let mockWrite = vi.fn();

vi.mock('@xterm/xterm', () => {
  class Terminal {
    open = vi.fn();
    write = mockWrite;
    writeln = mockWriteln;
    dispose = vi.fn();
    loadAddon = vi.fn();
    onData = vi.fn().mockReturnValue({ dispose: vi.fn() });
    onResize = vi.fn();
  }
  return { Terminal };
});

vi.mock('@xterm/addon-fit', () => {
  class FitAddon {
    fit = vi.fn();
  }
  return { FitAddon };
});

if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  } as any;
}

const eventListeners: Record<string, Function[]> = {};

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockImplementation((event: string, callback: Function) => {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(callback);
    return Promise.resolve(() => {
      eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
    });
  }),
}));

vi.mock('../services/tauri', async () => {
  const actual = await vi.importActual<any>('../services/tauri');
  return {
    ...actual,
    spawnPty: vi.fn().mockResolvedValue(undefined),
    killPty: vi.fn().mockResolvedValue(undefined),
    resizePty: vi.fn().mockResolvedValue(undefined),
    writePty: vi.fn().mockResolvedValue(undefined),
    configureHermesDefaults: vi.fn().mockResolvedValue(undefined),
    configureOpencodeDefaults: vi.fn().mockResolvedValue(undefined),
    deployLocalModel: vi.fn().mockResolvedValue(undefined),
    getOllamaChatModel: vi.fn().mockResolvedValue('frugallm-active'),
  };
});

describe('TerminalView Windows Native Execution & Error Handling', () => {
  const originalPlatform = navigator.platform;
  const originalUserAgent = navigator.userAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteln = vi.fn();
    mockWrite = vi.fn();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'platform', { value: originalPlatform, configurable: true });
    Object.defineProperty(navigator, 'userAgent', { value: originalUserAgent, configurable: true });
  });

  it('isWindowsPlatform correctly identifies Windows vs non-Windows environments', () => {
    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', configurable: true });
    expect(isWindowsPlatform()).toBe(true);

    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', configurable: true });
    expect(isWindowsPlatform()).toBe(false);

    Object.defineProperty(navigator, 'platform', { value: 'Linux x86_64', configurable: true });
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (X11; Linux x86_64)', configurable: true });
    expect(isWindowsPlatform()).toBe(false);
  });

  it('spawns powershell.exe with opencode zip extraction script on Windows for install-opencode', async () => {
    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
    Object.defineProperty(navigator, 'userAgent', { value: 'Windows', configurable: true });

    render(
      <TerminalView
        mode="install-opencode"
        sessionId="test-session-opencode"
        onExit={vi.fn()}
        setIsHermesInstalled={vi.fn()}
        setIsOpenCodeInstalled={vi.fn()}
        setIsOllamaInstalled={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(tauriService.spawnPty).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session-opencode',
          command: 'powershell.exe',
          args: expect.arrayContaining([
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            expect.stringContaining('opencode-windows-x64.zip'),
          ]),
        })
      );
    });
  });

  it('spawns powershell.exe with install.ps1 on Windows for install-hermes', async () => {
    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
    Object.defineProperty(navigator, 'userAgent', { value: 'Windows', configurable: true });

    render(
      <TerminalView
        mode="install-hermes"
        sessionId="test-session-hermes"
        onExit={vi.fn()}
        setIsHermesInstalled={vi.fn()}
        setIsOpenCodeInstalled={vi.fn()}
        setIsOllamaInstalled={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(tauriService.spawnPty).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session-hermes',
          command: 'powershell.exe',
          args: expect.arrayContaining([
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            expect.stringContaining('install.ps1'),
          ]),
        })
      );
    });
  });

  it('spawns powershell.exe with environment variables on Windows for run-hermes', async () => {
    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
    Object.defineProperty(navigator, 'userAgent', { value: 'Windows', configurable: true });

    render(
      <TerminalView
        mode="run-hermes"
        sessionId="test-session-run-hermes"
        onExit={vi.fn()}
        setIsHermesInstalled={vi.fn()}
        setIsOpenCodeInstalled={vi.fn()}
        setIsOllamaInstalled={vi.fn()}
        frugalConfig={{ ip: '127.0.0.1', port: 61721, api_password: 'secret-password' }}
      />
    );

    await waitFor(() => {
      expect(tauriService.spawnPty).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session-run-hermes',
          command: 'powershell.exe',
          args: expect.arrayContaining([
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            expect.stringContaining('$env:OPENAI_API_BASE'),
          ]),
        })
      );
    });
  });

  it('catches spawnPty rejections gracefully and displays ANSI error in terminal instead of hanging', async () => {
    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
    Object.defineProperty(navigator, 'userAgent', { value: 'Windows', configurable: true });

    vi.mocked(tauriService.spawnPty).mockRejectedValueOnce(new Error('program not found: powershell.exe'));
    const onProcessExit = vi.fn();

    render(
      <TerminalView
        mode="install-opencode"
        sessionId="test-session-failure"
        onExit={vi.fn()}
        onProcessExit={onProcessExit}
        setIsHermesInstalled={vi.fn()}
        setIsOpenCodeInstalled={vi.fn()}
        setIsOllamaInstalled={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mockWriteln).toHaveBeenCalledWith(
        expect.stringContaining('Failed to launch process: program not found: powershell.exe')
      );
      expect(onProcessExit).toHaveBeenCalled();
    });
  });
});
