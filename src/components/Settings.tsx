import React, { useState, useEffect } from 'react';
import { isEnabled as isAutostartEnabled, enable as enableAutostart, disable as disableAutostart } from '@tauri-apps/plugin-autostart';
import { Store } from '@tauri-apps/plugin-store';
import en from '../locales/en.json';

export interface SettingsProps {
  startOnLogin?: boolean;
  onStartOnLoginChange?: (enabled: boolean) => void;
  startMinimized?: boolean;
  onStartMinimizedChange?: (minimized: boolean) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  startOnLogin,
  onStartOnLoginChange,
  startMinimized,
  onStartMinimizedChange,
}) => {
  const [localStartOnLogin, setLocalStartOnLogin] = useState<boolean>(startOnLogin ?? false);
  const [localStartMinimized, setLocalStartMinimized] = useState<boolean>(startMinimized ?? false);
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

  const strings = en.routingGraph.nodeConfigPanel.inputs;

  return (
    <div
      data-testid="settings-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '8px 10px',
        backgroundColor: 'var(--zen-surface, #f9fafb)',
        border: '1px solid var(--zen-border, #e5e7eb)',
        borderRadius: '8px',
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
            fontWeight: 600,
            color: 'var(--zen-text, #111827)',
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
            fontWeight: 600,
            color: 'var(--zen-text, #111827)',
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
          />
          <span>{strings.startMinimized.label}</span>
        </label>
      </div>

      {errorMessage && (
        <div
          data-testid="settings-error-message"
          style={{
            fontSize: '0.72rem',
            color: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.08)',
            padding: '6px 8px',
            borderRadius: '4px',
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
