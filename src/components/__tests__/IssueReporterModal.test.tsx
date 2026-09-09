import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { IssueReporterModal } from '../IssueReporterModal';

describe('IssueReporterModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('does not render when isOpen is false', () => {
    render(<IssueReporterModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('issue-reporter-modal')).not.toBeInTheDocument();
  });

  it('fetches diagnostic data on open and displays form inputs', async () => {
    // Cross-reference Rust struct DiagnosticPayload { app_version, os_info, logs }
    (invoke as any).mockResolvedValueOnce({
      app_version: '0.0.11',
      os_info: 'macos x86_64',
      logs: '[12345678] [INFO] [INIT] Application started\n[12345679] [INFO] [ROUTING] Initialized',
    });

    render(<IssueReporterModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('issue-reporter-modal')).toBeInTheDocument();
    expect(screen.getByLabelText(/issue title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_diagnostic_data');
    });
  });

  it('allows expanding diagnostics preview and displays sanitized logs', async () => {
    (invoke as any).mockResolvedValueOnce({
      app_version: '0.0.11',
      os_info: 'macos x86_64',
      logs: '[12345678] [INFO] [AUTH] OpenAI: [REDACTED_API_KEY], Google AI Studio: [REDACTED_API_KEY]',
    });

    render(<IssueReporterModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_diagnostic_data');
    });

    const toggleBtn = screen.getByTestId('toggle-diagnostics-preview');
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/OpenAI: \[REDACTED_API_KEY\], Google AI Studio: \[REDACTED_API_KEY\]/)).toBeInTheDocument();
    expect(screen.getByText(/0.0.11/)).toBeInTheDocument();
    expect(screen.getByText(/macos x86_64/)).toBeInTheDocument();
  });

  it('handles diagnostic fetch failure gracefully without breaking the modal', async () => {
    (invoke as any).mockRejectedValueOnce(new Error('Tauri IPC failed'));

    render(<IssueReporterModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_diagnostic_data');
    });

    // Form inputs should still be usable even if diagnostics fetch errors
    const titleInput = screen.getByLabelText(/issue title/i);
    fireEvent.change(titleInput, { target: { value: 'Bug without diagnostics' } });
    expect((titleInput as HTMLInputElement).value).toBe('Bug without diagnostics');
  });

  it('shows missing key error banner when VITE_WEB3FORMS_ACCESS_KEY is not configured', async () => {
    (invoke as any).mockResolvedValueOnce({
      app_version: '0.0.11',
      os_info: 'macos x86_64',
      logs: 'logs',
    });

    vi.stubEnv('VITE_WEB3FORMS_ACCESS_KEY', '');

    render(<IssueReporterModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_diagnostic_data');
    });

    fireEvent.change(screen.getByLabelText(/issue title/i), {
      target: { value: 'Test missing key' },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Description' },
    });

    fireEvent.click(screen.getByTestId('submit-issue-button'));

    await waitFor(() => {
      expect(screen.getByText(/web3forms access key is not configured/i)).toBeInTheDocument();
    });
  });

  it('submits report to Web3Forms via Tauri IPC and transitions to success state', async () => {
    (invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'get_diagnostic_data') {
        return Promise.resolve({
          app_version: '0.0.11',
          os_info: 'macos x86_64',
          logs: '[12345678] [INFO] Clean logs',
        });
      }
      if (cmd === 'submit_issue_report') {
        return Promise.resolve(JSON.stringify({ success: true }));
      }
      return Promise.resolve();
    });

    vi.stubEnv('VITE_WEB3FORMS_ACCESS_KEY', 'test-mock-key');

    const onClose = vi.fn();
    render(<IssueReporterModal isOpen={true} onClose={onClose} />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_diagnostic_data');
    });

    fireEvent.change(screen.getByLabelText(/issue title/i), {
      target: { value: 'Test crash issue' },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Steps to reproduce crash' },
    });

    const submitBtn = screen.getByTestId('submit-issue-button');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        'submit_issue_report',
        expect.objectContaining({
          payload: expect.objectContaining({
            access_key: 'test-mock-key',
            subject: '[FrugaLLM Issue] Test crash issue',
            from_name: 'FrugaLLM User',
            message: expect.stringContaining('Steps to reproduce crash'),
          }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/report submitted successfully/i)).toBeInTheDocument();
    });
  });

  it('shows error banner when Web3Forms IPC dispatch fails', async () => {
    (invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'get_diagnostic_data') {
        return Promise.resolve({
          app_version: '0.0.11',
          os_info: 'macos x86_64',
          logs: 'logs',
        });
      }
      if (cmd === 'submit_issue_report') {
        return Promise.reject('Network error');
      }
      return Promise.resolve();
    });

    vi.stubEnv('VITE_WEB3FORMS_ACCESS_KEY', 'test-mock-key');

    render(<IssueReporterModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_diagnostic_data');
    });

    fireEvent.change(screen.getByLabelText(/issue title/i), {
      target: { value: 'Test network error' },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Description' },
    });

    fireEvent.click(screen.getByTestId('submit-issue-button'));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});
