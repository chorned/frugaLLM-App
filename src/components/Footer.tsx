import React from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { UpdateNotification } from './UpdateNotification';
import { OnboardingFooterTracker } from './OnboardingFooterTracker';
import { OnboardingState, OnboardingStep } from '../hooks/useOnboarding';
import en from '../locales/en.json';

import { useTheme } from '../hooks/useTheme';

export interface FooterProps {
  portConflict?: { port: number; message: string } | boolean | null;
  daemonError?: string | boolean | null;
  isDark?: boolean;
  minimizedTerminal?: {
    mode: string;
    title: string;
    onResume: () => void;
  } | null;
  onboarding?: {
    state: OnboardingState;
    currentStep?: OnboardingStep;
    isFooterDismissed?: boolean;
    hasSourceLinked?: boolean;
    hasHarnessInstalled?: boolean;
    onNext?: () => void;
    onPrev?: () => void;
    onSkip?: () => void;
    onResume?: () => void;
    onReset?: () => void;
    onDismiss?: () => void;
  };
}

export const Footer: React.FC<FooterProps> = ({ portConflict, daemonError, isDark: propIsDark, minimizedTerminal, onboarding }) => {
  const { isDark: hookIsDark } = useTheme();
  const isDark = propIsDark ?? hookIsDark;
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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

        {/* Windows Taskbar / Start Menu style Minimized Terminal CTA */}
        {minimizedTerminal && (
          <button
            data-testid="footer-minimized-terminal-cta"
            onClick={minimizedTerminal.onResume}
            title={`Click to resume ${minimizedTerminal.title}`}
            aria-label={`Resume ${minimizedTerminal.title}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              padding: 0,
              margin: 0,
              appearance: 'none',
              WebkitAppearance: 'none',
              color: 'var(--zen-text-secondary)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 500,
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--zen-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--zen-text-secondary)';
            }}
            className="hover:underline"
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                boxShadow: '0 0 6px rgba(16, 185, 129, 0.8)',
                flexShrink: 0
              }}
              className="animate-pulse"
            />
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            <span>{minimizedTerminal.title || 'Terminal'} (Click to resume)</span>
          </button>
        )}
      </div>

      {/* Center Slot: Persistent Onboarding Tracker */}
      {onboarding && (
        <div data-testid="footer-center-slot" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <OnboardingFooterTracker
            onboardingState={onboarding.state}
            currentStep={onboarding.currentStep}
            isFooterDismissed={onboarding.isFooterDismissed}
            hasSourceLinked={onboarding.hasSourceLinked}
            hasHarnessInstalled={onboarding.hasHarnessInstalled}
            isDark={isDark}
            onNext={onboarding.onNext}
            onPrev={onboarding.onPrev}
            onSkip={onboarding.onSkip}
            onResume={onboarding.onResume}
            onReset={onboarding.onReset}
            onDismiss={onboarding.onDismiss}
          />
        </div>
      )}

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
            boxShadow: isError ? '0 0 8px rgba(239, 68, 68, 0.6)' : 'none',
            flexShrink: 0,
            transition: 'all 0.2s ease'
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
