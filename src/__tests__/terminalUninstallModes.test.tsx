import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TerminalView } from '../components/TerminalView';
import * as tauriService from '../services/tauri';

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

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock('../services/tauri', async () => {
  const actual = await vi.importActual<any>('../services/tauri');
  return {
    ...actual,
    spawnPty: vi.fn().mockResolvedValue(undefined),
    killPty: vi.fn().mockResolvedValue(undefined),
    resizePty: vi.fn().mockResolvedValue(undefined),
    writePty: vi.fn().mockResolvedValue(undefined),
    uninstallHermes: vi.fn().mockResolvedValue(undefined),
    uninstallOpenCode: vi.fn().mockResolvedValue(undefined),
    uninstallOllama: vi.fn().mockResolvedValue(undefined),
    deleteLocalModel: vi.fn().mockResolvedValue(undefined),
    refreshRoutingChain: vi.fn().mockResolvedValue(undefined),
  };
});

describe('TerminalView Uninstall Modes', () => {
  const baseProps = {
    sessionId: 'test-uninstall',
    onExit: vi.fn(),
    setIsHermesInstalled: vi.fn(),
    setIsHermesManaged: vi.fn(),
    setIsOpenCodeInstalled: vi.fn(),
    setIsOpenCodeManaged: vi.fn(),
    setIsOllamaInstalled: vi.fn(),
    setIsOllamaManaged: vi.fn(),
    setNodes: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes Hermes uninstallation with staged logs and updates installation status', async () => {
    render(<TerminalView {...baseProps} mode="uninstall-hermes" />);

    expect(screen.getByRole('heading', { name: /Uninstall Hermes Agent/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(tauriService.uninstallHermes).toHaveBeenCalledTimes(1);
    });

    expect(baseProps.setIsHermesInstalled).toHaveBeenCalledWith(false);
    expect(baseProps.setIsHermesManaged).toHaveBeenCalledWith(false);
    expect(mockWriteln).toHaveBeenCalledWith(expect.stringContaining('Initiating complete uninstallation of Hermes Agent'));
  });

  it('executes OpenCode uninstallation with staged logs and updates installation status', async () => {
    render(<TerminalView {...baseProps} mode="uninstall-opencode" />);

    expect(screen.getByRole('heading', { name: /Uninstall OpenCode Agent/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(tauriService.uninstallOpenCode).toHaveBeenCalledTimes(1);
    });

    expect(baseProps.setIsOpenCodeInstalled).toHaveBeenCalledWith(false);
    expect(baseProps.setIsOpenCodeManaged).toHaveBeenCalledWith(false);
    expect(mockWriteln).toHaveBeenCalledWith(expect.stringContaining('Initiating complete uninstallation of OpenCode'));
  });

  it('executes Ollama uninstallation, deletes local model, and resets node status', async () => {
    render(<TerminalView {...baseProps} mode="uninstall-ollama" />);

    expect(screen.getByRole('heading', { name: /Uninstall Ollama Engine/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(tauriService.deleteLocalModel).toHaveBeenCalledTimes(1);
      expect(tauriService.uninstallOllama).toHaveBeenCalledTimes(1);
    });

    expect(baseProps.setIsOllamaInstalled).toHaveBeenCalledWith(false);
    expect(baseProps.setIsOllamaManaged).toHaveBeenCalledWith(false);
    expect(baseProps.setNodes).toHaveBeenCalled();
    expect(mockWriteln).toHaveBeenCalledWith(expect.stringContaining('Initiating complete uninstallation of Ollama Engine'));
  });
});
