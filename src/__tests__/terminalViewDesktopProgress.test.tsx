import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TerminalView } from '../components/TerminalView';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

let mockWriteln = vi.fn();
let mockWrite = vi.fn();
let mockOnData = vi.fn().mockImplementation(() => ({ dispose: vi.fn() }));

vi.mock('@xterm/xterm', () => {
  class Terminal {
    open = vi.fn();
    write = mockWrite;
    writeln = mockWriteln;
    dispose = vi.fn();
    loadAddon = vi.fn();
    onData = (cb: any) => mockOnData(cb);
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
    getOllamaChatModel: vi.fn().mockResolvedValue('frugallm-active'),
  };
});

describe('TerminalView Desktop Build Alive & Progress Indicators', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockWriteln = vi.fn();
    mockWrite = vi.fn();
    for (const key of Object.keys(eventListeners)) {
      delete eventListeners[key];
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders alive badge, progress bar, initial advisory notice, and periodic heartbeats for run-hermes-desktop', async () => {
    const onExit = vi.fn();
    const onProcessStart = vi.fn();

    render(
      <TerminalView
        mode="run-hermes-desktop"
        sessionId="run-hermes-desktop"
        onExit={onExit}
        onProcessStart={onProcessStart}
        setIsHermesInstalled={vi.fn()}
        setIsOpenCodeInstalled={vi.fn()}
        setIsOllamaInstalled={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Verify initial advisory text written to terminal
    expect(mockWriteln).toHaveBeenCalledWith(
      expect.stringContaining('Initializing desktop build environment')
    );

    // Verify alive badge is present in header
    const aliveBadge = screen.getByTestId('terminal-alive-badge');
    expect(aliveBadge).toBeInTheDocument();
    expect(aliveBadge.textContent).toContain('Packaging App');

    // Verify progress bar is present
    const progressBar = screen.getByTestId('desktop-build-progress-bar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar.textContent).toContain('Bundling Application Assets...');

    // Advance time by 15 seconds to trigger first heartbeat
    await act(async () => {
      vi.advanceTimersByTime(15000);
    });

    expect(mockWriteln).toHaveBeenCalledWith(
      expect.stringContaining('[Hermes Builder]')
    );
    expect(screen.getByTestId('desktop-build-progress-bar').textContent).toContain('15s elapsed');

    // Advance time to 45 seconds (verifying chunk stage)
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    expect(screen.getByTestId('desktop-build-progress-bar').textContent).toContain('Verifying Module Chunks...');

    // Simulate completion output from PTY
    const outputListeners = eventListeners['pty_output'] || [];
    expect(outputListeners.length).toBeGreaterThan(0);

    await act(async () => {
      outputListeners.forEach(cb => cb({
        payload: {
          session_id: 'run-hermes-desktop',
          data: 'Packaging complete. Electron started successfully.'
        }
      }));
    });

    // Progress bar and alive badge should complete and disappear
    expect(screen.queryByTestId('desktop-build-progress-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('terminal-alive-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('terminal-status-badge')).toBeInTheDocument();
    expect(screen.getByTestId('terminal-status-badge').textContent).toContain('Active');

    // Terminal writes completion notice
    expect(mockWriteln).toHaveBeenCalledWith(
      expect.stringContaining('Hermes Desktop application launched successfully.')
    );
  });

  it('transitions alive badge to Completed when process exits via pty_exit', async () => {
    const onExit = vi.fn();
    const onProcessExit = vi.fn();

    render(
      <TerminalView
        mode="run-hermes-desktop"
        sessionId="run-hermes-desktop-exit"
        onExit={onExit}
        onProcessExit={onProcessExit}
        setIsHermesInstalled={vi.fn()}
        setIsOpenCodeInstalled={vi.fn()}
        setIsOllamaInstalled={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('terminal-alive-badge')).toBeInTheDocument();

    // Trigger process exit event
    const exitListeners = eventListeners['pty_exit'] || [];
    expect(exitListeners.length).toBeGreaterThan(0);

    await act(async () => {
      exitListeners.forEach(cb => cb({
        payload: {
          session_id: 'run-hermes-desktop-exit',
          exit_code: 0
        }
      }));
    });

    expect(onProcessExit).toHaveBeenCalled();
    expect(screen.queryByTestId('desktop-build-progress-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('terminal-alive-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('terminal-status-badge').textContent).toContain('Completed');
  });
});
