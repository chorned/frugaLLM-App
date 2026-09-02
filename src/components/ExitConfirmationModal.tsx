import React from 'react';
import en from '../locales/en.json';

interface ExitConfirmationModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  activeServices?: string[];
}

export const ExitConfirmationModal: React.FC<ExitConfirmationModalProps> = ({
  isOpen,
  onCancel,
  onConfirm,
  activeServices = [],
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-modal-title"
      data-testid="exit-confirmation-modal"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#FFFFFF',
          border: 'none',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)',
          color: 'var(--zen-text)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          fontFamily: 'inherit',
          animation: 'fadeIn 0.15s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '9999px',
              backgroundColor: '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h3
              id="exit-modal-title"
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--zen-text)',
              }}
            >
              {en.exitConfirmation.title}
            </h3>
          </div>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: '0.84rem',
            lineHeight: 1.5,
            color: 'var(--zen-text-secondary)',
          }}
        >
          {en.exitConfirmation.description}
        </p>

        {activeServices.length > 0 && (
          <div
            style={{
              backgroundColor: 'var(--zen-surface-hover)',
              padding: '12px 14px',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--zen-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Background Daemons
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
              {activeServices.map((svc) => (
                <span
                  key={svc}
                  style={{
                    backgroundColor: 'var(--zen-surface)',
                    border: 'none',
                    color: 'var(--zen-text)',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                  {svc}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button
            type="button"
            data-testid="exit-cancel-button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px 18px',
              backgroundColor: 'var(--zen-surface-hover)',
              color: 'var(--zen-text)',
              border: 'none',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--zen-surface-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--zen-surface-hover)')}
          >
            {en.exitConfirmation.stayButton}
          </button>
          <button
            type="button"
            data-testid="exit-confirm-button"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '10px 18px',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#B91C1C')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#DC2626')}
          >
            {en.exitConfirmation.quitButton}
          </button>
        </div>
      </div>
    </div>
  );
};
