import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExitConfirmationModal } from '../ExitConfirmationModal';

describe('ExitConfirmationModal Component', () => {
  it('does not render when isOpen is false', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ExitConfirmationModal
        isOpen={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(screen.queryByTestId('exit-confirmation-modal')).not.toBeInTheDocument();
  });

  it('renders title, description, and action buttons when open', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ExitConfirmationModal
        isOpen={true}
        onCancel={onCancel}
        onConfirm={onConfirm}
        activeServices={['Hermes Dashboard', 'Hermes Gateway']}
      />
    );

    expect(screen.getByTestId('exit-confirmation-modal')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE SERVICES RUNNING')).toBeInTheDocument();
    expect(screen.getByText(/Quitting FrugaLLM will terminate all active agent sessions/i)).toBeInTheDocument();
    expect(screen.getByText('Hermes Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Hermes Gateway')).toBeInTheDocument();
    expect(screen.getByTestId('exit-cancel-button')).toBeInTheDocument();
    expect(screen.getByTestId('exit-confirm-button')).toBeInTheDocument();
  });

  it('calls onCancel when KEEP RUNNING button or backdrop is clicked', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ExitConfirmationModal
        isOpen={true}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByTestId('exit-cancel-button'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('exit-confirmation-modal'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('calls onConfirm when QUIT & STOP SERVICES button is clicked', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ExitConfirmationModal
        isOpen={true}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByTestId('exit-confirm-button'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('applies theme-aware styles with CSS variables for dark and light mode support', () => {
    render(
      <ExitConfirmationModal
        isOpen={true}
        onCancel={() => {}}
        onConfirm={() => {}}
        activeServices={['Hermes Gateway']}
      />
    );

    const modalDialog = screen.getByRole('dialog');
    const card = modalDialog.firstElementChild as HTMLElement;
    expect(card).toBeInTheDocument();
    expect(card.style.backgroundColor).toBe('var(--zen-surface)');
    expect(card.style.border).toContain('var(--zen-border)');
  });
});
