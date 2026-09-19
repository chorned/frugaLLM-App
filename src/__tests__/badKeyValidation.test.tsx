import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NodeConfigPanel } from '../components/NodeConfigPanel';
import { MemoryProvider } from '../context/MemoryContext';
import en from '../locales/en.json';

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  Store: {
    load: vi.fn().mockResolvedValue({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock('@tauri-apps/plugin-autostart', () => ({
  enable: vi.fn().mockResolvedValue(undefined),
  disable: vi.fn().mockResolvedValue(undefined),
  isEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock('../services/tauri', () => ({
  getModelTagForVram: vi.fn().mockResolvedValue('gemma4:12b'),
  setCredential: vi.fn().mockResolvedValue(undefined),
  deleteCredential: vi.fn().mockResolvedValue(undefined),
  refreshRoutingChain: vi.fn().mockResolvedValue(undefined),
}));

describe('Bad API Key Validation & Error Messaging in NodeConfigPanel', () => {
  const defaultProps = {
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue({ ok: true }),
    onOpenIssueReporter: vi.fn(),
    isHermesInstalled: true,
    isHermesManaged: false,
    isOpenCodeInstalled: true,
    isOpenCodeManaged: false,
    isOllamaInstalled: true,
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
    frugalConfig: { port: 61721 },
    handleOpenHermesGateway: vi.fn(),
    handleOpenHermesDesktop: vi.fn(),
    handleOpenHermesWeb: vi.fn(),
    handleOpenOpenCodeWeb: vi.fn(),
    activeProcesses: {},
    handleKillProcess: vi.fn(),
    setFrugalConfig: vi.fn(),
    latestTelemetry: null,
    hardwareProfile: null,
    portConflict: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays a mismatch error when user inputs an OpenRouter key into Google AI Studio node', async () => {
    const googleNode = {
      id: 'node-google',
      data: {
        label: 'Google AI Studio',
        status: 'ready',
        keyPrefix: null,
        lastStatus: null,
      },
    };

    render(
      <MemoryProvider>
        <NodeConfigPanel {...defaultProps} node={googleNode} />
      </MemoryProvider>
    );

    const input = screen.getByPlaceholderText(en.routingGraph.nodeConfigPanel.inputs.googleApiKey.placeholder);
    fireEvent.change(input, { target: { value: 'sk-or-v1-invalid-openrouter-key' } });

    const saveBtn = screen.getByTestId('save-node-config-button');
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const errorBanner = screen.getByTestId('node-google-key-error');
      expect(errorBanner).toBeInTheDocument();
      expect(errorBanner).toHaveTextContent(en.routingGraph.nodeConfigPanel.inputs.googleApiKey.errorMismatched);
    });

    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('displays a mismatch error when user inputs a Google key into OpenRouter node', async () => {
    const openrouterNode = {
      id: 'node-openrouter',
      data: {
        label: 'OpenRouter',
        status: 'ready',
        keyPrefix: null,
        lastStatus: null,
      },
    };

    render(
      <MemoryProvider>
        <NodeConfigPanel {...defaultProps} node={openrouterNode} />
      </MemoryProvider>
    );

    const input = screen.getByPlaceholderText(en.routingGraph.nodeConfigPanel.inputs.openRouterApiKey.placeholder);
    fireEvent.change(input, { target: { value: 'AIzaSyFakeGoogleKey' } });

    const saveBtn = screen.getByTestId('save-node-config-button');
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const errorBanner = screen.getByTestId('node-openrouter-key-error');
      expect(errorBanner).toBeInTheDocument();
      expect(errorBanner).toHaveTextContent(en.routingGraph.nodeConfigPanel.inputs.openRouterApiKey.errorMismatched);
    });

    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('displays verification error banner when onSave reports HTTP 400 bad key', async () => {
    const mockOnSave = vi.fn().mockResolvedValue({
      ok: false,
      error: 'Key verification failed (HTTP 400). Please check that your key is valid and active.',
    });

    const googleNode = {
      id: 'node-google',
      data: {
        label: 'Google AI Studio',
        status: 'ready',
        keyPrefix: null,
        lastStatus: null,
      },
    };

    render(
      <MemoryProvider>
        <NodeConfigPanel {...defaultProps} onSave={mockOnSave} node={googleNode} />
      </MemoryProvider>
    );

    const input = screen.getByPlaceholderText(en.routingGraph.nodeConfigPanel.inputs.googleApiKey.placeholder);
    fireEvent.change(input, { target: { value: 'AIzaSyBadKeyReturning400' } });

    const saveBtn = screen.getByTestId('save-node-config-button');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const errorBanner = screen.getByTestId('node-google-key-error');
      expect(errorBanner).toBeInTheDocument();
      expect(errorBanner).toHaveTextContent('Key verification failed (HTTP 400)');
    });
  });

  it('clears error banner when user begins typing again', async () => {
    const googleNode = {
      id: 'node-google',
      data: {
        label: 'Google AI Studio',
        status: 'ready',
        keyPrefix: null,
        lastStatus: null,
      },
    };

    render(
      <MemoryProvider>
        <NodeConfigPanel {...defaultProps} node={googleNode} />
      </MemoryProvider>
    );

    const input = screen.getByPlaceholderText(en.routingGraph.nodeConfigPanel.inputs.googleApiKey.placeholder);
    fireEvent.change(input, { target: { value: 'sk-or-mismatched' } });

    const saveBtn = screen.getByTestId('save-node-config-button');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByTestId('node-google-key-error')).toBeInTheDocument();
    });

    // User types new character
    fireEvent.change(input, { target: { value: 'AIzaSyCorrectPrefix' } });

    await waitFor(() => {
      expect(screen.queryByTestId('node-google-key-error')).not.toBeInTheDocument();
    });
  });

  it('renders persistent error status banner if node has non-200 lastStatus', () => {
    const googleNode = {
      id: 'node-google',
      data: {
        label: 'Google AI Studio',
        status: 'error',
        keyPrefix: 'AIzaS',
        lastStatus: '403',
      },
    };

    render(
      <MemoryProvider>
        <NodeConfigPanel {...defaultProps} node={googleNode} />
      </MemoryProvider>
    );

    const errorBanner = screen.getByTestId('node-google-key-error');
    expect(errorBanner).toBeInTheDocument();
    expect(errorBanner).toHaveTextContent('Key verification failed (HTTP 403)');
  });

  it('does not switch into disconnect state when entering a bad key on an unconfigured node', async () => {
    const mockOnSave = vi.fn().mockResolvedValue({
      ok: false,
      error: 'Key verification failed (HTTP 401). Please check that your key is valid and active.',
    });

    const openrouterNode = {
      id: 'node-openrouter',
      data: {
        label: 'OpenRouter',
        status: 'needs_activation',
        keyPrefix: null,
        lastStatus: null,
      },
    };

    render(
      <MemoryProvider>
        <NodeConfigPanel {...defaultProps} onSave={mockOnSave} node={openrouterNode} />
      </MemoryProvider>
    );

    // Verify initially no DISCONNECT button
    expect(screen.queryByText('DISCONNECT')).not.toBeInTheDocument();

    const input = screen.getByPlaceholderText(en.routingGraph.nodeConfigPanel.inputs.openRouterApiKey.placeholder);
    fireEvent.change(input, { target: { value: 'sk-or-v1-bad-key-invalid' } });

    const saveBtn = screen.getByTestId('save-node-config-button');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByTestId('node-openrouter-key-error')).toHaveTextContent('Key verification failed (HTTP 401)');
    });

    // Verify DISCONNECT button does NOT appear because we did not connect anything
    expect(screen.queryByText('DISCONNECT')).not.toBeInTheDocument();
    expect(screen.queryByText('OPENROUTER CONNECTED')).not.toBeInTheDocument();
  });
});
