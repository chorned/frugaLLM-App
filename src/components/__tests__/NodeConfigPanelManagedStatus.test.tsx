import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeConfigPanel } from '../NodeConfigPanel';
import { MemoryProvider } from '../../context/MemoryContext';
import en from '../../locales/en.json';

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

describe('NodeConfigPanel - Managed vs Adopted Status and Protection', () => {
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

  describe('Ollama Node', () => {
    const ollamaNode = { id: 'node-ollama', data: { label: 'Ollama Node', status: 'idle' } };

    it('displays System Managed badge, hides UNINSTALL OLLAMA, and keeps DELETE LOCAL MODEL when isOllamaManaged is false', () => {
      const handleDeleteLocalModel = vi.fn();
      render(
        <MemoryProvider>
          <NodeConfigPanel
            {...baseProps}
            node={ollamaNode}
            isOllamaInstalled={true}
            isOllamaManaged={false}
            handleDeleteLocalModel={handleDeleteLocalModel}
          />
        </MemoryProvider>
      );

      const badge = screen.getByTestId('system-managed-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(en.routingGraph.nodeConfigPanel.badges.systemManaged);

      // Destructive uninstall CTA must be hidden
      expect(screen.queryByText('UNINSTALL OLLAMA')).not.toBeInTheDocument();

      // Safe model deletion CTA must no longer be rendered (CHO-133)
      expect(screen.queryByTestId('btn-delete-local-model')).not.toBeInTheDocument();
    });

    it('hides badge and displays UNINSTALL OLLAMA when isOllamaManaged is true', () => {
      const handleUninstallOllama = vi.fn();
      render(
        <MemoryProvider>
          <NodeConfigPanel
            {...baseProps}
            node={ollamaNode}
            isOllamaInstalled={true}
            isOllamaManaged={true}
            handleUninstallOllama={handleUninstallOllama}
          />
        </MemoryProvider>
      );

      expect(screen.queryByTestId('system-managed-badge')).not.toBeInTheDocument();
      const uninstallBtn = screen.getByText('UNINSTALL OLLAMA');
      expect(uninstallBtn).toBeInTheDocument();

      fireEvent.click(uninstallBtn);
      const confirmYes = screen.getByText('YES');
      fireEvent.click(confirmYes);
      expect(handleUninstallOllama).toHaveBeenCalled();
    });
  });

  describe('Hermes Node', () => {
    const hermesNode = { id: 'node-hermes', data: { label: 'Hermes Agent', status: 'idle' } };

    it('displays System Managed badge and hides UNINSTALL HERMES when isHermesManaged is false', () => {
      render(
        <MemoryProvider>
          <NodeConfigPanel
            {...baseProps}
            node={hermesNode}
            isHermesInstalled={true}
            isHermesManaged={false}
          />
        </MemoryProvider>
      );

      const badge = screen.getByTestId('system-managed-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(en.routingGraph.nodeConfigPanel.badges.systemManaged);
      expect(screen.queryByText('UNINSTALL HERMES')).not.toBeInTheDocument();
    });

    it('hides badge and renders UNINSTALL HERMES when isHermesManaged is true', () => {
      const handleUninstallHermes = vi.fn();
      render(
        <MemoryProvider>
          <NodeConfigPanel
            {...baseProps}
            node={hermesNode}
            isHermesInstalled={true}
            isHermesManaged={true}
            handleUninstallHermes={handleUninstallHermes}
          />
        </MemoryProvider>
      );

      expect(screen.queryByTestId('system-managed-badge')).not.toBeInTheDocument();
      const uninstallBtn = screen.getByText('UNINSTALL HERMES');
      expect(uninstallBtn).toBeInTheDocument();

      fireEvent.click(uninstallBtn);
      const confirmYes = screen.getByText('YES');
      fireEvent.click(confirmYes);
      expect(handleUninstallHermes).toHaveBeenCalled();
    });
  });

  describe('OpenCode Node', () => {
    const opencodeNode = { id: 'node-opencode', data: { label: 'OpenCode Agent', status: 'idle' } };

    it('displays System Managed badge and hides UNINSTALL OPENCODE when isOpenCodeManaged is false', () => {
      render(
        <MemoryProvider>
          <NodeConfigPanel
            {...baseProps}
            node={opencodeNode}
            isOpenCodeInstalled={true}
            isOpenCodeManaged={false}
          />
        </MemoryProvider>
      );

      const badge = screen.getByTestId('system-managed-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(en.routingGraph.nodeConfigPanel.badges.systemManaged);
      expect(screen.queryByText('UNINSTALL OPENCODE')).not.toBeInTheDocument();
    });

    it('hides badge and renders UNINSTALL OPENCODE when isOpenCodeManaged is true', () => {
      const handleUninstallOpenCode = vi.fn();
      render(
        <MemoryProvider>
          <NodeConfigPanel
            {...baseProps}
            node={opencodeNode}
            isOpenCodeInstalled={true}
            isOpenCodeManaged={true}
            handleUninstallOpenCode={handleUninstallOpenCode}
          />
        </MemoryProvider>
      );

      expect(screen.queryByTestId('system-managed-badge')).not.toBeInTheDocument();
      const uninstallBtn = screen.getByText('UNINSTALL OPENCODE');
      expect(uninstallBtn).toBeInTheDocument();

      fireEvent.click(uninstallBtn);
      const confirmYes = screen.getByText('YES');
      fireEvent.click(confirmYes);
      expect(handleUninstallOpenCode).toHaveBeenCalled();
    });
  });
});
