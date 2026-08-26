import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface CloudModel {
  model: string;
  provider: string;
  score?: number;
}

export const CloudRoutingPanel = () => {
  const [chain, setChain] = useState<CloudModel[]>([]);
  const [loading, setLoading] = useState(false);


  const refreshChain = async () => {
    setLoading(true);
    try {
      const res: any = await invoke('refresh_routing_chain');
      setChain(res);
    } catch (err) {
      console.error('Failed to refresh routing chain:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Show cached chain immediately if it exists, but always fetch fresh models
    invoke('get_routing_chain').then((res: any) => {
      if (res && res.length > 0) {
        setChain(res);
      }
      refreshChain();
    }).catch((e) => {
      console.error(e);
      refreshChain();
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--zen-text)' }}>
          GLOBAL ROUTING POOL
        </div>
        <button 
          onClick={refreshChain} 
          disabled={loading}
          style={{ 
            fontSize: '0.7rem', 
            fontWeight: 600, 
            padding: '4px 8px', 
            borderRadius: '4px',
            backgroundColor: 'var(--zen-surface-hover)', 
            border: '1px solid var(--zen-border)',
            color: 'var(--zen-text)',
            cursor: loading ? 'wait' : 'pointer'
          }}
        >
          {loading ? 'REFRESHING...' : 'REFRESH'}
        </button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
        {chain.length === 0 && !loading && (
          <div style={{ fontSize: '0.8rem', color: '#6b7280', textAlign: 'center', padding: '12px' }}>
            No models found. Please configure a provider.
          </div>
        )}
        {chain.map((item, index) => {
          const isActive = index === 0;
          return (
            <div key={`${item.provider}-${item.model}-${index}`} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '10px 12px', 
              backgroundColor: isActive ? 'var(--zen-surface-hover)' : 'var(--zen-surface)', 
              border: `1px solid ${isActive ? 'var(--zen-accent)' : 'var(--zen-border)'}`, 
              borderRadius: '8px', 
              gap: '12px',
              position: 'relative'
            }}>
              {isActive && (
                <div style={{
                  position: 'absolute',
                  left: '-4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--zen-accent)',
                  boxShadow: '0 0 8px var(--zen-accent)'
                }} />
              )}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: isActive ? 700 : 600, color: 'var(--zen-text)' }}>
                  {item.model}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase' }}>
                    {item.provider}
                  </span>
                  {item.score !== undefined && (
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      color: 'var(--zen-text)',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid var(--zen-border)'
                    }}>
                      IQ: {item.score.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              {isActive && (
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--zen-accent)' }}>
                  ACTIVE
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
