import React, { useState, useEffect } from 'react';
import { useMemory } from '../context/MemoryContext';
import { editHermesSoul, setFrugallmConfig as updateFrugalConfig, getModelTagForVram } from '../services/tauri';
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart';
import { Store } from '@tauri-apps/plugin-store';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { formatApiBaseUrl, copyToClipboard } from '../utils/clipboard';
import { getProviderIcon } from './icons/ProviderIcons';
import { MemoryPipelineWidget } from './MemoryPipelineWidget';
import { CloudRoutingPanel } from './CloudRoutingPanel';
import { Settings } from './Settings';
import { Tooltip } from './Tooltip';
import en from '../locales/en.json';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';
import { AVAILABLE_MODELS, GRAPH_OVERHEAD_GB } from '../services/memoryCalculator';

let isScreenshotMode = () => false;
let APPSTORE_FORM_DATA: any = null;

if (import.meta.env.DEV) {
  const mod = await import('../dev/screenshotMode');
  isScreenshotMode = mod.isScreenshotMode;
  APPSTORE_FORM_DATA = mod.APPSTORE_FORM_DATA;
}

export interface NodeConfigPanelProps {
  node: any;
  onClose: () => void;
  onSave: (nodeId: string, data: any) => Promise<void> | void;
  onOpenIssueReporter?: () => void;
  isHermesInstalled: boolean;
  isOpenCodeInstalled: boolean;
  isOllamaInstalled: boolean;
  isToolGatewayInstalled?: boolean;
  detectedVram: number | string;
  setDetectedVram: (vram: any) => void;
  hasActiveBackend: boolean;
  handleInitializeHermes: () => void;
  handleOpenHermes: () => void;
  handleUninstallHermes: () => void;
  handleInitializeOpenCode: () => void;
  handleOpenOpenCode: () => void;
  handleUninstallOpenCode: () => void;
  handleInitializeOllama: () => void;
  handleOpenOllama: () => void;
  handleUninstallOllama: () => void;
  handleInstallToolGateway: () => void;
  handleUninstallToolGateway: () => void;
  handleDisconnectOpenRouter: () => void;
  handleDisconnectGoogle: () => void;
  frugalConfig: any;
  handleOpenHermesGateway: () => void;
  handleOpenHermesDesktop: () => void;
  handleOpenHermesWeb: () => void;
  handleOpenOpenCodeWeb: () => void;
  activeProcesses: Record<string, boolean>;
  handleKillProcess: (procName: string) => void;
  setFrugalConfig: any;
  latestTelemetry: any;
  hardwareProfile: any;
  portConflict: boolean;
}

export const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({ node, onClose, onSave, onOpenIssueReporter, isHermesInstalled, isOpenCodeInstalled, isOllamaInstalled, isToolGatewayInstalled, detectedVram, setDetectedVram, hasActiveBackend, handleInitializeHermes, handleOpenHermes, handleUninstallHermes, handleInitializeOpenCode, handleOpenOpenCode, handleUninstallOpenCode, handleInitializeOllama, handleOpenOllama, handleUninstallOllama, handleInstallToolGateway, handleUninstallToolGateway, handleDisconnectOpenRouter, handleDisconnectGoogle, frugalConfig, handleOpenHermesGateway, handleOpenHermesDesktop, handleOpenHermesWeb, handleOpenOpenCodeWeb, activeProcesses, handleKillProcess, setFrugalConfig, latestTelemetry, hardwareProfile, portConflict }: any) => {
  const memory = useMemory();
  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null);
  const [showToolGatewayPrompt, setShowToolGatewayPrompt] = useState<'install' | 'uninstall' | null>(null);
  const [ipCopied, setIpCopied] = useState(false);
  const [ipCopyError, setIpCopyError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [enablePassword, setEnablePassword] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);
  const [initialEnablePassword, setInitialEnablePassword] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const vramNum = Number(detectedVram) || 0;
    if (vramNum > 0) {
      memory.setDetectedVramGb(vramNum);
      getModelTagForVram(vramNum)
        .then((tag) => {
          if (tag) memory.setActiveModelName(tag);
        })
        .catch(() => {});
    }
  }, [detectedVram]);
  
  const [formData, setFormData] = useState(() => {
    if (import.meta.env.DEV && isScreenshotMode() && APPSTORE_FORM_DATA) {
      return {
        ip: node.data.ip || APPSTORE_FORM_DATA.ip,
        port: node.data.port || APPSTORE_FORM_DATA.port,
        status: node.data.status || 'active',
        schemaPath: node.data.schemaPath || APPSTORE_FORM_DATA.schemaPath,
        cwd: node.data.cwd || APPSTORE_FORM_DATA.cwd,
        bin: node.data.bin || APPSTORE_FORM_DATA.bin,
        extraArgs: node.data.extraArgs || APPSTORE_FORM_DATA.extraArgs,
        prompt: node.data.prompt || APPSTORE_FORM_DATA.prompt,
        apiKey: node.id === 'node-openrouter' ? APPSTORE_FORM_DATA.apiKey : '',
        googleApiKey: node.id === 'node-google' ? APPSTORE_FORM_DATA.googleApiKey : '',
        bind_all_interfaces: true,
        api_password: APPSTORE_FORM_DATA.api_password,
        hermes_workspace: APPSTORE_FORM_DATA.hermes_workspace,
        opencode_workspace: APPSTORE_FORM_DATA.opencode_workspace,
        start_on_login: true,
        start_minimized: false,
        global_cli_enabled: true,
        manual_model_overrides: APPSTORE_FORM_DATA.manual_model_overrides
      };
    }
    return {
      ip: node.data.ip || '',
      port: node.data.port || '',
      status: node.data.status || 'active',
      schemaPath: node.data.schemaPath || '',
      cwd: node.data.cwd || '',
      bin: node.data.bin || '',
      extraArgs: node.data.extraArgs || '',
      prompt: node.data.prompt || '',
      apiKey: '',
      googleApiKey: '',
      bind_all_interfaces: false,
      api_password: '',
      hermes_workspace: frugalConfig?.hermes_workspace || '',
      opencode_workspace: frugalConfig?.opencode_workspace || '',
      start_on_login: false,
      start_minimized: frugalConfig?.start_minimized || false,
      global_cli_enabled: false,
      manual_model_overrides: frugalConfig?.manual_model_overrides || []
    };
  });

  useEffect(() => {
    if (node.id === 'node-frugallm') {
      const hasPass = Boolean(frugalConfig?.api_password);
      setEnablePassword(hasPass);
      setInitialEnablePassword(hasPass);
      setShowPassword(false);
      setPasswordCopied(false);
      const initFrugal = {
        port: frugalConfig?.port?.toString() || '0',
        bind_all_interfaces: frugalConfig?.bind_all_interfaces || false,
        api_password: frugalConfig?.api_password || '',
        start_minimized: frugalConfig?.start_minimized || false,
        start_on_login: false,
        manual_model_overrides: frugalConfig?.manual_model_overrides || []
      };
      setFormData(prev => ({
        ...prev,
        ...initFrugal
      }));
      setInitialData(initFrugal);
      isAutostartEnabled()
        .then(enabled => {
          setFormData(prev => ({ ...prev, start_on_login: enabled }));
          setInitialData((prevInit: any) => ({ ...(prevInit || initFrugal), start_on_login: enabled }));
        })
        .catch(() => {});
    } else {
      const initOther = { 
        ip: node.data.ip || '', 
        port: node.data.port || '', 
        status: node.data.status || 'active',
        schemaPath: node.data.schemaPath || '',
        cwd: node.data.cwd || '',
        bin: node.data.bin || '',
        extraArgs: node.data.extraArgs || '',
        prompt: node.data.prompt || '',
        apiKey: '',
        googleApiKey: '',
        bind_all_interfaces: false,
        api_password: '',
        hermes_workspace: frugalConfig?.hermes_workspace || '~/Hermes',
        opencode_workspace: frugalConfig?.opencode_workspace || '~/Opencode',
        start_on_login: false,
        start_minimized: frugalConfig?.start_minimized || false,
        global_cli_enabled: false,
        manual_model_overrides: []
      };
      setFormData(initOther);
      setInitialData(initOther);
    }
  }, [node.id, frugalConfig]);

  const hasChanges = (() => {
    if (!initialData) return false;

    if (node.id === 'node-frugallm') {
      const portChanged = String(formData.port || '') !== String(initialData.port || '');
      const bindChanged = Boolean(formData.bind_all_interfaces) !== Boolean(initialData.bind_all_interfaces);
      const enablePassChanged = enablePassword !== initialEnablePassword;
      const passChanged = enablePassword ? (formData.api_password || '') !== (initialData.api_password || '') : false;
      const autostartChanged = Boolean(formData.start_on_login) !== Boolean(initialData.start_on_login);
      const minimizedChanged = Boolean(formData.start_minimized) !== Boolean(initialData.start_minimized);
      const overridesChanged = JSON.stringify(formData.manual_model_overrides || []) !== JSON.stringify(initialData.manual_model_overrides || []);
      return portChanged || bindChanged || enablePassChanged || passChanged || autostartChanged || minimizedChanged || overridesChanged;
    }

    if (node.id === 'node-openrouter') {
      return Boolean(formData.apiKey && formData.apiKey.trim().length > 0);
    }

    if (node.id === 'node-google') {
      return Boolean(formData.googleApiKey && formData.googleApiKey.trim().length > 0);
    }

    if (node.id === 'node-hermes') {
      if (!isHermesInstalled) return false;
      return (formData.hermes_workspace || '') !== (initialData.hermes_workspace || '');
    }

    if (node.id === 'node-opencode') {
      if (!isOpenCodeInstalled) return false;
      return (formData.opencode_workspace || '') !== (initialData.opencode_workspace || '');
    }

    if (node.data?.isAgent) {
      return (
        (formData.schemaPath || '') !== (initialData.schemaPath || '') ||
        (formData.cwd || '') !== (initialData.cwd || '') ||
        (formData.bin || '') !== (initialData.bin || '') ||
        (formData.extraArgs || '') !== (initialData.extraArgs || '') ||
        (formData.prompt || '') !== (initialData.prompt || '')
      );
    }

    // Generic / other nodes (e.g. node-ollama)
    return (
      (formData.ip || '') !== (initialData.ip || '') ||
      String(formData.port || '') !== String(initialData.port || '')
    );
  })();

  const handleChange = (e: any) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleSave = async () => {
    if (!hasChanges || isSaving) return;
    setIsSaving(true);
    try {
      if (node.id === 'node-frugallm') {
        try {
          if (formData.start_on_login) {
            await enableAutostart();
          } else {
            await disableAutostart();
          }
        } catch (err) {
          console.warn('Failed to update autostart setting:', err);
        }
        try {
          const store = await Store.load('store.json');
          await store.set('start_minimized', Boolean(formData.start_minimized));
          await store.save();
        } catch (err) {
          console.warn('Failed to save start_minimized to store:', err);
        }
      }
      const dataToSave = {
        ...formData,
        api_password: enablePassword ? formData.api_password : '',
        manual_model_overrides: formData.manual_model_overrides
      };
      await onSave(node.id, dataToSave);
      const resetForm = {
        ...formData,
        apiKey: '',
        googleApiKey: ''
      };
      setFormData(resetForm);
      setInitialData({ ...resetForm });
      setInitialEnablePassword(enablePassword);
    } catch (err) {
      console.error('Failed to save node config:', err);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handlePanelClick = (e: any) => e.stopPropagation();

  return (
    <div onClick={handlePanelClick} style={{ 
      width: node.id === 'node-frugallm' ? '780px' : '440px', 
      maxWidth: '92vw',
      maxHeight: '85vh',
      border: '1px solid var(--zen-border)', 
      backgroundColor: 'var(--zen-surface)', 
      borderRadius: '20px',
      display: 'flex', 
      flexDirection: 'column',
      boxShadow: 'var(--zen-shadow-modal)', 
      overflow: 'hidden',
      zIndex: 100,
      fontFamily: 'inherit'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', borderBottom: '1px solid var(--zen-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {getProviderIcon(node.id, { size: 18 })}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <h2 style={{ margin: 0, color: 'var(--zen-text)', fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{node.data.label}</h2>
            {node.data.subheader && (
              <span style={{ fontSize: '0.75rem', fontWeight: 450, color: 'var(--zen-text-secondary)' }}>
                {node.data.subheader}
              </span>
            )}
          </div>
        </div>
        <button 
          onClick={onClose} 
          data-testid="node-config-close-btn"
          className="btn-cta btn-cta-icon"
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '0.9rem', 
            color: 'var(--zen-text-secondary)', 
            width: '28px',
            height: '28px',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--zen-surface-hover)'; e.currentTarget.style.color = 'var(--zen-text)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--zen-text-secondary)'; }}
        >
          ✕
        </button>
      </div>
      
      <div style={{ padding: '18px 20px', flexGrow: 1, backgroundColor: 'transparent', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {node.id === 'node-frugallm' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '24px', alignItems: 'start' }}>
              {/* Left Column: Server & System Configuration */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>IP ADDRESS / HOST <Tooltip text="Where does this service live on the network? Usually, it's right here on your computer ('127.0.0.1' or 'localhost'), but it could be a cloud API halfway across the world!" /></label>
                    <div style={{ padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem' }}>
                      {formData.bind_all_interfaces ? '0.0.0.0' : (formData.ip || '127.0.0.1')}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>PORT <Tooltip text="Think of the IP address as the building, and the Port as the specific door to knock on. It's how our hub knows exactly where to send its messages." /></label>
                    <input 
                      type="text" 
                      name="port" 
                      data-testid="input-frugallm-port"
                      value={formData.port} 
                      onChange={handleChange} 
                      style={{ 
                        width: '100%', 
                        padding: '9px 14px', 
                        border: portConflict ? '1px solid #ef4444' : '1px solid var(--zen-border-input)', 
                        borderRadius: '12px', 
                        backgroundColor: 'var(--zen-surface-header)', 
                        color: 'var(--zen-text)', 
                        outline: 'none', 
                        boxSizing: 'border-box', 
                        fontFamily: 'inherit', 
                        fontWeight: 500, 
                        fontSize: '0.82rem', 
                        boxShadow: 'none' 
                      }} 
                    />
                    {portConflict && (
                      <div data-testid="port-conflict-hint" style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 500, marginTop: '4px', lineHeight: 1.2 }}>
                        Port {portConflict.port} in use: Close conflicting service and restart, or enter a new port.
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  data-testid="btn-copy-ip-port"
                  onClick={async () => {
                    const url = formatApiBaseUrl({
                      ip: formData.ip,
                      port: formData.port,
                      bind_all_interfaces: formData.bind_all_interfaces,
                    });
                    const success = await copyToClipboard(url);
                    if (success) {
                      setIpCopied(true);
                      setIpCopyError(false);
                      setTimeout(() => setIpCopied(false), 1500);
                    } else {
                      setIpCopyError(true);
                      setTimeout(() => setIpCopyError(false), 2000);
                    }
                  }}
                  style={{ 
                    width: '100%', 
                    padding: '9px 16px', 
                    backgroundColor: ipCopied ? '#10B981' : (ipCopyError ? '#ef4444' : '#171717'), 
                    color: '#ffffff', 
                    border: 'none', 
                    borderRadius: '9999px', 
                    fontWeight: 600, 
                    fontSize: '0.78rem', 
                    cursor: 'pointer', 
                    fontFamily: 'inherit', 
                    transition: 'all 0.15s ease' 
                  }}>
                  {ipCopied ? '✓ COPIED' : (ipCopyError ? 'COPY FAILED' : 'COPY IP & PORT')}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, color: 'var(--zen-text)' }}>
                    <input 
                      type="checkbox" 
                      name="bind_all_interfaces" 
                      checked={formData.bind_all_interfaces} 
                      onChange={(e) => setFormData(prev => ({ ...prev, bind_all_interfaces: e.target.checked }))} 
                      style={{ borderRadius: '4px', cursor: 'pointer' }}
                    />
                    {en.routingGraph.nodeConfigPanel.inputs.bindAllInterfaces.label}
                    <Tooltip text={en.routingGraph.nodeConfigPanel.inputs.bindAllInterfaces.helpText} />
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, color: 'var(--zen-text)' }}>
                      <input 
                        type="checkbox" 
                        name="enable_api_password"
                        data-testid="api-password-checkbox"
                        checked={enablePassword} 
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEnablePassword(checked);
                          if (!checked) {
                            setFormData(prev => ({ ...prev, api_password: '' }));
                          }
                        }} 
                        style={{ borderRadius: '4px', cursor: 'pointer' }}
                      />
                      {en.routingGraph.nodeConfigPanel.inputs.apiPassword.checkboxLabel}
                      <Tooltip text={en.routingGraph.nodeConfigPanel.inputs.apiPassword.helpText} />
                    </label>
                    {enablePassword && formData.api_password && (
                      <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>
                        {en.routingGraph.nodeConfigPanel.inputs.apiPassword.active}
                      </span>
                    )}
                  </div>

                  {enablePassword && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        name="api_password" 
                        data-testid="api-password-input"
                        value={formData.api_password} 
                        onChange={handleChange} 
                        placeholder={en.routingGraph.nodeConfigPanel.inputs.apiPassword.placeholder}
                        style={{ 
                          flex: 1, 
                          padding: '9px 14px', 
                          border: '1px solid var(--zen-border-input)', 
                          borderRadius: '12px', 
                          backgroundColor: 'var(--zen-surface-header)', 
                          color: 'var(--zen-text)', 
                          outline: 'none', 
                          boxSizing: 'border-box', 
                          fontFamily: 'inherit', 
                          fontWeight: 500, 
                          fontSize: '0.82rem',
                          boxShadow: 'none' 
                        }} 
                      />
                      <button
                        type="button"
                        data-testid="toggle-password-visibility"
                        onClick={() => setShowPassword(prev => !prev)}
                        title={showPassword ? en.routingGraph.nodeConfigPanel.inputs.apiPassword.buttons.hide : en.routingGraph.nodeConfigPanel.inputs.apiPassword.buttons.show}
                        aria-label={showPassword ? en.routingGraph.nodeConfigPanel.inputs.apiPassword.buttons.hide : en.routingGraph.nodeConfigPanel.inputs.apiPassword.buttons.show}
                        style={{
                          padding: '9px 12px',
                          backgroundColor: 'var(--zen-surface-hover)',
                          color: 'var(--zen-text)',
                          border: '1px solid var(--zen-border-input)',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'inherit',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button
                        type="button"
                        data-testid="copy-password-button"
                        disabled={!formData.api_password}
                        onClick={async () => {
                          if (!formData.api_password) return;
                          try {
                            await writeText(formData.api_password);
                            setPasswordCopied(true);
                            setTimeout(() => setPasswordCopied(false), 1500);
                          } catch (err) {
                            console.error('Clipboard write failed:', err);
                          }
                        }}
                        title={passwordCopied ? en.routingGraph.nodeConfigPanel.inputs.apiPassword.buttons.copied : en.routingGraph.nodeConfigPanel.inputs.apiPassword.buttons.copy}
                        aria-label={passwordCopied ? en.routingGraph.nodeConfigPanel.inputs.apiPassword.buttons.copied : en.routingGraph.nodeConfigPanel.inputs.apiPassword.buttons.copy}
                        style={{
                          padding: '9px 12px',
                          backgroundColor: passwordCopied ? '#10B981' : 'var(--zen-surface-hover)',
                          color: passwordCopied ? '#ffffff' : 'var(--zen-text)',
                          border: '1px solid var(--zen-border-input)',
                          borderRadius: '12px',
                          cursor: formData.api_password ? 'pointer' : 'not-allowed',
                          opacity: formData.api_password ? 1 : 0.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'inherit',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {passwordCopied ? <Check size={15} /> : <Copy size={15} />}
                      </button>
                    </div>
                  )}
                </div>

                <div 
                  data-testid="settings-section-divider"
                  style={{ 
                    height: '1px', 
                    backgroundColor: 'var(--zen-border)', 
                    width: '100%' 
                  }} 
                />

                <div>
                  <Settings
                    startOnLogin={formData.start_on_login}
                    onStartOnLoginChange={(enabled: boolean) => setFormData(prev => ({ ...prev, start_on_login: enabled }))}
                    startMinimized={formData.start_minimized}
                    onStartMinimizedChange={(minimized: boolean) => setFormData(prev => ({ ...prev, start_minimized: minimized }))}
                    globalCliEnabled={formData.global_cli_enabled}
                    onGlobalCliEnabledChange={(enabled: boolean) => setFormData(prev => ({ ...prev, global_cli_enabled: enabled }))}
                    onReportIssue={onOpenIssueReporter}
                  />
                </div>
              </div>

              {/* Right Column: Global Routing Pool */}
              <div style={{ borderLeft: '1px solid var(--zen-border)', paddingLeft: '24px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                <CloudRoutingPanel 
                  overrides={formData.manual_model_overrides}
                  onOverridesChange={(newOverrides) => setFormData(prev => ({ ...prev, manual_model_overrides: newOverrides }))}
                />
              </div>
            </div>
          ) : node.data.isAgent ? (
            <>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>SCHEMA PATH <Tooltip text="Think of this as the agent's strict instruction manual. By giving it a JSON schema, we force the AI to return data in the exact structure your application expects. No more messy text—just clean data!" /></label>
                <input type="text" name="schemaPath" value={formData.schemaPath} onChange={handleChange} 
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', boxShadow: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>WORKING DIR (CWD) <Tooltip text="Where should the agent live while it works? This is the folder on your computer where the agent will run commands and look for files. It's basically the agent's home base." /></label>
                <input type="text" name="cwd" value={formData.cwd} onChange={handleChange} 
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', boxShadow: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>EXECUTABLE (BIN) <Tooltip text="Which program is actually doing the heavy lifting? This tells the system what tool to launch under the hood. Usually, it's 'agy' for our Antigravity agent, but you can plug in any CLI tool!" /></label>
                <input type="text" name="bin" value={formData.bin} onChange={handleChange} 
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', boxShadow: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>EXTRA ARGS (CSV) <Tooltip text="Want to tweak how the agent runs? You can pass secret flags here (like '--verbose' to see its inner thoughts). Just list them out, separated by commas." /></label>
                <input type="text" name="extraArgs" value={formData.extraArgs} onChange={handleChange} placeholder="--verbose, --force"
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', boxShadow: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>INSTRUCTION PROMPT <Tooltip text="This is your agent's main mission. Tell it exactly what you want it to accomplish. Be as specific as possible—the better the prompt, the better the results!" /></label>
                <textarea name="prompt" value={formData.prompt} onChange={handleChange} rows={2} 
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', boxShadow: 'none' }} />
              </div>
            </>
          ) : (
            <>
              {node.id !== 'node-openrouter' && node.id !== 'node-google' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>IP ADDRESS / HOST <Tooltip text="Where does this service live on the network? Usually, it's right here on your computer ('127.0.0.1' or 'localhost'), but it could be a cloud API halfway across the world!" /></label>
                    {node.id === 'node-hermes' || node.id === 'node-opencode' ? (
                      <div style={{ padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem' }}>
                        {formData.ip}
                      </div>
                    ) : (
                      <input type="text" name="ip" value={formData.ip} onChange={handleChange} 
                        style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', boxShadow: 'none' }} />
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>PORT <Tooltip text="Think of the IP address as the building, and the Port as the specific door to knock on. It's how our hub knows exactly where to send its messages." /></label>
                    {node.id === 'node-hermes' || node.id === 'node-opencode' ? (
                      <div style={{ padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem' }}>
                        {formData.port}
                      </div>
                    ) : (
                      <input 
                        type="text" 
                        name="port" 
                        data-testid="input-port"
                        value={formData.port} 
                        onChange={handleChange} 
                        style={{ 
                          width: '100%', 
                          padding: '9px 14px', 
                          border: '1px solid var(--zen-border-input)', 
                          borderRadius: '12px', 
                          backgroundColor: 'var(--zen-surface-header)', 
                          color: 'var(--zen-text)', 
                          outline: 'none', 
                          boxSizing: 'border-box', 
                          fontFamily: 'inherit', 
                          fontWeight: 500, 
                          fontSize: '0.82rem', 
                          boxShadow: 'none' 
                        }} 
                      />
                    )}
                  </div>
                </div>
              )}
              {node.id === 'node-openrouter' && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>API KEY <Tooltip text="Your OpenRouter API Key. This will be securely saved into your operating system's native Keychain!" /></label>
                  <input type="password" name="apiKey" value={formData.apiKey || ''} onChange={handleChange} placeholder={Boolean(node.data.keyPrefix || node.data.status === 'active') ? en.routingGraph.nodeConfigPanel.inputs.openRouterApiKey.configuredPlaceholder : en.routingGraph.nodeConfigPanel.inputs.openRouterApiKey.placeholder}
                    style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', boxShadow: 'none' }} />
                </div>
              )}
              {node.id === 'node-google' && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px', letterSpacing: '0.02em' }}>API KEY <Tooltip text="Your Google AI Studio API Key. This will be securely saved into your operating system's native Keychain!" /></label>
                  <input type="password" name="googleApiKey" value={formData.googleApiKey || ''} onChange={handleChange} placeholder={Boolean(node.data.keyPrefix || node.data.status === 'active') ? en.routingGraph.nodeConfigPanel.inputs.googleApiKey.configuredPlaceholder : en.routingGraph.nodeConfigPanel.inputs.googleApiKey.placeholder}
                    style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', boxShadow: 'none' }} />
                </div>
              )}
            </>
          )}
          
        </div>
        
        {node.data.description && node.id !== 'node-ollama' ? (
          <p style={{ fontSize: '0.75rem', color: 'var(--zen-text-secondary)', marginTop: '16px', marginBottom: '0', lineHeight: 1.4, borderTop: '1px solid var(--zen-border)', paddingTop: '12px' }}>
            {node.data.description}
          </p>
        ) : null}

      {node.id === 'node-hermes' && isHermesInstalled === false && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          {!hasActiveBackend ? (
            <p style={{ fontSize: '0.75rem', color: 'var(--zen-text)', margin: 0, fontWeight: 500 }}>Please connect an intelligence source to FrugaLLM first.</p>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); handleInitializeHermes(); }}
              style={{ width: '100%', padding: '10px 16px', backgroundColor: '#171717', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              INSTALL HERMES
            </button>
          )}
        </div>
      )}
      
      {node.id === 'node-hermes' && isHermesInstalled === true && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--zen-text)', fontSize: '0.8rem', fontWeight: 600 }}>HERMES AGENT INSTALLED</h4>
          {confirmUninstall === 'hermes' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 600 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleUninstallHermes(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '4px' }}>WORKSPACE FOLDER</label>
                <input type="text" name="hermes_workspace" value={formData.hermes_workspace || ''} onChange={handleChange}
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem' }} />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenHermes(); }}
                style={{ width: '100%', padding: '10px 16px', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                LAUNCH HERMES
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); (handleOpenHermesDesktop || handleOpenHermesGateway)(); }}
                  style={{ flex: 1, padding: '8px 12px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                  LAUNCH APP
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleOpenHermesWeb(); }}
                  style={{ flex: 1, padding: '8px 12px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                  LAUNCH WEBUI
                </button>
              </div>
              {(() => {
                const hermesModes: { key: string; label: string; mode: string }[] = [];
                if (activeProcesses['run-hermes-gateway'] || activeProcesses['hermes-gateway']) {
                  hermesModes.push({ key: 'hermes-gateway', label: 'HERMES GATEWAY ACTIVE', mode: 'run-hermes-gateway' });
                }
                if (activeProcesses['run-hermes-desktop'] || activeProcesses['run-hermes-app']) {
                  hermesModes.push({ key: 'hermes-desktop', label: 'HERMES APP ACTIVE', mode: 'run-hermes-desktop' });
                }
                if (activeProcesses['run-hermes-web'] || activeProcesses['hermes-dashboard'] || activeProcesses['hermes-web']) {
                  hermesModes.push({ key: 'hermes-web', label: 'HERMES WEBUI ACTIVE', mode: 'run-hermes-web' });
                }
                if (activeProcesses['run-hermes']) {
                  hermesModes.push({ key: 'hermes-cli', label: 'HERMES CLI ACTIVE', mode: 'run-hermes' });
                }
                return hermesModes.map(item => (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '12px', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--zen-text)', fontWeight: 600, fontSize: '0.75rem' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                      {item.label}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleKillProcess(item.mode); }} style={{ backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '9999px', padding: '3px 8px', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer' }}>CLOSE</button>
                  </div>
                ));
              })()}
              <button 
                onClick={(e) => { e.stopPropagation(); editHermesSoul().catch(console.error); }}
                style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--zen-surface-hover)', borderRadius: '9999px', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                EDIT SOUL.MD
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('hermes'); }}
                style={{ width: '100%', padding: '8px 12px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                UNINSTALL HERMES
              </button>
            </div>
          )}
        </div>
      )}

      {node.id === 'node-opencode' && isOpenCodeInstalled === false && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          {!hasActiveBackend ? (
            <p style={{ fontSize: '0.75rem', color: 'var(--zen-text)', margin: 0, fontWeight: 500 }}>Please connect an intelligence source to FrugaLLM first.</p>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); handleInitializeOpenCode(); }}
              style={{ width: '100%', padding: '10px 16px', backgroundColor: '#171717', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              INSTALL OPENCODE
            </button>
          )}
        </div>
      )}
      
      {node.id === 'node-opencode' && isOpenCodeInstalled === true && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--zen-text)', fontSize: '0.8rem', fontWeight: 600 }}>OPENCODE AGENT INSTALLED</h4>
          {confirmUninstall === 'opencode' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 600 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleUninstallOpenCode(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '4px' }}>WORKSPACE FOLDER</label>
                <input type="text" name="opencode_workspace" value={formData.opencode_workspace || ''} onChange={handleChange}
                  style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem' }} />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenOpenCode(); }}
                style={{ width: '100%', padding: '10px 16px', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                LAUNCH OPENCODE
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenOpenCodeWeb(); }}
                style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                LAUNCH WEBUI
              </button>
              {['run-opencode', 'run-opencode-web'].map(mode => activeProcesses && activeProcesses[mode] && (
                <div key={mode} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '12px', marginBottom: '4px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--zen-text)', fontWeight: 600, fontSize: '0.75rem' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                    {mode.replace('run-', '').toUpperCase()} ACTIVE
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleKillProcess(mode); }} style={{ backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '9999px', padding: '3px 8px', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer' }}>CLOSE</button>
                </div>
              ))}
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('opencode'); }}
                style={{ width: '100%', padding: '8px 12px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                UNINSTALL OPENCODE
              </button>
            </div>
          )}
        </div>
      )}

      {node.id === 'node-ollama' && isOllamaInstalled === false && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px' }}>VRAM DETECTED (GB) <Tooltip text="We tried to auto-detect your Video RAM, but you can correct this if it's wrong." /></label>
            <input 
              type="text" 
              value={detectedVram} 
              onChange={(e) => {
                setDetectedVram(e.target.value);
                const num = Number(e.target.value) || 0;
                if (num > 0) memory.setDetectedVramGb(num);
              }}
              data-testid="vram-detected-input"
              style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem' }} 
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--zen-text-secondary)', marginBottom: '5px' }}>RECOMMENDED MODEL <Tooltip text="Based on your VRAM, we'll pull this model for you!" /></label>
            <select 
              value={memory.activeModelName} 
              onChange={(e) => memory.setActiveModelName(e.target.value)}
              data-testid="recommended-model-input"
              style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--zen-border-input)', borderRadius: '12px', backgroundColor: 'var(--zen-surface-header)', color: 'var(--zen-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.82rem', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '32px' }} 
            >
              {AVAILABLE_MODELS.map((model: any) => {
                const totalGb = (model.weightsGb + model.kvCacheGb + GRAPH_OVERHEAD_GB).toFixed(1);
                return (
                  <option key={model.tag} value={model.tag}>
                    • {model.tag} ({totalGb} GB)
                  </option>
                );
              })}
            </select>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <MemoryPipelineWidget 
              modelTag={memory.activeModelName} 
              segments={memory.effectiveSegments} 
              hardwareProfile={hardwareProfile || memory.hardwareProfile || latestTelemetry?.hardware_profile} 
            />
          </div>

          <button 
            onClick={(e) => { e.stopPropagation(); handleInitializeOllama(); }}
            style={{ width: '100%', padding: '10px 16px', backgroundColor: '#171717', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s ease' }}>
            INSTALL OLLAMA
          </button>
        </div>
      )}
      
      {node.id === 'node-ollama' && isOllamaInstalled === true && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--zen-text)', fontSize: '0.8rem', fontWeight: 600 }}>OLLAMA INSTALLED</h4>
          
          <div style={{ marginBottom: '12px' }}>
            <MemoryPipelineWidget 
              modelTag={latestTelemetry?.ollama?.model_name || memory.activeModelName} 
              segments={memory.effectiveSegments} 
              hardwareProfile={hardwareProfile || memory.hardwareProfile || latestTelemetry?.hardware_profile} 
            />
          </div>
          {confirmUninstall === 'ollama' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 600 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleUninstallOllama(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenOllama(); }}
                style={{ width: '100%', padding: '10px 16px', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                CHAT WITH OLLAMA
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('ollama'); }}
                style={{ width: '100%', padding: '8px 12px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                UNINSTALL OLLAMA
              </button>
            </div>
          )}
        </div>
      )}

      {node.id === 'node-ollama' && isOllamaInstalled === true && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0, color: 'var(--zen-text)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.02em' }}>
              {en.routingGraph.nodeConfigPanel.actions.toolGateway.title}
            </h4>
            <span 
              data-testid="tool-gateway-status"
              style={{ 
              fontSize: '0.65rem', fontWeight: 600, padding: '3px 8px', borderRadius: '9999px',
              backgroundColor: isToolGatewayInstalled ? '#dcfce7' : '#F4F4F5',
              color: isToolGatewayInstalled ? '#15803d' : 'var(--zen-text-secondary)',
              border: `1px solid ${isToolGatewayInstalled ? '#86efac' : 'var(--zen-border)'}`
            }}>
              {isToolGatewayInstalled ? en.routingGraph.nodeConfigPanel.actions.toolGateway.installed : en.routingGraph.nodeConfigPanel.actions.toolGateway.notInstalled}
            </span>
          </div>

          <p style={{ margin: '0 0 10px 0', fontSize: '0.72rem', color: 'var(--zen-text-secondary)', lineHeight: '1.35' }}>
            {en.routingGraph.nodeConfigPanel.actions.toolGateway.description}
          </p>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, color: 'var(--zen-text)', userSelect: 'none' }}>
            <input 
              type="checkbox"
              name="toolGatewayCheckbox"
              data-testid="tool-gateway-checkbox"
              checked={!!frugalConfig?.tool_enforcing_gateway}
              onChange={(e) => {
                const checked = e.target.checked;
                if (checked) {
                  if (!isToolGatewayInstalled) {
                    setShowToolGatewayPrompt('install');
                  } else {
                    const next = { ...frugalConfig, tool_enforcing_gateway: true };
                    if (setFrugalConfig) setFrugalConfig(next);
                    updateFrugalConfig(next).catch(console.error);
                  }
                } else {
                  if (isToolGatewayInstalled) {
                    setShowToolGatewayPrompt('uninstall');
                  } else {
                    const next = { ...frugalConfig, tool_enforcing_gateway: false };
                    if (setFrugalConfig) setFrugalConfig(next);
                    updateFrugalConfig(next).catch(console.error);
                  }
                }
              }}
              style={{ width: '15px', height: '15px', cursor: 'pointer', borderRadius: '4px', accentColor: '#10B981' }}
            />
            <span>{en.routingGraph.nodeConfigPanel.actions.toolGateway.checkboxLabel}</span>
          </label>

          {showToolGatewayPrompt === 'install' && (
            <div style={{ marginTop: '10px', padding: '12px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 600 }}>
                {en.routingGraph.nodeConfigPanel.actions.toolGateway.installPromptTitle}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--zen-text-secondary)', lineHeight: '1.3' }}>
                {en.routingGraph.nodeConfigPanel.actions.toolGateway.installPromptText}
              </span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                <button 
                  data-testid="confirm-install-tool-gateway"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowToolGatewayPrompt(null);
                    handleInstallToolGateway();
                  }}
                  style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-accent)', color: '#ffffff', border: 'none', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  {en.routingGraph.nodeConfigPanel.actions.toolGateway.installButton}
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowToolGatewayPrompt(null);
                  }}
                  style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  {en.routingGraph.nodeConfigPanel.actions.toolGateway.cancelButton}
                </button>
              </div>
            </div>
          )}

          {showToolGatewayPrompt === 'uninstall' && (
            <div style={{ marginTop: '10px', padding: '12px', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 600 }}>
                {en.routingGraph.nodeConfigPanel.actions.toolGateway.uninstallPromptTitle}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--zen-text-secondary)', lineHeight: '1.3' }}>
                {en.routingGraph.nodeConfigPanel.actions.toolGateway.uninstallPromptText}
              </span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                <button 
                  data-testid="confirm-uninstall-tool-gateway"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowToolGatewayPrompt(null);
                    handleUninstallToolGateway();
                  }}
                  style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  {en.routingGraph.nodeConfigPanel.actions.toolGateway.uninstallButton}
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowToolGatewayPrompt(null);
                  }}
                  style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  {en.routingGraph.nodeConfigPanel.actions.toolGateway.cancelButton}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {node.id === 'node-openrouter' && Boolean(node.data.keyPrefix || node.data.status === 'active') && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--zen-text)', fontSize: '0.8rem', fontWeight: 600 }}>OPENROUTER CONNECTED</h4>
          {confirmUninstall === 'openrouter' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 600 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleDisconnectOpenRouter(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('openrouter'); }}
                style={{ width: '100%', padding: '8px 12px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                DISCONNECT
              </button>
            </div>
          )}
        </div>
      )}

      {node.id === 'node-google' && Boolean(node.data.keyPrefix || node.data.status === 'active') && (
        <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'var(--zen-surface-hover)', border: '1px solid var(--zen-border)', borderRadius: '14px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--zen-text)', fontSize: '0.8rem', fontWeight: 600 }}>GOOGLE AI STUDIO CONNECTED</h4>
          {confirmUninstall === 'google' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--zen-text)', fontWeight: 600 }}>ARE YOU SURE?</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleDisconnectGoogle(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: '#FFFFFF', border: 'none', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>YES</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmUninstall(null); }} style={{ flex: 1, padding: '8px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', border: '1px solid var(--zen-border)', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>NO</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setConfirmUninstall('google'); }}
                style={{ width: '100%', padding: '8px 12px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '9999px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem' }}>
                DISCONNECT
              </button>
            </div>
          )}
        </div>
      )}
      </div>
      
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--zen-border)', backgroundColor: 'var(--zen-surface)', display: 'flex', gap: '8px' }}>
        <button 
          onClick={handleSave} 
          disabled={!hasChanges || isSaving}
          data-testid="save-node-config-button"
          className={`btn-cta ${hasChanges && !isSaving ? 'btn-cta-primary' : 'btn-cta-secondary'}`}
          style={{ 
            flex: 1, 
            padding: '11px 20px', 
            backgroundColor: hasChanges && !isSaving ? 'var(--zen-accent)' : 'var(--zen-pill-bg)', 
            color: hasChanges && !isSaving ? '#FFFFFF' : 'var(--zen-text-secondary)', 
            border: hasChanges && !isSaving ? 'none' : '1px solid var(--zen-pill-border)', 
            borderRadius: '9999px', 
            fontWeight: 600, 
            fontSize: '0.85rem', 
            cursor: hasChanges && !isSaving ? 'pointer' : 'not-allowed', 
            opacity: 1,
            fontFamily: 'inherit', 
            boxShadow: hasChanges && !isSaving ? 'var(--zen-active-glow)' : 'none', 
          }}
          onMouseDown={e => { 
            if (hasChanges && !isSaving) {
              e.currentTarget.style.transform = 'scale(0.99)'; 
            }
          }}
          onMouseUp={e => { 
            if (hasChanges && !isSaving) {
              e.currentTarget.style.transform = 'none'; 
            }
          }}
        >
          {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
        </button>
      </div>
    </div>
  );
};

