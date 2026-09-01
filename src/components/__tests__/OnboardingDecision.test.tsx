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
    expect(screen.getByText(/I want to learn, walk me through it/i)).toBeInTheDocument();
    expect(screen.getByText(/Doing is learning/i)).toBeInTheDocument();
  });

  it('triggers onSelect("learning") when the learning option is clicked', () => {
    // Arrange
    const onSelect = vi.fn();
    render(<OnboardingDecision onSelect={onSelect} />);

    // Act
    const learnButton = screen.getByText(/I want to learn, walk me through it/i).closest('button');
    expect(learnButton).not.toBeNull();
    fireEvent.click(learnButton!);

    // Assert
    expect(onSelect).toHaveBeenCalledWith('learning');
  });

  it('triggers onSelect("completed") when the skip tutorial option is clicked', () => {
    // Arrange
    const onSelect = vi.fn();
    render(<OnboardingDecision onSelect={onSelect} />);

    // Act
    const skipButton = screen.getByText(/Doing is learning/i).closest('button');
    expect(skipButton).not.toBeNull();
    fireEvent.click(skipButton!);

    // Assert
    expect(onSelect).toHaveBeenCalledWith('completed');
  });
});
