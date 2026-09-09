import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';

// Mock Tauri core and event APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { CloudRoutingPanel, CloudModel } from '../CloudRoutingPanel';

describe('CloudRoutingPanel Component', () => {
  let proxyErrorCallback: (event: any) => void;
  let unlistenSpy: any;

  const mockModels: CloudModel[] = [
    { model: 'openrouter/anthropic-claude-3.5-sonnet', provider: 'openrouter', iq: 95 },
    { model: 'google/gemini-2.5-flash', provider: 'google', iq: 88 },
    { model: 'openrouter/claude-3.5-sonnet:computer-use', provider: 'openrouter', iq: 90 }, // should be filtered out
    { model: 'openrouter/free', provider: 'openrouter', iq: 0 }, // should be filtered out
    { model: 'openrouter:free', provider: 'openrouter', iq: 0 }, // should be filtered out
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    unlistenSpy = vi.fn();
    (listen as any).mockImplementation((eventName: string, cb: any) => {
      if (eventName === 'proxy_model_error') {
        proxyErrorCallback = cb;
      }
      return Promise.resolve(unlistenSpy);
    });

    (invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'get_frugallm_config') {
        return Promise.resolve({ manual_model_overrides: [] });
      }
      if (cmd === 'get_routing_chain' || cmd === 'refresh_routing_chain') {
        return Promise.resolve(mockModels);
      }
      if (cmd === 'set_model_override') {
        return Promise.resolve();
      }
      return Promise.resolve();
    });
  });

  it('renders global routing pool with models, filtering out computer-use and openrouter free alias models', async () => {
    // Arrange & Act
    render(<CloudRoutingPanel />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('GLOBAL ROUTING POOL')).toBeInTheDocument();
      expect(screen.getByText('openrouter/anthropic-claude-3.5-sonnet')).toBeInTheDocument();
      expect(screen.getByText('google/gemini-2.5-flash')).toBeInTheDocument();
    });

    // Ensure computer-use model and openrouter free aliases are filtered
    expect(screen.queryByText('openrouter/claude-3.5-sonnet:computer-use')).not.toBeInTheDocument();
    expect(screen.queryByText('openrouter/free')).not.toBeInTheDocument();
    expect(screen.queryByText('openrouter:free')).not.toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('renders a score of 0 or missing score as "⚡ SCORE: N/A" and positive scores as actual values', async () => {
    const freeModels: CloudModel[] = [
      { model: 'google/gemma-4-26b-a4b-it:free', provider: 'openrouter', iq: 0 },
      { model: 'google/gemma-4-31b-it:free', provider: 'openrouter', iq: 81.2 },
    ];

    (invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'get_frugallm_config') return Promise.resolve({ manual_model_overrides: [] });
      if (cmd === 'get_routing_chain' || cmd === 'refresh_routing_chain') return Promise.resolve(freeModels);
      return Promise.resolve();
    });

    render(<CloudRoutingPanel />);

    await waitFor(() => {
      expect(screen.getByText('google/gemma-4-26b-a4b-it:free')).toBeInTheDocument();
      expect(screen.getByText('google/gemma-4-31b-it:free')).toBeInTheDocument();
    });

    // Assert that score 0 is rendered as N/A, and positive score is rendered with value
    expect(screen.getByText('⚡ SCORE: N/A')).toBeInTheDocument();
    expect(screen.getByText('⚡ SCORE: 81.2')).toBeInTheDocument();
  });

  it('renders empty placeholder when routing pool has no models', async () => {
    // Arrange
    (invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'get_frugallm_config') return Promise.resolve({ manual_model_overrides: [] });
      if (cmd === 'get_routing_chain' || cmd === 'refresh_routing_chain') return Promise.resolve([]);
      return Promise.resolve();
    });

    // Act
    render(<CloudRoutingPanel />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('When you have connect one or more intelligence sources, all available models will be listed here.')).toBeInTheDocument();
    });
  });

  it('displays quota/rate-limit error badge when proxy_model_error event is received', async () => {
    // Arrange
    render(<CloudRoutingPanel />);
    await waitFor(() => expect(screen.getByText('openrouter/anthropic-claude-3.5-sonnet')).toBeInTheDocument());

    // Act: Emit 429 quota error event
    await act(async () => {
      proxyErrorCallback({
        payload: {
          model: 'openrouter/anthropic-claude-3.5-sonnet',
          provider: 'openrouter',
          error: 'Rate limit exceeded: 429 Too Many Requests',
        },
      });
    });

    // Assert
    expect(screen.getByText('SKIPPED: 429 (QUOTA)')).toBeInTheDocument();
  });

  it('displays timeout/cooldown error badge when proxy_model_error with TTFT timeout event is received', async () => {
    // Arrange
    render(<CloudRoutingPanel />);
    await waitFor(() => expect(screen.getByText('openrouter/anthropic-claude-3.5-sonnet')).toBeInTheDocument());

    // Act: Emit TTFT timeout error event
    await act(async () => {
      proxyErrorCallback({
        payload: {
          model: 'openrouter/anthropic-claude-3.5-sonnet',
          provider: 'openrouter',
          error: 'openrouter API error: HTTP timeout - Exceeded TTFT timeout (10s) waiting for first token on model nvidia/nemotron',
        },
      });
    });

    // Assert
    expect(screen.getByText('SKIPPED: TIMEOUT (COOLDOWN)')).toBeInTheDocument();
  });

  it('handles reordering via Rank Top button and invokes set_model_override', async () => {
    // Arrange
    render(<CloudRoutingPanel />);
    await waitFor(() => expect(screen.getByText('google/gemini-2.5-flash')).toBeInTheDocument());

    // Act: Click Rank Top on the second model (index 1)
    const rankTopButtons = screen.getAllByTitle('Rank Top');
    fireEvent.click(rankTopButtons[1]);

    // Assert
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('set_model_override', {
        overrides: ['google/gemini-2.5-flash'],
      });
    });
  });

  it('unpins model override when Reset is clicked', async () => {
    // Arrange: config starts with an override
    (invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'get_frugallm_config') {
        return Promise.resolve({ manual_model_overrides: ['google/gemini-2.5-flash'] });
      }
      if (cmd === 'get_routing_chain' || cmd === 'refresh_routing_chain') {
        return Promise.resolve(mockModels);
      }
      if (cmd === 'set_model_override') {
        return Promise.resolve();
      }
      return Promise.resolve();
    });

    render(<CloudRoutingPanel />);
    await waitFor(() => expect(screen.getByText('Reset')).toBeInTheDocument());

    // Act: Click Reset button
    fireEvent.click(screen.getByText('Reset'));

    // Assert
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('set_model_override', { overrides: [] });
    });
  });

  it('in controlled mode (with onOverridesChange), calls callback and does not invoke set_model_override immediately', async () => {
    const onOverridesChangeMock = vi.fn();
    (invoke as any).mockClear();

    render(
      <CloudRoutingPanel 
        overrides={[]} 
        onOverridesChange={onOverridesChangeMock} 
      />
    );
    await waitFor(() => expect(screen.getByText('google/gemini-2.5-flash')).toBeInTheDocument());

    // Act: Click Rank Top on index 1
    const rankTopButtons = screen.getAllByTitle('Rank Top');
    fireEvent.click(rankTopButtons[1]);

    // Assert: Callback was fired with new overrides
    expect(onOverridesChangeMock).toHaveBeenCalledWith(['google/gemini-2.5-flash']);
    
    // Assert: set_model_override was NOT called immediately
    expect(invoke).not.toHaveBeenCalledWith('set_model_override', expect.anything());
  });

  it('filters out models with context_length < 128000 and frugallm-active models', async () => {
    const contextTestModels: CloudModel[] = [
      { model: 'model/valid-128k', provider: 'openrouter', iq: 80, context_length: 128000 },
      { model: 'model/valid-1m', provider: 'google', iq: 90, context_length: 1048576 },
      { model: 'model/excluded-8k', provider: 'google', iq: 70, context_length: 8192 },
      { model: 'model/excluded-32k', provider: 'openrouter', iq: 60, context_length: 32000 },
      { model: 'frugallm-active:latest', provider: 'ollama', iq: 0, context_length: 131072 },
    ];

    (invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'get_frugallm_config') return Promise.resolve({ manual_model_overrides: [] });
      if (cmd === 'get_routing_chain' || cmd === 'refresh_routing_chain') return Promise.resolve(contextTestModels);
      return Promise.resolve();
    });

    render(<CloudRoutingPanel />);

    await waitFor(() => {
      expect(screen.getByText('model/valid-128k')).toBeInTheDocument();
      expect(screen.getByText('model/valid-1m')).toBeInTheDocument();
    });

    // Sub-128k models and frugallm-active aliases must be strictly excluded from display
    expect(screen.queryByText('model/excluded-8k')).not.toBeInTheDocument();
    expect(screen.queryByText('model/excluded-32k')).not.toBeInTheDocument();
    expect(screen.queryByText('frugallm-active:latest')).not.toBeInTheDocument();

    // Context badges are removed
    expect(screen.queryByTestId('model-context-model/valid-128k')).not.toBeInTheDocument();
    expect(screen.queryByTestId('model-context-model/valid-1m')).not.toBeInTheDocument();
  });
});
