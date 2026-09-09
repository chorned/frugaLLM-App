import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock @xterm/xterm
vi.mock('@xterm/xterm', () => {
  class Terminal {
    open = vi.fn();
    write = vi.fn();
    writeln = vi.fn();
    dispose = vi.fn();
    loadAddon = vi.fn();
    onData = vi.fn().mockReturnValue({ dispose: vi.fn() });
    onResize = vi.fn();
  }
  return { Terminal };
});

vi.mock('@xterm/addon-fit', () => {
  class FitAddon {
    fit = vi.fn();
  }
  return { FitAddon };
});

if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  } as any;
}

// Mock Tauri plugins & APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const eventListeners: Record<string, Function[]> = {};

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockImplementation((event: string, callback: Function) => {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(callback);
    return Promise.resolve(() => {
      eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
    });
  }),
}));

vi.mock('@tauri-apps/plugin-autostart', () => ({
  isEnabled: vi.fn().mockResolvedValue(false),
  enable: vi.fn().mockResolvedValue(undefined),
  disable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  Store: {
    load: vi.fn().mockResolvedValue({
      get: vi.fn().mockResolvedValue(false),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    }),
  },
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
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import confetti from 'canvas-confetti';
import App from '../App';

describe('App Component Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.keys(eventListeners).forEach(k => delete eventListeners[k]);

    (invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'is_wipe_mode') return Promise.resolve(false);
      if (cmd === 'is_mock_update_mode') return Promise.resolve(false);
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
        expect(screen.getAllByText('FrugaLLM').length).toBeGreaterThanOrEqual(1);
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
        expect(screen.getAllByText('FrugaLLM').length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 10000 }
    );

    // Act: Click on the FrugaLLM node container
    const frugalNode = container.querySelector('[data-node-id="node-frugallm"]');
    expect(frugalNode).not.toBeNull();
    fireEvent.click(frugalNode!);

    // Assert: Config panel opens with FrugaLLM settings and 4px reduced blur backdrop
    await waitFor(
      () => {
        expect(screen.getByText('COPY IP & PORT')).toBeInTheDocument();
        expect(screen.getByTestId('api-password-checkbox')).toBeInTheDocument();
        const backdrop = document.querySelector('div[style*="blur(4px)"]');
        expect(backdrop).toBeInTheDocument();
      },
      { timeout: 10000 }
    );
  }, 15000);

  it('renders port conflict banner and Hub error badge when server status is PortConflict', async () => {
    // Arrange: Mock server status returning PortConflict on 5050
    localStorage.setItem('onboardingState', 'completed');
    (invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'is_wipe_mode') return Promise.resolve(false);
      if (cmd === 'is_mock_update_mode') return Promise.resolve(false);
      if (cmd === 'get_frugallm_config') {
        return Promise.resolve({
          port: 5050,
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
      if (cmd === 'get_frugallm_server_status') {
        return Promise.resolve({
          status: 'PortConflict',
          data: {
            port: 5050,
            ip: '127.0.0.1',
            message: 'Close the service currently using port [5050] and restart the app, or choose a different port.',
          },
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

    render(<App />);

    // Assert: Banner appears with port conflict details
    await waitFor(
      () => {
        expect(screen.getByTestId('port-conflict-banner')).toBeInTheDocument();
        expect(screen.getByText('PORT CONFLICT DETECTED')).toBeInTheDocument();
        expect(
          screen.getByText(/Close the service currently using port \[5050\] and restart the app\./i)
        ).toBeInTheDocument();
        expect(screen.getByTestId('frugallm-port-conflict-badge')).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    // Act: Click "Configure Port" on the banner
    const configureBtn = screen.getByTestId('port-conflict-configure');
    fireEvent.click(configureBtn);

    // Assert: Hub settings panel opens with editable port field and conflict hint
    await waitFor(
      () => {
        const portInput = screen.getByTestId('input-frugallm-port');
        expect(portInput).toBeInTheDocument();
        expect((portInput as HTMLInputElement).value).toBe('5050');
        expect(screen.getByTestId('port-conflict-hint')).toBeInTheDocument();
      },
      { timeout: 10000 }
    );
  }, 15000);

  it('disables SAVE CHANGES button until changes are made, then enables it and shoots confetti on save', async () => {
    localStorage.setItem('onboardingState', 'completed');
    const { container } = render(<App />);

    await waitFor(
      () => {
        expect(screen.getAllByText('FrugaLLM').length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 10000 }
    );

    // Open FrugaLLM config
    const frugalNode = container.querySelector('[data-node-id="node-frugallm"]');
    expect(frugalNode).not.toBeNull();
    fireEvent.click(frugalNode!);

    await waitFor(() => {
      expect(screen.getByTestId('save-node-config-button')).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId('save-node-config-button');
    // Initially disabled because no changes exist
    expect(saveButton).toBeDisabled();

    // Modify port
    const portInput = screen.getByTestId('input-frugallm-port');
    fireEvent.change(portInput, { target: { name: 'port', value: '62000' } });

    // Button should now be enabled and have accent styling
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
      expect(saveButton).toHaveStyle({ backgroundColor: 'var(--zen-accent)' });
    });

    // Click SAVE CHANGES
    fireEvent.click(saveButton);

    // Verify invoke was called and confetti was triggered
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('set_frugallm_config', expect.anything());
      expect(confetti).toHaveBeenCalled();
    });
  }, 15000);

  it('does not render missing agent text when agents are not installed', async () => {
    localStorage.setItem('onboardingState', 'completed');
    (invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'is_wipe_mode') return Promise.resolve(false);
      if (cmd === 'is_mock_update_mode') return Promise.resolve(false);
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
        });
      }
      if (cmd === 'check_hermes_status') return Promise.resolve(false);
      if (cmd === 'check_opencode_status') return Promise.resolve(false);
      if (cmd === 'check_ollama_status') return Promise.resolve(true);
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

    const { container } = render(<App />);

    await waitFor(
      () => {
        expect(screen.getByText('Hermes')).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    // Open Hermes node
    const hermesNode = container.querySelector('[data-node-id="node-hermes"]');
    expect(hermesNode).not.toBeNull();
    fireEvent.click(hermesNode!);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'INSTALL HERMES' })).toBeInTheDocument();
    });

    // Ensure HERMES AGENT MISSING is not rendered
    expect(screen.queryByText(/HERMES AGENT MISSING/i)).not.toBeInTheDocument();

    // Close and open OpenCode node
    const closeBtn = screen.getByRole('button', { name: '✕' });
    fireEvent.click(closeBtn);

    const opencodeNode = container.querySelector('[data-node-id="node-opencode"]');
    expect(opencodeNode).not.toBeNull();
    fireEvent.click(opencodeNode!);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'INSTALL OPENCODE' })).toBeInTheDocument();
    });

    // Ensure OPENCODE AGENT MISSING is not rendered
    expect(screen.queryByText(/OPENCODE AGENT MISSING/i)).not.toBeInTheDocument();
  }, 15000);

  it('triggers exit confirmation modal when request_exit_confirmation event is received', async () => {
    const baseInvoke = (invoke as any).getMockImplementation();
    (invoke as any).mockImplementation((cmd: string, args: any) => {
      if (cmd === 'get_active_services') return Promise.resolve(['Hermes Dashboard', 'Hermes Gateway']);
      if (cmd === 'confirm_exit_app') return Promise.resolve();
      return baseInvoke(cmd, args);
    });

    render(<App />);

    await waitFor(
      () => {
        expect(screen.getAllByText('FrugaLLM').length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 10000 }
    );

    // Simulate Tauri backend emitting request_exit_confirmation
    expect(eventListeners['request_exit_confirmation']).toBeDefined();
    await act(async () => {
      for (const cb of eventListeners['request_exit_confirmation'] || []) {
        cb();
      }
    });

    // Assert: Modal is visible with warning and active services
    await waitFor(() => {
      expect(screen.getByTestId('exit-confirmation-modal')).toBeInTheDocument();
      expect(screen.getByText('ACTIVE SERVICES RUNNING')).toBeInTheDocument();
      expect(screen.getByText('Hermes Dashboard')).toBeInTheDocument();
    });

    // Cancel exit
    fireEvent.click(screen.getByTestId('exit-cancel-button'));
    expect(screen.queryByTestId('exit-confirmation-modal')).not.toBeInTheDocument();

    // Trigger again and confirm exit
    await act(async () => {
      for (const cb of eventListeners['request_exit_confirmation'] || []) {
        cb();
      }
    });

    await waitFor(() => {
      expect(screen.getByTestId('exit-confirmation-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('exit-confirm-button'));
    expect(invoke).toHaveBeenCalledWith('confirm_exit_app');
  }, 15000);

  it('autostarts Hermes Gateway when installed, launches Hermes Desktop via LAUNCH APP and WebUI, and allows Close', async () => {
    const baseInvoke = (invoke as any).getMockImplementation();
    (invoke as any).mockImplementation((cmd: string, args: any) => {
      if (cmd === 'check_hermes_status') return Promise.resolve(true);
      if (cmd === 'check_hermes_ready') return Promise.resolve(true);
      if (cmd === 'get_active_services') return Promise.resolve(['hermes-gateway']);
      if (cmd === 'spawn_pty') return Promise.resolve();
      if (cmd === 'kill_pty') return Promise.resolve();
      if (cmd === 'stop_hermes_service') return Promise.resolve();
      return baseInvoke(cmd, args);
    });

    const { container } = render(<App />);

    await waitFor(
      () => {
        expect(screen.getByText('Hermes')).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    // Open Hermes Node Config Panel
    const hermesNode = container.querySelector('[data-node-id="node-hermes"]');
    expect(hermesNode).not.toBeNull();
    fireEvent.click(hermesNode!);

    await waitFor(() => {
      expect(screen.getByText('LAUNCH WEBUI')).toBeInTheDocument();
      expect(screen.getByText('LAUNCH APP')).toBeInTheDocument();
      // Hermes Gateway should be active on startup when Hermes is installed
      expect(screen.getByText('HERMES GATEWAY ACTIVE')).toBeInTheDocument();
    });

    // 1. Click Launch App -> Opens Terminal View with Hermes App build/startup logs
    const launchAppBtn = screen.getByText('LAUNCH APP');
    await act(async () => {
      fireEvent.click(launchAppBtn);
    });

    // Assert: Terminal View opened with Hermes App title and PTY spawned with hermes desktop
    await waitFor(() => {
      expect(screen.getByText('Hermes App')).toBeInTheDocument();
    });
    expect(invoke).toHaveBeenCalledWith(
      'spawn_pty',
      expect.objectContaining({
        sessionId: 'run-hermes-desktop',
      })
    );

    // 2. Click HIDE button to keep running in background and return to canvas
    const hideBtns = screen.getAllByText(/HIDE/i);
    await act(async () => {
      fireEvent.click(hideBtns[0]);
    });

    // Assert: Terminal View is hidden (modal dismissed)
    await waitFor(() => {
      const overlay = container.querySelector('div[style*="z-index: 50"], div[style*="zIndex: 50"]');
      if (overlay) {
        expect(overlay).toHaveStyle({ display: 'none' });
      }
    });

    // Reopen Hermes Config Panel to verify BOTH processes are active concurrently with CLOSE buttons
    fireEvent.click(hermesNode!);
    await waitFor(() => {
      expect(screen.getByText('HERMES GATEWAY ACTIVE')).toBeInTheDocument();
      expect(screen.getByText('HERMES APP ACTIVE')).toBeInTheDocument();
    });

    const closeButtons = screen.getAllByRole('button', { name: 'CLOSE' });
    expect(closeButtons.length).toBe(2);

    // Click CLOSE on Hermes Gateway process
    await act(async () => {
      fireEvent.click(closeButtons[0]);
    });
    expect(invoke).toHaveBeenCalledWith('kill_pty', { sessionId: 'run-hermes-gateway' });
    expect(invoke).toHaveBeenCalledWith('stop_hermes_service', { service: 'run-hermes-gateway' });
  }, 15000);

  it('launches Hermes CLI from CTA with robust PATH including ~/.local/bin and executes properly', async () => {
    const baseInvoke = (invoke as any).getMockImplementation();
    let spawnedCommands: any[] = [];
    (invoke as any).mockImplementation((cmd: string, args: any) => {
      if (cmd === 'check_hermes_status') return Promise.resolve(true);
      if (cmd === 'check_hermes_ready') return Promise.resolve(true);
      if (cmd === 'get_active_services') return Promise.resolve([]);
      if (cmd === 'spawn_pty') {
        spawnedCommands.push(args);
        return Promise.resolve();
      }
      if (cmd === 'kill_pty') return Promise.resolve();
      return baseInvoke(cmd, args);
    });

    const { container } = render(<App />);

    await waitFor(
      () => {
        expect(screen.getByText('Hermes')).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    // Open Hermes Node Config Panel
    const hermesNode = container.querySelector('[data-node-id="node-hermes"]');
    expect(hermesNode).not.toBeNull();
    fireEvent.click(hermesNode!);

    await waitFor(() => {
      expect(screen.getByText('LAUNCH HERMES')).toBeInTheDocument();
    });

    // Click Launch Hermes CTA
    const launchHermesBtn = screen.getByText('LAUNCH HERMES');
    await act(async () => {
      fireEvent.click(launchHermesBtn);
    });

    // Verify Terminal View opened with Hermes Terminal title
    await waitFor(() => {
      expect(screen.getByText('Hermes Terminal')).toBeInTheDocument();
    });

    // Verify spawn_pty was called with sessionId 'run-hermes' and includes $HOME/.local/bin in PATH
    expect(spawnedCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sessionId: 'run-hermes',
          command: 'bash',
          args: [
            '-c',
            expect.stringMatching(/\$HOME\/\.local\/bin.*HERMES_BIN.*"\$HERMES_BIN"/),
          ],
        }),
      ])
    );
  }, 15000);

  it('handles TerminalView close confirmation, cancellation, and termination', async () => {
    const baseInvoke = (invoke as any).getMockImplementation();
    (invoke as any).mockImplementation((cmd: string, args: any) => {
      if (cmd === 'check_hermes_status') return Promise.resolve(true);
      if (cmd === 'check_hermes_ready') return Promise.resolve(true);
      if (cmd === 'get_active_services') return Promise.resolve([]);
      if (cmd === 'spawn_pty') return Promise.resolve();
      if (cmd === 'kill_pty') return Promise.resolve();
      return baseInvoke(cmd, args);
    });

    const { container } = render(<App />);

    await waitFor(
      () => {
        expect(screen.getByText('Hermes')).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    // Open Hermes Node Config Panel
    const hermesNode = container.querySelector('[data-node-id="node-hermes"]');
    expect(hermesNode).not.toBeNull();
    fireEvent.click(hermesNode!);

    await waitFor(() => {
      expect(screen.getByText('LAUNCH APP')).toBeInTheDocument();
    });

    // Launch Hermes App -> opens TerminalView
    await act(async () => {
      fireEvent.click(screen.getByText('LAUNCH APP'));
    });

    await waitFor(() => {
      expect(screen.getByText('Hermes App')).toBeInTheDocument();
    });

    // Click ✕ on the visible Hermes App terminal
    const closeButtons = screen.getAllByRole('button', { name: '✕' });
    const appCloseBtn = closeButtons[closeButtons.length - 1];
    fireEvent.click(appCloseBtn);

    // Assert: confirmation message and buttons are displayed
    await waitFor(() => {
      expect(screen.getByText('This will terminate the running process. Are you sure?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    // Click Cancel -> confirmation disappears, close & hide buttons return
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByText('This will terminate the running process. Are you sure?')).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: '✕' }).length).toBeGreaterThanOrEqual(1);
    });

    // Click ✕ again and click Yes -> invokes kill_pty and closes terminal
    const closeButtonsAfterCancel = screen.getAllByRole('button', { name: '✕' });
    fireEvent.click(closeButtonsAfterCancel[closeButtonsAfterCancel.length - 1]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    });

    expect(invoke).toHaveBeenCalledWith('kill_pty', { sessionId: 'run-hermes-desktop' });
  }, 15000);

  it('renders header with left-aligned FrugaLLM logo, footer with placeholder hyperlinks, and dark grey node gear icons', async () => {
    localStorage.setItem('onboardingState', 'completed');
    const { container } = render(<App />);

    await waitFor(
      () => {
        expect(screen.getByTestId('app-header')).toBeInTheDocument();
        expect(screen.getByTestId('app-footer')).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    // Header assertions: left-aligned logo and brand text
    const header = screen.getByTestId('app-header');
    expect(header).toBeInTheDocument();
    const logoSvg = screen.getByRole('img', { name: 'FrugaLLM Logo' });
    expect(logoSvg).toBeInTheDocument();
    expect(screen.getByTestId('header-frugallm-icon')).toBeInTheDocument();

    // Footer assertions: placeholder hyperlinks
    const footer = screen.getByTestId('app-footer');
    expect(footer).toBeInTheDocument();
    expect(screen.getByTestId('footer-link-docs')).toHaveTextContent('Documentation');
    expect(screen.getByTestId('footer-link-github')).toHaveTextContent('GitHub');
    expect(screen.getByTestId('footer-link-guides')).toHaveTextContent('Quickstart Guides');
    expect(screen.getByTestId('footer-link-privacy')).toHaveTextContent('Privacy & Telemetry');

    // Footer Guides link interaction
    fireEvent.click(screen.getByTestId('footer-link-guides'));
    await waitFor(() => {
      expect(screen.getByText(/FRUGALLM \/\/ QUICKSTART GUIDES/i)).toBeInTheDocument();
    });
    // Close guides modal
    fireEvent.click(screen.getByRole('button', { name: '✕' }));

    // Canvas node gear icon styling assertion: Dark grey matching headerText
    const frugalNode = container.querySelector('[data-node-id="node-frugallm"]') as HTMLElement;
    expect(frugalNode).not.toBeNull();
    const gearIconContainer = frugalNode?.querySelector('svg circle')?.closest('div');
    expect(gearIconContainer).toHaveStyle({ color: 'var(--zen-text)' });

    // Assert 3-Row Flexbox Router Architecture
    const mainContainer = screen.getByTestId('router-main-container');
    expect(mainContainer).toHaveStyle({
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    });

    // Assert Dynamic SVG Routing Layer
    const svgLayer = screen.getByTestId('router-svg-layer');
    expect(svgLayer).toBeInTheDocument();
    expect(svgLayer).toHaveStyle({
      position: 'absolute',
      pointerEvents: 'none'
    });

    // Assert Top Row (3 nodes: ollama, google, openrouter)
    const topRow = screen.getByTestId('router-top-row');
    expect(topRow).toHaveStyle({
      display: 'flex',
      width: '100%',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    });
    expect(topRow.querySelector('[data-node-id="node-ollama"]')).toBeInTheDocument();
    expect(topRow.querySelector('[data-node-id="node-google"]')).toBeInTheDocument();
    expect(topRow.querySelector('[data-node-id="node-openrouter"]')).toBeInTheDocument();

    // Assert Middle Row (1 central router node: frugallm)
    const middleRow = screen.getByTestId('router-middle-row');
    expect(middleRow).toHaveStyle({
      display: 'flex',
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center'
    });
    expect(middleRow.querySelector('[data-node-id="node-frugallm"]')).toBeInTheDocument();

    // Assert Bottom Row (2 nodes: opencode, hermes with horizontal padding)
    const bottomRow = screen.getByTestId('router-bottom-row');
    expect(bottomRow).toHaveStyle({
      display: 'flex',
      width: '100%',
      justifyContent: 'space-around',
      alignItems: 'flex-end',
      paddingLeft: '11%',
      paddingRight: '11%'
    });
    expect(bottomRow.querySelector('[data-node-id="node-opencode"]')).toBeInTheDocument();
    expect(bottomRow.querySelector('[data-node-id="node-hermes"]')).toBeInTheDocument();
  }, 15000);

  it('reactively updates provider status indicators on failure and maintains error status until 200 OK', async () => {
    render(<App />);

    // Wait for canvas to load
    await waitFor(() => {
      expect(screen.getByTestId('node-google-status')).toBeInTheDocument();
      expect(screen.getByTestId('node-openrouter-status')).toBeInTheDocument();
    }, { timeout: 10000 });

    // 1. Emit 403 Forbidden for Google
    act(() => {
      eventListeners['provider_status']?.forEach(cb => cb({ payload: { provider: 'google', status: '403' } }));
    });

    const googleStatus = screen.getByTestId('node-google-status');
    expect(googleStatus).toHaveTextContent('403');
    expect(googleStatus).toHaveStyle({ color: 'rgb(239, 68, 68)' }); // #ef4444

    // 2. Emit 503 Overloaded for OpenRouter
    act(() => {
      eventListeners['provider_status']?.forEach(cb => cb({ payload: { provider: 'openrouter', status: '503' } }));
    });

    const openrouterStatus = screen.getByTestId('node-openrouter-status');
    expect(openrouterStatus).toHaveTextContent('503');
    expect(openrouterStatus).toHaveStyle({ color: 'rgb(239, 68, 68)' });

    // Verify Google status stayed at 403
    expect(screen.getByTestId('node-google-status')).toHaveTextContent('403');
    expect(screen.getByTestId('node-google-status')).toHaveStyle({ color: 'rgb(239, 68, 68)' });

    // 3. Emit 200 OK for Google — Google turns green, OpenRouter remains 503
    act(() => {
      eventListeners['provider_status']?.forEach(cb => cb({ payload: { provider: 'google', status: '200 OK' } }));
    });

    expect(screen.getByTestId('node-google-status')).toHaveTextContent('200 OK');
    expect(screen.getByTestId('node-google-status')).toHaveStyle({ color: 'rgb(16, 185, 129)' }); // #10B981
    expect(screen.getByTestId('node-openrouter-status')).toHaveTextContent('503');
    expect(screen.getByTestId('node-openrouter-status')).toHaveStyle({ color: 'rgb(239, 68, 68)' });

    // 4. Emit 503 for Ollama
    act(() => {
      eventListeners['provider_status']?.forEach(cb => cb({ payload: { provider: 'ollama', status: '503' } }));
    });

    const ollamaStatus = screen.getByTestId('node-ollama-status');
    expect(ollamaStatus).toBeInTheDocument();
    expect(ollamaStatus).toHaveTextContent('503');

    // 5. Emit 429 Rate Limit for Google — should be Yellow (#eab308 / rgb(234, 179, 8))
    act(() => {
      eventListeners['provider_status']?.forEach(cb => cb({ payload: { provider: 'google', status: '429' } }));
    });
    expect(screen.getByTestId('node-google-status')).toHaveTextContent('429');
    expect(screen.getByTestId('node-google-status')).toHaveStyle({ color: 'rgb(234, 179, 8)' }); // #eab308

    // 6. Emit 429 for OpenRouter — should be Yellow (#eab308 / rgb(234, 179, 8))
    act(() => {
      eventListeners['provider_status']?.forEach(cb => cb({ payload: { provider: 'openrouter', status: '429' } }));
    });
    expect(screen.getByTestId('node-openrouter-status')).toHaveTextContent('429');
    expect(screen.getByTestId('node-openrouter-status')).toHaveStyle({ color: 'rgb(234, 179, 8)' }); // #eab308

    // 7. Recover OpenRouter to 200 OK — should be Green (#10B981 / rgb(16, 185, 129))
    act(() => {
      eventListeners['provider_status']?.forEach(cb => cb({ payload: { provider: 'openrouter', status: '200 OK' } }));
    });
    expect(screen.getByTestId('node-openrouter-status')).toHaveTextContent('200 OK');
    expect(screen.getByTestId('node-openrouter-status')).toHaveStyle({ color: 'rgb(16, 185, 129)' }); // #10B981
  }, 15000);

  it('initializes provider statuses from backend on startup including rate limits', async () => {
    (invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'get_provider_statuses') {
        return Promise.resolve({
          google: '429',
          openrouter: '403',
        });
      }
      if (cmd === 'is_wipe_mode') return Promise.resolve(false);
      if (cmd === 'is_mock_update_mode') return Promise.resolve(false);
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
      if (cmd === 'get_credential') return Promise.resolve('mock-key');
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

    render(<App />);

    await waitFor(() => {
      const googleStatus = screen.getByTestId('node-google-status');
      expect(googleStatus).toHaveTextContent('429');
      expect(googleStatus).toHaveStyle({ color: 'rgb(234, 179, 8)' }); // Yellow #eab308

      const openrouterStatus = screen.getByTestId('node-openrouter-status');
      expect(openrouterStatus).toHaveTextContent('403');
      expect(openrouterStatus).toHaveStyle({ color: 'rgb(239, 68, 68)' }); // Red #ef4444
    }, { timeout: 10000 });
  }, 15000);

  it('allows replacing an existing configured API key and persists credentials even when probe returns 403', async () => {
    (tauriFetch as any).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'Forbidden' } }),
    });

    (invoke as any).mockImplementation((cmd: string, args?: any) => {
      if (cmd === 'get_credential') {
        if (args?.service === 'google') return Promise.resolve('AIzaSyOriginalKey123');
        if (args?.service === 'openrouter') return Promise.resolve('sk-or-originalkey');
        return Promise.resolve(null);
      }
      if (cmd === 'set_credential') return Promise.resolve();
      if (cmd === 'refresh_routing_chain') return Promise.resolve();
      if (cmd === 'get_provider_statuses') {
        return Promise.resolve({
          google: '200 OK',
        });
      }
      if (cmd === 'is_wipe_mode') return Promise.resolve(false);
      if (cmd === 'is_mock_update_mode') return Promise.resolve(false);
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

    render(<App />);

    // Wait for the app to finish loading and display the existing key prefix
    await waitFor(() => {
      const apiKeyDisplay = screen.getByTestId('node-google-api-key');
      expect(apiKeyDisplay).toHaveTextContent('AIzaS...');
    }, { timeout: 10000 });

    // Open Google AI Studio config panel
    const googleNode = document.getElementById('node-google');
    expect(googleNode).not.toBeNull();
    fireEvent.click(googleNode!);

    // NodeConfigPanel opens: Check configured placeholder and Disconnect button
    await waitFor(() => {
      const input = screen.getByPlaceholderText('•••••••••••••••• (Key Configured)');
      expect(input).toBeInTheDocument();
      expect(screen.getByText('DISCONNECT')).toBeInTheDocument();
    });

    // Replace the API key with a new key with prefix 'NEWKY'
    const input = screen.getByPlaceholderText('•••••••••••••••• (Key Configured)');
    fireEvent.change(input, { target: { value: 'NEWKY_test_replaced_google_api_key' } });

    // Verify SAVE button is enabled
    const saveButton = screen.getByTestId('save-node-config-button');
    expect(saveButton).not.toBeDisabled();

    // Click SAVE CHANGES
    fireEvent.click(saveButton);

    // Verify set_credential was called with the new key!
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('set_credential', {
        service: 'google',
        secret: 'NEWKY_test_replaced_google_api_key',
      });
    });

    // Verify the canvas node now displays the new prefix and 403 error in red
    await waitFor(() => {
      const apiKeyDisplay = screen.getByTestId('node-google-api-key');
      expect(apiKeyDisplay).toHaveTextContent('NEWKY...');
      const statusDisplay = screen.getByTestId('node-google-status');
      expect(statusDisplay).toHaveTextContent('403');
      expect(statusDisplay).toHaveStyle({ color: 'rgb(239, 68, 68)' });
    });

    // Verify Disconnect button remains visible even when status is 403
    expect(screen.getByText('DISCONNECT')).toBeInTheDocument();
  }, 15000);

  it('renders report issue CTA button at the bottom of NodeConfigPanel and opens IssueReporterModal', async () => {
    (invoke as any).mockImplementation((cmd: string, args?: any) => {
      if (cmd === 'get_diagnostic_data') {
        return Promise.resolve({
          app_version: '0.0.11',
          os_info: 'macos x86_64',
          logs: '[1234] [INFO] system ok',
        });
      }
      if (cmd === 'get_credential') return Promise.resolve(null);
      if (cmd === 'is_wipe_mode') return Promise.resolve(false);
      if (cmd === 'is_mock_update_mode') return Promise.resolve(false);
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
      if (cmd === 'check_ollama_status') return Promise.resolve(false);
      if (cmd === 'check_hermes_status') return Promise.resolve(false);
      if (cmd === 'check_opencode_status') return Promise.resolve(false);
      if (cmd === 'check_tool_gateway_status') return Promise.resolve(false);
      if (cmd === 'get_provider_statuses') return Promise.resolve({});
      if (cmd === 'detect_vram') return Promise.resolve(16384);
      if (cmd === 'get_model_tag_for_vram') return Promise.resolve('gemma4:12b');
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

    render(<App />);

    // 1. First, click Google Node and verify "Report Issue" button is NOT present
    await waitFor(() => {
      expect(document.getElementById('node-google')).not.toBeNull();
    }, { timeout: 10000 });
    const googleNode = document.getElementById('node-google')!;
    fireEvent.click(googleNode);

    // Ensure Google Node panel opens, but does not have the report issue button
    await waitFor(() => {
      expect(screen.getByTestId('save-node-config-button')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('report-issue-button')).not.toBeInTheDocument();

    // 2. Click FrugaLLM node to open its settings panel
    const frugallmNode = document.getElementById('node-frugallm')!;
    fireEvent.click(frugallmNode);

    // Verify "Report Issue & Send Diagnostics" button is present underneath View Logs
    await waitFor(() => {
      expect(screen.getByTestId('btn-view-logs')).toBeInTheDocument();
      expect(screen.getByTestId('report-issue-button')).toBeInTheDocument();
    });

    // 3. Click the button to trigger modal
    fireEvent.click(screen.getByTestId('report-issue-button'));

    // Verify IssueReporterModal is displayed and get_diagnostic_data was invoked
    await waitFor(() => {
      expect(screen.getByTestId('issue-reporter-modal')).toBeInTheDocument();
      expect(invoke).toHaveBeenCalledWith('get_diagnostic_data');
    });

    // Close modal
    fireEvent.click(screen.getByTestId('cancel-issue-button'));
    await waitFor(() => {
      expect(screen.queryByTestId('issue-reporter-modal')).not.toBeInTheDocument();
    });
  }, 15000);
});


