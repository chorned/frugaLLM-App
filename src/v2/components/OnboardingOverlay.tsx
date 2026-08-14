import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface OnboardingOverlayProps {
  onComplete: () => void;
}

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ onComplete }) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Continuously track the "LOCAL HARDWARE" node's position
  useEffect(() => {
    let animationFrameId: number;
    let foundElement: Element | null = null;

    const findTargetNode = () => {
      if (!foundElement) {
        // Query the DOM for an element containing the specific text
        // The V1 Hardware node has the text "LOCAL HARDWARE" with a chevron span, so includes is safer
        const elements = Array.from(document.querySelectorAll('div'));
        
        const heading = elements.find(el => el.textContent?.includes('LOCAL HARDWARE') && el.style.fontWeight === '800');
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
      <div className="fixed inset-0 z-[9998] bg-black/40 pointer-events-auto" />
      {targetRect && (
        <div 
          className="absolute z-[9999] pointer-events-none rounded border-2 border-orange-500"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)'
          }}
        />
      )}
      <div style={tooltipStyle} className="pointer-events-auto w-80 bg-neutral-900 border-2 border-orange-500 rounded-lg p-6 shadow-2xl shadow-orange-500/20">
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[12px] border-b-orange-500"></div>
        <div className="absolute -top-[9px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[10px] border-b-neutral-900"></div>
        
        <h3 className="text-xl font-bold text-white mb-2">Local Hardware Node</h3>
        <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
          This node represents your machine's physical GPU and CPU. FrugalLLM monitors telemetry in real-time to optimize local AI inference. 
        </p>
        
        <div className="flex justify-end">
          <button 
            onClick={onComplete}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded transition-colors"
          >
            Finish Tour
          </button>
        </div>
      </div>
    </>,
    document.body
  );
};
