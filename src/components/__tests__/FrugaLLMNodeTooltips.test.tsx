import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopologyCanvas } from '../TopologyCanvas';
import en from '../../locales/en.json';

describe('FrugaLLM Node Dual Tooltips (CHO-57 / CHO-122)', () => {
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

  it('renders minimalist dotted-underline tooltip triggers for all three FrugaLLM metrics', () => {
    render(<TopologyCanvas {...defaultProps} />);

    // Session Tokens label trigger
    const sessionInfo = screen.getByTestId('btn-frugallm-session-tokens-info');
    expect(sessionInfo).toBeInTheDocument();
    expect(sessionInfo).toHaveTextContent('Session tokens');
    expect(sessionInfo.style.textDecoration).toContain('underline dotted');

    // Total Tokens label trigger
    const totalInfo = screen.getByTestId('btn-frugallm-total-tokens-info');
    expect(totalInfo).toBeInTheDocument();
    expect(totalInfo).toHaveTextContent('Total tokens');
    expect(totalInfo.style.textDecoration).toContain('underline dotted');

    // Money Saved ($ Saved) label trigger
    const moneyInfo = screen.getByTestId('btn-frugallm-money-saved-info');
    expect(moneyInfo).toBeInTheDocument();
    expect(moneyInfo).toHaveTextContent('$ Saved');
    expect(moneyInfo.style.textDecoration).toContain('underline dotted');

    // Verify absence of old dual ( ? ) help icon triggers
    expect(screen.queryByTestId('btn-frugallm-session-tokens-help')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-frugallm-total-tokens-help')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-frugallm-money-saved-help')).not.toBeInTheDocument();
  });

  it('displays consolidated definition and outcome micro-copy on hover for $ Saved label tooltip', () => {
    render(<TopologyCanvas {...defaultProps} />);

    const moneyInfo = screen.getByTestId('btn-frugallm-money-saved-info');
    fireEvent.mouseEnter(moneyInfo);

    // Expect the localized consolidated message from en.json
    expect(screen.getByText(en.routingGraph.frugallmNode.moneySavedTooltip)).toBeInTheDocument();

    fireEvent.mouseLeave(moneyInfo);
    expect(screen.queryByText(en.routingGraph.frugallmNode.moneySavedTooltip)).not.toBeInTheDocument();
  });

  it('displays consolidated micro-copy on hover for Session tokens and Total tokens', () => {
    render(<TopologyCanvas {...defaultProps} />);

    const sessionInfo = screen.getByTestId('btn-frugallm-session-tokens-info');
    fireEvent.mouseEnter(sessionInfo);
    expect(screen.getByText(en.routingGraph.frugallmNode.sessionTokensTooltip)).toBeInTheDocument();
    fireEvent.mouseLeave(sessionInfo);

    const totalInfo = screen.getByTestId('btn-frugallm-total-tokens-info');
    fireEvent.mouseEnter(totalInfo);
    expect(screen.getByText(en.routingGraph.frugallmNode.totalTokensTooltip)).toBeInTheDocument();
    fireEvent.mouseLeave(totalInfo);
  });

  it('stops event propagation on mousedown so canvas pan/drag is never triggered', () => {
    const handleCanvasMouseDown = vi.fn();
    render(<TopologyCanvas {...defaultProps} handleCanvasMouseDown={handleCanvasMouseDown} />);

    const moneyInfo = screen.getByTestId('btn-frugallm-money-saved-info');
    
    // Simulate mousedown directly on tooltip button
    fireEvent.mouseDown(moneyInfo);

    // Canvas handler should not be invoked due to stopPropagation
    expect(handleCanvasMouseDown).not.toHaveBeenCalled();
  });

  it('renders calculated money saved correctly matching Claude Sonnet 5 rates', () => {
    // 100,000 input * $2.00/M = $0.20
    // 50,000 output * $10.00/M = $0.50
    // Total = $0.70
    render(<TopologyCanvas {...defaultProps} />);

    const moneySavedVal = screen.getByTestId('frugallm-money-saved');
    expect(moneySavedVal).toHaveTextContent('$0.70');
  });

  it('includes cached input tokens in money saved calculation based on Claude Sonnet 5 pricing', () => {
    render(
      <TopologyCanvas
        {...defaultProps}
        frugalConfig={{
          ...defaultProps.frugalConfig,
          input_tokens_lifetime: 1000000, // 1M * $2.00 = $2.00
          output_tokens_lifetime: 500000,  // 0.5M * $10.00 = $5.00
          cached_tokens_lifetime: 2000000, // 2M * $0.20 = $0.40
        }}
      />
    );
    const moneySavedVal = screen.getByTestId('frugallm-money-saved');
    expect(moneySavedVal).toHaveTextContent('$7.40');
  });

  it('correctly sums input, output, and cached tokens for session and total lifetime display', () => {
    render(
      <TopologyCanvas
        {...defaultProps}
        frugalConfig={{
          ...defaultProps.frugalConfig,
          input_tokens_session: 1000,
          output_tokens_session: 2000,
          cached_tokens_session: 3000,
          input_tokens_lifetime: 10000,
          output_tokens_lifetime: 20000,
          cached_tokens_lifetime: 30000,
        }}
      />
    );

    const sessionTokensVal = screen.getByTestId('frugallm-session-tokens');
    expect(sessionTokensVal).toHaveTextContent('6,000');

    const totalTokensVal = screen.getByTestId('frugallm-total-tokens');
    expect(totalTokensVal).toHaveTextContent('60,000');
  });
});
