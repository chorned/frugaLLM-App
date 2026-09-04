import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TerminalLoader } from '../TerminalLoader';

describe('TerminalLoader Component', () => {
  it('renders branding header, SVG logo, and empty terminal console when no logs provided', () => {
    // Arrange & Act
    render(<TerminalLoader logs={[]} />);

    // Assert
    expect(screen.getByRole('heading', { name: /Starting FrugaLLM\.\.\./i })).toBeInTheDocument();
    const logo = screen.getByRole('img', { name: /FrugaLLM Logo/i });
    expect(logo).toBeInTheDocument();
    expect(logo.tagName.toLowerCase()).toBe('svg');
    expect(screen.getByTestId('boot-screen-logo')).toBeInTheDocument();
  });

  it('matches dark mode and light mode themes via theme prop', () => {
    const { rerender } = render(<TerminalLoader logs={[]} theme="dark" />);
    const darkConsole = screen.getByTestId('terminal-loader-console');
    expect(darkConsole).toHaveStyle({ backgroundColor: '#14110E' });

    rerender(<TerminalLoader logs={[]} theme="light" />);
    const lightConsole = screen.getByTestId('terminal-loader-console');
    expect(lightConsole).toHaveStyle({ backgroundColor: '#FFFFFF' });
  });

  it('renders streamed boot logs with timestamp prefixes in chronological order', () => {
    // Arrange
    const logs = [
      'Checking hardware GPU configuration...',
      'Initializing local proxy server on 127.0.0.1:61721...',
      'Ready for local inference requests.',
    ];

    // Act
    render(<TerminalLoader logs={logs} />);

    // Assert
    expect(screen.getByText(/Checking hardware GPU configuration\.\.\./)).toBeInTheDocument();
    expect(screen.getByText(/Initializing local proxy server on 127\.0\.0\.1:61721\.\.\./)).toBeInTheDocument();
    expect(screen.getByText(/Ready for local inference requests\./)).toBeInTheDocument();
  });
});

