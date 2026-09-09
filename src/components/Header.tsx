import React from 'react';
import { FrugaLLMIcon } from './icons/ProviderIcons';
import { Sun, Moon } from 'lucide-react';
import en from '../locales/en.json';

export interface HeaderProps {
  headerRef?: React.RefObject<HTMLElement | null>;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenGuides: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  headerRef,
  isDark,
  onToggleTheme,
  onOpenGuides,
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
        <button
          onClick={onOpenGuides}
          data-testid="header-guides-btn"
          className="btn-cta btn-cta-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            border: '1px solid var(--zen-border-subtle)',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: 'var(--zen-text)',
            fontFamily: 'inherit',
          }}
        >
          {en.footer?.guides || 'Quickstart Guides'}
        </button>
      </div>
    </header>
  );
};

