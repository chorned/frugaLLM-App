import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('NodeConfigPanel - Ollama Layout and Model Guidance', () => {
  const defaultProps = {
    node: { id: 'node-ollama', data: { label: 'Ollama Node', status: 'idle' } },
    onClose: vi.fn(),
    onSave: vi.fn(),
    isHermesInstalled: false,
    isOpenCodeInstalled: false,
    isOllamaInstalled: false,
    isToolGatewayInstalled: false,
    detectedVram: 16,
    setDetectedVram: vi.fn(),
    hasActiveBackend: false,
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
    activeProcesses: {},
    handleKillProcess: vi.fn(),
    setFrugalConfig: vi.fn(),
    latestTelemetry: {
      hardware_profile: {
        is_unified: false,
        dedicated_vram: 16 * 1024 * 1024 * 1024,
        system_ram: 32 * 1024 * 1024 * 1024,
        execution_ceiling: 16 * 1024 * 1024 * 1024,
        os_architecture: 'linux-x86_64',
      },
    },
    hardwareProfile: null,
    portConflict: false,
  };

  it('maintains a clean layout without bulky info cards when Ollama is not installed', () => {
    render(
      <MemoryProvider>
        <NodeConfigPanel {...defaultProps} isOllamaInstalled={false} />
      </MemoryProvider>
    );

    expect(screen.queryByTestId('ollama-info-panels')).not.toBeInTheDocument();
    expect(screen.queryByTestId('info-panel-weights')).not.toBeInTheDocument();
    expect(screen.queryByTestId('info-panel-q8-context')).not.toBeInTheDocument();
    expect(screen.queryByTestId('info-panel-model-tradeoffs')).not.toBeInTheDocument();
  });

  it('maintains a clean layout without bulky info cards when Ollama is installed', () => {
    render(
      <MemoryProvider>
        <NodeConfigPanel {...defaultProps} isOllamaInstalled={true} />
      </MemoryProvider>
    );

    expect(screen.queryByTestId('ollama-info-panels')).not.toBeInTheDocument();
    expect(screen.queryByTestId('info-panel-weights')).not.toBeInTheDocument();
    expect(screen.queryByTestId('info-panel-q8-context')).not.toBeInTheDocument();
    expect(screen.queryByTestId('info-panel-model-tradeoffs')).not.toBeInTheDocument();
  });

  it('verifies refined recommendedModel localized guidance in FrugaLLM tone of voice', () => {
    const recModel = en.routingGraph.nodeConfigPanel.inputs.recommendedModel;
    // Explains smaller vs bigger models
    expect(recModel.tooltip).toMatch(/Smaller models/i);
    expect(recModel.tooltip).toMatch(/larger models/i);
    expect(recModel.outcomeHelp).toMatch(/Compact local models/i);
    expect(recModel.outcomeHelp).toMatch(/Larger models/i);

    // Benchmarks local models vs frontier cloud endpoints
    expect(recModel.outcomeHelp).toMatch(/frontier cloud endpoints/i);
    expect(recModel.outcomeHelp).toMatch(/Claude 3\.5 Sonnet/i);
    expect(recModel.outcomeHelp).toMatch(/Gemini 1\.5 Pro/i);
  });
});
