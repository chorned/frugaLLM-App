import { invoke } from '@tauri-apps/api/core';
import { HardwareProfile } from './memoryCalculator';

export interface FrugalConfig {
  port?: number;
  bind_all_interfaces?: boolean;
  active_preset?: string;
  manual_model_overrides?: Record<string, string>;
  enable_paid_fallback?: boolean;
  openrouter_api_key?: string;
  google_api_key?: string;
  input_tokens_lifetime?: number;
  output_tokens_lifetime?: number;
  input_tokens_session?: number;
  output_tokens_session?: number;
  [key: string]: any;
}

export interface IssueReportPayload {
  title?: string;
  description?: string;
  logs?: string;
  system_info?: any;
  [key: string]: any;
}

export interface SpawnPtyOptions {
  sessionId?: string;
  command: string;
  args?: string[];
}

/**
 * Typed Tauri IPC Client Layer
 * Centralizes and types all communication with the Tauri Rust backend.
 */

export async function getFrugallmConfig(): Promise<FrugalConfig> {
  return invoke<FrugalConfig>('get_frugallm_config');
}

export async function setFrugallmConfig(
  configOrPayload: FrugalConfig | { config?: FrugalConfig; newConfig?: FrugalConfig }
): Promise<void> {
  const payload = (configOrPayload && ('newConfig' in configOrPayload || 'config' in configOrPayload))
    ? ('newConfig' in configOrPayload ? configOrPayload.newConfig : configOrPayload.config)
    : configOrPayload;
  return invoke<void>('set_frugallm_config', { newConfig: payload });
}

export async function checkHermesStatus(): Promise<boolean> {
  return invoke<boolean>('check_hermes_status');
}

export async function checkOpencodeStatus(): Promise<boolean> {
  return invoke<boolean>('check_opencode_status');
}

export async function checkOllamaStatus(): Promise<boolean> {
  return invoke<boolean>('check_ollama_status');
}

export async function checkToolGatewayStatus(): Promise<boolean> {
  return invoke<boolean>('check_tool_gateway_status');
}

export async function setToolGatewayInstalled(installed: boolean): Promise<void> {
  return invoke<void>('set_tool_gateway_installed', { installed });
}

export async function isWipeMode(): Promise<boolean> {
  return invoke<boolean>('is_wipe_mode');
}

export async function getOllamaChatModel(): Promise<string> {
  return invoke<string>('get_ollama_chat_model');
}

export async function getHermesVersion(): Promise<string> {
  return invoke<string>('get_hermes_version');
}

export async function getOpencodeVersion(): Promise<string> {
  return invoke<string>('get_opencode_version');
}

export async function uninstallOllama(): Promise<void> {
  return invoke<void>('uninstall_ollama');
}

export async function uninstallOpenCode(): Promise<void> {
  return invoke<void>('uninstall_opencode');
}

export async function uninstallHermes(): Promise<void> {
  return invoke<void>('uninstall_hermes');
}

export async function detectVram(): Promise<number> {
  return invoke<number>('detect_vram');
}

export async function detectHardwareProfile(): Promise<HardwareProfile> {
  return invoke<HardwareProfile>('detect_hardware_profile');
}

export async function getActiveServices(): Promise<string[]> {
  return invoke<string[]>('get_active_services');
}

export async function hasActiveServices(): Promise<boolean> {
  return invoke<boolean>('has_active_services');
}

export async function confirmExitApp(): Promise<void> {
  return invoke<void>('confirm_exit_app');
}

export async function submitIssueReport(payload: IssueReportPayload): Promise<void> {
  return invoke<void>('submit_issue_report', { payload });
}

export async function setCredential(service: string, secret: string): Promise<void> {
  return invoke<void>('set_credential', { service, secret });
}

export async function getCredential(service: string): Promise<string | null> {
  return invoke<string | null>('get_credential', { service });
}

export async function deleteCredential(service: string): Promise<void> {
  return invoke<void>('delete_credential', { service });
}

export async function wipeCredentials(): Promise<void> {
  return invoke<void>('wipe_credentials');
}

export async function refreshRoutingChain(): Promise<any> {
  return invoke<any>('refresh_routing_chain');
}

export async function getRoutingChain(): Promise<any> {
  return invoke<any>('get_routing_chain');
}

export async function setRoutingChain(chain: any): Promise<void> {
  return invoke<void>('set_routing_chain', { chain });
}

export async function setModelOverride(overrides: Record<string, string>): Promise<void> {
  return invoke<void>('set_model_override', { overrides });
}

export async function editHermesSoul(): Promise<void> {
  return invoke<void>('edit_hermes_soul');
}

export async function openAppLogs(): Promise<void> {
  return invoke<void>('open_app_logs');
}

export async function setGlobalCliCommands(enabled: boolean): Promise<void> {
  return invoke<void>('set_global_cli_commands', { enabled });
}

export async function getGlobalCliCommandsStatus(): Promise<boolean> {
  return invoke<boolean>('get_global_cli_commands_status');
}

export async function spawnPty(
  commandOrOptions: string | SpawnPtyOptions,
  args?: string[],
  sessionId?: string
): Promise<void> {
  if (typeof commandOrOptions === 'object') {
    return invoke<void>('spawn_pty', {
      sessionId: commandOrOptions.sessionId,
      command: commandOrOptions.command,
      args: commandOrOptions.args || [],
    });
  }
  return invoke<void>('spawn_pty', {
    sessionId,
    command: commandOrOptions,
    args: args || [],
  });
}

export async function killPty(sessionId: string): Promise<void> {
  return invoke<void>('kill_pty', { sessionId });
}

export async function resizePty(sessionId: string, cols: number, rows: number): Promise<void> {
  return invoke<void>('resize_pty', { sessionId, cols, rows });
}

export async function writePty(sessionId: string, data: string): Promise<void> {
  return invoke<void>('write_pty', { sessionId, data });
}

export async function stopHermesService(service: string): Promise<void> {
  return invoke<void>('stop_hermes_service', { service });
}

export async function startHermesService(service: string): Promise<void> {
  return invoke<void>('start_hermes_service', { service });
}

export async function configureHermesDefaults(): Promise<void> {
  return invoke<void>('configure_hermes_defaults');
}

export async function configureOpencodeDefaults(): Promise<void> {
  return invoke<void>('configure_opencode_defaults');
}

export async function deployLocalModel(): Promise<void> {
  return invoke<void>('deploy_local_model');
}

export async function restartApp(): Promise<void> {
  return invoke<void>('restart_app');
}

export async function getDiagnosticData(): Promise<any> {
  return invoke<any>('get_diagnostic_data');
}

export async function getLocalIps(): Promise<string[]> {
  return invoke<string[]>('get_local_ips');
}

export async function getModelTagForVram(vramGb: number): Promise<string> {
  return invoke<string>('get_model_tag_for_vram', { detectedVramGb: vramGb, vramGb });
}

export async function getProviderStatuses(): Promise<any> {
  return invoke<any>('get_provider_statuses');
}

export async function getFrugallmServerStatus(): Promise<any> {
  return invoke<any>('get_frugallm_server_status');
}

export async function checkHermesReady(): Promise<boolean> {
  return invoke<boolean>('check_hermes_ready');
}
