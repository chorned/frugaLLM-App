import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock @tauri-apps/api/core invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('Typed Tauri IPC Service Layer (CHO-117)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports all required typed IPC wrapper functions from src/services/tauri.ts', async () => {
    const tauriService = await import('../services/tauri');
    expect(typeof tauriService.getFrugallmConfig).toBe('function');
    expect(typeof tauriService.setFrugallmConfig).toBe('function');
    expect(typeof tauriService.checkHermesStatus).toBe('function');
    expect(typeof tauriService.checkOpencodeStatus).toBe('function');
    expect(typeof tauriService.checkOllamaStatus).toBe('function');
    expect(typeof tauriService.checkToolGatewayStatus).toBe('function');
    expect(typeof tauriService.detectVram).toBe('function');
    expect(typeof tauriService.getActiveServices).toBe('function');
    expect(typeof tauriService.confirmExitApp).toBe('function');
    expect(typeof tauriService.submitIssueReport).toBe('function');
    expect(typeof tauriService.setCredential).toBe('function');
    expect(typeof tauriService.deleteCredential).toBe('function');
    expect(typeof tauriService.refreshRoutingChain).toBe('function');
    expect(typeof tauriService.getRoutingChain).toBe('function');
    expect(typeof tauriService.setModelOverride).toBe('function');
    expect(typeof tauriService.editHermesSoul).toBe('function');
    expect(typeof tauriService.openAppLogs).toBe('function');
    expect(typeof tauriService.setGlobalCliCommands).toBe('function');
    expect(typeof tauriService.spawnPty).toBe('function');
    expect(typeof tauriService.killPty).toBe('function');
    expect(typeof tauriService.resizePty).toBe('function');
    expect(typeof tauriService.writePty).toBe('function');
    expect(typeof tauriService.configureHermesDefaults).toBe('function');
    expect(typeof tauriService.configureOpencodeDefaults).toBe('function');
    expect(typeof tauriService.deployLocalModel).toBe('function');
  });

  it('delegates to invoke with exact command names and argument signatures', async () => {
    const tauriService = await import('../services/tauri');
    mockInvoke.mockResolvedValueOnce({ port: 61721 });
    const config = await tauriService.getFrugallmConfig();
    expect(mockInvoke).toHaveBeenCalledWith('get_frugallm_config');
    expect(config).toEqual({ port: 61721 });

    mockInvoke.mockResolvedValueOnce(true);
    const hermesInstalled = await tauriService.checkHermesStatus();
    expect(mockInvoke).toHaveBeenCalledWith('check_hermes_status');
    expect(hermesInstalled).toBe(true);

    mockInvoke.mockResolvedValueOnce(undefined);
    await tauriService.setCredential('openrouter', 'sk-test');
    expect(mockInvoke).toHaveBeenCalledWith('set_credential', { service: 'openrouter', secret: 'sk-test' });

    mockInvoke.mockResolvedValueOnce(undefined);
    await tauriService.spawnPty('bash', ['-c', 'echo hello'], 'run-test');
    expect(mockInvoke).toHaveBeenCalledWith('spawn_pty', { sessionId: 'run-test', command: 'bash', args: ['-c', 'echo hello'] });
  });

  it('guarantees zero raw @tauri-apps/api/core invoke calls inside UI presentation components', () => {
    const presentationFiles = [
      'src/App.tsx',
      'src/components/Header.tsx',
      'src/components/Footer.tsx',
      'src/components/GuidesModal.tsx',
      'src/components/NodeConfigPanel.tsx',
      'src/components/CloudRoutingPanel.tsx',
      'src/components/Settings.tsx',
      'src/components/TerminalView.tsx',
      'src/components/TerminalOverlays.tsx',
      'src/components/IssueReporterModal.tsx',
      'src/hooks/useNodeActions.ts',
      'src/hooks/useAppEvents.ts',
      'src/services/appInit.ts',
    ];

    const projectRoot = path.resolve(__dirname, '../..');
    for (const relPath of presentationFiles) {
      const fullPath = path.join(projectRoot, relPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const hasRawInvokeImport = /import\s*\{[^}]*\binvoke\b[^}]*\}\s*from\s*['"]@tauri-apps\/api\/core['"]/.test(content);
        expect(hasRawInvokeImport, `${relPath} still directly imports raw invoke from @tauri-apps/api/core`).toBe(false);
      }
    }
  });
});
