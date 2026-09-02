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
});
