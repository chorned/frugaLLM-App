import React from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { UpdateNotification } from './UpdateNotification';
import en from '../locales/en.json';

export interface FooterProps {
  onOpenGuides: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenGuides }) => {
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
          href="#docs" 
          data-testid="footer-link-docs"
          onClick={(e) => { e.preventDefault(); }} 
          style={{ color: 'var(--zen-text-secondary)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--zen-text)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--zen-text-secondary)'}
        >
          {en.footer?.documentation || 'Documentation'}
        </a>
        <a 
          href="https://github.com" 
          target="_blank" 
          rel="noreferrer"
          data-testid="footer-link-github"
          onClick={(e) => { e.preventDefault(); openUrl('https://github.com').catch(() => {}); }} 
          style={{ color: 'var(--zen-text-secondary)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--zen-text)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--zen-text-secondary)'}
        >
          {en.footer?.github || 'GitHub'}
        </a>
        <a 
          href="#guides" 
          data-testid="footer-link-guides"
          onClick={(e) => { e.preventDefault(); onOpenGuides(); }} 
          style={{ color: 'var(--zen-text-secondary)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--zen-text)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--zen-text-secondary)'}
        >
          {en.footer?.guides || 'Quickstart Guides'}
        </a>
        <a 
          href="#privacy" 
          data-testid="footer-link-privacy"
          onClick={(e) => { e.preventDefault(); }} 
          style={{ color: 'var(--zen-text-secondary)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--zen-text)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--zen-text-secondary)'}
        >
          {en.footer?.privacy || 'Privacy & Telemetry'}
        </a>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <UpdateNotification />
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
        <span style={{ fontWeight: 500, color: 'var(--zen-text-secondary)' }}>{en.footer?.status || 'System Ready'}</span>
      </div>
    </footer>
  );
};

