import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, ArrowUpToLine, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getFrugallmConfig, refreshRoutingChain as fetchRoutingChain, getRoutingChain, setModelOverride } from '../services/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import en from '../locales/en.json';
import { getProviderIcon } from './icons/ProviderIcons';
import { isOpenRouterFreeAlias, MIN_CONTEXT_WINDOW } from '../router';
import { Tooltip } from './Tooltip';

export interface CloudModel {
  model: string;
  provider: string;
  iq?: number;
  context_length?: number;
}

const isEligibleRoutingModel = (m: CloudModel): boolean => {
  if (!m?.model) return false;
  if (m.model.includes('computer-use')) return false;
  if (isOpenRouterFreeAlias(m.model)) return false;
  if (m.model.startsWith('frugallm-active')) return false;
  if (typeof m.context_length === 'number' && m.context_length < MIN_CONTEXT_WINDOW) return false;
  return true;
};

export interface CloudRoutingPanelProps {
  overrides?: string[];
  onOverridesChange?: (newOverrides: string[]) => void;
}

export const CloudRoutingPanel = ({ overrides: propOverrides, onOverridesChange }: CloudRoutingPanelProps = {}) => {
  const [chain, setChain] = useState<CloudModel[]>([]);
  const [internalOverrides, setInternalOverrides] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const activeOverrides = propOverrides !== undefined ? propOverrides : internalOverrides;
  const t = en.routingGraph?.cloudRoutingPanel;

  const refreshChain = async () => {
    setLoading(true);
    setErrors({});
    try {
      const configRes: any = await getFrugallmConfig();
      if (propOverrides === undefined) {
        setInternalOverrides(configRes?.manual_model_overrides || []);
      }
      const res: any = await fetchRoutingChain();
      const filteredRes = (res || []).filter(isEligibleRoutingModel);
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
        const res: any = await getFrugallmConfig();
        if (propOverrides === undefined) {
          setInternalOverrides(res?.manual_model_overrides || []);
        }
        const cRes: any = await getRoutingChain();
        if (Array.isArray(cRes) && cRes.length > 0) {
          const filteredCRes = cRes.filter(isEligibleRoutingModel);
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
      } else if (activeOverrides.includes(model)) {
        newOverrides.push(model);
      } else {
        newOverrides.push("");
      }
    }
    
    while (newOverrides.length > 0 && newOverrides[newOverrides.length - 1] === "") {
        newOverrides.pop();
    }

    setChain(newChain); // Immediate optimistic UI update

    if (onOverridesChange) {
      // Controlled mode (inside settings panel): changes are temporary until user taps SAVE CHANGES
      onOverridesChange(newOverrides);
    } else {
      // Standalone mode: immediate IPC persistence
      setInternalOverrides(newOverrides);
      try {
        await setModelOverride(newOverrides as any);
        await refreshChain();
      } catch(err) {
         console.error("Failed to save override", err);
      }
    }
  };

  const unpinModel = async (e: React.MouseEvent, modelId: string) => {
    e.stopPropagation();
    const newOverrides = activeOverrides.map(id => id === modelId ? "" : id);
    while (newOverrides.length > 0 && newOverrides[newOverrides.length - 1] === "") {
        newOverrides.pop();
    }
    
    if (onOverridesChange) {
      // Controlled mode: temporary until user taps SAVE CHANGES
      onOverridesChange(newOverrides);
    } else {
      // Standalone mode: immediate IPC persistence
      setInternalOverrides(newOverrides);
      try {
        await setModelOverride(newOverrides as any);
        await refreshChain();
      } catch(err) {
         console.error("Failed to save override", err);
      }
    }
  };

  return (
    <div data-testid="cloud-routing-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
        <Tooltip 
          text={t?.infoTooltip || "FrugaLLM prioritizes models from top to bottom. Requests target the top model first and instantly fail over to lower tiers if rate limits or errors occur."}
          triggerTestId="btn-cloud-routing-info"
          ariaLabel="Info about global routing pool"
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--zen-text)', letterSpacing: '0.02em' }}>
            {t?.title || 'GLOBAL ROUTING POOL'}
          </span>
        </Tooltip>
        <button 
          className="btn-cta btn-cta-secondary"
          onClick={refreshChain} 
          disabled={loading}
          style={{ 
            fontSize: '0.68rem', 
            fontWeight: 500, 
            padding: '4px 10px', 
            borderRadius: '9999px',
            backgroundColor: 'var(--zen-surface-hover)', 
            border: 'none',
            color: 'var(--zen-text)',
            cursor: loading ? 'wait' : 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--zen-surface-secondary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--zen-surface-hover)'; }}
        >
          {loading ? (t?.refreshing || 'REFRESHING...') : (t?.refresh || 'REFRESH')}
        </button>
      </div>
      
      <div 
        className="routing-pool-scrollbar" 
        style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '365px', overflowY: 'auto', paddingRight: '6px' }}
      >
        {chain.length === 0 && !loading && (
          <div style={{ fontSize: '0.78rem', color: 'var(--zen-text-secondary)', textAlign: 'center', padding: '24px 12px', lineHeight: 1.5 }}>
            {t?.noModels || 'When you have connect one or more intelligence sources, all available models will be listed here.'}
          </div>
        )}
        <AnimatePresence>
          {chain.map((item, index) => {
            const isActive = index === 0;
            const isPinned = activeOverrides.includes(item.model);
            
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
                  padding: '8px 12px', 
                  backgroundColor: isActive ? 'var(--zen-surface-hover)' : 'var(--zen-surface)', 
                  border: 'none',
                  borderRadius: '12px', 
                  gap: '10px',
                  position: 'relative',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                  transition: 'background-color 0.15s ease'
                }}>
              
              {/* RANK CONTROLS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <button 
                  onClick={() => handleMove(index, 0)}
                  disabled={index === 0}
                  title={t?.rankTop || "Rank Top"}
                  style={{ background: 'transparent', border: 'none', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.2 : 0.7, padding: '2px', display: 'flex', borderRadius: '4px' }}
                  onMouseEnter={(e) => { if(index !== 0) e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { if(index !== 0) e.currentTarget.style.opacity = '0.7'; }}
                >
                  <ArrowUpToLine size={13} color="var(--zen-text)" />
                </button>
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button 
                    onClick={() => handleMove(index, index - 1)}
                    disabled={index === 0}
                    title={t?.rankUp || "Rank Up"}
                    style={{ background: 'transparent', border: 'none', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.2 : 0.7, padding: '2px', display: 'flex', borderRadius: '4px' }}
                    onMouseEnter={(e) => { if(index !== 0) e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { if(index !== 0) e.currentTarget.style.opacity = '0.7'; }}
                  >
                    <ChevronUp size={14} color="var(--zen-text)" />
                  </button>
                  <button 
                    onClick={() => handleMove(index, index + 1)}
                    disabled={index === chain.length - 1}
                    title={t?.rankDown || "Rank Down"}
                    style={{ background: 'transparent', border: 'none', cursor: index === chain.length - 1 ? 'default' : 'pointer', opacity: index === chain.length - 1 ? 0.2 : 0.7, padding: '2px', display: 'flex', borderRadius: '4px' }}
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
                  left: '-3px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#171717'
                }} />
              )}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: isActive ? 600 : 450, color: 'var(--zen-text)' }}>
                  {item.model}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {getProviderIcon(item.provider, { size: 12 })}
                    <span style={{ fontSize: '0.68rem', color: 'var(--zen-text-secondary)', textTransform: 'uppercase', fontWeight: 500, letterSpacing: '0.02em' }}>
                      {item.provider}
                    </span>
                  </div>
                  {item.iq !== undefined && (
                    <>
                      <span style={{ width: '1px', height: '9px', backgroundColor: 'var(--zen-border)', opacity: 0.6, margin: '0 1px' }} />
                      <span style={{ fontSize: '0.68rem', color: 'var(--zen-text-secondary)', fontWeight: 500, letterSpacing: '0.02em', display: 'inline-flex', alignItems: 'center' }}>
                        {t?.scorePrefix || 'SCORE: '}{(item.iq && item.iq > 0) ? item.iq : 'N/A'}
                      </span>
                    </>
                  )}
                  {errors[item.model] && (() => {
                    const errLower = errors[item.model].toLowerCase();
                    const isTimeout = errLower.includes("timeout") || errLower.includes("ttft");
                    const isQuota = errors[item.model].includes("429");
                    const color = isTimeout ? '#D97706' : '#DC2626';
                    const bgColor = isTimeout ? '#FEF3C7' : '#FEE2E2';
                    const label = isQuota 
                      ? (t?.skippedQuota || "SKIPPED: 429 (QUOTA)") 
                      : isTimeout 
                      ? (t?.skippedTimeout || "SKIPPED: TIMEOUT (COOLDOWN)") 
                      : (t?.skippedError || "SKIPPED: ERROR");

                    return (
                      <Tooltip 
                        text={`${t?.modelErrorHelp || 'Why was this skipped?'} (${errors[item.model]})`}
                        triggerTestId={`btn-model-error-help-${item.model}`}
                        ariaLabel={`Help for model ${item.model} error`}
                        style={{ pointerEvents: 'auto' }}
                      >
                        <span style={{ fontSize: '0.65rem', color, backgroundColor: bgColor, padding: '2px 8px', borderRadius: '9999px', fontWeight: 600, letterSpacing: '0.02em' }}>
                          {label}
                        </span>
                      </Tooltip>
                    );
                  })()}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isPinned && (
                  <button 
                    className="btn-cta btn-cta-secondary"
                    onClick={(e) => unpinModel(e, item.model)}
                    title={t?.resetRankTitle || "Reset Rank (Drop to Dynamic)"}
                    style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.68rem', 
                      fontWeight: 500, 
                      padding: '4px 10px', 
                      borderRadius: '9999px',
                      letterSpacing: '0.02em',
                    }}
                  >
                    <X size={12} color="var(--zen-text)" />
                    {t?.resetButton || "Reset"}
                  </button>
                )}
                {isActive && !isPinned && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#171717', backgroundColor: '#E4E4E7', padding: '2px 8px', borderRadius: '9999px', pointerEvents: 'none' }}>
                    {t?.active || "ACTIVE"}
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
