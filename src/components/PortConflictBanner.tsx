import React from 'react';
import en from '../locales/en.json';

interface PortConflictBannerProps {
  port: number;
  onConfigurePort?: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const PortConflictBanner: React.FC<PortConflictBannerProps> = ({
  port,
  onConfigurePort,
  onRetry,
  onDismiss,
}) => {
  const t = en.portConflict;
  const actionCloseRestart = t.actionCloseRestart.replace('{{port}}', port.toString());

  return (
    <div
      data-testid="port-conflict-banner"
      role="alert"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'relative',
        zIndex: 50,
        margin: '12px auto',
        maxWidth: '920px',
        width: 'calc(100% - 32px)',
        backgroundColor: 'var(--zen-surface)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        borderRadius: '16px',
        boxShadow: 'var(--zen-shadow-modal), 0 0 24px rgba(239, 68, 68, 0.12)',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        fontFamily: 'inherit',
        color: 'var(--zen-text)',
        animation: 'fadeIn 0.2s ease-in-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(239, 68, 68, 0.14)',
            border: '1px solid rgba(239, 68, 68, 0.28)',
            boxShadow: '0 0 14px rgba(239, 68, 68, 0.15)',
            color: '#EF4444',
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: '#F87171',
                textTransform: 'uppercase',
              }}
            >
              {t.title}
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#FCA5A5',
                padding: '2px 8px',
                borderRadius: '9999px',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
              }}
            >
              PORT {port}
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '0.82rem',
              fontWeight: 500,
              color: 'var(--zen-text)',
              lineHeight: 1.35,
            }}
          >
            {actionCloseRestart} <span style={{ color: 'var(--zen-text-secondary)', fontWeight: 450 }}>{t.actionOrChange}</span>
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {onConfigurePort && (
          <button
            data-testid="port-conflict-configure"
            className="btn-cta btn-cta-danger"
            onClick={onConfigurePort}
            style={{
              padding: '8px 16px',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {t.configurePort}
          </button>
        )}

        {onRetry && (
          <button
            data-testid="port-conflict-retry"
            className="btn-cta btn-cta-secondary"
            onClick={onRetry}
            style={{
              padding: '8px 14px',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            {t.retry || 'Retry Port'}
          </button>
        )}

        {onDismiss && (
          <button
            data-testid="port-conflict-dismiss"
            className="btn-cta btn-cta-secondary"
            onClick={onDismiss}
            style={{
              padding: '8px 14px',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '0.78rem',
            }}
          >
            {t.dismiss}
          </button>
        )}
      </div>
    </div>
  );
};
