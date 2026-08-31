import React from 'react';
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

  it('renders global routing pool with models, filtering out computer-use models', async () => {
    // Arrange & Act
    render(<CloudRoutingPanel />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('GLOBAL ROUTING POOL')).toBeInTheDocument();
      expect(screen.getByText('openrouter/anthropic-claude-3.5-sonnet')).toBeInTheDocument();
      expect(screen.getByText('google/gemini-2.5-flash')).toBeInTheDocument();
    });

    // Ensure computer-use model is filtered
    expect(screen.queryByText('openrouter/claude-3.5-sonnet:computer-use')).not.toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
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
      expect(screen.getByText('No models found. Please configure a provider.')).toBeInTheDocument();
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

  it('unpins model override when CANCEL RANK is clicked', async () => {
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
    await waitFor(() => expect(screen.getByText('CANCEL RANK')).toBeInTheDocument());

    // Act: Click cancel rank
    fireEvent.click(screen.getByText('CANCEL RANK'));

    // Assert
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('set_model_override', { overrides: [] });
    });
  });
});
