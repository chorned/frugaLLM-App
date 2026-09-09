import { useState, useCallback, useLayoutEffect, useEffect } from 'react';
import { AppNode, SvgLineCoord, initialEdges } from '../constants/canvas';

interface UseTopologyWiresProps {
  mainContainerRef: React.RefObject<HTMLDivElement | null>;
  centralNodeRef: React.MutableRefObject<HTMLDivElement | null>;
  outerNodeRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  nodes: AppNode[];
  portConflict: any;
  terminalMode: string | null;
  isAppLoaded: boolean;
  theme: string;
  activeProxyState: any;
  activeProcesses: Record<string, boolean>;
  toggleTheme: () => void;
}

export function useTopologyWires({
  mainContainerRef,
  centralNodeRef,
  outerNodeRefs,
  nodes,
  portConflict,
  terminalMode,
  isAppLoaded,
  theme,
  activeProxyState,
  activeProcesses,
  toggleTheme,
}: UseTopologyWiresProps) {
  const [lines, setLines] = useState<SvgLineCoord[]>([]);

  const calculateLines = useCallback(() => {
    const container = mainContainerRef.current;
    const centralEl = centralNodeRef.current;
    if (!container || !centralEl) return;

    const containerRect = container.getBoundingClientRect();
    const isZeroSize = containerRect.width === 0 && containerRect.height === 0;

    const scaleX = (!isZeroSize && container.offsetWidth > 0) ? (containerRect.width / container.offsetWidth) : 1;
    const scaleY = (!isZeroSize && container.offsetHeight > 0) ? (containerRect.height / container.offsetHeight) : 1;

    const getCenter = (el: HTMLElement | null, fallbackCoord: { x: number; y: number }) => {
      if (!el) return fallbackCoord;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        return fallbackCoord;
      }
      return {
        x: ((r.left + r.width / 2) - containerRect.left) / scaleX,
        y: ((r.top + r.height / 2) - containerRect.top) / scaleY,
      };
    };

    const defaultFallback: Record<string, { x: number; y: number }> = {
      'node-ollama': { x: 140, y: 70 },
      'node-google': { x: 500, y: 70 },
      'node-openrouter': { x: 860, y: 70 },
      'node-frugallm': { x: 500, y: 300 },
      'node-opencode': { x: 300, y: 530 },
      'node-hermes': { x: 700, y: 530 },
    };

    const centralCenter = getCenter(centralEl, defaultFallback['node-frugallm']);
    const computedLines: SvgLineCoord[] = [];

    for (const edge of initialEdges) {
      const isCentralSource = edge.source === 'node-frugallm';
      const outerId = isCentralSource ? edge.target : edge.source;
      const outerEl = outerNodeRefs.current[outerId];
      const outerCenter = getCenter(outerEl, defaultFallback[outerId] || { x: 0, y: 0 });

      let isActive = false;
      if (edge.id === 'edge-hermes-frugallm') {
        isActive = activeProxyState?.source === 'hermes' || !!activeProcesses['run-hermes'] || !!activeProcesses['run-hermes-gateway'];
      } else if (edge.id === 'edge-opencode-frugallm') {
        isActive = activeProxyState?.source === 'opencode' || !!activeProcesses['run-opencode'];
      } else if (edge.id === 'edge-frugallm-ollama') {
        isActive = activeProxyState?.target === 'ollama' || terminalMode === 'run-ollama';
      } else if (edge.id === 'edge-frugallm-openrouter') {
        isActive = activeProxyState?.target === 'openrouter';
      } else if (edge.id === 'edge-frugallm-google') {
        isActive = activeProxyState?.target === 'google';
      }

      const sx = isCentralSource ? centralCenter.x : outerCenter.x;
      const sy = isCentralSource ? centralCenter.y : outerCenter.y;
      const tx = isCentralSource ? outerCenter.x : centralCenter.x;
      const ty = isCentralSource ? outerCenter.y : centralCenter.y;

      computedLines.push({
        id: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
        x1: sx,
        y1: sy,
        x2: tx,
        y2: ty,
        isActive,
      });
    }

    setLines(prev => {
      if (
        prev.length === computedLines.length &&
        prev.every((p, i) => {
          const c = computedLines[i];
          return (
            p.id === c.id &&
            Math.abs(p.x1 - c.x1) < 0.5 &&
            Math.abs(p.y1 - c.y1) < 0.5 &&
            Math.abs(p.x2 - c.x2) < 0.5 &&
            Math.abs(p.y2 - c.y2) < 0.5 &&
            p.isActive === c.isActive
          );
        })
      ) {
        return prev;
      }
      return computedLines;
    });
  }, [activeProxyState, activeProcesses, terminalMode, centralNodeRef, outerNodeRefs, mainContainerRef]);

  const handleToggleTheme = useCallback(() => {
    toggleTheme();
    calculateLines();
    setTimeout(() => {
      calculateLines();
    }, 50);
  }, [toggleTheme, calculateLines]);

  useLayoutEffect(() => {
    calculateLines();
  }, [calculateLines, nodes, portConflict, isAppLoaded, theme]);

  useEffect(() => {
    const container = mainContainerRef.current;
    if (!container) return;

    const mountTimer = setTimeout(() => {
      calculateLines();
    }, 50);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        calculateLines();
      });
      ro.observe(container);
    }

    window.addEventListener('resize', calculateLines);

    return () => {
      clearTimeout(mountTimer);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', calculateLines);
    };
  }, [calculateLines, nodes, portConflict, terminalMode, isAppLoaded, theme, mainContainerRef]);

  return {
    lines,
    calculateLines,
    handleToggleTheme,
  };
}
