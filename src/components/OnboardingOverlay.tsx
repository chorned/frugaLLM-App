import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface OnboardingOverlayProps {
  onComplete: () => void;
}

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ onComplete }) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);


  // Continuously track the "LOCAL HARDWARE" node's position
  useEffect(() => {
    let animationFrameId: number;
    let foundElement: Element | null = null;

    const findTargetNode = () => {
        const heading = document.getElementById('local-hardware-heading');
        if (heading) {
          let parent = heading.parentElement;
          while (parent) {
            if (parent.style.position === 'absolute') {
              foundElement = parent;
              break;
            }
            parent = parent.parentElement;
          }
        }

      if (foundElement) {
        setTargetRect(foundElement.getBoundingClientRect());
      }
      
      animationFrameId = requestAnimationFrame(findTargetNode);
    };

    animationFrameId = requestAnimationFrame(findTargetNode);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const tooltipStyle: React.CSSProperties = targetRect ? {
    position: 'absolute',
    top: `${targetRect.top + targetRect.height + 16}px`,
    left: `${targetRect.left + (targetRect.width / 2)}px`,
    transform: 'translateX(-50%)',
    zIndex: 9999,
  } : {
    display: 'none'
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/10 backdrop-blur-sm pointer-events-auto" />
      {targetRect && (
        <div 
          className="absolute z-[9999] pointer-events-none rounded-2xl ring-4 ring-black/5"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.2)'
          }}
        />
      )}
      <div style={tooltipStyle} className="pointer-events-auto w-80 bg-zen-surface rounded-2xl p-6 shadow-glass transform transition-all border border-zen-border">
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[12px] border-b-zen-border"></div>
        <div className="absolute -top-[11px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-b-[11px] border-b-zen-surface"></div>
        
        <h3 className="text-xl font-semibold text-zen-text mb-2 tracking-tight">Local Hardware Node</h3>
        <p className="text-sm text-zen-text-secondary mb-6 leading-relaxed">
          This node represents your machine's physical GPU and CPU. FrugalLLM monitors telemetry in real-time to optimize local AI inference. 
        </p>
        
        <div className="flex justify-end">
          <button 
            onClick={onComplete}
            className="px-5 py-2.5 bg-zen-surface-hover border border-zen-border hover:border-zen-text text-zen-text text-sm font-medium rounded-xl transition-all"
          >
            Finish Tour
          </button>
        </div>
      </div>
    </>,
    document.body
  );
};
