import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeActions } from '../hooks/useNodeActions';

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('Native Terminal CTAs Integration', () => {
  const defaultProps = {
    terminalMode: null,
    setTerminalMode: vi.fn(),
    setActiveProcesses: vi.fn(),
    setIsHermesInstalled: vi.fn(),
    setIsHermesManaged: vi.fn(),
    setIsOpenCodeInstalled: vi.fn(),
    setIsOpenCodeManaged: vi.fn(),
    setIsOllamaInstalled: vi.fn(),
    setIsOllamaManaged: vi.fn(),
    setIsToolGatewayInstalled: vi.fn(),
    setNodes: vi.fn(),
    frugalConfig: {
      port: 61721,
      api_password: 'test-password',
      hermes_workspace: '/Users/test/hermes-workspace',
      opencode_workspace: '/Users/test/opencode-workspace',
    },
    setFrugalConfig: vi.fn(),
    setPortConflict: vi.fn(),
    setSelectedNodeId: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it('launches Hermes in native terminal with hermes_workspace and proxy config', async () => {
    const { result } = renderHook(() => useNodeActions(defaultProps as any));

    await act(async () => {
      result.current.handleOpenHermes();
    });

    expect(mockInvoke).toHaveBeenCalledWith('launch_native_app_session', {
      appName: 'hermes',
      model: null,
      workspaceOverride: '/Users/test/hermes-workspace',
    });
    // Verifies in-app terminal was NOT opened
    expect(defaultProps.setTerminalMode).not.toHaveBeenCalledWith('run-hermes');
  });

  it('launches OpenCode in native terminal with opencode_workspace and proxy config', async () => {
    const { result } = renderHook(() => useNodeActions(defaultProps as any));

    await act(async () => {
      result.current.handleOpenOpenCode();
    });

    expect(mockInvoke).toHaveBeenCalledWith('launch_native_app_session', {
      appName: 'opencode',
      model: null,
      workspaceOverride: '/Users/test/opencode-workspace',
    });
    expect(defaultProps.setTerminalMode).not.toHaveBeenCalledWith('run-opencode');
  });

  it('launches Ollama in native terminal', async () => {
    const { result } = renderHook(() => useNodeActions(defaultProps as any));

    await act(async () => {
      result.current.handleOpenOllama();
    });

    expect(mockInvoke).toHaveBeenCalledWith('launch_native_app_session', {
      appName: 'ollama',
      model: null,
      workspaceOverride: null,
    });
    expect(defaultProps.setTerminalMode).not.toHaveBeenCalledWith('run-ollama');
  });

  it('preserves in-app terminal mode for all installer actions', () => {
    const { result } = renderHook(() => useNodeActions(defaultProps as any));

    act(() => {
      result.current.handleInitializeHermes();
    });
    expect(defaultProps.setTerminalMode).toHaveBeenCalledWith('install-hermes');

    act(() => {
      result.current.handleInitializeOpenCode();
    });
    expect(defaultProps.setTerminalMode).toHaveBeenCalledWith('install-opencode');

    act(() => {
      result.current.handleInitializeOllama();
    });
    expect(defaultProps.setTerminalMode).toHaveBeenCalledWith('install-ollama');

    act(() => {
      result.current.handleInstallToolGateway();
    });
    expect(defaultProps.setTerminalMode).toHaveBeenCalledWith('install-tool-gateway');

    act(() => {
      result.current.handleUninstallToolGateway();
    });
    expect(defaultProps.setTerminalMode).toHaveBeenCalledWith('uninstall-tool-gateway');
  });

  it('routes all uninstallation actions through the interactive in-app terminal view', () => {
    const { result } = renderHook(() => useNodeActions(defaultProps as any));

    act(() => {
      result.current.handleUninstallHermes();
    });
    expect(defaultProps.setTerminalMode).toHaveBeenCalledWith('uninstall-hermes');

    act(() => {
      result.current.handleUninstallOpenCode();
    });
    expect(defaultProps.setTerminalMode).toHaveBeenCalledWith('uninstall-opencode');

    act(() => {
      result.current.handleUninstallOllama();
    });
    expect(defaultProps.setTerminalMode).toHaveBeenCalledWith('uninstall-ollama');

    act(() => {
      result.current.handleUninstallToolGateway();
    });
    expect(defaultProps.setTerminalMode).toHaveBeenCalledWith('uninstall-tool-gateway');
  });
});
