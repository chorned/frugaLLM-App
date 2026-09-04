import React, { useState, useEffect } from 'react';
import { isEnabled as isAutostartEnabled, enable as enableAutostart, disable as disableAutostart } from '@tauri-apps/plugin-autostart';
import { Store } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';
import en from '../locales/en.json';
import { Tooltip } from './Tooltip';

export interface SettingsProps {
  startOnLogin?: boolean;
  onStartOnLoginChange?: (enabled: boolean) => void;
  startMinimized?: boolean;
  onStartMinimizedChange?: (minimized: boolean) => void;
  globalCliEnabled?: boolean;
  onGlobalCliEnabledChange?: (enabled: boolean) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  startOnLogin,
  onStartOnLoginChange,
  startMinimized,
  onStartMinimizedChange,
  globalCliEnabled,
  onGlobalCliEnabledChange,
}) => {
  const [localStartOnLogin, setLocalStartOnLogin] = useState<boolean>(startOnLogin ?? false);
  const [localStartMinimized, setLocalStartMinimized] = useState<boolean>(startMinimized ?? false);
  const [localGlobalCli, setLocalGlobalCli] = useState<boolean>(globalCliEnabled ?? false);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const syncState = async () => {
      try {
        const autostartEnabled = await isAutostartEnabled();
        if (isMounted) {
          setLocalStartOnLogin(autostartEnabled);
          onStartOnLoginChange?.(autostartEnabled);
        }
      } catch (err) {
        console.warn('Could not check autostart status:', err);
      }

      try {
        const store = await Store.load('store.json');
        const storeMin = await store.get<boolean>('start_minimized');
        if (storeMin !== null && storeMin !== undefined && isMounted) {
          setLocalStartMinimized(Boolean(storeMin));
          onStartMinimizedChange?.(Boolean(storeMin));
        }
      } catch (err) {
        console.warn('Could not read start_minimized from store:', err);
      }

      try {
        const store = await Store.load('store.json');
        const storeCli = await store.get<boolean>('global_cli_enabled');
        if (storeCli !== null && storeCli !== undefined && isMounted) {
          setLocalGlobalCli(Boolean(storeCli));
          onGlobalCliEnabledChange?.(Boolean(storeCli));
        } else {
          const backendCli = await invoke<boolean>('get_global_cli_commands_status').catch(() => false);
          if (isMounted && backendCli !== undefined) {
            setLocalGlobalCli(Boolean(backendCli));
            onGlobalCliEnabledChange?.(Boolean(backendCli));
          }
        }
      } catch (err) {
        console.warn('Could not read global_cli_enabled:', err);
      } finally {
        if (isMounted) {
          setIsSyncing(false);
        }
      }
    };

    syncState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (startOnLogin !== undefined) {
      setLocalStartOnLogin(startOnLogin);
    }
  }, [startOnLogin]);

  useEffect(() => {
    if (startMinimized !== undefined) {
      setLocalStartMinimized(startMinimized);
    }
  }, [startMinimized]);

  useEffect(() => {
    if (globalCliEnabled !== undefined) {
      setLocalGlobalCli(globalCliEnabled);
    }
  }, [globalCliEnabled]);

  const handleToggleAutostart = async (checked: boolean) => {
    setLocalStartOnLogin(checked);
    setErrorMessage(null);
    try {
      if (checked) {
        await enableAutostart();
      } else {
        await disableAutostart();
      }
      onStartOnLoginChange?.(checked);
    } catch (err: any) {
      console.error('Failed to toggle autostart:', err);
      setErrorMessage(String(err));
      try {
        const actual = await isAutostartEnabled();
        setLocalStartOnLogin(actual);
        onStartOnLoginChange?.(actual);
      } catch {}
    }
  };

  const handleToggleStartMinimized = async (checked: boolean) => {
    setLocalStartMinimized(checked);
    onStartMinimizedChange?.(checked);
    try {
      const store = await Store.load('store.json');
      await store.set('start_minimized', checked);
      await store.save();
    } catch (err) {
      console.warn('Failed to persist start_minimized:', err);
    }
  };

  const handleToggleGlobalCli = async (checked: boolean) => {
    setLocalGlobalCli(checked);
    setErrorMessage(null);
    try {
      await invoke('set_global_cli_commands', { enabled: checked });
      const store = await Store.load('store.json');
      await store.set('global_cli_enabled', checked);
      await store.save();
      onGlobalCliEnabledChange?.(checked);
    } catch (err: any) {
      console.error('Failed to toggle global CLI:', err);
      setErrorMessage(String(err));
      setLocalGlobalCli(!checked);
    }
  };

  const strings = en.routingGraph.nodeConfigPanel.inputs;

  return (
    <div
      data-testid="settings-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '0',
        backgroundColor: 'transparent',
        border: 'none',
        fontFamily: 'inherit',
      }}
    >
      {/* Start on Login Toggle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 500,
            color: 'var(--zen-text)',
          }}
        >
          <input
            type="checkbox"
            name="start_on_login"
            data-testid="checkbox-start-on-login"
            aria-label={strings.startOnLogin.label}
            checked={localStartOnLogin}
            disabled={isSyncing}
            onChange={(e) => handleToggleAutostart(e.target.checked)}
            style={{ borderRadius: '4px', cursor: 'pointer' }}
          />
          <span>{strings.startOnLogin.label}</span>
        </label>
      </div>

      {/* Start Minimized Toggle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 500,
            color: 'var(--zen-text)',
          }}
        >
          <input
            type="checkbox"
            name="start_minimized"
            data-testid="checkbox-start-minimized"
            aria-label={strings.startMinimized.label}
            checked={localStartMinimized}
            disabled={isSyncing}
            onChange={(e) => handleToggleStartMinimized(e.target.checked)}
            style={{ borderRadius: '4px', cursor: 'pointer' }}
          />
          <span>{strings.startMinimized.label}</span>
        </label>
      </div>

      {/* Global CLI Commands Toggle with Hover Tooltip ( i ) */}
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 500,
            color: 'var(--zen-text)',
          }}
        >
          <input
            type="checkbox"
            name="global_cli"
            data-testid="checkbox-global-cli"
            aria-label={strings.globalCli.label}
            checked={localGlobalCli}
            disabled={isSyncing}
            onChange={(e) => handleToggleGlobalCli(e.target.checked)}
            style={{ borderRadius: '4px', cursor: 'pointer' }}
          />
          <span>{strings.globalCli.label}</span>
          <Tooltip 
            text={strings.globalCli.tooltip}
            triggerTestId="btn-global-cli-info"
            testId="global-cli-tooltip-box"
            ariaLabel="Info about global CLI commands"
          />
        </label>
      </div>

      {errorMessage && (
        <div
          data-testid="settings-error-message"
          style={{
            fontSize: '0.72rem',
            color: '#dc2626',
            backgroundColor: '#fee2e2',
            padding: '6px 10px',
            borderRadius: '8px',
            fontWeight: 500,
          }}
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default Settings;


