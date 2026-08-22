import React from 'react';

interface OnboardingDecisionProps {
  onSelect: (decision: 'learning' | 'completed') => void;
}

export const OnboardingDecision: React.FC<OnboardingDecisionProps> = ({ onSelect }) => {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/10 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zen-surface border border-zen-border rounded-2xl p-8 max-w-lg w-full shadow-2xl shadow-glass transform transition-all">
        <h2 className="text-3xl font-bold text-zen-text mb-4 tracking-tight">Welcome to FrugalLLM</h2>
        <p className="text-zen-text-secondary mb-8 leading-relaxed">
          The ultimate local-first AI orchestrator. Do you want a quick tour of the nodes, or are you ready to dive straight in?
        </p>
        
        <div className="flex flex-col gap-4">
          <button
            onClick={() => onSelect('learning')}
            className="group relative flex items-center justify-between p-4 bg-zen-surface hover:bg-zen-surface-hover border border-zen-border hover:border-zen-accent rounded-2xl transition-all duration-200"
          >
            <div className="flex flex-col text-left">
              <span className="text-lg font-semibold text-zen-text group-hover:text-zen-accent transition-colors">I want to learn, walk me through it</span>
              <span className="text-sm text-zen-text-secondary">Starts a quick interactive tutorial.</span>
            </div>
            <span className="text-2xl opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300 text-zen-accent">→</span>
          </button>

          <button
            onClick={() => onSelect('completed')}
            className="group relative flex items-center justify-between p-4 bg-zen-surface hover:bg-zen-surface-hover border border-zen-border hover:border-zen-accent rounded-2xl transition-all duration-200"
          >
            <div className="flex flex-col text-left">
              <span className="text-lg font-semibold text-zen-text group-hover:text-zen-accent transition-colors">Doing is learning (skip tutorial)</span>
              <span className="text-sm text-zen-text-secondary">Jump right into the app.</span>
            </div>
            <span className="text-2xl opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300 text-zen-accent">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};
