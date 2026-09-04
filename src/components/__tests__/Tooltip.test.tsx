import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from '../Tooltip';

describe('Tooltip Component', () => {
  it('renders trigger icon with proper accessibility attributes', () => {
    render(<Tooltip text="Tooltip description text" triggerTestId="test-tooltip-trigger" ariaLabel="Test info label" />);

    const trigger = screen.getByTestId('test-tooltip-trigger');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('role', 'button');
    expect(trigger).toHaveAttribute('aria-label', 'Test info label');
    expect(trigger).toHaveAttribute('tabIndex', '0');
  });

  it('shows tooltip content on hover and hides on mouse leave', () => {
    render(
      <Tooltip 
        text="Helpful explanation message" 
        triggerTestId="test-trigger" 
        testId="test-tooltip-portal" 
      />
    );

    const trigger = screen.getByTestId('test-trigger');
    expect(screen.queryByTestId('test-tooltip-portal')).not.toBeInTheDocument();

    fireEvent.mouseEnter(trigger);
    expect(screen.getByTestId('test-tooltip-portal')).toBeInTheDocument();
    expect(screen.getByText('Helpful explanation message')).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByTestId('test-tooltip-portal')).not.toBeInTheDocument();
  });

  it('toggles tooltip content on click', () => {
    render(
      <Tooltip 
        text="Click toggle explanation" 
        triggerTestId="test-trigger" 
        testId="test-tooltip-portal" 
      />
    );

    const trigger = screen.getByTestId('test-trigger');
    expect(screen.queryByTestId('test-tooltip-portal')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByTestId('test-tooltip-portal')).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByTestId('test-tooltip-portal')).not.toBeInTheDocument();
  });

  it('supports keyboard toggling with Enter and Space keys', () => {
    render(
      <Tooltip 
        text="Keyboard accessible message" 
        triggerTestId="test-trigger" 
        testId="test-tooltip-portal" 
      />
    );

    const trigger = screen.getByTestId('test-trigger');
    expect(screen.queryByTestId('test-tooltip-portal')).not.toBeInTheDocument();

    // Toggle with Enter
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByTestId('test-tooltip-portal')).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.queryByTestId('test-tooltip-portal')).not.toBeInTheDocument();

    // Toggle with Space
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(screen.getByTestId('test-tooltip-portal')).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: ' ' });
    expect(screen.queryByTestId('test-tooltip-portal')).not.toBeInTheDocument();
  });
});
