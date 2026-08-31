import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TerminalLoader } from '../TerminalLoader';

describe('TerminalLoader Component', () => {
  it('renders branding header, logo, and empty terminal console when no logs provided', () => {
    // Arrange & Act
    render(<TerminalLoader logs={[]} />);

    // Assert
    expect(screen.getByRole('heading', { name: /Starting FrugaLLM\.\.\./i })).toBeInTheDocument();
    expect(screen.getByAltText('FrugaLLM Logo')).toBeInTheDocument();
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
