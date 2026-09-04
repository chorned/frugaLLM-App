import React, { useEffect, useRef } from 'react';
import { FrugaLLMIcon } from './icons/ProviderIcons';
import { useTheme, Theme } from '../hooks/useTheme';
import en from '../locales/en.json';

interface TerminalLoaderProps {
  logs: string[];
  theme?: Theme;
}

export const TerminalLoader: React.FC<TerminalLoaderProps> = ({ logs, theme: propTheme }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme: currentTheme, isDark } = useTheme();
  const activeTheme = propTheme ?? currentTheme;
  const isDarkMode = activeTheme === 'dark' || (propTheme === undefined && isDark);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      data-testid="terminal-loader"
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--zen-app-bg)',
        color: 'var(--zen-text)',
        fontFamily: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        boxSizing: 'border-box',
        transition: 'background-color 0.2s ease, color 0.2s ease'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '1200px', width: '100%', height: '80vh' }}>
        <FrugaLLMIcon
          size={80}
          title={en.bootScreen?.logoAlt || 'FrugaLLM Logo'}
          aria-label={en.bootScreen?.logoAlt || 'FrugaLLM Logo'}
          role="img"
          data-testid="boot-screen-logo"
          style={{
            marginBottom: '20px',
            color: 'var(--zen-text)',
            borderRadius: '16px'
          }}
        />
        <h2 style={{
          color: 'var(--zen-text)',
          marginBottom: '20px',
          letterSpacing: '-0.01em',
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '1.25rem'
        }}>
          {en.bootScreen?.title || 'Starting FrugaLLM...'}
        </h2>
        <div 
          ref={containerRef}
          data-testid="terminal-loader-console"
          style={{
            width: '100%',
            flex: 1,
            backgroundColor: isDarkMode ? '#14110E' : '#FFFFFF',
            color: 'var(--zen-text)',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid var(--zen-border)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontFamily: '"Courier New", Courier, monospace',
            boxShadow: isDarkMode ? '0 12px 32px rgba(0, 0, 0, 0.4)' : '0 12px 32px rgba(0, 0, 0, 0.08)',
            transition: 'background-color 0.2s ease, border-color 0.2s ease'
          }}
        >
          {logs.map((log, index) => (
            <div key={index} style={{ fontSize: '0.9rem', color: 'var(--zen-text)' }}>
              <span style={{ color: 'var(--zen-text-secondary)', marginRight: '10px' }}>[{new Date().toISOString().split('T')[1].split('.')[0]}]</span>
              {log}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
            <span style={{ width: '8px', height: '16px', backgroundColor: 'var(--zen-text)', animation: 'blink 1s step-end infinite' }} />
          </div>
        </div>
      </div>
      <style>
        {`
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}
      </style>
    </div>
  );
};
