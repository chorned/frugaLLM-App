import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TopologyCanvas } from '../TopologyCanvas';

describe('TopologyCanvas Wires Rendering', () => {
  const defaultProps = {
    canvasRef: { current: null },
    mainContainerRef: { current: null },
    centralNodeRef: { current: null },
    outerNodeRefs: { current: {} },
    nodes: [
      {
        id: 'node-frugallm',
        position: { x: 0, y: 0 },
        data: { label: 'FrugaLLM', subheader: 'Routing Gateway' }
      }
    ] as any[],
    selectedNodeId: null,
    terminalMode: null,
    portConflict: null,
    frugalConfig: {
      input_tokens_session: 100,
      output_tokens_session: 200,
      cached_tokens_session: 50,
      input_tokens_lifetime: 500,
      output_tokens_lifetime: 1000,
      cached_tokens_lifetime: 250,
    },
    isOllamaInstalled: true,
    setSelectedNodeId: vi.fn(),
    setPortConflict: vi.fn(),
    handleCanvasClick: vi.fn(),
    handleCanvasMouseDown: vi.fn(),
    handleNodeClick: vi.fn(),
    autoScale: 1,
    pan: { x: 0, y: 0 },
    zoom: 1,
    lines: [],
    activeProxyState: null,
    isHermesInstalled: true,
    isOpenCodeInstalled: true,
    activeProcesses: {},
    hermesVersion: 'v0.4.2',
    opencodeVersion: 'v1.0.0',
  };

  it('renders forward animation (User to Cloud) on active wire when direction is forward', () => {
    const lines = [
      {
        id: 'edge-opencode-frugallm',
        x1: 300,
        y1: 530,
        x2: 500,
        y2: 300,
        isActive: true,
        direction: 'forward' as const,
      },
      {
        id: 'edge-frugallm-openrouter',
        x1: 500,
        y1: 300,
        x2: 860,
        y2: 70,
        isActive: true,
        direction: 'forward' as const,
      },
    ];

    render(<TopologyCanvas {...defaultProps} lines={lines} />);

    const opencodeLine = screen.getByTestId('svg-line-edge-opencode-frugallm');
    const openrouterLine = screen.getByTestId('svg-line-edge-frugallm-openrouter');

    expect(opencodeLine).toHaveClass('edge-flow-active');
    expect(opencodeLine.style.animation).toContain('flowAnimation 0.8s');

    expect(openrouterLine).toHaveClass('edge-flow-active');
    expect(openrouterLine.style.animation).toContain('flowAnimation 0.8s');
  });

  it('renders reverse animation (Cloud back to User) on active wire when direction is reverse', () => {
    const lines = [
      {
        id: 'edge-opencode-frugallm',
        x1: 300,
        y1: 530,
        x2: 500,
        y2: 300,
        isActive: true,
        direction: 'reverse' as const,
      },
      {
        id: 'edge-frugallm-openrouter',
        x1: 500,
        y1: 300,
        x2: 860,
        y2: 70,
        isActive: true,
        direction: 'reverse' as const,
      },
    ];

    render(<TopologyCanvas {...defaultProps} lines={lines} />);

    const opencodeLine = screen.getByTestId('svg-line-edge-opencode-frugallm');
    const openrouterLine = screen.getByTestId('svg-line-edge-frugallm-openrouter');

    expect(opencodeLine).toHaveClass('edge-flow-active-reverse');
    expect(opencodeLine.style.animation).toContain('flowAnimationReverse 0.8s');

    expect(openrouterLine).toHaveClass('edge-flow-active-reverse');
    expect(openrouterLine.style.animation).toContain('flowAnimationReverse 0.8s');
  });

  it('renders idle styling when wire is inactive', () => {
    const lines = [
      {
        id: 'edge-frugallm-ollama',
        x1: 500,
        y1: 300,
        x2: 140,
        y2: 70,
        isActive: false,
      },
    ];

    render(<TopologyCanvas {...defaultProps} lines={lines} />);

    const ollamaLine = screen.getByTestId('svg-line-edge-frugallm-ollama');
    expect(ollamaLine).not.toHaveClass('edge-flow-active');
    expect(ollamaLine).not.toHaveClass('edge-flow-active-reverse');
    expect(ollamaLine.style.animation).toBe('');
  });
});
