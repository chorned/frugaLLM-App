import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingDecision } from '../OnboardingDecision';

describe('OnboardingDecision Component', () => {
  it('renders welcome title, subtitle, and both interactive decision options', () => {
    // Arrange
    const onSelect = vi.fn();

    // Act
    render(<OnboardingDecision onSelect={onSelect} />);

    // Assert
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/Set Up in 5 Minutes \(Guided\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Skip to Workspace/i)).toBeInTheDocument();
  });

  it('triggers onSelect("learning") when the guided setup option is clicked', () => {
    // Arrange
    const onSelect = vi.fn();
    render(<OnboardingDecision onSelect={onSelect} />);

    // Act
    const learnButton = screen.getByTestId('onboarding-guided-btn');
    expect(learnButton).not.toBeNull();
    fireEvent.click(learnButton);

    // Assert
    expect(onSelect).toHaveBeenCalledWith('learning');
  });

  it('triggers onSelect("completed") when the skip tutorial option is clicked', () => {
    // Arrange
    const onSelect = vi.fn();
    render(<OnboardingDecision onSelect={onSelect} />);

    // Act
    const skipButton = screen.getByTestId('onboarding-skip-btn');
    expect(skipButton).not.toBeNull();
    fireEvent.click(skipButton);

    // Assert
    expect(onSelect).toHaveBeenCalledWith('completed');
  });
});
