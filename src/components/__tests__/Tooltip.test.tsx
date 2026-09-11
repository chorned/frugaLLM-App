import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip, HelpTooltip } from '../Tooltip';

describe('Tooltip Component', () => {
  it('renders trigger label with proper accessibility attributes and dotted underline styling', () => {
    render(
      <Tooltip text="Tooltip description text" triggerTestId="test-tooltip-trigger" ariaLabel="Test info label">
        <span>Session tokens</span>
      </Tooltip>
    );

    const trigger = screen.getByTestId('test-tooltip-trigger');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Session tokens');
    expect(trigger).toHaveAttribute('role', 'button');
    expect(trigger).toHaveAttribute('aria-label', 'Test info label');
    expect(trigger).toHaveAttribute('tabIndex', '0');
    expect(trigger.style.cursor).toBe('help');
    expect(trigger.style.textDecoration).toContain('underline dotted');
    expect(trigger.style.textUnderlineOffset).toBe('4px');
  });

  it('shows tooltip content on hover with dark surface container styling, and hides on mouse leave', () => {
    render(
      <Tooltip 
        text="Helpful explanation message" 
        triggerTestId="test-trigger" 
        testId="test-tooltip-portal" 
      >
        <span>Hover Me</span>
      </Tooltip>
    );

    const trigger = screen.getByTestId('test-trigger');
    expect(screen.queryByTestId('test-tooltip-portal')).not.toBeInTheDocument();

    fireEvent.mouseEnter(trigger);
    const portal = screen.getByTestId('test-tooltip-portal');
    expect(portal).toBeInTheDocument();
    expect(portal).toHaveTextContent('Helpful explanation message');
    expect(portal.style.backgroundColor).toBe('rgb(24, 24, 27)'); // #18181b
    expect(portal.style.maxWidth).toBe('260px');
    expect(portal.style.fontSize).toBe('0.75rem');

    // Verify aria-describedby linkage
    expect(trigger).toHaveAttribute('aria-describedby', portal.id);

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByTestId('test-tooltip-portal')).not.toBeInTheDocument();
    expect(trigger).not.toHaveAttribute('aria-describedby');
  });

  it('toggles tooltip content on click', () => {
    render(
      <Tooltip 
        text="Click toggle explanation" 
        triggerTestId="test-trigger" 
        testId="test-tooltip-portal" 
      >
        <span>Click Me</span>
      </Tooltip>
    );

    const trigger = screen.getByTestId('test-trigger');
    expect(screen.queryByTestId('test-tooltip-portal')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByTestId('test-tooltip-portal')).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByTestId('test-tooltip-portal')).not.toBeInTheDocument();
  });

  it('supports keyboard toggling with Enter, Space, and dismissal with Escape', () => {
    render(
      <Tooltip 
        text="Keyboard accessible message" 
        triggerTestId="test-trigger" 
        testId="test-tooltip-portal" 
      >
        <span>Keyboard Target</span>
      </Tooltip>
    );

    const trigger = screen.getByTestId('test-trigger');
    expect(screen.queryByTestId('test-tooltip-portal')).not.toBeInTheDocument();

    // Toggle with Enter
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByTestId('test-tooltip-portal')).toBeInTheDocument();

    // Dismiss with Escape
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByTestId('test-tooltip-portal')).not.toBeInTheDocument();

    // Toggle with Space
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(screen.getByTestId('test-tooltip-portal')).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: ' ' });
    expect(screen.queryByTestId('test-tooltip-portal')).not.toBeInTheDocument();
  });

  it('renders help variant with proper aria-label and data-variant', () => {
    render(
      <Tooltip 
        variant="help"
        text="Troubleshooting guidance" 
        triggerTestId="test-help-trigger" 
        testId="test-help-portal" 
      >
        <span>Help Trigger</span>
      </Tooltip>
    );

    const trigger = screen.getByTestId('test-help-trigger');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('data-variant', 'help');
    expect(trigger).toHaveAttribute('aria-label', 'Guidance: Troubleshooting guidance');

    fireEvent.mouseEnter(trigger);
    expect(screen.getByTestId('test-help-portal')).toBeInTheDocument();
    expect(screen.getByText('Troubleshooting guidance')).toBeInTheDocument();
  });

  it('renders HelpTooltip shorthand correctly', () => {
    render(
      <HelpTooltip 
        text="Outcome assistance message" 
        triggerTestId="test-shorthand-trigger" 
        testId="test-shorthand-portal" 
      >
        <span>Shorthand Trigger</span>
      </HelpTooltip>
    );

    const trigger = screen.getByTestId('test-shorthand-trigger');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('data-variant', 'help');

    fireEvent.click(trigger);
    expect(screen.getByTestId('test-shorthand-portal')).toBeInTheDocument();
    expect(screen.getByText('Outcome assistance message')).toBeInTheDocument();
  });
});
