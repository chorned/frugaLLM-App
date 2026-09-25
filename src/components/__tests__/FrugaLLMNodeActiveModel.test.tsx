import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopologyCanvas, formatModelDisplayName } from '../TopologyCanvas';
import en from '../../locales/en.json';

describe('formatModelDisplayName helper', () => {
  it('formats various model names cleanly', () => {
    expect(formatModelDisplayName(null)).toBe('None');
    expect(formatModelDisplayName(undefined)).toBe('None');
    expect(formatModelDisplayName('')).toBe('None');
    expect(formatModelDisplayName('models/gemini-2.5-flash')).toBe('gemini-2.5-flash');
    expect(formatModelDisplayName('library/llama3.3:latest')).toBe('llama3.3');
    expect(formatModelDisplayName('deepseek/deepseek-r1')).toBe('deepseek/deepseek-r1');
    expect(formatModelDisplayName('frugallm-active-gemma4')).toBe('gemma4');
  });
});

describe('FrugaLLM Center Node Active and Loaded Model Indicator', () => {
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
      input_tokens_session: 1200,
      output_tokens_session: 3800,
      input_tokens_lifetime: 100000,
      output_tokens_lifetime: 50000,
    } as any,
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
    isHermesInstalled: false,
    isOpenCodeInstalled: false,
    activeProcesses: {},
    hermesVersion: '',
    opencodeVersion: '',
  };

  it('renders "None" in secondary color when no model is active or in routing chain', () => {
    render(<TopologyCanvas {...defaultProps} routingChain={[]} latestTelemetry={null} />);

    const labelTrigger = screen.getByTestId('btn-frugallm-active-model-info');
    expect(labelTrigger).toBeInTheDocument();
    expect(labelTrigger).toHaveTextContent(en.routingGraph.frugallmNode.model);

    const modelValue = screen.getByTestId('frugallm-active-model');
    expect(modelValue).toBeInTheDocument();
    expect(modelValue).toHaveTextContent('None');
    expect(modelValue).toHaveStyle({ color: 'var(--zen-text-secondary)' });
  });

  it('shows tooltip micro-copy on hover over the Model label trigger', () => {
    render(<TopologyCanvas {...defaultProps} routingChain={[]} latestTelemetry={null} />);

    const labelTrigger = screen.getByTestId('btn-frugallm-active-model-info');
    fireEvent.mouseEnter(labelTrigger);

    expect(screen.getByText(en.routingGraph.frugallmNode.activeModelTooltip)).toBeInTheDocument();

    fireEvent.mouseLeave(labelTrigger);
    expect(screen.queryByText(en.routingGraph.frugallmNode.activeModelTooltip)).not.toBeInTheDocument();
  });

  it('renders top candidate model from routingChain in regular text color when proxy is idle', () => {
    const chain = [
      { provider: 'Google', model: 'models/gemini-2.5-flash', latency_ms: 120 },
      { provider: 'Ollama', model: 'gemma4:latest', latency_ms: 250 },
    ];

    render(
      <TopologyCanvas
        {...defaultProps}
        routingChain={chain}
        activeProxyState={null}
      />
    );

    const modelValue = screen.getByTestId('frugallm-active-model');
    expect(modelValue).toBeInTheDocument();
    expect(modelValue).toHaveTextContent('gemini-2.5-flash');
    expect(modelValue).toHaveStyle({ color: 'var(--zen-text)' });
  });

  it('renders active model in emerald green (#10B981) when actively used in proxy call', () => {
    const chain = [
      { provider: 'Google', model: 'models/gemini-2.5-flash', latency_ms: 120 },
    ];

    render(
      <TopologyCanvas
        {...defaultProps}
        routingChain={chain}
        activeProxyState={{
          isActive: true,
          provider: 'google',
          model: 'gemini-2.5-flash',
          agent: 'hermes',
          direction: 'request',
        }}
      />
    );

    const modelValue = screen.getByTestId('frugallm-active-model');
    expect(modelValue).toBeInTheDocument();
    expect(modelValue).toHaveTextContent('gemini-2.5-flash');
    expect(modelValue).toHaveStyle({ color: '#10B981' });
  });

  it('resolves active model from routingChain if activeProxyState lacks explicit model field', () => {
    const chain = [
      { provider: 'Ollama', model: 'library/qwen2.5-coder:7b', latency_ms: 80 },
    ];

    render(
      <TopologyCanvas
        {...defaultProps}
        routingChain={chain}
        activeProxyState={{
          isActive: true,
          provider: 'ollama',
          agent: 'opencode',
          direction: 'stream',
        }}
      />
    );

    const modelValue = screen.getByTestId('frugallm-active-model');
    expect(modelValue).toBeInTheDocument();
    expect(modelValue).toHaveTextContent('qwen2.5-coder:7b');
    expect(modelValue).toHaveStyle({ color: '#10B981' });
  });

  it('falls back to latestTelemetry model when routingChain is empty and idle', () => {
    render(
      <TopologyCanvas
        {...defaultProps}
        routingChain={[]}
        latestTelemetry={{
          ollama: {
            model_name: 'llama3.2:3b',
          },
        }}
        activeProxyState={null}
      />
    );

    const modelValue = screen.getByTestId('frugallm-active-model');
    expect(modelValue).toBeInTheDocument();
    expect(modelValue).toHaveTextContent('llama3.2:3b');
    expect(modelValue).toHaveStyle({ color: 'var(--zen-text)' });
  });
});
