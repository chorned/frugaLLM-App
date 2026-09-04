import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateNotification } from '../UpdateNotification';
import * as updateCheckerModule from '../../utils/updateChecker';

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

import { openUrl } from '@tauri-apps/plugin-opener';

describe('UpdateNotification Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no update is available', async () => {
    vi.spyOn(updateCheckerModule, 'checkForAppUpdates').mockResolvedValue({
      hasUpdate: false,
      latestVersion: '0.0.9',
      currentVersion: '0.0.9',
      htmlUrl: null,
    });

    const { container } = render(<UpdateNotification owner="chorned" repo="frugaLLM-App" />);

    await waitFor(() => {
      expect(updateCheckerModule.checkForAppUpdates).toHaveBeenCalledTimes(1);
    });

    expect(container.firstChild).toBeNull();
  });

  it('renders update notice in footer when an update is available', async () => {
    vi.spyOn(updateCheckerModule, 'checkForAppUpdates').mockResolvedValue({
      hasUpdate: true,
      latestVersion: '0.1.0',
      currentVersion: '0.0.9',
      htmlUrl: 'https://github.com/chorned/frugaLLM-App/releases/tag/v0.1.0',
    });

    render(<UpdateNotification owner="chorned" repo="frugaLLM-App" />);

    await waitFor(() => {
      expect(screen.getByTestId('update-notification')).toBeInTheDocument();
    });

    expect(screen.getByText(/Update v0\.1\.0 available/i)).toBeInTheDocument();
  });

  it('triggers openUrl when clicking the View Release link or notice button', async () => {
    const targetUrl = 'https://github.com/chorned/frugaLLM-App/releases/tag/v0.1.0';
    vi.spyOn(updateCheckerModule, 'checkForAppUpdates').mockResolvedValue({
      hasUpdate: true,
      latestVersion: '0.1.0',
      currentVersion: '0.0.9',
      htmlUrl: targetUrl,
    });

    render(<UpdateNotification owner="chorned" repo="frugaLLM-App" />);

    await waitFor(() => {
      expect(screen.getByTestId('update-notification')).toBeInTheDocument();
    });

    const releaseButton = screen.getByTestId('update-notification-action');
    fireEvent.click(releaseButton);

    expect(openUrl).toHaveBeenCalledWith(targetUrl);
  });

  it('handles openUrl rejection gracefully without crashing', async () => {
    vi.mocked(openUrl).mockRejectedValue(new Error('Browser open failed'));
    vi.spyOn(updateCheckerModule, 'checkForAppUpdates').mockResolvedValue({
      hasUpdate: true,
      latestVersion: '0.1.0',
      currentVersion: '0.0.9',
      htmlUrl: 'https://github.com/chorned/frugaLLM-App/releases/tag/v0.1.0',
    });

    render(<UpdateNotification owner="chorned" repo="frugaLLM-App" />);

    await waitFor(() => {
      expect(screen.getByTestId('update-notification')).toBeInTheDocument();
    });

    const releaseButton = screen.getByTestId('update-notification-action');
    expect(() => fireEvent.click(releaseButton)).not.toThrow();
  });
});
