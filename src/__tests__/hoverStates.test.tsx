import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExitConfirmationModal } from '../components/ExitConfirmationModal';
import { PortConflictBanner } from '../components/PortConflictBanner';

// Mock canvas and localization constants
vi.mock('../services/tauri', () => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}));

describe('Hover States Specification (CHO-58)', () => {
  it('verifies ExitConfirmationModal buttons render with btn-cta classes', () => {
    render(
      <ExitConfirmationModal
        isOpen={true}
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );

    const cancelBtn = screen.getByTestId('exit-cancel-button');
    const confirmBtn = screen.getByTestId('exit-confirm-button');

    expect(cancelBtn).toHaveClass('btn-cta');
    expect(cancelBtn).toHaveClass('btn-cta-secondary');
    expect(confirmBtn).toHaveClass('btn-cta');
    expect(confirmBtn).toHaveClass('btn-cta-danger');
  });

  it('verifies PortConflictBanner buttons render with btn-cta classes', () => {
    render(
      <PortConflictBanner
        port={61721}
        onConfigurePort={() => {}}
        onDismiss={() => {}}
      />
    );

    const configBtn = screen.getByTestId('port-conflict-configure');
    const dismissBtn = screen.getByTestId('port-conflict-dismiss');

    expect(configBtn).toHaveClass('btn-cta');
    expect(configBtn).toHaveClass('btn-cta-danger');
    expect(dismissBtn).toHaveClass('btn-cta');
    expect(dismissBtn).toHaveClass('btn-cta-secondary');
  });

  it('verifies ExitConfirmationModal buttons have active interactive attributes', () => {
    render(
      <ExitConfirmationModal
        isOpen={true}
        activeServices={['Hermes', 'Opencode']}
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );

    const cancelBtn = screen.getByTestId('exit-cancel-button');
    const confirmBtn = screen.getByTestId('exit-confirm-button');

    expect(cancelBtn).toBeEnabled();
    expect(confirmBtn).toBeEnabled();
    expect(confirmBtn).toHaveTextContent(/QUIT & STOP SERVICES/i);
    expect(cancelBtn).toHaveTextContent(/KEEP RUNNING/i);
  });
});
