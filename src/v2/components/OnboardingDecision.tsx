import React from 'react';

interface OnboardingDecisionProps {
  onSelect: (decision: 'learning' | 'completed') => void;
}

export const OnboardingDecision: React.FC<OnboardingDecisionProps> = ({ onSelect }) => {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border-2 border-orange-500 rounded-lg p-8 max-w-lg w-full shadow-2xl shadow-orange-500/20 transform transition-all">
        <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Welcome to FrugalLLM</h2>
        <p className="text-neutral-400 mb-8 leading-relaxed">
          The ultimate local-first AI orchestrator. Do you want a quick tour of the nodes, or are you ready to dive straight in?
        </p>
        
        <div className="flex flex-col gap-4">
          <button
            onClick={() => onSelect('learning')}
            className="group relative flex items-center justify-between p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-orange-500 rounded-lg transition-all duration-200"
          >
            <div className="flex flex-col text-left">
              <span className="text-lg font-semibold text-white group-hover:text-orange-400 transition-colors">I want to learn, walk me through it</span>
              <span className="text-sm text-neutral-500">Starts a quick interactive tutorial.</span>
            </div>
            <span className="text-2xl opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300 text-orange-500">→</span>
          </button>

          <button
            onClick={() => onSelect('completed')}
            className="group relative flex items-center justify-between p-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-orange-500 rounded-lg transition-all duration-200"
          >
            <div className="flex flex-col text-left">
              <span className="text-lg font-semibold text-white group-hover:text-orange-400 transition-colors">Doing is learning (skip tutorial)</span>
              <span className="text-sm text-neutral-500">Jump right into the app.</span>
            </div>
            <span className="text-2xl opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300 text-orange-500">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};
