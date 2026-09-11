import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export type TooltipVariant = 'info' | 'help';

export interface TooltipProps {
  text: string;
  children?: React.ReactNode;
  variant?: TooltipVariant;
  testId?: string;
  triggerTestId?: string;
  ariaLabel?: string;
  delay?: number;
  style?: React.CSSProperties;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  text, 
  children,
  variant = 'info',
  testId, 
  triggerTestId,
  ariaLabel,
  delay,
  style: propStyle,
}) => {
  const [visible, setVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, isAbove: true });
  const triggerRef = useRef<HTMLElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipIdRef = useRef<string>(`tooltip-${Math.random().toString(36).substring(2, 9)}`);

  const effectiveAriaLabel = ariaLabel || (typeof children === 'string' ? `${children}: ${text}` : (variant === 'help' ? `Guidance: ${text}` : text));

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const isAbove = rect.top > 100;
      setCoords({
        top: isAbove ? rect.top - 8 : rect.bottom + 8,
        left: rect.left + rect.width / 2,
        isAbove
      });
    }
  };

  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  const openDelay = delay !== undefined ? delay : (isTest ? 0 : 180);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (openDelay === 0) {
      updatePosition();
      setVisible(true);
    } else {
      timeoutRef.current = setTimeout(() => {
        updatePosition();
        setVisible(true);
      }, openDelay);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  const handleFocus = () => {
    setIsFocused(true);
    updatePosition();
    setVisible(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

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
        ref={triggerRef as any}
        data-testid={triggerTestId}
        data-variant={variant}
        role="button"
        tabIndex={0}
        aria-label={effectiveAriaLabel}
        aria-describedby={visible ? tooltipIdRef.current : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onMouseDown={(e) => e.stopPropagation()}
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
          } else if (e.key === 'Escape') {
            setVisible(false);
          }
        }}
        style={{ 
          cursor: 'help',
          textDecoration: 'underline dotted',
          textDecorationColor: isHovered || isFocused ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.35)',
          textUnderlineOffset: '4px',
          transition: 'text-decoration-color 0.15s ease',
          outline: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          ...propStyle 
        }}
      >
        {children}
      </span>
      {visible && createPortal(
        <div 
          id={tooltipIdRef.current}
          data-testid={testId}
          role="tooltip"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: coords.isAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            zIndex: 999999,
            pointerEvents: 'none',
            width: 'max-content',
            maxWidth: '260px',
            backgroundColor: '#18181b',
            color: 'var(--zen-text, #f4f4f5)',
            textAlign: 'left',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '0.75rem',
            lineHeight: 1.5,
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.25)',
            border: '1px solid #27272a',
            textTransform: 'none',
            fontWeight: 400
          }}
        >
          {text}
          <div 
            style={{
              position: 'absolute',
              ...(coords.isAbove 
                ? { top: '100%', borderColor: '#18181b transparent transparent transparent' } 
                : { bottom: '100%', borderColor: 'transparent transparent #18181b transparent' }),
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

export const HelpTooltip: React.FC<TooltipProps> = (props) => (
  <Tooltip {...props} variant="help" />
);

export const TooltipGroup: React.FC<{
  children: React.ReactNode;
  gap?: string;
  style?: React.CSSProperties;
}> = ({ children, gap = '3px', style }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap, ...style }}>
    {children}
  </span>
);
