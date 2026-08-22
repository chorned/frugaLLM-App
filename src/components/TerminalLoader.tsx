import React, { useEffect, useRef } from 'react';

interface TerminalLoaderProps {
  logs: string[];
}

export const TerminalLoader: React.FC<TerminalLoaderProps> = ({ logs }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: 'var(--zen-surface-hover)',
      color: 'var(--zen-text)',
      fontFamily: 'inherit',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '800px', width: '100%' }}>
        <img src="/frugallm-icon.png" alt="FrugaLLM Logo" style={{ width: '100px', height: '100px', marginBottom: '24px' }} />
        <h2 style={{ color: 'var(--zen-text)', marginBottom: '20px', letterSpacing: '2px', textAlign: 'center', fontWeight: 600 }}>Starting FrugaLLM...</h2>
        <div 
          ref={containerRef}
          style={{
            width: '100%',
            height: '300px',
            backgroundColor: '#ffffff',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontFamily: '"Courier New", Courier, monospace',
            boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}
        >
        {logs.map((log, index) => (
          <div key={index} style={{ fontSize: '0.9rem', color: '#1f2937' }}>
            <span style={{ color: '#6b7280', marginRight: '10px' }}>[{new Date().toISOString().split('T')[1].split('.')[0]}]</span>
            {log}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
          <span style={{ width: '10px', height: '18px', backgroundColor: 'var(--zen-accent)', animation: 'blink 1s step-end infinite' }} />
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
