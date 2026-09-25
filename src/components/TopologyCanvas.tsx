import React from 'react';
import { AppNode, Icons, NODE_WIDTH } from '../constants/canvas';
import { HardwareNode, InfoField, StatusLight } from './NodeWidgets';
import { OllamaIcon, getProviderIcon } from './icons/ProviderIcons';
import { openUrl } from '@tauri-apps/plugin-opener';
import en from '../locales/en.json';
import { Tooltip } from './Tooltip';
import { calculateMoneySaved } from '../utils/pricing';

export interface TopologyCanvasProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  mainContainerRef: React.RefObject<HTMLDivElement | null>;
  centralNodeRef: React.MutableRefObject<HTMLDivElement | null>;
  outerNodeRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  nodes: AppNode[];
  selectedNodeId: string | null;
  terminalMode: string | null;
  portConflict: any;
  frugalConfig?: any;
  isOllamaInstalled: boolean;
  setSelectedNodeId: (id: string | null) => void;
  setPortConflict: (conflict: any) => void;
  handleCanvasClick: (e: any) => void;
  handleCanvasMouseDown: (e: any) => void;
  handleNodeClick: (e: any, nodeId: string) => void;
  autoScale: number;
  pan: { x: number; y: number };
  zoom: number;
  lines: Array<{ id: string; x1: number; y1: number; x2: number; y2: number; isActive?: boolean; direction?: 'forward' | 'reverse' }>;
  activeProxyState: any;
  isHermesInstalled: boolean;
  isOpenCodeInstalled: boolean;
  activeProcesses: Record<string, boolean>;
  hermesVersion: string;
  opencodeVersion: string;
  routingChain?: any[];
  latestTelemetry?: any;
}

export function formatModelDisplayName(rawModel: string | undefined | null): string {
  if (!rawModel || rawModel === 'None' || rawModel === 'Unknown') return 'None';
  return rawModel
    .replace(/^library\//, '')
    .replace(/^models\//, '')
    .replace(/frugallm-active.*/, 'gemma4')
    .replace(/:latest$/, '');
}

export function getEndpointStatusColor(rawStatus: string | undefined, isActive = false): string {
  if (!rawStatus) {
    return isActive ? '#eab308' : 'var(--zen-text-secondary)';
  }
  const s = rawStatus.trim().toLowerCase();

  // Green: The endpoint is alive (200, 200 OK, 2xx)
  if (s === '200 ok' || s === '200' || /^2\d\d$/i.test(s) || s === 'alive' || s === 'healthy') {
    return '#10B981';
  }

  // Yellow: The endpoint is temporarily exhausted (429, 500, 503, 5xx, timeout, standby)
  if (/429/i.test(s) || /5\d\d/i.test(s) || s.includes('timeout') || s.includes('standby') || s.includes('overload') || s.includes('exhaust')) {
    return '#eab308';
  }

  // Red: The endpoint permanently dead (404, 403, 401, offline, fatal error)
  if (/403|404|401/i.test(s) || s.includes('offline') || s.includes('not found') || s.includes('denied') || s.includes('error')) {
    return '#ef4444';
  }

  // Any other 4xx (non-429) is permanently dead / client error
  if (/4\d\d/i.test(s)) {
    return '#ef4444';
  }

  return isActive ? '#eab308' : 'var(--zen-text-secondary)';
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  canvasRef,
  mainContainerRef,
  centralNodeRef,
  outerNodeRefs,
  nodes,
  selectedNodeId,
  terminalMode,
  portConflict,
  frugalConfig,
  isOllamaInstalled,
  setSelectedNodeId,
  handleCanvasClick,
  handleCanvasMouseDown,
  handleNodeClick,
  autoScale,
  pan,
  zoom,
  lines,
  activeProxyState,
  isHermesInstalled,
  isOpenCodeInstalled,
  activeProcesses,
  hermesVersion,
  opencodeVersion,
  routingChain,
  latestTelemetry,
}) => {
  const topNodes = ['node-ollama', 'node-google', 'node-openrouter']
    .map(id => nodes.find(n => n.id === id))
    .filter(Boolean) as AppNode[];

  const centralNode = nodes.find(n => n.id === 'node-frugallm');

  const bottomNodes = ['node-opencode', 'node-hermes']
    .map(id => nodes.find(n => n.id === id))
    .filter(Boolean) as AppNode[];

  const renderNode = (node: AppNode) => {
    const isSelected = selectedNodeId === node.id;
    const isCore = node.id === 'node-frugallm';

    let stateColors = {
      border: isCore && portConflict ? 'rgba(239, 68, 68, 0.45)' : 'transparent',
      headerBg: isCore && portConflict ? 'rgba(239, 68, 68, 0.12)' : (isSelected ? 'var(--zen-surface-header-active)' : 'var(--zen-surface-header)'), 
      headerText: 'var(--zen-text)',
      bodyBg: 'var(--zen-surface)',
      dot: isCore && portConflict ? '#ef4444' : '#10B981',
      statusText: 'var(--zen-text-secondary)',
      boxShadow: isCore && portConflict ? '0 0 24px rgba(239, 68, 68, 0.22), var(--zen-shadow-diffused)' : 'var(--zen-shadow-diffused)',
      borderStyle: isCore && portConflict ? 'solid' : 'none',
      borderWidth: isCore && portConflict ? '1px' : '0px'
    };

    let Icon: React.ReactNode = Icons.cpu;
    const providerIcon = getProviderIcon(node.id, { size: 14 });
    if (providerIcon) {
      Icon = providerIcon;
    } else if (node.data.isAgent) {
      Icon = Icons.agent;
    }

    const setNodeRef = (el: HTMLDivElement | null) => {
      if (isCore) {
        centralNodeRef.current = el;
      } else {
        outerNodeRefs.current[node.id] = el;
      }
    };

    if (node.id === 'node-ollama') {
      const isOllamaGenerating = activeProxyState?.target === 'ollama' || terminalMode === 'run-ollama';
      return (
        <div
          key={node.id}
          id={node.id}
          data-node-id={node.id}
          data-testid={node.id}
          ref={setNodeRef}
          className={`retro-node ${isSelected ? 'selected' : ''}`.trim()}
          style={{ 
            position: 'relative',
            width: NODE_WIDTH, 
            height: 'auto',
            boxSizing: 'border-box',
            zIndex: isSelected ? 5 : 1,
            backgroundColor: 'var(--zen-surface)',
            border: 'none',
            borderRadius: '16px',
            boxShadow: isSelected ? '0 0 0 2px var(--zen-active-border), var(--zen-active-glow), var(--zen-shadow-diffused)' : 'var(--zen-shadow-diffused)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            userSelect: 'none',
            overflow: 'hidden'
          }}
          onMouseDown={(e) => handleCanvasMouseDown(e)}
          onClick={(e) => handleNodeClick(e, node.id)}
        >
          <HardwareNode 
            isGenerating={isOllamaGenerating} 
            label={node.data.label} 
            subheader={node.data.subheader} 
            icon={<OllamaIcon size={14} />} 
            isSelected={isSelected} 
            lastStatus={node.data.lastStatus}
            onSettingsClick={() => handleNodeClick(null, node.id)}
          />
        </div>
      );
    }

    return (
      <div 
        key={node.id}
        id={node.id}
        data-node-id={node.id}
        data-testid={node.id}
        ref={setNodeRef}
        className={`retro-node ${isSelected ? 'selected' : ''}`.trim()}
        style={{
          position: 'relative',
          width: NODE_WIDTH,
          height: 'auto',
          boxSizing: 'border-box',
          cursor: 'pointer',
          backgroundColor: stateColors.bodyBg,
          border: isCore && portConflict ? '1px solid rgba(239, 68, 68, 0.45)' : 'none',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: isSelected ? `0 0 0 2px var(--zen-active-border), var(--zen-active-glow), ${stateColors.boxShadow}` : stateColors.boxShadow,
          zIndex: isSelected ? 5 : 1,
          display: 'flex',
          flexDirection: 'column',
          userSelect: 'none'
        }}
        onMouseDown={(e) => handleCanvasMouseDown(e)}
        onClick={(e) => handleNodeClick(e, node.id)}
      >
        {/* Header */}
        <div style={{ 
          backgroundColor: stateColors.headerBg, 
          color: stateColors.headerText,
          padding: isCore && portConflict ? '9px 11px' : '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: isCore && portConflict ? '1px solid rgba(239, 68, 68, 0.25)' : 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            {Icon}
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <span style={{ fontWeight: 600, fontSize: '0.80rem', color: stateColors.headerText, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                {node.data.label}
              </span>
              {node.data.subheader && (
                <span style={{ fontWeight: 450, fontSize: '0.64rem', color: 'var(--zen-text-secondary)', whiteSpace: 'nowrap' }}>
                  {node.data.subheader}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
            {isCore && portConflict && (
              <span
                data-testid="frugallm-port-conflict-badge"
                style={{
                  fontSize: '0.50rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  color: '#FCA5A5',
                  padding: '2px 5px',
                  borderRadius: '9999px',
                  letterSpacing: '0.03em',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                PORT CONFLICT
              </span>
            )}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                handleNodeClick(e, node.id);
              }}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--zen-text)',
                padding: '2px',
                borderRadius: '9999px',
                opacity: 0.8
              }}
            >
              {Icons.settings}
            </div>
          </div>
        </div>
        
        {/* Body */}
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: stateColors.bodyBg, color: 'var(--zen-text)', boxSizing: 'border-box' }}>
          {isCore ? (
            <>
              {portConflict && (
                <div
                  data-testid="frugallm-node-conflict-warning"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId('node-frugallm');
                  }}
                  role="button"
                  tabIndex={0}
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#FCA5A5',
                    borderRadius: '8px',
                    padding: '6px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    textAlign: 'center',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'background-color 0.15s ease, border-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.22)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.55)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Port {portConflict.port} Conflict
                </div>
              )}
              {(() => {
                const isActivelyUsed = Boolean(activeProxyState);
                let resolvedModel = 'None';

                if (isActivelyUsed && activeProxyState?.model) {
                  resolvedModel = activeProxyState.model;
                } else if (isActivelyUsed && activeProxyState?.target) {
                  const providerModel = routingChain?.find((m: any) => m.provider?.toLowerCase() === activeProxyState.target?.toLowerCase())?.model;
                  if (providerModel) {
                    resolvedModel = providerModel;
                  } else if (activeProxyState.target === 'ollama' && latestTelemetry?.ollama?.model_name && latestTelemetry.ollama.model_name !== 'None' && latestTelemetry.ollama.model_name !== 'Unknown') {
                    resolvedModel = latestTelemetry.ollama.model_name;
                  } else if (routingChain && routingChain.length > 0 && routingChain[0]?.model) {
                    resolvedModel = routingChain[0].model;
                  }
                } else if (routingChain && routingChain.length > 0 && routingChain[0]?.model) {
                  resolvedModel = routingChain[0].model;
                } else if (latestTelemetry?.ollama?.model_name && latestTelemetry.ollama.model_name !== 'None' && latestTelemetry.ollama.model_name !== 'Unknown') {
                  resolvedModel = latestTelemetry.ollama.model_name;
                }

                const displayModelName = formatModelDisplayName(resolvedModel);
                const hasModel = displayModelName !== 'None';

                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Tooltip 
                      text={en.routingGraph.frugallmNode?.activeModelTooltip || "The model currently being utilized or queued for the next call."}
                      triggerTestId="btn-frugallm-active-model-info"
                      ariaLabel="Model: The model currently being utilized or queued for the next call."
                    >
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>
                        {en.routingGraph.frugallmNode?.model || 'Model:'}
                      </span>
                    </Tooltip>
                    <span 
                      data-testid="frugallm-active-model" 
                      style={{ 
                        fontSize: '0.78rem', 
                        fontWeight: 600, 
                        color: isActivelyUsed ? '#10B981' : (hasModel ? 'var(--zen-text)' : 'var(--zen-text-secondary)'),
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '120px'
                      }}
                      title={displayModelName}
                    >
                      {displayModelName}
                    </span>
                  </div>
                );
              })()}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Tooltip 
                  text={en.routingGraph.frugallmNode?.sessionTokensTooltip || en.routingGraph.frugallmNode?.sessionTokensHelp || "Total prompt and completion tokens routed through FrugaLLM since launch. Monitors current workload and resets to zero upon restart."}
                  triggerTestId="btn-frugallm-session-tokens-info"
                  ariaLabel="Session tokens: Total prompt and completion tokens routed through FrugaLLM since launch."
                >
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>
                    {en.routingGraph.frugallmNode?.sessionTokens || 'Session tokens:'}
                  </span>
                </Tooltip>
                <span data-testid="frugallm-session-tokens" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--zen-text)' }}>
                  {((frugalConfig?.input_tokens_session || 0) + (frugalConfig?.output_tokens_session || 0) + (frugalConfig?.cached_tokens_session || 0)).toLocaleString('en-US')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Tooltip 
                  text={en.routingGraph.frugallmNode?.totalTokensTooltip || en.routingGraph.frugallmNode?.totalTokensHelp || "Cumulative lifetime tokens routed through this FrugaLLM instance across all sessions."}
                  triggerTestId="btn-frugallm-total-tokens-info"
                  ariaLabel="Total tokens: Cumulative lifetime tokens routed through this FrugaLLM instance."
                >
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>
                    {en.routingGraph.frugallmNode?.totalTokens || 'Total tokens:'}
                  </span>
                </Tooltip>
                <span data-testid="frugallm-total-tokens" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--zen-text)' }}>
                  {((frugalConfig?.input_tokens_lifetime || 0) + (frugalConfig?.output_tokens_lifetime || 0) + (frugalConfig?.cached_tokens_lifetime || 0)).toLocaleString('en-US')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Tooltip 
                  text={en.routingGraph.frugallmNode?.moneySavedTooltip || en.routingGraph.frugallmNode?.moneySavedHelp || "Estimated cost reduction from local routing and free cloud tiers, benchmarked against Claude Sonnet 5 pricing ($2.00/1M input, $10.00/1M output, and $0.20/1M cached input tokens)."}
                  triggerTestId="btn-frugallm-money-saved-info"
                  ariaLabel="Money saved: Estimated cost reduction from local routing and free cloud tiers."
                >
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>
                    {en.routingGraph.frugallmNode?.moneySaved || '$ Saved:'}
                  </span>
                </Tooltip>
                <span data-testid="frugallm-money-saved" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#10B981' }}>
                  ${calculateMoneySaved(frugalConfig)}
                </span>
              </div>
            </>
          ) : (node.id === 'node-openrouter' || node.id === 'node-google') ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>API Key</span>
                {Boolean(node.data.keyPrefix || node.data.status === 'active') ? (
                  <span data-testid={`${node.id}-api-key`} style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--zen-text)', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                    {node.data.keyPrefix ? `${node.data.keyPrefix}...` : (node.id === 'node-google' ? 'AIzaS...' : 'sk-or...')}
                  </span>
                ) : (
                  <a
                    href={node.id === 'node-openrouter' ? 'https://openrouter.ai' : 'https://aistudio.google.com'}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      e.stopPropagation();
                      openUrl(node.id === 'node-openrouter' ? 'https://openrouter.ai' : 'https://aistudio.google.com').catch(() => {});
                    }}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: 'var(--zen-text)',
                      textDecoration: 'underline',
                      cursor: 'pointer'
                    }}
                  >
                    Get key
                  </a>
                )}
              </div>
              {(() => {
                const rawStatus = node.data.lastStatus;
                const statusText = rawStatus || (node.data.status === 'active' ? '200 OK' : 'N/A');
                const statusColor = getEndpointStatusColor(rawStatus, node.data.status === 'active');
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>Status</span>
                    <span data-testid={`${node.id}-status`} style={{ fontSize: '0.78rem', fontWeight: 500, color: statusColor }}>
                      {statusText}
                    </span>
                  </div>
                );
              })()}
            </>
          ) : (node.id === 'node-hermes' || node.id === 'node-opencode') ? (
            (() => {
              const isHermes = node.id === 'node-hermes';
              const isInstalled = isHermes ? isHermesInstalled : isOpenCodeInstalled;
              const isRunning = isHermes 
                ? !!(activeProcesses['run-hermes'] || activeProcesses['run-hermes-gateway'] || activeProcesses['run-hermes-desktop'] || activeProcesses['run-hermes-web'] || activeProcesses['hermes-gateway'] || activeProcesses['hermes-dashboard'] || node.data.status === 'active')
                : !!(activeProcesses['run-opencode'] || activeProcesses['run-opencode-web'] || node.data.status === 'active');
              
              const statusText = !isInstalled ? 'N/A' : (isRunning ? 'Active' : 'Ready');
              const statusColor = !isInstalled ? 'var(--zen-text-secondary)' : '#10B981';
              const versionText = !isInstalled ? 'N/A' : (isHermes ? hermesVersion : opencodeVersion);

              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)' }}>Status:</span>
                    <span data-testid={`${node.id}-status`} style={{ fontSize: '0.78rem', fontWeight: 500, color: statusColor }}>
                      {statusText}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--zen-text-secondary)', flexShrink: 0 }}>Version:</span>
                    <span data-testid={`${node.id}-version`} style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--zen-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={versionText}>
                      {versionText}
                    </span>
                  </div>
                </>
              );
            })()
          ) : (
            <>
              <StatusLight status={node.data.status as any} text={node.data.status === 'active' ? 'Connected' : node.data.status === 'ready' ? (node.id === 'node-ollama' && isOllamaInstalled ? 'Stopped' : 'Ready') : (node.data.status.replace('_', ' ').toUpperCase())} />
              <InfoField label={'ENDPOINT'} value={node.data.port ? `${node.data.ip}:${node.data.port}` : `${node.data.ip}`} />
            </>
          )}
        </div>
      </div>
    );
  };

  return (
        <div 
          ref={canvasRef}
          data-testid="main-canvas"
          onClick={handleCanvasClick}
          style={{ 
            flexGrow: 1, position: 'relative', 
            cursor: 'default',
            display: terminalMode ? 'none' : 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overscrollBehavior: 'none',
            minHeight: 0,
            overflow: 'hidden'
          }}
        >
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transform: `scale(${autoScale}) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          pointerEvents: 'none'
        }}>
          {/* Main Relative Container for 3-Row Flexbox Router */}
          <div
            ref={mainContainerRef}
            data-testid="router-main-container"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '1100px',
              height: '100%',
              maxHeight: '660px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '24px 32px',
              boxSizing: 'border-box',
              pointerEvents: 'auto'
            }}
          >
            {/* Dynamic SVG Routing Layer */}
            <svg
              data-testid="router-svg-layer"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 0,
                overflow: 'visible'
              }}
            >
              {lines.map((line) => {
                const isReverse = line.direction === 'reverse';
                const animName = isReverse ? 'flowAnimationReverse' : 'flowAnimation';
                const animClass = isReverse ? 'edge-flow-active-reverse' : 'edge-flow-active';
                return (
                  <line
                    key={line.id}
                    id={line.id}
                    data-testid={`svg-line-${line.id}`}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke={line.isActive ? "var(--zen-accent)" : "var(--zen-edge)"}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={line.isActive ? 8 : undefined}
                    className={line.isActive ? animClass : ""}
                    style={line.isActive ? {
                      strokeDasharray: '8',
                      animation: `${animName} 0.8s linear infinite`,
                      transition: 'stroke 0.2s ease, opacity 0.2s ease'
                    } : { transition: 'stroke 0.2s ease, opacity 0.2s ease' }}
                  />
                );
              })}
            </svg>

            {/* Top Row (3 nodes) */}
            <div
              data-testid="router-top-row"
              style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                zIndex: 10,
                flex: 1
              }}
            >
              {topNodes.map(renderNode)}
            </div>

            {/* Middle Row (1 central router node) */}
            <div
              data-testid="router-middle-row"
              style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10,
                flex: 1
              }}
            >
              {centralNode && renderNode(centralNode)}
            </div>

            {/* Bottom Row (2 nodes) */}
            <div
              data-testid="router-bottom-row"
              style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'space-around',
                alignItems: 'flex-end',
                paddingLeft: '11%',
                paddingRight: '11%',
                boxSizing: 'border-box',
                zIndex: 10,
                flex: 1
              }}
            >
              {bottomNodes.map(renderNode)}
            </div>
          </div>
        </div>

      </div>

  );
};

