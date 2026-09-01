import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { OnboardingOverlay } from '../OnboardingOverlay';

describe('OnboardingOverlay Component', () => {
  let targetHeading: HTMLDivElement;

  beforeEach(() => {
    // Create target DOM element for spotlight tracking
    targetHeading = document.createElement('div');
    targetHeading.id = 'local-hardware-heading';
    targetHeading.getBoundingClientRect = () => ({
      left: 100,
      top: 150,
      right: 350,
      bottom: 250,
      width: 250,
      height: 100,
      x: 100,
      y: 150,
      toJSON: () => {},
    });
    document.body.appendChild(targetHeading);
  });

  afterEach(() => {
    if (document.body.contains(targetHeading)) {
      document.body.removeChild(targetHeading);
    }
  });

  it('renders spotlight panels and tooltip card tracking target element', async () => {
    // Arrange
    const onComplete = vi.fn();

    // Act
    render(<OnboardingOverlay onComplete={onComplete} />);

    // Trigger rAF frame
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    // Assert: Spotlight quadrants are rendered
    expect(screen.getByTestId('spotlight-top')).toBeInTheDocument();
    expect(screen.getByTestId('spotlight-bottom')).toBeInTheDocument();
    expect(screen.getByTestId('spotlight-left')).toBeInTheDocument();
    expect(screen.getByTestId('spotlight-right')).toBeInTheDocument();

    // Assert: Tooltip text
    expect(screen.getByText('Local Hardware Node')).toBeInTheDocument();
    expect(screen.getByText(/Finish Tour/i)).toBeInTheDocument();
  });

  it('triggers onComplete callback when Finish Tour button is clicked', async () => {
    // Arrange
    const onComplete = vi.fn();
    render(<OnboardingOverlay onComplete={onComplete} />);

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    // Act
    const finishBtn = screen.getByText(/Finish Tour/i);
    fireEvent.click(finishBtn);

    // Assert
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('handles window resize events cleanly', async () => {
    // Arrange
    render(<OnboardingOverlay onComplete={vi.fn()} />);

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    // Act
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    // Assert: Tooltip remains rendered
    expect(screen.getByText('Local Hardware Node')).toBeInTheDocument();
  });
});
