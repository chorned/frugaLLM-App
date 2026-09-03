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
      backgroundColor: '#FFFFFF',
      color: 'var(--zen-text)',
      fontFamily: 'inherit',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '1200px', width: '100%', height: '80vh' }}>
        <img src="/frugallm-icon.png" alt="FrugaLLM Logo" style={{ width: '80px', height: '80px', marginBottom: '20px', borderRadius: '16px' }} />
        <h2 style={{ color: 'var(--zen-text)', marginBottom: '20px', letterSpacing: '-0.01em', textAlign: 'center', fontWeight: 700, fontSize: '1.25rem' }}>Starting FrugaLLM...</h2>
        <div 
          ref={containerRef}
          style={{
            width: '100%',
            flex: 1,
            backgroundColor: '#18181B',
            color: '#f3f4f6',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #27272A',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontFamily: '"Courier New", Courier, monospace',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.08)'
          }}
        >
        {logs.map((log, index) => (
          <div key={index} style={{ fontSize: '0.9rem', color: '#f3f4f6' }}>
            <span style={{ color: '#71717A', marginRight: '10px' }}>[{new Date().toISOString().split('T')[1].split('.')[0]}]</span>
            {log}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
          <span style={{ width: '8px', height: '16px', backgroundColor: '#FFFFFF', animation: 'blink 1s step-end infinite' }} />
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
