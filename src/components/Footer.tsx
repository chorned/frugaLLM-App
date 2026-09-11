import React from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { UpdateNotification } from './UpdateNotification';
import en from '../locales/en.json';

export interface FooterProps {
  portConflict?: { port: number; message: string } | boolean | null;
  daemonError?: string | boolean | null;
}

export const Footer: React.FC<FooterProps> = ({ portConflict, daemonError }) => {
  const isPortConflict = Boolean(portConflict);
  const isDaemonFailure = Boolean(daemonError);
  const isError = isPortConflict || isDaemonFailure;

  const statusColor = isError ? '#ef4444' : '#10B981';
  const statusText = isPortConflict
    ? (en.footer?.portConflict || 'Port Conflict')
    : isDaemonFailure
    ? (en.footer?.daemonFailure || 'Daemon Failure')
    : (en.footer?.status || 'System Ready');

  const statusTitle = isPortConflict
    ? (typeof portConflict === 'object' && portConflict?.message ? portConflict.message : 'Port conflict detected')
    : isDaemonFailure && typeof daemonError === 'string'
    ? daemonError
    : undefined;

  return (
    <footer 
      data-testid="app-footer" 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '10px 20px', 
        backgroundColor: 'var(--zen-footer-bg)', 
        borderTop: '1px solid var(--zen-footer-border)',
        flexShrink: 0,
        zIndex: 10,
        fontSize: '0.75rem',
        color: 'var(--zen-text-secondary)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <a 
          href="https://horned.se/" 
          target="_blank" 
          rel="noreferrer"
          data-testid="footer-link-horned"
          onClick={(e) => { e.preventDefault(); openUrl('https://horned.se/').catch(() => {}); }} 
          style={{ color: 'var(--zen-text-secondary)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--zen-text)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--zen-text-secondary)'}
        >
          {en.footer?.horned || 'Horned.se'}
        </a>
        <a 
          href="https://github.com/chorned" 
          target="_blank" 
          rel="noreferrer"
          data-testid="footer-link-github"
          onClick={(e) => { e.preventDefault(); openUrl('https://github.com/chorned').catch(() => {}); }} 
          style={{ color: 'var(--zen-text-secondary)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--zen-text)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--zen-text-secondary)'}
        >
          {en.footer?.github || 'Github'}
        </a>
      </div>
      <div 
        data-testid="footer-status-container"
        title={statusTitle}
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <UpdateNotification />
        <span 
          data-testid="footer-status-dot"
          style={{ 
            width: '6px', 
            height: '6px', 
            borderRadius: '50%', 
            backgroundColor: statusColor,
            flexShrink: 0,
            transition: 'background-color 0.2s ease'
          }} 
        />
        <span 
          data-testid="footer-status-text"
          style={{ 
            fontWeight: 500, 
            color: isError ? '#ef4444' : 'var(--zen-text-secondary)',
            transition: 'color 0.2s ease'
          }}
        >
          {statusText}
        </span>
      </div>
    </footer>
  );
};

