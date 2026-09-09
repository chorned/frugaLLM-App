import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Settings } from '../Settings';

// Mock plugin-autostart
const mockIsEnabled = vi.fn();
const mockEnable = vi.fn();
const mockDisable = vi.fn();

vi.mock('@tauri-apps/plugin-autostart', () => ({
  isEnabled: () => mockIsEnabled(),
  enable: () => mockEnable(),
  disable: () => mockDisable(),
}));

// Mock plugin-store
const mockStoreGet = vi.fn();
const mockStoreSet = vi.fn();
const mockStoreSave = vi.fn();

// Mock tauri invoke
const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args: any) => mockInvoke(cmd, args),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  Store: {
    load: vi.fn().mockResolvedValue({
      get: (key: string) => mockStoreGet(key),
      set: (key: string, val: any) => mockStoreSet(key, val),
      save: () => mockStoreSave(),
    }),
  },
}));

describe('Settings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEnabled.mockResolvedValue(false);
    mockEnable.mockResolvedValue(undefined);
    mockDisable.mockResolvedValue(undefined);
    mockStoreGet.mockResolvedValue(false);
    mockStoreSet.mockResolvedValue(undefined);
    mockStoreSave.mockResolvedValue(undefined);
    mockInvoke.mockResolvedValue(undefined);
  });

  it('renders both controlled checkboxes with concise labels', async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
      expect(screen.getByTestId('checkbox-start-on-login')).toBeInTheDocument();
      expect(screen.getByTestId('checkbox-start-minimized')).toBeInTheDocument();
      expect(screen.getByText('Start on Login')).toBeInTheDocument();
      expect(screen.getByText('Start Minimized')).toBeInTheDocument();
      expect(screen.queryByTestId('unsigned-app-warning')).not.toBeInTheDocument();
    });
  });

  it('synchronizes OS autostart state and persistent store on mount', async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockStoreGet.mockImplementation(async (key: string) => {
      if (key === 'start_minimized') return true;
      return null;
    });

    const onLoginChange = vi.fn();
    const onMinimizedChange = vi.fn();

    render(
      <Settings
        onStartOnLoginChange={onLoginChange}
        onStartMinimizedChange={onMinimizedChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('checkbox-start-on-login')).toBeChecked();
      expect(screen.getByTestId('checkbox-start-minimized')).toBeChecked();
    });

    expect(mockIsEnabled).toHaveBeenCalled();
    expect(onLoginChange).toHaveBeenCalledWith(true);
    expect(onMinimizedChange).toHaveBeenCalledWith(true);
  });

  it('toggles Start on Login and invokes enableAutostart and callback', async () => {
    mockIsEnabled.mockResolvedValue(false);
    const onLoginChange = vi.fn();

    render(<Settings onStartOnLoginChange={onLoginChange} />);

    await waitFor(() => {
      expect(screen.getByTestId('checkbox-start-on-login')).not.toBeDisabled();
    });

    const checkbox = screen.getByTestId('checkbox-start-on-login');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mockEnable).toHaveBeenCalledTimes(1);
      expect(onLoginChange).toHaveBeenCalledWith(true);
    });

    // Uncheck
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mockDisable).toHaveBeenCalledTimes(1);
      expect(onLoginChange).toHaveBeenCalledWith(false);
    });
  });

  it('toggles Start Minimized and persists value to tauri-plugin-store', async () => {
    const onMinimizedChange = vi.fn();

    render(<Settings onStartMinimizedChange={onMinimizedChange} />);

    await waitFor(() => {
      expect(screen.getByTestId('checkbox-start-minimized')).not.toBeDisabled();
    });

    const minCheckbox = screen.getByTestId('checkbox-start-minimized');
    fireEvent.click(minCheckbox);

    await waitFor(() => {
      expect(mockStoreSet).toHaveBeenCalledWith('start_minimized', true);
      expect(mockStoreSave).toHaveBeenCalled();
      expect(onMinimizedChange).toHaveBeenCalledWith(true);
    });
  });

  it('handles autostart IPC rejection gracefully without throwing unhandled exceptions', async () => {
    mockIsEnabled.mockResolvedValue(false);
    mockEnable.mockRejectedValue(new Error('Permission denied by OS'));

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByTestId('checkbox-start-on-login')).not.toBeDisabled();
    });

    const checkbox = screen.getByTestId('checkbox-start-on-login');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByTestId('settings-error-message')).toBeInTheDocument();
      expect(screen.getByText(/Permission denied by OS/i)).toBeInTheDocument();
    });
  });

  it('renders global CLI checkbox with info ( i ) icon', async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByTestId('checkbox-global-cli')).toBeInTheDocument();
      expect(screen.getByTestId('btn-global-cli-info')).toBeInTheDocument();
      expect(screen.getByText(/Register CLI commands in system terminal/i)).toBeInTheDocument();
    });
  });

  it('triggers explanation tooltip when hovering or clicking ( i ) button', async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-global-cli-info')).toBeInTheDocument();
    });

    const infoBtn = screen.getByTestId('btn-global-cli-info');
    expect(screen.queryByTestId('global-cli-tooltip-box')).not.toBeInTheDocument();

    // Hover triggers tooltip
    fireEvent.mouseEnter(infoBtn);
    expect(screen.getByTestId('global-cli-tooltip-box')).toBeInTheDocument();
    expect(screen.getByText(/Creates shell PATH links for Hermes, OpenCode, and Ollama/i)).toBeInTheDocument();

    // Mouse leave dismisses tooltip
    fireEvent.mouseLeave(infoBtn);
    expect(screen.queryByTestId('global-cli-tooltip-box')).not.toBeInTheDocument();

    // Click toggle also works for accessibility / touch devices
    fireEvent.click(infoBtn);
    expect(screen.getByTestId('global-cli-tooltip-box')).toBeInTheDocument();

    fireEvent.click(infoBtn);
    expect(screen.queryByTestId('global-cli-tooltip-box')).not.toBeInTheDocument();
  });

  it('synchronizes global CLI state on mount and invokes toggle on check/uncheck', async () => {
    mockStoreGet.mockImplementation(async (key: string) => {
      if (key === 'global_cli_enabled') return true;
      return false;
    });
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_global_cli_commands_status') return true;
      return undefined;
    });

    const onCliChange = vi.fn();
    render(<Settings onGlobalCliEnabledChange={onCliChange} />);

    await waitFor(() => {
      expect(screen.getByTestId('checkbox-global-cli')).toBeChecked();
    });

    const checkbox = screen.getByTestId('checkbox-global-cli');
    // Uncheck
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_global_cli_commands', { enabled: false });
      expect(mockStoreSet).toHaveBeenCalledWith('global_cli_enabled', false);
      expect(onCliChange).toHaveBeenCalledWith(false);
    });

    // Check again
    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_global_cli_commands', { enabled: true });
      expect(mockStoreSet).toHaveBeenCalledWith('global_cli_enabled', true);
      expect(onCliChange).toHaveBeenCalledWith(true);
    });
  });

  it('handles global CLI IPC rejection gracefully and displays error message', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'set_global_cli_commands') throw new Error('Failed to create symlink: Permission denied');
      return undefined;
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByTestId('checkbox-global-cli')).not.toBeDisabled();
    });

    const checkbox = screen.getByTestId('checkbox-global-cli');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByTestId('settings-error-message')).toBeInTheDocument();
      expect(screen.getByText(/Failed to create symlink: Permission denied/i)).toBeInTheDocument();
    });
  });

  it('renders View Logs button and triggers open_app_logs on click', async () => {
    render(<Settings />);
    const btn = await screen.findByTestId('btn-view-logs');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(mockInvoke).toHaveBeenCalledWith('open_app_logs', undefined);
  });
});
