import React from 'react';
import en from '../locales/en.json';
import { OnboardingState, OnboardingStep } from '../hooks/useOnboarding';
import { useTheme } from '../hooks/useTheme';

export interface OnboardingFooterTrackerProps {
  onboardingState: OnboardingState;
  currentStep?: OnboardingStep;
  isFooterDismissed?: boolean;
  hasSourceLinked?: boolean;
  hasHarnessInstalled?: boolean;
  isDark?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
  onSkip?: () => void;
  onResume?: () => void;
  onReset?: () => void;
  onDismiss?: () => void;
}

export const OnboardingFooterTracker: React.FC<OnboardingFooterTrackerProps> = ({
  onboardingState,
  currentStep = 1,
  isFooterDismissed = false,
  hasSourceLinked = false,
  hasHarnessInstalled = false,
  isDark: propIsDark,
  onNext,
  onPrev,
  onSkip,
  onResume,
}) => {
  const { isDark: hookIsDark } = useTheme();
  const isDark = propIsDark ?? hookIsDark;

  // If dismissed or fresh (launch dialog shown), do not display tracker
  if (isFooterDismissed || onboardingState === 'fresh') {
    return null;
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '4px 14px',
    borderRadius: '9999px',
    backgroundColor: isDark ? 'rgba(38, 32, 27, 0.95)' : '#FFFFFF',
    border: `1px solid ${isDark ? 'rgba(90, 78, 68, 0.9)' : '#E2D8CC'}`,
    boxShadow: isDark ? '0 2px 10px rgba(0, 0, 0, 0.6)' : '0 2px 8px rgba(0, 0, 0, 0.08)',
    fontSize: '0.75rem',
    color: isDark ? '#F3EFEA' : '#2D2824',
    userSelect: 'none',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  };

  const dividerStyle: React.CSSProperties = {
    color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
    fontWeight: 300,
  };

  // 1. Learning State: Interactive step progress and controls
  if (onboardingState === 'learning') {
    return (
      <div
        data-testid="footer-tracker-learning"
        style={containerStyle}
        className="font-medium"
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-zen-accent animate-pulse inline-block" />
          <span style={{ color: isDark ? '#F3EFEA' : '#2D2824', fontWeight: 600 }}>
            {en.onboarding?.footerTracker?.stepProgress
              ?.replace('{{current}}', String(currentStep))
              ?.replace('{{total}}', '6') ?? `Step ${currentStep} of 6`}
          </span>
        </div>

        <span style={dividerStyle}>|</span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="footer-tracker-prev-btn"
            onClick={onPrev}
            disabled={currentStep <= 1}
            style={{
              background: 'none',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              padding: 0,
              margin: 0,
              appearance: 'none',
              WebkitAppearance: 'none',
              color: isDark ? '#D1C7BD' : '#4B5563',
              cursor: currentStep <= 1 ? 'default' : 'pointer',
              fontSize: '11px',
              fontWeight: 500,
              lineHeight: 1,
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (currentStep > 1) e.currentTarget.style.color = isDark ? '#FFFFFF' : '#111827';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = isDark ? '#D1C7BD' : '#4B5563';
            }}
            className="hover:underline disabled:no-underline disabled:opacity-40"
          >
            {en.onboarding?.footerTracker?.prev ?? '< Back'}
          </button>
          <button
            type="button"
            data-testid="footer-tracker-next-btn"
            onClick={onNext}
            disabled={currentStep >= 6}
            style={{
              background: 'none',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              padding: 0,
              margin: 0,
              appearance: 'none',
              WebkitAppearance: 'none',
              color: isDark ? '#F3EFEA' : '#111827',
              cursor: currentStep >= 6 ? 'default' : 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              lineHeight: 1,
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (currentStep < 6) e.currentTarget.style.color = 'var(--zen-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = isDark ? '#F3EFEA' : '#111827';
            }}
            className="hover:underline disabled:no-underline disabled:opacity-40"
          >
            {en.onboarding?.footerTracker?.next ?? 'Next >'}
          </button>
        </div>

        <span style={dividerStyle}>|</span>

        <button
          type="button"
          data-testid="footer-tracker-skip-btn"
          onClick={onSkip}
          style={{
            background: 'none',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            padding: 0,
            margin: 0,
            appearance: 'none',
            WebkitAppearance: 'none',
            color: isDark ? '#D1C7BD' : '#4B5563',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 500,
            lineHeight: 1,
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = isDark ? '#FFFFFF' : '#111827')}
          onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#D1C7BD' : '#4B5563')}
          className="hover:underline"
        >
          {en.onboarding?.footerTracker?.skip ?? 'Skip Tour'}
        </button>
      </div>
    );
  }

  // 2. Completed State: Compact checklist and quick re-engagement actions
  if (onboardingState === 'completed') {
    return (
      <div
        data-testid="footer-tracker-completed"
        style={containerStyle}
        className="font-medium"
      >
        {/* Source Linked Check */}
        <div
          data-testid="tracker-source-status"
          className="flex items-center gap-1.5"
          title={hasSourceLinked ? 'Intelligence Source Active' : 'No Source Configured'}
        >
          {hasSourceLinked ? (
            <span
              data-testid="tracker-source-active"
              style={{ color: isDark ? '#34D399' : '#059669', fontWeight: 700 }}
              className="text-xs"
            >
              ✓
            </span>
          ) : (
            <span
              data-testid="tracker-source-inactive"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)' }}
              className="w-2.5 h-2.5 rounded-full border inline-block"
            />
          )}
          <span
            style={{
              color: hasSourceLinked
                ? (isDark ? '#F3EFEA' : '#1F2937')
                : (isDark ? '#B8ABA0' : '#6B7280'),
              fontWeight: hasSourceLinked ? 600 : 400,
            }}
          >
            {en.onboarding?.footerTracker?.checklistSource ?? 'Source Linked'}
          </span>
        </div>

        {/* Harness Installed Check */}
        <div
          data-testid="tracker-harness-status"
          className="flex items-center gap-1.5"
          title={hasHarnessInstalled ? 'Agentic Harness Ready' : 'No Harness Installed'}
        >
          {hasHarnessInstalled ? (
            <span
              data-testid="tracker-harness-active"
              style={{ color: isDark ? '#34D399' : '#059669', fontWeight: 700 }}
              className="text-xs"
            >
              ✓
            </span>
          ) : (
            <span
              data-testid="tracker-harness-inactive"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)' }}
              className="w-2.5 h-2.5 rounded-full border inline-block"
            />
          )}
          <span
            style={{
              color: hasHarnessInstalled
                ? (isDark ? '#F3EFEA' : '#1F2937')
                : (isDark ? '#B8ABA0' : '#6B7280'),
              fontWeight: hasHarnessInstalled ? 600 : 400,
            }}
          >
            {en.onboarding?.footerTracker?.checklistHarness ?? 'Harness Installed'}
          </span>
        </div>

        <span style={dividerStyle}>|</span>

        {/* Action buttons (Flat link, no border/box, no dismiss X) */}
        <div className="flex items-center">
          <button
            type="button"
            data-testid="footer-tracker-tour-btn"
            onClick={onResume}
            style={{
              background: 'none',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              padding: 0,
              margin: 0,
              appearance: 'none',
              WebkitAppearance: 'none',
              color: isDark ? '#D1C7BD' : '#4B5563',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 500,
              lineHeight: 1,
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = isDark ? '#FFFFFF' : '#111827')}
            onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#D1C7BD' : '#4B5563')}
            className="hover:underline"
          >
            {en.onboarding?.footerTracker?.tour ?? 'Tour'}
          </button>
        </div>
      </div>
    );
  }

  return null;
};
