import React from 'react';
import en from '../locales/en.json';

interface PortConflictBannerProps {
  port: number;
  onConfigurePort?: () => void;
  onDismiss?: () => void;
}

export const PortConflictBanner: React.FC<PortConflictBannerProps> = ({
  port,
  onConfigurePort,
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
        maxWidth: '900px',
        width: 'calc(100% - 32px)',
        backgroundColor: '#FEF2F2',
        border: 'none',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(239, 68, 68, 0.08)',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        fontFamily: 'inherit',
        color: '#991B1B',
        animation: 'fadeIn 0.2s ease-in-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '9999px',
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
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
                letterSpacing: '0.04em',
                color: '#991B1B',
                textTransform: 'uppercase',
              }}
            >
              {t.title}
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                backgroundColor: '#DC2626',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '9999px',
                letterSpacing: '0.04em',
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
              color: '#7F1D1D',
              lineHeight: 1.35,
            }}
          >
            {actionCloseRestart} <span style={{ opacity: 0.85, fontWeight: 450 }}>{t.actionOrChange}</span>
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

        {onDismiss && (
          <button
            data-testid="port-conflict-dismiss"
            className="btn-cta btn-cta-secondary"
            onClick={onDismiss}
            style={{
              padding: '8px 14px',
              backgroundColor: '#FEE2E2',
              color: '#991B1B',
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
