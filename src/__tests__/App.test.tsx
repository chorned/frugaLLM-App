import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock @xterm/xterm
vi.mock('@xterm/xterm', () => {
  class Terminal {
    open = vi.fn();
    write = vi.fn();
    dispose = vi.fn();
    loadAddon = vi.fn();
    onData = vi.fn();
  }
  return { Terminal };
});

vi.mock('@xterm/addon-fit', () => {
  class FitAddon {
    fit = vi.fn();
  }
  return { FitAddon };
});

// Mock Tauri plugins & APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

vi.mock('@tauri-apps/plugin-autostart', () => ({
  isEnabled: vi.fn().mockResolvedValue(false),
  enable: vi.fn().mockResolvedValue(undefined),
  disable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  }),
}));

import { invoke } from '@tauri-apps/api/core';
import App from '../App';

describe('App Component Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    (invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'is_wipe_mode') return Promise.resolve(false);
      if (cmd === 'get_frugallm_config') {
        return Promise.resolve({
          port: 61721,
          bind_all_interfaces: false,
          api_password: '',
          input_tokens_session: 0,
          output_tokens_session: 0,
          input_tokens_lifetime: 0,
          output_tokens_lifetime: 0,
          opencode_workspace: '~/OpenCode',
          hermes_workspace: '~/Hermes',
          start_minimized: false,
          manual_model_overrides: [],
          tool_enforcing_gateway: false,
        });
      }
      if (cmd === 'get_routing_chain') return Promise.resolve([]);
      if (cmd === 'check_ollama_status') return Promise.resolve(true);
      if (cmd === 'check_hermes_status') return Promise.resolve(true);
      if (cmd === 'check_opencode_status') return Promise.resolve(true);
      if (cmd === 'check_tool_gateway_status') return Promise.resolve(false);
      if (cmd === 'detect_vram') return Promise.resolve(16384);
      if (cmd === 'get_model_tag_for_vram') return Promise.resolve('gemma4:12b');
      if (cmd === 'get_credential') return Promise.resolve(null);
      if (cmd === 'detect_hardware_profile') {
        return Promise.resolve({
          is_unified: false,
          dedicated_vram: 16 * 1024 * 1024 * 1024,
          system_ram: 32 * 1024 * 1024 * 1024,
          execution_ceiling: 16 * 1024 * 1024 * 1024,
          os_architecture: 'macos-x86_64',
        });
      }
      return Promise.resolve();
    });
  });

  it('renders the initial loader until background services are ready, then mounts the workspace canvas', async () => {
    // Arrange & Act
    render(<App />);

    // Assert: App finishes loader and displays nodes
    await waitFor(
      () => {
        expect(screen.getByText('FrugaLLM')).toBeInTheDocument();
        expect(screen.getByText('Ollama')).toBeInTheDocument();
        expect(screen.getByText('AI Studio')).toBeInTheDocument();
      },
      { timeout: 10000 }
    );
  }, 15000);

  it('triggers onboarding decision modal on fresh launch and advances to tutorial overlay', async () => {
    // Arrange
    localStorage.setItem('onboardingState', 'fresh');

    // Act
    render(<App />);

    // Assert: Onboarding decision popup appears
    await waitFor(
      () => {
        expect(screen.getByText(/I want to learn, walk me through it/i)).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    // Act: Click learning walk-through
    const learnBtn = screen.getByText(/I want to learn, walk me through it/i).closest('button');
    expect(learnBtn).not.toBeNull();
    fireEvent.click(learnBtn!);

    // Assert: Overlay with tutorial displays
    await waitFor(
      () => {
        expect(screen.getByText(/Local Hardware Node/i)).toBeInTheDocument();
        expect(screen.getByText(/Finish Tour/i)).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    // Act: Finish tour
    fireEvent.click(screen.getByText(/Finish Tour/i));

    // Assert: Overlay completes
    await waitFor(
      () => {
        expect(screen.queryByText(/Finish Tour/i)).not.toBeInTheDocument();
      },
      { timeout: 10000 }
    );
  }, 15000);

  it('opens property configuration panel when clicking a canvas node', async () => {
    // Arrange: bypass onboarding
    localStorage.setItem('onboardingState', 'completed');
    const { container } = render(<App />);

    await waitFor(
      () => {
        expect(screen.getByText('FrugaLLM')).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    // Act: Click on the FrugaLLM node container
    const frugalNode = container.querySelector('[data-node-id="node-frugallm"]');
    expect(frugalNode).not.toBeNull();
    fireEvent.click(frugalNode!);

    // Assert: Config panel opens with FrugaLLM settings
    await waitFor(
      () => {
        expect(screen.getByText('COPY IP & PORT')).toBeInTheDocument();
        expect(screen.getByTestId('api-password-checkbox')).toBeInTheDocument();
      },
      { timeout: 10000 }
    );
  }, 15000);
});
