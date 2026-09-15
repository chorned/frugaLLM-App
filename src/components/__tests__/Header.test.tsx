import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Header } from '../Header';

describe('Header Component', () => {
  it('renders header container, logo, brand name, and Beta banner', () => {
    render(
      <Header
        isDark={true}
        onToggleTheme={vi.fn()}
      />
    );

    expect(screen.getByTestId('app-header')).toBeInTheDocument();
    expect(screen.getByTestId('header-frugallm-icon')).toBeInTheDocument();
    expect(screen.getByText('FrugaLLM')).toBeInTheDocument();

    const betaBanner = screen.getByTestId('header-beta-banner');
    expect(betaBanner).toBeInTheDocument();
    expect(betaBanner).toHaveTextContent('Beta');
    expect(screen.getByTestId('header-beta-dot')).toBeInTheDocument();
  });

  it('renders Report Issue CTA and handles click when onOpenIssueReporter is provided', () => {
    const onOpenIssueReporter = vi.fn();
    render(
      <Header
        isDark={true}
        onToggleTheme={vi.fn()}
        onOpenIssueReporter={onOpenIssueReporter}
      />
    );

    const reportBtn = screen.getByTestId('header-report-issue-btn');
    expect(reportBtn).toBeInTheDocument();
    expect(reportBtn).toHaveTextContent('Report Issue');

    fireEvent.click(reportBtn);
    expect(onOpenIssueReporter).toHaveBeenCalledTimes(1);
  });

  it('does not render Report Issue CTA when onOpenIssueReporter is undefined', () => {
    render(
      <Header
        isDark={true}
        onToggleTheme={vi.fn()}
      />
    );

    expect(screen.queryByTestId('header-report-issue-btn')).not.toBeInTheDocument();
  });

  it('renders theme toggle and responds to click', () => {
    const onToggleTheme = vi.fn();
    const { rerender } = render(
      <Header
        isDark={true}
        onToggleTheme={onToggleTheme}
      />
    );

    const themeBtn = screen.getByTestId('header-theme-toggle-btn');
    expect(themeBtn).toBeInTheDocument();
    expect(themeBtn).toHaveAttribute('title', 'Switch to light theme');

    fireEvent.click(themeBtn);
    expect(onToggleTheme).toHaveBeenCalledTimes(1);

    // Switch to light mode
    rerender(
      <Header
        isDark={false}
        onToggleTheme={onToggleTheme}
      />
    );
    expect(themeBtn).toHaveAttribute('title', 'Switch to dark theme');
  });

  it('attaches headerRef to the header element', () => {
    const headerRef = React.createRef<HTMLElement>();
    render(
      <Header
        headerRef={headerRef}
        isDark={true}
        onToggleTheme={vi.fn()}
      />
    );

    expect(headerRef.current).not.toBeNull();
    expect(headerRef.current?.getAttribute('data-testid')).toBe('app-header');
  });

  it('handles mouse hover interactions on the Report Issue button', () => {
    const onOpenIssueReporter = vi.fn();
    render(
      <Header
        isDark={true}
        onToggleTheme={vi.fn()}
        onOpenIssueReporter={onOpenIssueReporter}
      />
    );

    const reportBtn = screen.getByTestId('header-report-issue-btn');
    fireEvent.mouseEnter(reportBtn);
    expect(reportBtn).toHaveStyle({ color: 'var(--zen-text)' });

    fireEvent.mouseLeave(reportBtn);
    expect(reportBtn).toHaveStyle({ color: 'var(--zen-text-secondary)' });
  });
});
