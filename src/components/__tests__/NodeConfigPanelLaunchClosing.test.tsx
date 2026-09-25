import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NodeConfigPanel } from '../NodeConfigPanel';
import { MemoryProvider } from '../../context/MemoryContext';

vi.mock('@tauri-apps/plugin-autostart', () => ({
  enable: vi.fn(),
  disable: vi.fn(),
  isEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/tauri', () => ({
  editHermesSoul: vi.fn(),
  setFrugallmConfig: vi.fn().mockResolvedValue(undefined),
  getModelTagForVram: vi.fn().mockResolvedValue('gemma4:12b'),
}));

describe('NodeConfigPanel - Auto-closing node on launch actions', () => {
  const createDefaultProps = (nodeId: string, nodeLabel: string) => ({
    node: { id: nodeId, data: { label: nodeLabel, status: 'ready' } },
    onClose: vi.fn(),
    onSave: vi.fn(),
    isHermesInstalled: true,
    isHermesManaged: false,
    isOpenCodeInstalled: true,
    isOpenCodeManaged: false,
    isOllamaInstalled: false,
    isOllamaManaged: false,
    isToolGatewayInstalled: false,
    detectedVram: 16,
    setDetectedVram: vi.fn(),
    hasActiveBackend: true,
    handleInitializeHermes: vi.fn(),
    handleOpenHermes: vi.fn(),
    handleUninstallHermes: vi.fn(),
    handleInitializeOpenCode: vi.fn(),
    handleOpenOpenCode: vi.fn(),
    handleUninstallOpenCode: vi.fn(),
    handleInitializeOllama: vi.fn(),
    handleOpenOllama: vi.fn(),
    handleUninstallOllama: vi.fn(),
    handleInstallToolGateway: vi.fn(),
    handleUninstallToolGateway: vi.fn(),
    handleDisconnectOpenRouter: vi.fn(),
    handleDisconnectGoogle: vi.fn(),
    frugalConfig: {},
    handleOpenHermesGateway: vi.fn(),
    handleOpenHermesDesktop: vi.fn(),
    handleOpenHermesWeb: vi.fn(),
    handleOpenOpenCodeWeb: vi.fn(),
    activeProcesses: {
      'run-hermes-gateway': true,
      'hermes-gateway': true,
    },
    handleKillProcess: vi.fn(),
    setFrugalConfig: vi.fn(),
    latestTelemetry: null,
    hardwareProfile: null,
    portConflict: null,
  });

  it('triggers handleOpenHermes and closes node when clicking LAUNCH HERMES', () => {
    const props = createDefaultProps('node-hermes', 'Hermes');
    render(
      <MemoryProvider>
        <NodeConfigPanel {...props} />
      </MemoryProvider>
    );

    const launchCliBtn = screen.getByRole('button', { name: /LAUNCH HERMES/i });
    expect(launchCliBtn).toBeInTheDocument();

    act(() => {
      fireEvent.click(launchCliBtn);
    });

    expect(props.handleOpenHermes).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers handleOpenHermesDesktop and closes node when clicking LAUNCH APP for Hermes', () => {
    const props = createDefaultProps('node-hermes', 'Hermes');
    render(
      <MemoryProvider>
        <NodeConfigPanel {...props} />
      </MemoryProvider>
    );

    const launchAppBtn = screen.getByRole('button', { name: /LAUNCH APP/i });
    expect(launchAppBtn).toBeInTheDocument();

    act(() => {
      fireEvent.click(launchAppBtn);
    });

    expect(props.handleOpenHermesDesktop).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers handleOpenHermesWeb and closes node when clicking LAUNCH WEBUI for Hermes', () => {
    const props = createDefaultProps('node-hermes', 'Hermes');
    render(
      <MemoryProvider>
        <NodeConfigPanel {...props} />
      </MemoryProvider>
    );

    const launchWebBtn = screen.getByRole('button', { name: /LAUNCH WEBUI/i });
    expect(launchWebBtn).toBeInTheDocument();

    act(() => {
      fireEvent.click(launchWebBtn);
    });

    expect(props.handleOpenHermesWeb).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers handleOpenOpenCode and closes node when clicking LAUNCH OPENCODE', () => {
    const props = createDefaultProps('node-opencode', 'OpenCode');
    render(
      <MemoryProvider>
        <NodeConfigPanel {...props} />
      </MemoryProvider>
    );

    const launchCliBtn = screen.getByRole('button', { name: /LAUNCH OPENCODE/i });
    expect(launchCliBtn).toBeInTheDocument();

    act(() => {
      fireEvent.click(launchCliBtn);
    });

    expect(props.handleOpenOpenCode).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers handleOpenOpenCodeWeb and closes node when clicking LAUNCH WEBUI for OpenCode', () => {
    const props = createDefaultProps('node-opencode', 'OpenCode');
    render(
      <MemoryProvider>
        <NodeConfigPanel {...props} />
      </MemoryProvider>
    );

    const launchWebBtn = screen.getByRole('button', { name: /LAUNCH WEBUI/i });
    expect(launchWebBtn).toBeInTheDocument();

    act(() => {
      fireEvent.click(launchWebBtn);
    });

    expect(props.handleOpenOpenCodeWeb).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
