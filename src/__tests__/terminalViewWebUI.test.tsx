import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
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
    deployLocalModel: vi.fn().mockResolvedValue(undefined),
    getOllamaChatModel: vi.fn().mockResolvedValue('frugallm-active'),
  };
});

describe('CHO-138: Auto-close terminal view after WebUI launch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteln = vi.fn();
    mockWrite = vi.fn();
    for (const key of Object.keys(eventListeners)) {
      delete eventListeners[key];
    }
  });

  it('automatically calls onExit when Hermes WebUI confirms launch output', async () => {
    const onExit = vi.fn();
    const onProcessStart = vi.fn();

    render(
      <TerminalView
        mode="run-hermes-web"
        sessionId="run-hermes-web"
        onExit={onExit}
        onProcessStart={onProcessStart}
        setIsHermesInstalled={vi.fn()}
        setIsOpenCodeInstalled={vi.fn()}
        setIsOllamaInstalled={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(onProcessStart).toHaveBeenCalled();
    });

    // Simulate PTY output indicating Hermes dashboard has started
    const listeners = eventListeners['pty_output'] || [];
    expect(listeners.length).toBeGreaterThan(0);

    for (const listener of listeners) {
      listener({
        payload: {
          session_id: 'run-hermes-web',
          data: 'Hermes dashboard running at http://127.0.0.1:8000\n',
        },
      });
    }

    await waitFor(() => {
      expect(onExit).toHaveBeenCalled();
    }, { timeout: 3500 });
  });

  it('automatically calls onExit when OpenCode WebUI confirms launch output', async () => {
    const onExit = vi.fn();
    const onProcessStart = vi.fn();

    render(
      <TerminalView
        mode="run-opencode-web"
        sessionId="run-opencode-web"
        onExit={onExit}
        onProcessStart={onProcessStart}
        setIsHermesInstalled={vi.fn()}
        setIsOpenCodeInstalled={vi.fn()}
        setIsOllamaInstalled={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(onProcessStart).toHaveBeenCalled();
    });

    const listeners = eventListeners['pty_output'] || [];
    expect(listeners.length).toBeGreaterThan(0);

    for (const listener of listeners) {
      listener({
        payload: {
          session_id: 'run-opencode-web',
          data: 'OpenCode server listening on http://127.0.0.1:4096\n',
        },
      });
    }

    await waitFor(() => {
      expect(onExit).toHaveBeenCalled();
    }, { timeout: 3500 });
  });
});
