import React from 'react';
import ReactMarkdown from 'react-markdown';
import { openUrl } from '@tauri-apps/plugin-opener';
import { GUIDES_MAP } from '../constants/canvas';

export interface GuidesModalProps {
  guidesOpen: boolean;
  onCloseGuides: () => void;
  activeGuide: string | null;
  onCloseActiveGuide: () => void;
  onSelectGuide?: (guideKey: string) => void;
}

export const GuidesModal: React.FC<GuidesModalProps> = ({
  guidesOpen,
  onCloseGuides,
  activeGuide,
  onCloseActiveGuide,
  onSelectGuide,
}) => {
  return (
    <>
      {/* Quickstart Guides Modal */}
      {guidesOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={onCloseGuides}>
          <div onClick={e => e.stopPropagation()} style={{ width: '520px', backgroundColor: 'var(--zen-surface)', border: 'none', borderRadius: '20px', boxShadow: 'var(--zen-shadow-modal)', overflow: 'hidden', padding: '28px', display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: 'none', paddingBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--zen-text)' }}>FRUGALLM // QUICKSTART GUIDES</h2>
              <button onClick={onCloseGuides} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--zen-text-secondary)', fontWeight: 'bold' }}>✕</button>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--zen-text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
              Welcome to the FrugalLLM Central Hub. Select a guide below to learn how to configure your neural topology and orchestrate your AI agents:
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div 
                style={{ padding: '14px 16px', border: 'none', borderRadius: '14px', backgroundColor: 'var(--zen-surface-hover)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', transition: 'background-color 0.15s ease' }} 
                onClick={() => onSelectGuide?.('agents')}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--zen-surface-secondary)'} 
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--zen-surface-hover)'}
              >
                <div style={{ width: '28px', height: '28px', backgroundColor: '#171717', color: '#FFFFFF', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '0.85rem', borderRadius: '9999px' }}>1</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--zen-text)', marginBottom: '2px' }}>Defining JSON Schemas</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--zen-text-secondary)' }}>Learn how to force agents to return strict data formats.</div>
                </div>
              </div>
              
              <div 
                style={{ padding: '14px 16px', border: 'none', borderRadius: '14px', backgroundColor: 'var(--zen-surface-hover)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', transition: 'background-color 0.15s ease' }} 
                onClick={() => onSelectGuide?.('ollama')}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--zen-surface-secondary)'} 
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--zen-surface-hover)'}
              >
                <div style={{ width: '28px', height: '28px', backgroundColor: '#171717', color: '#FFFFFF', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '0.85rem', borderRadius: '9999px' }}>2</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--zen-text)', marginBottom: '2px' }}>Connecting Local Ollama</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--zen-text-secondary)' }}>How to run completely private models locally on port 11434.</div>
                </div>
              </div>
              
              <div 
                style={{ padding: '14px 16px', border: 'none', borderRadius: '14px', backgroundColor: 'var(--zen-surface-hover)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', transition: 'background-color 0.15s ease' }} 
                onClick={() => onSelectGuide?.('openrouter')}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--zen-surface-secondary)'} 
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--zen-surface-hover)'}
              >
                <div style={{ width: '28px', height: '28px', backgroundColor: '#171717', color: '#FFFFFF', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '0.85rem', borderRadius: '9999px' }}>3</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--zen-text)', marginBottom: '2px' }}>Advanced OpenRouter Multiplexing</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--zen-text-secondary)' }}>Route queries dynamically to save costs and avoid rate limits.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Markdown Guide Modal */}
      {activeGuide && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={onCloseActiveGuide}>
          <div onClick={e => e.stopPropagation()} style={{ width: '700px', maxHeight: '80vh', backgroundColor: 'var(--zen-surface)', border: '1px solid var(--zen-border)', borderRadius: '20px', boxShadow: 'var(--zen-shadow-modal)', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: 'var(--zen-surface-hover)', color: 'var(--zen-text)', borderBottom: '1px solid var(--zen-border)' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700,  fontFamily: 'inherit' }}>FRUGALLM // GUIDE</h2>
              <button onClick={onCloseActiveGuide} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--zen-text-secondary)', fontWeight: 'bold' }}>✕</button>
            </div>
            
            <div style={{ padding: '30px', overflowY: 'auto', lineHeight: 1.6, color: 'var(--zen-text)' }}>
              <ReactMarkdown 
                components={{
                  a: ({node, ...props}) => (
                    <a {...props} onClick={(e) => {
                      e.preventDefault();
                      if (props.href) openUrl(props.href);
                    }} style={{ color: '#ea580c', textDecoration: 'underline', cursor: 'pointer' }} />
                  ),
                  h1: ({node, ...props}) => <h1 {...props} style={{ marginTop: 0, borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }} />,
                  h2: ({node, ...props}) => <h2 {...props} style={{ marginTop: '1.5em', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }} />,
                  h3: ({node, ...props}) => <h3 {...props} style={{ marginTop: '1.2em' }} />,
                  code: ({node, className, children, ...props}: any) => {
                    const match = /language-([a-zA-Z0-9]+)/.exec(className || '')
                    return !match ? (
                      <code {...props} style={{ backgroundColor: 'var(--zen-surface-hover)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.9em', color: '#ea580c' }}>
                        {children}
                      </code>
                    ) : (
                      <div style={{ backgroundColor: 'var(--zen-accent)', color: '#f3f4f6', padding: '12px', borderRadius: '4px', overflowX: 'auto', marginBottom: '16px', fontFamily: 'monospace', fontSize: '0.9em' }}>
                        <code {...props}>{children}</code>
                      </div>
                    )
                  }
                }}
              >
                {GUIDES_MAP[activeGuide]}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

