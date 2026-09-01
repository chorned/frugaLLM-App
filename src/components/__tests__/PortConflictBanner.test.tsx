import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PortConflictBanner } from '../PortConflictBanner';

describe('PortConflictBanner Component', () => {
  it('renders conflict banner with the exact port number and action text', () => {
    render(<PortConflictBanner port={5050} />);

    expect(screen.getByTestId('port-conflict-banner')).toBeInTheDocument();
    expect(screen.getByText('PORT CONFLICT DETECTED')).toBeInTheDocument();
    expect(screen.getByText('PORT 5050')).toBeInTheDocument();
    expect(
      screen.getByText(/Close the service currently using port \[5050\] and restart the app\./i)
    ).toBeInTheDocument();
  });

  it('triggers onConfigurePort when configure button is clicked', () => {
    const handleConfigure = vi.fn();
    render(<PortConflictBanner port={61721} onConfigurePort={handleConfigure} />);

    const configureBtn = screen.getByTestId('port-conflict-configure');
    fireEvent.click(configureBtn);

    expect(handleConfigure).toHaveBeenCalledTimes(1);
  });

  it('triggers onDismiss when dismiss button is clicked', () => {
    const handleDismiss = vi.fn();
    render(<PortConflictBanner port={61721} onDismiss={handleDismiss} />);

    const dismissBtn = screen.getByTestId('port-conflict-dismiss');
    fireEvent.click(dismissBtn);

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
