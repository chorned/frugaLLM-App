import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export const InfoIconSVG = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="-50 -50 590 590" width="14" height="14" style={{ display: 'block' }} fill="currentColor" {...props}>
    <path d="M245.148,0C109.967,0,0.009,109.98,0.009,245.162c0,135.182,109.958,245.156,245.139,245.156 c135.186,0,245.162-109.978,245.162-245.156C490.31,109.98,380.333,0,245.148,0z M245.148,438.415 c-106.555,0-193.234-86.698-193.234-193.253c0-106.555,86.68-193.258,193.234-193.258c106.559,0,193.258,86.703,193.258,193.258 C438.406,351.717,351.706,438.415,245.148,438.415z"/>
    <path d="M270.036,221.352h-49.771c-8.351,0-15.131,6.78-15.131,15.118v147.566c0,8.352,6.78,15.119,15.131,15.119h49.771 c8.351,0,15.131-6.77,15.131-15.119V236.471C285.167,228.133,278.387,221.352,270.036,221.352z"/>
    <path d="M245.148,91.168c-24.48,0-44.336,19.855-44.336,44.336c0,24.484,19.855,44.34,44.336,44.34 c24.485,0,44.342-19.855,44.342-44.34C289.489,111.023,269.634,91.168,245.148,91.168z"/>
  </svg>
);

export interface TooltipProps {
  text: string;
  testId?: string;
  triggerTestId?: string;
  ariaLabel?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  text, 
  testId, 
  triggerTestId,
  ariaLabel = "More information"
}) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, isAbove: true });
  const triggerRef = useRef<HTMLSpanElement>(null);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const isAbove = rect.top > 90;
      setCoords({
        top: isAbove ? rect.top - 8 : rect.bottom + 8,
        left: rect.left + rect.width / 2,
        isAbove
      });
    }
  };

  const handleMouseEnter = () => {
    updatePosition();
    setVisible(true);
  };

  const handleMouseLeave = () => {
    setVisible(false);
  };

  useEffect(() => {
    if (!visible) return;
    const handleScrollOrResize = () => {
      updatePosition();
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [visible]);

  return (
    <>
      <span 
        ref={triggerRef}
        data-testid={triggerTestId}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          updatePosition();
          setVisible(v => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            updatePosition();
            setVisible(v => !v);
          }
        }}
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: '14px', 
          height: '14px', 
          color: '#9ca3af', 
          marginLeft: '6px', 
          cursor: 'help' 
        }}
      >
        <InfoIconSVG width="14" height="14" />
      </span>
      {visible && createPortal(
        <div 
          data-testid={testId}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: coords.isAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            zIndex: 999999,
            pointerEvents: 'none',
            width: 'max-content',
            maxWidth: '260px',
            backgroundColor: '#111827',
            color: '#ffffff',
            textAlign: 'center',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '0.75rem',
            fontFamily: 'sans-serif',
            fontWeight: 'normal',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.2)',
            lineHeight: 1.35,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            textTransform: 'none'
          }}
        >
          {text}
          <div 
            style={{
              position: 'absolute',
              ...(coords.isAbove 
                ? { top: '100%', borderColor: '#111827 transparent transparent transparent' } 
                : { bottom: '100%', borderColor: 'transparent transparent #111827 transparent' }),
              left: '50%',
              transform: 'translateX(-50%)',
              borderWidth: '5px',
              borderStyle: 'solid',
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
};
