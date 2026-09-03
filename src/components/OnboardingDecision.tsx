import React from 'react';
import en from '../locales/en.json';

interface OnboardingDecisionProps {
  onSelect: (decision: 'learning' | 'completed') => void;
}

export const OnboardingDecision: React.FC<OnboardingDecisionProps> = ({ onSelect }) => {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/20 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zen-surface border-none rounded-3xl p-8 max-w-lg w-full shadow-2xl shadow-glass transform transition-all">
        <h2 className="text-2xl font-bold text-zen-text mb-3 tracking-tight">
          {en.onboarding?.welcomeTitle ?? 'Welcome to FrugalLLM'}
        </h2>
        <p className="text-zen-text-secondary mb-6 text-sm leading-relaxed">
          {en.onboarding?.welcomeSubtitle ??
            'The ultimate local-first AI orchestrator. Do you want a quick tour of the nodes, or are you ready to dive straight in?'}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => onSelect('learning')}
            className="group relative flex items-center justify-between p-4 bg-zen-surface-hover hover:bg-zen-surface-secondary border-none rounded-2xl transition-all duration-200"
          >
            <div className="flex flex-col text-left">
              <span className="text-base font-semibold text-zen-text transition-colors">
                {en.onboarding?.learnTitle ?? 'I want to learn, walk me through it'}
              </span>
              <span className="text-xs text-zen-text-secondary mt-0.5">
                {en.onboarding?.learnSubtitle ?? 'Starts a quick interactive tutorial.'}
              </span>
            </div>
            <span className="text-xl opacity-0 group-hover:opacity-100 transform translate-x-[-8px] group-hover:translate-x-0 transition-all duration-200 text-zen-text">
              →
            </span>
          </button>

          <button
            onClick={() => onSelect('completed')}
            className="group relative flex items-center justify-between p-4 bg-zen-surface-hover hover:bg-zen-surface-secondary border-none rounded-2xl transition-all duration-200"
          >
            <div className="flex flex-col text-left">
              <span className="text-base font-semibold text-zen-text transition-colors">
                {en.onboarding?.skipTitle ?? 'Doing is learning (skip tutorial)'}
              </span>
              <span className="text-xs text-zen-text-secondary mt-0.5">
                {en.onboarding?.skipSubtitle ?? 'Jump right into the app.'}
              </span>
            </div>
            <span className="text-xl opacity-0 group-hover:opacity-100 transform translate-x-[-8px] group-hover:translate-x-0 transition-all duration-200 text-zen-text">
              →
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};


