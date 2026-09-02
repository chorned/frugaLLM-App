import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import en from '../locales/en.json';

interface OnboardingOverlayProps {
  onComplete: () => void;
}

const EDGE_PADDING = 16;
const GAP = 14;
const MIN_ARROW_INSET = 26;

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ onComplete }) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipDimensions, setTooltipDimensions] = useState({ width: 340, height: 230 });

  // Keep track of viewport dimensions
  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Continuously track the "LOCAL HARDWARE" node's position without redundant re-renders
  useEffect(() => {
    let animationFrameId: number;
    let foundElement: Element | null = null;

    const findTargetNode = () => {
      const heading = document.getElementById('local-hardware-heading');
      if (heading) {
        let parent = heading.parentElement;
        while (parent) {
          if (parent.style.position === 'absolute' || parent.classList.contains('react-flow__node')) {
            foundElement = parent;
            break;
          }
          parent = parent.parentElement;
        }
        if (!foundElement) {
          foundElement = heading;
        }
      }

      if (foundElement) {
        const newRect = foundElement.getBoundingClientRect();
        setTargetRect((prev) => {
          if (
            !prev ||
            Math.abs(prev.top - newRect.top) > 0.5 ||
            Math.abs(prev.left - newRect.left) > 0.5 ||
            Math.abs(prev.width - newRect.width) > 0.5 ||
            Math.abs(prev.height - newRect.height) > 0.5
          ) {
            return newRect;
          }
          return prev;
        });
      }

      animationFrameId = requestAnimationFrame(findTargetNode);
    };

    animationFrameId = requestAnimationFrame(findTargetNode);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Measure actual tooltip dimensions
  useLayoutEffect(() => {
    if (tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        if (
          Math.abs(rect.width - tooltipDimensions.width) > 1 ||
          Math.abs(rect.height - tooltipDimensions.height) > 1
        ) {
          setTooltipDimensions({ width: rect.width, height: rect.height });
        }
      }
    }
  }, [targetRect, tooltipDimensions.width, tooltipDimensions.height]);

  // Compute smart, edge-clamped positioning & dynamic arrow alignment
  const targetCenterX = targetRect ? targetRect.left + targetRect.width / 2 : 0;

  const tooltipWidth = tooltipDimensions.width || 340;
  const tooltipHeight = tooltipDimensions.height || 230;

  const spaceBelow = targetRect ? viewport.height - (targetRect.bottom + GAP) : 0;
  const spaceAbove = targetRect ? targetRect.top - GAP : 0;

  let placement: 'bottom' | 'top' = 'bottom';
  let tooltipTop = 0;

  if (targetRect) {
    if (spaceBelow >= tooltipHeight + EDGE_PADDING) {
      placement = 'bottom';
      tooltipTop = targetRect.bottom + GAP;
    } else if (spaceAbove >= tooltipHeight + EDGE_PADDING) {
      placement = 'top';
      tooltipTop = targetRect.top - tooltipHeight - GAP;
    } else {
      if (spaceBelow >= spaceAbove) {
        placement = 'bottom';
        tooltipTop = Math.max(
          EDGE_PADDING,
          Math.min(viewport.height - tooltipHeight - EDGE_PADDING, targetRect.bottom + GAP)
        );
      } else {
        placement = 'top';
        tooltipTop = Math.max(
          EDGE_PADDING,
          Math.min(viewport.height - tooltipHeight - EDGE_PADDING, targetRect.top - tooltipHeight - GAP)
        );
      }
    }
  }

  const idealLeft = targetCenterX - tooltipWidth / 2;
  const minLeft = EDGE_PADDING;
  const maxLeft = Math.max(EDGE_PADDING, viewport.width - tooltipWidth - EDGE_PADDING);
  const tooltipLeft = Math.min(Math.max(idealLeft, minLeft), maxLeft);

  const idealArrowLeft = targetCenterX - tooltipLeft;
  const arrowLeft = Math.min(
    Math.max(idealArrowLeft, MIN_ARROW_INSET),
    tooltipWidth - MIN_ARROW_INSET
  );

  const PAD = 8;
  const cutoutLeft = targetRect ? Math.max(0, targetRect.left - PAD) : 0;
  const cutoutTop = targetRect ? Math.max(0, targetRect.top - PAD) : 0;
  const cutoutRight = targetRect ? Math.min(viewport.width, targetRect.right + PAD) : 0;
  const cutoutBottom = targetRect ? Math.min(viewport.height, targetRect.bottom + PAD) : 0;
  const cutoutWidth = Math.max(0, cutoutRight - cutoutLeft);
  const cutoutHeight = Math.max(0, cutoutBottom - cutoutTop);

  return createPortal(
    <>
      {/* If targetRect is not yet found, show full-screen backdrop */}
      {!targetRect && (
        <div className="fixed inset-0 z-[9998] bg-black/25 backdrop-blur-sm pointer-events-auto" />
      )}

      {/* 4-Quadrant Backdrop Blur: Leaves a completely open physical hole over targetRect so it is NEVER blurred */}
      {targetRect && (
        <>
          {/* Top panel */}
          <div
            data-testid="spotlight-top"
            className="fixed z-[9998] bg-black/25 backdrop-blur-sm pointer-events-auto"
            style={{
              top: 0,
              left: 0,
              width: '100vw',
              height: `${cutoutTop}px`,
            }}
          />

          {/* Bottom panel */}
          <div
            data-testid="spotlight-bottom"
            className="fixed z-[9998] bg-black/25 backdrop-blur-sm pointer-events-auto"
            style={{
              top: `${cutoutBottom}px`,
              left: 0,
              width: '100vw',
              bottom: 0,
            }}
          />

          {/* Left panel */}
          <div
            data-testid="spotlight-left"
            className="fixed z-[9998] bg-black/25 backdrop-blur-sm pointer-events-auto"
            style={{
              top: `${cutoutTop}px`,
              left: 0,
              width: `${cutoutLeft}px`,
              height: `${cutoutHeight}px`,
            }}
          />

          {/* Right panel */}
          <div
            data-testid="spotlight-right"
            className="fixed z-[9998] bg-black/25 backdrop-blur-sm pointer-events-auto"
            style={{
              top: `${cutoutTop}px`,
              left: `${cutoutRight}px`,
              right: 0,
              height: `${cutoutHeight}px`,
            }}
          />

          {/* 4 Corner Patches for smooth rounded-2xl (16px) cutout corners */}
          <svg
            className="fixed pointer-events-none"
            style={{ top: cutoutTop, left: cutoutLeft, width: 16, height: 16, zIndex: 9998 }}
          >
            <path d="M 0 0 H 16 A 16 16 0 0 0 0 16 Z" fill="rgba(0,0,0,0.25)" />
          </svg>
          <svg
            className="fixed pointer-events-none"
            style={{ top: cutoutTop, left: Math.max(0, cutoutRight - 16), width: 16, height: 16, zIndex: 9998 }}
          >
            <path d="M 16 0 H 0 A 16 16 0 0 1 16 16 Z" fill="rgba(0,0,0,0.25)" />
          </svg>
          <svg
            className="fixed pointer-events-none"
            style={{ top: Math.max(0, cutoutBottom - 16), left: cutoutLeft, width: 16, height: 16, zIndex: 9998 }}
          >
            <path d="M 0 16 H 16 A 16 16 0 0 1 0 0 Z" fill="rgba(0,0,0,0.25)" />
          </svg>
          <svg
            className="fixed pointer-events-none"
            style={{
              top: Math.max(0, cutoutBottom - 16),
              left: Math.max(0, cutoutRight - 16),
              width: 16,
              height: 16,
              zIndex: 9998,
            }}
          >
            <path d="M 16 16 H 0 A 16 16 0 0 0 16 0 Z" fill="rgba(0,0,0,0.25)" />
          </svg>

          {/* Highlight Ring around the crisp, unblurred cutout */}
          <div
            className="fixed z-[9998] pointer-events-none rounded-2xl ring-2 ring-zen-border shadow-[0_0_30px_rgba(0,0,0,0.25)]"
            style={{
              top: `${cutoutTop}px`,
              left: `${cutoutLeft}px`,
              width: `${cutoutWidth}px`,
              height: `${cutoutHeight}px`,
            }}
          />
        </>
      )}

      {/* Edge-Clamped Tooltip Card */}
      {targetRect && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: `${tooltipTop}px`,
            left: `${tooltipLeft}px`,
            width: '340px',
            maxWidth: `calc(100vw - ${EDGE_PADDING * 2}px)`,
            zIndex: 9999,
          }}
          className="pointer-events-auto bg-zen-surface rounded-2xl p-6 shadow-glass transform transition-all duration-150 border border-zen-border"
        >
          {/* Arrow pointing UP when tooltip is below target */}
          {placement === 'bottom' && (
            <>
              <div
                className="absolute -top-[12px] w-0 h-0 pointer-events-none"
                style={{
                  left: `${arrowLeft}px`,
                  transform: 'translateX(-50%)',
                  borderLeft: '10px solid transparent',
                  borderRight: '10px solid transparent',
                  borderBottom: '12px solid var(--zen-border)',
                }}
              />
              <div
                className="absolute -top-[10px] w-0 h-0 pointer-events-none"
                style={{
                  left: `${arrowLeft}px`,
                  transform: 'translateX(-50%)',
                  borderLeft: '9px solid transparent',
                  borderRight: '9px solid transparent',
                  borderBottom: '11px solid var(--zen-surface)',
                }}
              />
            </>
          )}

          {/* Arrow pointing DOWN when tooltip is above target */}
          {placement === 'top' && (
            <>
              <div
                className="absolute -bottom-[12px] w-0 h-0 pointer-events-none"
                style={{
                  left: `${arrowLeft}px`,
                  transform: 'translateX(-50%)',
                  borderLeft: '10px solid transparent',
                  borderRight: '10px solid transparent',
                  borderTop: '12px solid var(--zen-border)',
                }}
              />
              <div
                className="absolute -bottom-[10px] w-0 h-0 pointer-events-none"
                style={{
                  left: `${arrowLeft}px`,
                  transform: 'translateX(-50%)',
                  borderLeft: '9px solid transparent',
                  borderRight: '9px solid transparent',
                  borderTop: '11px solid var(--zen-surface)',
                }}
              />
            </>
          )}

          <h3 className="text-xl font-semibold text-zen-text mb-2 tracking-tight">
            {en.onboarding?.hardwareNodeTitle ?? 'Local Hardware Node'}
          </h3>
          <p className="text-sm text-zen-text-secondary mb-6 leading-relaxed">
            {en.onboarding?.hardwareNodeDescription ??
              "This node represents your machine's physical GPU and CPU. FrugalLLM monitors telemetry in real-time to optimize local AI inference."}
          </p>

          <div className="flex justify-end">
            <button
              onClick={onComplete}
              className="px-6 py-2.5 bg-zen-text text-white hover:bg-neutral-800 text-sm font-medium rounded-full transition-all hover:shadow-sm active:scale-[0.98]"
            >
              {en.onboarding?.finishTour ?? 'Finish Tour'}
            </button>
          </div>
        </div>
      )}
    </>,
    document.body
  );
};

