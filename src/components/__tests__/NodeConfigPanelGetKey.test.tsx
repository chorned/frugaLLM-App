import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NodeConfigPanel } from '../NodeConfigPanel';
import { MemoryProvider } from '../../context/MemoryContext';
import { openUrl } from '@tauri-apps/plugin-opener';

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

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

describe('NodeConfigPanel - Get Key Hyperlink', () => {
  const baseProps = {
    onClose: vi.fn(),
    onSave: vi.fn(),
    isHermesInstalled: false,
    isHermesManaged: false,
    isOpenCodeInstalled: false,
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
    handleDeleteLocalModel: vi.fn(),
    handleInstallToolGateway: vi.fn(),
    handleUninstallToolGateway: vi.fn(),
    handleDisconnectOpenRouter: vi.fn(),
    handleDisconnectGoogle: vi.fn(),
    frugalConfig: {},
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

  describe('OpenRouter Node', () => {
    const unconfiguredOpenRouterNode = {
      id: 'node-openrouter',
      data: { label: 'OpenRouter', status: 'idle', keyPrefix: null },
    };

    it('displays Get Key hyperlink pointing to openrouter.ai and triggers openUrl on click', async () => {
      await act(async () => {
        render(
          <MemoryProvider>
            <NodeConfigPanel
              {...baseProps}
              node={unconfiguredOpenRouterNode}
            />
          </MemoryProvider>
        );
      });

      const link = screen.getByTestId('link-get-openrouter-key');
      expect(link).toBeInTheDocument();
      expect(link).toHaveTextContent('Get Key');
      expect(link).toHaveAttribute('href', 'https://openrouter.ai');

      await act(async () => {
        fireEvent.click(link);
      });
      expect(openUrl).toHaveBeenCalledWith('https://openrouter.ai');
    });

    it('hides Get Key link when user enters an API key', async () => {
      await act(async () => {
        render(
          <MemoryProvider>
            <NodeConfigPanel
              {...baseProps}
              node={unconfiguredOpenRouterNode}
            />
          </MemoryProvider>
        );
      });

      const input = screen.getByPlaceholderText('Get Key');
      expect(screen.getByTestId('link-get-openrouter-key')).toBeInTheDocument();

      await act(async () => {
        fireEvent.change(input, { target: { value: 'sk-or-v1-test-key' } });
      });
      expect(screen.queryByTestId('link-get-openrouter-key')).not.toBeInTheDocument();
    });

    it('does not display Get Key link when node is already configured or active', async () => {
      const configuredNode = {
        id: 'node-openrouter',
        data: { label: 'OpenRouter', status: 'active', keyPrefix: 'sk-or-v1' },
      };

      await act(async () => {
        render(
          <MemoryProvider>
            <NodeConfigPanel
              {...baseProps}
              node={configuredNode}
            />
          </MemoryProvider>
        );
      });

      expect(screen.queryByTestId('link-get-openrouter-key')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText('•••••••••••••••• (Key Configured)')).toBeInTheDocument();
    });
  });

  describe('Google AI Studio Node', () => {
    const unconfiguredGoogleNode = {
      id: 'node-google',
      data: { label: 'AI Studio', status: 'idle', keyPrefix: null },
    };

    it('displays Get Key hyperlink pointing to aistudio.google.com and triggers openUrl on click', async () => {
      await act(async () => {
        render(
          <MemoryProvider>
            <NodeConfigPanel
              {...baseProps}
              node={unconfiguredGoogleNode}
            />
          </MemoryProvider>
        );
      });

      const link = screen.getByTestId('link-get-google-key');
      expect(link).toBeInTheDocument();
      expect(link).toHaveTextContent('Get Key');
      expect(link).toHaveAttribute('href', 'https://aistudio.google.com');

      await act(async () => {
        fireEvent.click(link);
      });
      expect(openUrl).toHaveBeenCalledWith('https://aistudio.google.com');
    });

    it('hides Get Key link when user enters a Google API key', async () => {
      await act(async () => {
        render(
          <MemoryProvider>
            <NodeConfigPanel
              {...baseProps}
              node={unconfiguredGoogleNode}
            />
          </MemoryProvider>
        );
      });

      const input = screen.getByPlaceholderText('Get Key');
      expect(screen.getByTestId('link-get-google-key')).toBeInTheDocument();

      await act(async () => {
        fireEvent.change(input, { target: { value: 'AIzaSyTestKey' } });
      });
      expect(screen.queryByTestId('link-get-google-key')).not.toBeInTheDocument();
    });

    it('does not display Get Key link when Google node is already configured or active', async () => {
      const configuredGoogleNode = {
        id: 'node-google',
        data: { label: 'AI Studio', status: 'active', keyPrefix: 'AIzaSy' },
      };

      await act(async () => {
        render(
          <MemoryProvider>
            <NodeConfigPanel
              {...baseProps}
              node={configuredGoogleNode}
            />
          </MemoryProvider>
        );
      });

      expect(screen.queryByTestId('link-get-google-key')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText('•••••••••••••••• (Key Configured)')).toBeInTheDocument();
    });
  });
});
