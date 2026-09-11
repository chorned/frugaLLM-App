import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Footer } from '../Footer';
import * as openerPlugin from '@tauri-apps/plugin-opener';

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

describe('Footer Component', () => {
  it('renders emerald green indicator with System Ready by default', () => {
    render(<Footer />);

    expect(screen.getByTestId('app-footer')).toBeInTheDocument();
    const dot = screen.getByTestId('footer-status-dot');
    const text = screen.getByTestId('footer-status-text');

    expect(dot).toHaveStyle({ backgroundColor: '#10B981' });
    expect(text).toHaveTextContent('System Ready');
    expect(text).toHaveStyle({ color: 'var(--zen-text-secondary)' });
  });

  it('renders red indicator with Port Conflict when portConflict is active', () => {
    render(
      <Footer 
        portConflict={{ port: 5050, message: 'Port 5050 is in use' }} 
      />
    );

    const dot = screen.getByTestId('footer-status-dot');
    const text = screen.getByTestId('footer-status-text');
    const container = screen.getByTestId('footer-status-container');

    expect(dot).toHaveStyle({ backgroundColor: '#ef4444' });
    expect(text).toHaveTextContent('Port Conflict');
    expect(text).toHaveStyle({ color: '#ef4444' });
    expect(container).toHaveAttribute('title', 'Port 5050 is in use');
  });

  it('renders red indicator with Daemon Failure when daemonError is active', () => {
    render(
      <Footer 
        daemonError="Hermes Gateway daemon failed to start" 
      />
    );

    const dot = screen.getByTestId('footer-status-dot');
    const text = screen.getByTestId('footer-status-text');
    const container = screen.getByTestId('footer-status-container');

    expect(dot).toHaveStyle({ backgroundColor: '#ef4444' });
    expect(text).toHaveTextContent('Daemon Failure');
    expect(text).toHaveStyle({ color: '#ef4444' });
    expect(container).toHaveAttribute('title', 'Hermes Gateway daemon failed to start');
  });

  it('prioritizes port conflict over daemon error when both are present', () => {
    render(
      <Footer 
        portConflict={{ port: 61721, message: 'Port conflict on 61721' }}
        daemonError="Process exited with code 1"
      />
    );

    const dot = screen.getByTestId('footer-status-dot');
    const text = screen.getByTestId('footer-status-text');

    expect(dot).toHaveStyle({ backgroundColor: '#ef4444' });
    expect(text).toHaveTextContent('Port Conflict');
  });

  it('renders Horned.se and Github links and opens external browser via openUrl on click', () => {
    render(<Footer />);

    const hornedLink = screen.getByTestId('footer-link-horned');
    const githubLink = screen.getByTestId('footer-link-github');

    expect(hornedLink).toHaveTextContent('Horned.se');
    expect(githubLink).toHaveTextContent('Github');

    fireEvent.click(hornedLink);
    expect(openerPlugin.openUrl).toHaveBeenCalledWith('https://horned.se/');

    fireEvent.click(githubLink);
    expect(openerPlugin.openUrl).toHaveBeenCalledWith('https://github.com/chorned');
  });
});
