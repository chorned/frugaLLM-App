import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTopologyWires } from '../useTopologyWires';
import { initialNodes } from '../../constants/canvas';

describe('useTopologyWires hook', () => {
  const createMockRefs = () => {
    const mainContainerEl = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600 }),
      offsetWidth: 1000,
      offsetHeight: 600,
    } as any;

    const centralEl = {
      getBoundingClientRect: () => ({ left: 400, top: 250, width: 200, height: 100, right: 600, bottom: 350 }),
    } as any;

    const outerEls: Record<string, any> = {
      'node-ollama': {
        getBoundingClientRect: () => ({ left: 50, top: 50, width: 200, height: 100, right: 250, bottom: 150 }),
      },
      'node-google': {
        getBoundingClientRect: () => ({ left: 400, top: 50, width: 200, height: 100, right: 600, bottom: 150 }),
      },
      'node-openrouter': {
        getBoundingClientRect: () => ({ left: 750, top: 50, width: 200, height: 100, right: 950, bottom: 150 }),
      },
      'node-opencode': {
        getBoundingClientRect: () => ({ left: 200, top: 480, width: 200, height: 100, right: 400, bottom: 580 }),
      },
      'node-hermes': {
        getBoundingClientRect: () => ({ left: 600, top: 480, width: 200, height: 100, right: 800, bottom: 580 }),
      },
    };

    return {
      mainContainerRef: { current: mainContainerEl },
      centralNodeRef: { current: centralEl },
      outerNodeRefs: { current: outerEls },
    };
  };

  it('computes forward direction when activeProxyState is in request phase (user to cloud)', () => {
    const refs = createMockRefs();
    const { result } = renderHook(() =>
      useTopologyWires({
        mainContainerRef: refs.mainContainerRef,
        centralNodeRef: refs.centralNodeRef,
        outerNodeRefs: refs.outerNodeRefs,
        nodes: initialNodes,
        portConflict: null,
        terminalMode: null,
        isAppLoaded: true,
        theme: 'dark',
        activeProxyState: { source: 'opencode', target: 'openrouter', phase: 'request' },
        activeProcesses: {},
        toggleTheme: () => {},
      })
    );

    const opencodeLine = result.current.lines.find((l) => l.id === 'edge-opencode-frugallm');
    const openrouterLine = result.current.lines.find((l) => l.id === 'edge-frugallm-openrouter');
    const ollamaLine = result.current.lines.find((l) => l.id === 'edge-frugallm-ollama');

    expect(opencodeLine).toBeDefined();
    expect(opencodeLine?.isActive).toBe(true);
    expect(opencodeLine?.direction).toBe('forward');

    expect(openrouterLine).toBeDefined();
    expect(openrouterLine?.isActive).toBe(true);
    expect(openrouterLine?.direction).toBe('forward');

    expect(ollamaLine?.isActive).toBe(false);
  });

  it('computes reverse direction when activeProxyState is in response phase (cloud back to user)', () => {
    const refs = createMockRefs();
    const { result } = renderHook(() =>
      useTopologyWires({
        mainContainerRef: refs.mainContainerRef,
        centralNodeRef: refs.centralNodeRef,
        outerNodeRefs: refs.outerNodeRefs,
        nodes: initialNodes,
        portConflict: null,
        terminalMode: null,
        isAppLoaded: true,
        theme: 'dark',
        activeProxyState: { source: 'hermes', target: 'ollama', phase: 'response' },
        activeProcesses: {},
        toggleTheme: () => {},
      })
    );

    const hermesLine = result.current.lines.find((l) => l.id === 'edge-hermes-frugallm');
    const ollamaLine = result.current.lines.find((l) => l.id === 'edge-frugallm-ollama');

    expect(hermesLine).toBeDefined();
    expect(hermesLine?.isActive).toBe(true);
    expect(hermesLine?.direction).toBe('reverse');

    expect(ollamaLine).toBeDefined();
    expect(ollamaLine?.isActive).toBe(true);
    expect(ollamaLine?.direction).toBe('reverse');
  });
});
