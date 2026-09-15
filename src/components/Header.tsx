import React from 'react';
import { FrugaLLMIcon } from './icons/ProviderIcons';
import { Sun, Moon, Bug } from 'lucide-react';
import en from '../locales/en.json';

export interface HeaderProps {
  headerRef?: React.RefObject<HTMLElement | null>;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenIssueReporter?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  headerRef,
  isDark,
  onToggleTheme,
  onOpenIssueReporter,
}) => {
  return (
    <header 
      ref={headerRef}
      data-testid="app-header" 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '10px 20px', 
        backgroundColor: 'var(--zen-header-bg)', 
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--zen-header-border)',
        flexShrink: 0,
        zIndex: 10
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <FrugaLLMIcon 
          size={22} 
          title="FrugaLLM Logo"
          aria-label="FrugaLLM Logo"
          data-testid="header-frugallm-icon"
          style={{ color: 'var(--zen-text)', flexShrink: 0 }} 
        />
        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--zen-text)', letterSpacing: '-0.01em' }}>
          {en.header?.brandName || 'FrugaLLM'}
        </span>

        {/* Beta Banner */}
        <div
          data-testid="header-beta-banner"
          title={en.header?.betaTooltip || 'FrugaLLM is currently in active Beta development'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            height: '20px',
            padding: '0 8px',
            borderRadius: '9999px',
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(217, 119, 6, 0.1)',
            border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(217, 119, 6, 0.25)',
            color: isDark ? '#FBBF24' : '#B45309',
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            lineHeight: 1,
            boxSizing: 'border-box',
            userSelect: 'none',
          }}
        >
          <span
            data-testid="header-beta-dot"
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: isDark ? '#FBBF24' : '#D97706',
              boxShadow: isDark ? '0 0 6px rgba(245, 158, 11, 0.6)' : '0 0 4px rgba(217, 119, 6, 0.4)',
              flexShrink: 0,
            }}
          />
          <span>{en.header?.betaBanner || 'Beta'}</span>
        </div>

        {/* Report Issue CTA */}
        {onOpenIssueReporter && (
          <button
            type="button"
            data-testid="header-report-issue-btn"
            onClick={onOpenIssueReporter}
            title={en.header?.reportIssueTooltip || 'Report an issue or send diagnostic telemetry'}
            aria-label={en.header?.reportIssue || 'Report Issue'}
            className="btn-cta"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              height: '20px',
              padding: '0 8px',
              borderRadius: '9999px',
              backgroundColor: 'var(--zen-pill-bg)',
              border: '1px solid var(--zen-pill-border)',
              color: 'var(--zen-text-secondary)',
              fontSize: '0.68rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              outline: 'none',
              lineHeight: 1,
              boxSizing: 'border-box',
              userSelect: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--zen-text)';
              e.currentTarget.style.borderColor = 'var(--zen-border-input)';
              e.currentTarget.style.backgroundColor = 'var(--zen-surface-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--zen-text-secondary)';
              e.currentTarget.style.borderColor = 'var(--zen-pill-border)';
              e.currentTarget.style.backgroundColor = 'var(--zen-pill-bg)';
            }}
          >
            <Bug size={11} style={{ flexShrink: 0, opacity: 0.85 }} />
            <span>{en.header?.reportIssue || 'Report Issue'}</span>
          </button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={onToggleTheme}
          data-testid="header-theme-toggle-btn"
          className="btn-cta btn-cta-icon"
          aria-label={en.header?.toggleTheme || "Toggle theme"}
          role="button"
          title={isDark ? (en.header?.themeLight || "Switch to light theme") : (en.header?.themeDark || "Switch to dark theme")}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            padding: 0,
            backgroundColor: 'var(--zen-pill-bg)',
            border: '1px solid var(--zen-pill-border)',
            borderRadius: '9999px',
            color: 'var(--zen-text)',
          }}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  );
};

