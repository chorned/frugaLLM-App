import React from 'react';
import en from '../locales/en.json';

interface OnboardingDecisionProps {
  onSelect: (decision: 'learning' | 'completed') => void;
}

export const OnboardingDecision: React.FC<OnboardingDecisionProps> = ({ onSelect }) => {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--zen-surface)',
          border: '1px solid var(--zen-border)',
          color: 'var(--zen-text)',
          boxShadow: 'var(--zen-shadow-modal)',
          borderRadius: '24px',
        }}
        className="p-8 max-w-lg w-full transform transition-all"
      >
        <h2 style={{ color: 'var(--zen-text)' }} className="text-2xl font-bold mb-3 tracking-tight">
          {en.onboarding?.welcomeTitle ?? 'Welcome to FrugaLLM'}
        </h2>
        <p style={{ color: 'var(--zen-text-secondary)' }} className="mb-6 text-sm leading-relaxed">
          {en.onboarding?.welcomeSubtitle ??
            'Run autonomous agentic harnesses (Open Code & Hermes) against free cloud tiers and local models with zero API bills.'}
        </p>

        <div className="flex flex-col gap-3">
          <button
            data-testid="onboarding-guided-btn"
            onClick={() => onSelect('learning')}
            style={{
              backgroundColor: 'var(--zen-surface-hover)',
              border: '1px solid var(--zen-border)',
              color: 'var(--zen-text)',
            }}
            className="btn-cta group relative flex items-center justify-center p-4 rounded-2xl transition-all duration-200 cursor-pointer hover:opacity-95 w-full"
          >
            <div className="flex flex-col items-center text-center">
              <span style={{ color: 'var(--zen-text)' }} className="text-base font-semibold transition-colors">
                {en.onboarding?.startGuided ?? 'Set Up in 5 Minutes (Guided)'}
              </span>
              <span style={{ color: 'var(--zen-text-secondary)' }} className="text-xs mt-0.5">
                {en.onboarding?.learnSubtitle ?? 'Starts a quick interactive tutorial.'}
              </span>
            </div>
            <span
              style={{ color: 'var(--zen-text)' }}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-xl opacity-0 group-hover:opacity-100 transform translate-x-[-4px] group-hover:translate-x-0 transition-all duration-200 pointer-events-none"
            >
              →
            </span>
          </button>

          <button
            data-testid="onboarding-skip-btn"
            onClick={() => onSelect('completed')}
            style={{
              backgroundColor: 'var(--zen-surface-hover)',
              border: '1px solid var(--zen-border)',
              color: 'var(--zen-text)',
            }}
            className="btn-cta group relative flex items-center justify-center p-4 rounded-2xl transition-all duration-200 cursor-pointer hover:opacity-95 w-full"
          >
            <div className="flex flex-col items-center text-center">
              <span style={{ color: 'var(--zen-text)' }} className="text-base font-semibold transition-colors">
                {en.onboarding?.skipTutorial ?? 'Skip to Workspace'}
              </span>
              <span style={{ color: 'var(--zen-text-secondary)' }} className="text-xs mt-0.5">
                {en.onboarding?.skipSubtitle ?? 'Jump right into the app.'}
              </span>
            </div>
            <span
              style={{ color: 'var(--zen-text)' }}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-xl opacity-0 group-hover:opacity-100 transform translate-x-[-4px] group-hover:translate-x-0 transition-all duration-200 pointer-events-none"
            >
              →
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
