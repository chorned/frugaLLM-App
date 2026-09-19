import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingFooterTracker } from '../OnboardingFooterTracker';

describe('OnboardingFooterTracker Component', () => {
  it('renders null when isFooterDismissed is true', () => {
    // Act
    const { container } = render(
      <OnboardingFooterTracker
        onboardingState="completed"
        isFooterDismissed={true}
      />
    );

    // Assert
    expect(container.firstChild).toBeNull();
  });

  it('renders null when onboardingState is "fresh"', () => {
    // Act
    const { container } = render(
      <OnboardingFooterTracker
        onboardingState="fresh"
        isFooterDismissed={false}
      />
    );

    // Assert
    expect(container.firstChild).toBeNull();
  });

  it('renders learning controls and handles prev, next, and skip actions', () => {
    // Arrange
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const onSkip = vi.fn();

    // Act
    render(
      <OnboardingFooterTracker
        onboardingState="learning"
        currentStep={2}
        onNext={onNext}
        onPrev={onPrev}
        onSkip={onSkip}
      />
    );

    // Assert: Progress displayed
    expect(screen.getByText(/Step 2 of 6/i)).toBeInTheDocument();

    // Act & Assert: Previous button
    const prevBtn = screen.getByTestId('footer-tracker-prev-btn');
    expect(prevBtn).not.toBeDisabled();
    fireEvent.click(prevBtn);
    expect(onPrev).toHaveBeenCalledTimes(1);

    // Act & Assert: Next button
    const nextBtn = screen.getByTestId('footer-tracker-next-btn');
    expect(nextBtn).not.toBeDisabled();
    fireEvent.click(nextBtn);
    expect(onNext).toHaveBeenCalledTimes(1);

    // Act & Assert: Skip button
    const skipBtn = screen.getByTestId('footer-tracker-skip-btn');
    fireEvent.click(skipBtn);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('disables prev button on Step 1 and next button on Step 6', () => {
    // Render Step 1
    const { rerender } = render(
      <OnboardingFooterTracker
        onboardingState="learning"
        currentStep={1}
      />
    );
    expect(screen.getByTestId('footer-tracker-prev-btn')).toBeDisabled();
    expect(screen.getByTestId('footer-tracker-next-btn')).not.toBeDisabled();

    // Render Step 6
    rerender(
      <OnboardingFooterTracker
        onboardingState="learning"
        currentStep={6}
      />
    );
    expect(screen.getByTestId('footer-tracker-prev-btn')).not.toBeDisabled();
    expect(screen.getByTestId('footer-tracker-next-btn')).toBeDisabled();
  });

  it('renders completed checklist status and flat Tour button', () => {
    // Arrange
    const onResume = vi.fn();
    const onDismiss = vi.fn();

    // Act
    render(
      <OnboardingFooterTracker
        onboardingState="completed"
        hasSourceLinked={true}
        hasHarnessInstalled={true}
        onResume={onResume}
        onDismiss={onDismiss}
      />
    );

    // Assert
    expect(screen.getByTestId('tracker-source-active')).toBeInTheDocument();
    expect(screen.getByTestId('tracker-harness-active')).toBeInTheDocument();
    expect(screen.queryByTestId('tracker-ready-pill')).not.toBeInTheDocument();

    // Actions
    const tourBtn = screen.getByTestId('footer-tracker-tour-btn');
    expect(tourBtn).toHaveTextContent('Tour');
    expect(tourBtn).toHaveStyle({ background: 'none' });
    fireEvent.click(tourBtn);
    expect(onResume).toHaveBeenCalledTimes(1);

    // The 'x' dismiss button has been removed as requested
    expect(screen.queryByTestId('footer-tracker-dismiss-btn')).not.toBeInTheDocument();
  });

  it('renders inactive status when either source or harness is missing', () => {
    // Act
    render(
      <OnboardingFooterTracker
        onboardingState="completed"
        hasSourceLinked={true}
        hasHarnessInstalled={false}
      />
    );

    // Assert
    expect(screen.getByTestId('tracker-source-active')).toBeInTheDocument();
    expect(screen.getByTestId('tracker-harness-inactive')).toBeInTheDocument();
  });

  it('renders elevated pill container with dark theme styling', () => {
    window.localStorage.setItem('frugallm-theme', 'dark');
    render(
      <OnboardingFooterTracker
        onboardingState="completed"
        hasSourceLinked={true}
        hasHarnessInstalled={true}
      />
    );

    const tracker = screen.getByTestId('footer-tracker-completed');
    expect(tracker).toHaveStyle({
      borderRadius: '9999px',
      backgroundColor: 'rgba(38, 32, 27, 0.95)',
      color: '#F3EFEA',
    });
  });

  it('renders elevated pill container with light theme styling', () => {
    window.localStorage.setItem('frugallm-theme', 'light');
    render(
      <OnboardingFooterTracker
        onboardingState="completed"
        hasSourceLinked={true}
        hasHarnessInstalled={true}
      />
    );

    const tracker = screen.getByTestId('footer-tracker-completed');
    expect(tracker).toHaveStyle({
      borderRadius: '9999px',
      backgroundColor: '#FFFFFF',
      color: '#2D2824',
    });
  });
});
