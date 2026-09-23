import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @tauri-apps/api/core invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('Typed Tauri IPC Service Layer (CHO-117)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serializes arguments correctly across configuration and routing IPC calls', async () => {
    const tauriService = await import('../services/tauri');

    // getFrugallmConfig
    mockInvoke.mockResolvedValueOnce({ port: 61721 });
    const config = await tauriService.getFrugallmConfig();
    expect(mockInvoke).toHaveBeenCalledWith('get_frugallm_config');
    expect(config).toEqual({ port: 61721 });

    // setFrugallmConfig with flat config
    mockInvoke.mockResolvedValueOnce(undefined);
    await tauriService.setFrugallmConfig({ port: 8080 });
    expect(mockInvoke).toHaveBeenCalledWith('set_frugallm_config', { newConfig: { port: 8080 } });

    // setFrugallmConfig with newConfig envelope
    mockInvoke.mockResolvedValueOnce(undefined);
    await tauriService.setFrugallmConfig({ newConfig: { port: 9090 } });
    expect(mockInvoke).toHaveBeenCalledWith('set_frugallm_config', { newConfig: { port: 9090 } });

    // setModelOverride
    mockInvoke.mockResolvedValueOnce(undefined);
    await tauriService.setModelOverride({ gemma: 'ollama' });
    expect(mockInvoke).toHaveBeenCalledWith('set_model_override', { overrides: { gemma: 'ollama' } });

    // setRoutingChain and getRoutingChain
    mockInvoke.mockResolvedValueOnce(undefined);
    await tauriService.setRoutingChain(['cloud', 'local']);
    expect(mockInvoke).toHaveBeenCalledWith('set_routing_chain', { chain: ['cloud', 'local'] });

    mockInvoke.mockResolvedValueOnce(['cloud', 'local']);
    const chain = await tauriService.getRoutingChain();
    expect(mockInvoke).toHaveBeenCalledWith('get_routing_chain');
    expect(chain).toEqual(['cloud', 'local']);
  });

  it('handles PTY terminal process lifecycle commands with proper parameter mappings', async () => {
    const tauriService = await import('../services/tauri');

    // spawnPty with options object
    mockInvoke.mockResolvedValueOnce(undefined);
    await tauriService.spawnPty({ command: 'bash', args: ['-i'], sessionId: 'term-1' });
    expect(mockInvoke).toHaveBeenCalledWith('spawn_pty', {
      sessionId: 'term-1',
      command: 'bash',
      args: ['-i'],
    });

    // spawnPty with positional arguments
    mockInvoke.mockResolvedValueOnce(undefined);
    await tauriService.spawnPty('bash', ['-c', 'echo hello'], 'term-2');
    expect(mockInvoke).toHaveBeenCalledWith('spawn_pty', {
      sessionId: 'term-2',
      command: 'bash',
      args: ['-c', 'echo hello'],
    });

    // writePty
    mockInvoke.mockResolvedValueOnce(undefined);
    await tauriService.writePty('term-1', 'ls -la\n');
    expect(mockInvoke).toHaveBeenCalledWith('write_pty', { sessionId: 'term-1', data: 'ls -la\n' });

    // resizePty
    mockInvoke.mockResolvedValueOnce(undefined);
    await tauriService.resizePty('term-1', 120, 30);
    expect(mockInvoke).toHaveBeenCalledWith('resize_pty', { sessionId: 'term-1', cols: 120, rows: 30 });

    // killPty
    mockInvoke.mockResolvedValueOnce(undefined);
    await tauriService.killPty('term-1');
    expect(mockInvoke).toHaveBeenCalledWith('kill_pty', { sessionId: 'term-1' });
  });

  it('normalizes legacy boolean and null status responses into DependencyStatus', async () => {
    const tauriService = await import('../services/tauri');

    // checkHermesStatus returning boolean true
    mockInvoke.mockResolvedValueOnce(true);
    const hermesRes = await tauriService.checkHermesStatus();
    expect(hermesRes).toEqual({ is_installed: true, is_managed: false });

    // checkOpencodeStatus returning boolean false
    mockInvoke.mockResolvedValueOnce(false);
    const opencodeRes = await tauriService.checkOpencodeStatus();
    expect(opencodeRes).toEqual({ is_installed: false, is_managed: false });

    // checkOllamaStatus returning null/undefined
    mockInvoke.mockResolvedValueOnce(null);
    const ollamaNullRes = await tauriService.checkOllamaStatus();
    expect(ollamaNullRes).toEqual({ is_installed: false, is_managed: false });

    // checkOllamaStatus returning full DependencyStatus object
    mockInvoke.mockResolvedValueOnce({ is_installed: true, is_managed: true });
    const ollamaObjRes = await tauriService.checkOllamaStatus();
    expect(ollamaObjRes).toEqual({ is_installed: true, is_managed: true });
  });

  it('propagates IPC error rejections to callers', async () => {
    const tauriService = await import('../services/tauri');

    // getFrugallmConfig rejections
    mockInvoke.mockRejectedValueOnce(new Error('IPC bridge disconnected'));
    await expect(tauriService.getFrugallmConfig()).rejects.toThrow('IPC bridge disconnected');

    // setCredential rejections
    mockInvoke.mockRejectedValueOnce(new Error('Keyring unavailable'));
    await expect(tauriService.setCredential('openrouter', 'bad-key')).rejects.toThrow('Keyring unavailable');

    // spawnPty rejections
    mockInvoke.mockRejectedValueOnce(new Error('Spawn failed: executable not found'));
    await expect(tauriService.spawnPty('nonexistent-cmd', [], 'bad-term')).rejects.toThrow(
      'Spawn failed: executable not found'
    );
  });

  it('properly serializes native terminal, session launch, and issue reports', async () => {
    const tauriService = await import('../services/tauri');

    // launchNativeTerminal
    mockInvoke.mockResolvedValueOnce(undefined);
    await tauriService.launchNativeTerminal('echo hi', '/tmp', { FOO: 'bar' }, 'My Title');
    expect(mockInvoke).toHaveBeenCalledWith('launch_native_terminal', {
      command: 'echo hi',
      cwd: '/tmp',
      envVars: { FOO: 'bar' },
      title: 'My Title',
    });

    // launchNativeAppSession
    mockInvoke.mockResolvedValueOnce(undefined);
    await tauriService.launchNativeAppSession('hermes', 'gemma:4b', '/workspace');
    expect(mockInvoke).toHaveBeenCalledWith('launch_native_app_session', {
      appName: 'hermes',
      model: 'gemma:4b',
      workspaceOverride: '/workspace',
    });

    // submitIssueReport
    mockInvoke.mockResolvedValueOnce(undefined);
    const issuePayload = { title: 'Bug Report', description: 'Details here', logs: 'Sample log' };
    await tauriService.submitIssueReport(issuePayload);
    expect(mockInvoke).toHaveBeenCalledWith('submit_issue_report', { payload: issuePayload });

    // deleteLocalModel
    mockInvoke.mockResolvedValueOnce(undefined);
    await tauriService.deleteLocalModel();
    expect(mockInvoke).toHaveBeenCalledWith('delete_local_model');
  });
});
