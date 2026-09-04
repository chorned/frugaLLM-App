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
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
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
          backgroundColor: 'var(--zen-surface)',
          border: '1px solid var(--zen-border)',
          borderRadius: '24px',
          padding: '26px',
          boxShadow: 'var(--zen-shadow-modal)',
          color: 'var(--zen-text)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          fontFamily: 'inherit',
          animation: 'fadeIn 0.15s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(239, 68, 68, 0.14)',
              border: '1px solid rgba(239, 68, 68, 0.28)',
              boxShadow: '0 0 16px rgba(239, 68, 68, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                letterSpacing: '0.01em',
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
            lineHeight: 1.55,
            color: 'var(--zen-text-secondary)',
          }}
        >
          {en.exitConfirmation.description}
        </p>

        {activeServices.length > 0 && (
          <div
            style={{
              backgroundColor: 'var(--zen-surface-hover)',
              border: '1px solid var(--zen-border)',
              padding: '12px 14px',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--zen-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active Background Daemons
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
              {activeServices.map((svc) => (
                <span
                  key={svc}
                  style={{
                    backgroundColor: 'var(--zen-surface)',
                    border: '1px solid var(--zen-border-input)',
                    color: 'var(--zen-text)',
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)' }} />
                  {svc}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          <button
            type="button"
            data-testid="exit-cancel-button"
            className="btn-cta btn-cta-secondary"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '11px 18px',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '0.82rem',
              letterSpacing: '0.02em',
            }}
          >
            {en.exitConfirmation.stayButton}
          </button>
          <button
            type="button"
            data-testid="exit-confirm-button"
            className="btn-cta btn-cta-danger"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '11px 18px',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '0.82rem',
              letterSpacing: '0.02em',
            }}
          >
            {en.exitConfirmation.quitButton}
          </button>
        </div>
      </div>
    </div>
  );
};
