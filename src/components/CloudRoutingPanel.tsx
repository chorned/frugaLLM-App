import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, ArrowUpToLine, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface CloudModel {
  model: string;
  provider: string;
  iq?: number;
}

export const CloudRoutingPanel = () => {
  const [chain, setChain] = useState<CloudModel[]>([]);
  const [overrides, setOverrides] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refreshChain = async () => {
    setLoading(true);
    setErrors({});
    try {
      const configRes: any = await invoke('get_frugallm_config');
      setOverrides(configRes.manual_model_overrides || []);
      const res: any = await invoke('refresh_routing_chain');
      const filteredRes = res.filter((m: CloudModel) => !m.model.includes('computer-use'));
      setChain(filteredRes);
    } catch (err) {
      console.error('Failed to refresh routing chain:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    const setup = async () => {
      unlisten = await listen('proxy_model_error', (event: any) => {
        const payload = event.payload;
        setErrors(prev => ({
          ...prev,
          [payload.model]: payload.error
        }));
      });
      
      try {
        const res: any = await invoke('get_frugallm_config');
        setOverrides(res.manual_model_overrides || []);
        const cRes: any = await invoke('get_routing_chain');
        if (cRes && cRes.length > 0) {
          const filteredCRes = cRes.filter((m: CloudModel) => !m.model.includes('computer-use'));
          setChain(filteredCRes);
        }
        refreshChain();
      } catch (e) {
        console.error(e);
        refreshChain();
      }
    };
    
    setup();
    
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleMove = async (oldIdx: number, newIdx: number) => {
    if (oldIdx === newIdx || oldIdx < 0 || newIdx < 0 || newIdx >= chain.length) return;

    const newChain = [...chain];
    const [moved] = newChain.splice(oldIdx, 1);
    newChain.splice(newIdx, 0, moved);

    const newOverrides: string[] = [];
    for (let i = 0; i < newChain.length; i++) {
      const model = newChain[i].model;
      if (i === newIdx) {
        newOverrides.push(model);
      } else if (overrides.includes(model)) {
        newOverrides.push(model);
      } else {
        newOverrides.push("");
      }
    }
    
    while (newOverrides.length > 0 && newOverrides[newOverrides.length - 1] === "") {
        newOverrides.pop();
    }

    setOverrides(newOverrides);
    setChain(newChain); // Optimistic UI update

    try {
      await invoke('set_model_override', { overrides: newOverrides });
      await refreshChain();
    } catch(err) {
       console.error("Failed to save override", err);
    }
  };

  const unpinModel = async (e: React.MouseEvent, modelId: string) => {
    e.stopPropagation();
    const newOverrides = overrides.map(id => id === modelId ? "" : id);
    while (newOverrides.length > 0 && newOverrides[newOverrides.length - 1] === "") {
        newOverrides.pop();
    }
    setOverrides(newOverrides);
    
    try {
      await invoke('set_model_override', { overrides: newOverrides });
      await refreshChain();
    } catch(err) {
       console.error("Failed to save override", err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--zen-text)' }}>
          GLOBAL ROUTING POOL
        </div>
        <button 
          onClick={refreshChain} 
          disabled={loading}
          style={{ 
            fontSize: '0.65rem', 
            fontWeight: 600, 
            padding: '2px 6px', 
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
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
        {chain.length === 0 && !loading && (
          <div style={{ fontSize: '0.75rem', color: '#6b7280', textAlign: 'center', padding: '8px' }}>
            No models found. Please configure a provider.
          </div>
        )}
        <AnimatePresence>
          {chain.map((item, index) => {
            const isActive = index === 0;
            const isPinned = overrides.includes(item.model);
            
            return (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                key={`${item.provider}-${item.model}`}
                data-testid={`model-row-${item.model}`}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '6px 10px', 
                  backgroundColor: isActive ? 'var(--zen-surface-hover)' : 'var(--zen-surface)', 
                  border: `1px solid ${isActive ? 'var(--zen-accent)' : 'var(--zen-border)'}`,
                  borderRadius: '6px', 
                  gap: '8px',
                  position: 'relative',
                }}>
              
              {/* RANK CONTROLS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <button 
                  onClick={() => handleMove(index, 0)}
                  disabled={index === 0}
                  title="Rank Top"
                  style={{ background: 'transparent', border: 'none', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.2 : 0.7, padding: '2px', display: 'flex' }}
                  onMouseEnter={(e) => { if(index !== 0) e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { if(index !== 0) e.currentTarget.style.opacity = '0.7'; }}
                >
                  <ArrowUpToLine size={12} color="var(--zen-text)" />
                </button>
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button 
                    onClick={() => handleMove(index, index - 1)}
                    disabled={index === 0}
                    title="Rank Up"
                    style={{ background: 'transparent', border: 'none', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.2 : 0.7, padding: '2px', display: 'flex' }}
                    onMouseEnter={(e) => { if(index !== 0) e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { if(index !== 0) e.currentTarget.style.opacity = '0.7'; }}
                  >
                    <ChevronUp size={14} color="var(--zen-text)" />
                  </button>
                  <button 
                    onClick={() => handleMove(index, index + 1)}
                    disabled={index === chain.length - 1}
                    title="Rank Down"
                    style={{ background: 'transparent', border: 'none', cursor: index === chain.length - 1 ? 'default' : 'pointer', opacity: index === chain.length - 1 ? 0.2 : 0.7, padding: '2px', display: 'flex' }}
                    onMouseEnter={(e) => { if(index !== chain.length - 1) e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { if(index !== chain.length - 1) e.currentTarget.style.opacity = '0.7'; }}
                  >
                    <ChevronDown size={14} color="var(--zen-text)" />
                  </button>
                </div>
              </div>
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
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: isActive ? 700 : 600, color: 'var(--zen-text)' }}>
                  {item.model}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase' }}>
                    {item.provider}
                  </span>
                  {item.iq !== undefined && (
                    <span style={{ fontSize: '0.65rem', color: '#fff', backgroundColor: 'var(--zen-accent)', padding: '2px 6px', borderRadius: '12px', fontWeight: 700, letterSpacing: '0.05em', boxShadow: '0 0 8px rgba(139, 92, 246, 0.4)' }}>
                      ⚡ SCORE: {item.iq === 0 ? "N/A" : item.iq}
                    </span>
                  )}
                  {errors[item.model] && (
                    <span style={{ fontSize: '0.65rem', color: '#fff', backgroundColor: '#ef4444', padding: '2px 6px', borderRadius: '12px', fontWeight: 700, letterSpacing: '0.05em', boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)' }}>
                      SKIPPED: {errors[item.model].includes("429") ? "429 (QUOTA)" : "ERROR"}
                    </span>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isPinned && (
                  <button 
                    onClick={(e) => unpinModel(e, item.model)}
                    title="Cancel Rank (Drop to Dynamic)"
                    style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.65rem', 
                      fontWeight: 700, 
                      color: 'var(--zen-text)', 
                      backgroundColor: 'transparent', 
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: '1px solid var(--zen-border)',
                      letterSpacing: '0.05em',
                      transition: 'all 0.2s',
                      opacity: 0.8
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--zen-surface-hover)'; e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.opacity = '0.8'; }}
                  >
                    <X size={12} color="var(--zen-text)" />
                    CANCEL RANK
                  </button>
                )}
                {isActive && !isPinned && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--zen-accent)', pointerEvents: 'none' }}>
                    ACTIVE
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
        </AnimatePresence>
      </div>
    </div>
  );
};
