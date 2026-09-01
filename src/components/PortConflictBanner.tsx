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
        backgroundColor: '#451a03', // Deep amber-950
        border: '2px solid #f59e0b', // Amber-500
        borderRadius: '10px',
        boxShadow: '0 8px 30px rgba(245, 158, 11, 0.25), 0 0 15px rgba(239, 68, 68, 0.2)',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        fontFamily: 'inherit',
        color: '#fef3c7',
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
            borderRadius: '8px',
            backgroundColor: '#b45309',
            color: '#ffffff',
            flexShrink: 0,
            boxShadow: '0 0 10px rgba(245, 158, 11, 0.4)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                fontWeight: 900,
                letterSpacing: '0.08em',
                color: '#fbbf24',
                textTransform: 'uppercase',
              }}
            >
              {t.title}
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                backgroundColor: '#dc2626',
                color: '#ffffff',
                padding: '1px 6px',
                borderRadius: '4px',
                letterSpacing: '0.05em',
              }}
            >
              PORT {port}
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#fef3c7',
              lineHeight: 1.35,
            }}
          >
            {actionCloseRestart} <span style={{ opacity: 0.85, fontWeight: 500 }}>{t.actionOrChange}</span>
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {onConfigurePort && (
          <button
            data-testid="port-conflict-configure"
            onClick={onConfigurePort}
            style={{
              padding: '8px 14px',
              backgroundColor: '#f59e0b',
              color: '#1e1b4b',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fbbf24')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f59e0b')}
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
            onClick={onDismiss}
            style={{
              padding: '8px 12px',
              backgroundColor: 'transparent',
              color: '#d1d5db',
              border: '1px solid #78350f',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = '#f59e0b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#d1d5db';
              e.currentTarget.style.borderColor = '#78350f';
            }}
          >
            {t.dismiss}
          </button>
        )}
      </div>
    </div>
  );
};
