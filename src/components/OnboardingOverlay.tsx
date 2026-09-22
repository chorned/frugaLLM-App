import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  setCredential,
  getCredential,
  refreshRoutingChain,
  installHermes,
  installOpenCode,
  checkHermesStatus,
  checkOpencodeStatus,
  detectHardwareProfile,
  safeFetch,
} from '../services/tauri';
import { useMemory } from '../context/MemoryContext';
import { useTheme } from '../hooks/useTheme';
import { FrugaLLMIcon } from './icons/ProviderIcons';
import en from '../locales/en.json';

export interface OnboardingOverlayProps {
  currentStep?: number;
  onNext?: () => void;
  onPrev?: () => void;
  onGoToStep?: (step: number) => void;
  onComplete: () => void;
  onStatusChange?: () => void;
  onInstallHermes?: () => void;
  onInstallOpenCode?: () => void;
  onOpenIssueReporter?: () => void;
  isHermesInstalled?: boolean;
  isOpenCodeInstalled?: boolean;
}

const EDGE_PADDING = 16;
const PAD = 16;
const GAP = 16;
const MIN_ARROW_INSET = 26;
const BACKDROP_BG = 'rgba(0, 0, 0, 0.45)';

const MAX_SIMULATED_TOKENS = 999999999;
const MID_REALISTIC_TOKENS = 10000000;

/**
 * Maps linear slider position s in [0, 1] to token count:
 * - Lower half s in [0, 0.5]: quadratic power curve mapping from 0 to 10,000,000 tokens
 *   (e.g., 25% slider = 2,500,000 tokens, 50% slider = 10,000,000 tokens).
 * - Upper half s in [0.5, 1.0]: exponential curve accelerating from 10,000,000 to 999,999,999 tokens
 *   (e.g., 75% slider = 100,000,000 tokens, 100% slider = 999,999,999 tokens).
 */
export function sliderToTokens(s: number): number {
  if (s <= 0) return 0;
  if (s >= 1) return MAX_SIMULATED_TOKENS;

  if (s <= 0.5) {
    const u = s * 2;
    const tokens = Math.pow(u, 2) * MID_REALISTIC_TOKENS;
    return Math.round(tokens);
  } else {
    const v = (s - 0.5) * 2;
    const ratio = MAX_SIMULATED_TOKENS / MID_REALISTIC_TOKENS;
    const tokens = MID_REALISTIC_TOKENS * Math.pow(ratio, v);
    return Math.min(MAX_SIMULATED_TOKENS, Math.round(tokens));
  }
}

export function tokensToSlider(tokens: number): number {
  if (tokens <= 0) return 0;
  if (tokens >= MAX_SIMULATED_TOKENS) return 1;

  if (tokens <= MID_REALISTIC_TOKENS) {
    const ratio = Math.max(0, Math.min(1, tokens / MID_REALISTIC_TOKENS));
    const u = Math.sqrt(ratio);
    return Math.max(0, Math.min(0.5, u * 0.5));
  } else {
    const ratio = tokens / MID_REALISTIC_TOKENS;
    const maxRatio = MAX_SIMULATED_TOKENS / MID_REALISTIC_TOKENS;
    const v = Math.max(0, Math.log(ratio) / Math.log(maxRatio));
    return Math.max(0.5, Math.min(1, 0.5 + v * 0.5));
  }
}

/**
 * Computes the union bounding box of specified element IDs.
 * Bypasses stretched flexbox row containers to wrap the actual child cards.
 */
function getNodesBoundingBox(nodeIds: string[]): DOMRect | null {
  const rects: DOMRect[] = [];
  for (const id of nodeIds) {
    const el = document.getElementById(id);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        rects.push(r);
      }
    }
  }
  if (rects.length === 0) return null;

  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));

  return new DOMRect(left, top, right - left, bottom - top);
}

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({
  currentStep = 1,
  onNext,
  onPrev,
  onComplete,
  onStatusChange,
  onInstallHermes,
  onInstallOpenCode,
  onOpenIssueReporter,
  isHermesInstalled: propIsHermesInstalled,
  isOpenCodeInstalled: propIsOpenCodeInstalled,
}) => {
  const { isDark } = useTheme();
  const memory = useMemory();
  const [hardwareProfile, setHardwareProfile] = useState<any>(null);

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipDimensions, setTooltipDimensions] = useState({ width: 420, height: 280 });

  // Step 3 Ephemeral Simulated Metrics & Savings Calculation (Default to half way = MID_REALISTIC_TOKENS)
  const [simulatedTokens, setSimulatedTokens] = useState(MID_REALISTIC_TOKENS);
  const simulatedSaved = simulatedTokens * 0.000023;
  const simulatedSavedDisplay = simulatedSaved.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Step 4 State
  const [googleKey, setGoogleKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [googleSaved, setGoogleSaved] = useState(false);
  const [openrouterSaved, setOpenrouterSaved] = useState(false);
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [savingOpenrouter, setSavingOpenrouter] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Step 5 State
  const [isOpenCodeInstalled, setIsOpenCodeInstalled] = useState(false);
  const [isHermesInstalled, setIsHermesInstalled] = useState(false);
  const [installingOpenCode, setInstallingOpenCode] = useState(false);
  const [installingHermes, setInstallingHermes] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  const effectiveIsOpenCodeInstalled = propIsOpenCodeInstalled ?? isOpenCodeInstalled;
  const effectiveIsHermesInstalled = propIsHermesInstalled ?? isHermesInstalled;

  // Resize listener
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

  // Fetch hardware profile and existing statuses on mount
  useEffect(() => {
    let mounted = true;

    async function loadTelemetry() {
      try {
        const profile = await detectHardwareProfile();
        if (mounted && profile) {
          setHardwareProfile(profile);
        }
      } catch (err) {
        // Fallback gracefully
      }
    }

    async function loadCredentialsAndDependencies() {
      try {
        const [gKey, orKey, hermes, opencode] = await Promise.allSettled([
          getCredential('google'),
          getCredential('openrouter'),
          checkHermesStatus(),
          checkOpencodeStatus(),
        ]);

        if (mounted) {
          if (gKey.status === 'fulfilled' && gKey.value && gKey.value.trim().length > 0) {
            setGoogleKey(gKey.value);
            setGoogleSaved(true);
          }
          if (orKey.status === 'fulfilled' && orKey.value && orKey.value.trim().length > 0) {
            setOpenrouterKey(orKey.value);
            setOpenrouterSaved(true);
          }
          if (hermes.status === 'fulfilled') {
            const installed =
              typeof hermes.value === 'boolean' ? hermes.value : Boolean(hermes.value?.is_installed);
            setIsHermesInstalled(installed);
          }
          if (opencode.status === 'fulfilled') {
            const installed =
              typeof opencode.value === 'boolean' ? opencode.value : Boolean(opencode.value?.is_installed);
            setIsOpenCodeInstalled(installed);
          }
        }
      } catch (e) {
        console.error('Error loading onboarding statuses', e);
      }
    }

    loadTelemetry();
    loadCredentialsAndDependencies();

    return () => {
      mounted = false;
    };
  }, []);

  // Compute exact RAM allocation matching the Ollama node's memTotal denominator
  const effectiveProfile = memory?.hardwareProfile || hardwareProfile;
  const executionCeiling =
    effectiveProfile?.execution_ceiling ||
    memory?.effectiveSegments?.execution_ceiling_bytes ||
    (memory?.latestTelemetry?.hardware?.vram_total || 0) ||
    (effectiveProfile?.total_memory_mb ? effectiveProfile.total_memory_mb * 1024 * 1024 : 0) ||
    (effectiveProfile?.system_ram ? effectiveProfile.system_ram : 8 * 1024 * 1024 * 1024);
  const detectedRamDisplay = (executionCeiling / (1024 * 1024 * 1024)).toFixed(1);

  // Step 3: Ephemeral Canvas SVG Wire Animation and Simulated Metrics Counter
  useEffect(() => {
    if (currentStep !== 3) return;

    // 1. Smoothly animate simulated token count to half way (MID_REALISTIC_TOKENS = 10,000,000)
    setSimulatedTokens(1200);
    const start = performance.now();
    const duration = 2200;
    let animId: number;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (progress >= 1) {
        setSimulatedTokens(MID_REALISTIC_TOKENS);
      } else {
        setSimulatedTokens(Math.round(1200 + (MID_REALISTIC_TOKENS - 1200) * eased));
        animId = requestAnimationFrame(tick);
      }
    };
    animId = requestAnimationFrame(tick);

    // 2. Ephemeral wire animation: apply pulse style to edge-frugallm-google and edge-opencode-frugallm
    const wire1 = document.getElementById('edge-frugallm-google');
    const wire2 = document.getElementById('edge-opencode-frugallm');
    const wires = [wire1, wire2].filter(Boolean) as unknown as SVGLineElement[];

    const originalStyles = wires.map((wire) => ({
      el: wire,
      stroke: wire.style.stroke || '',
      strokeDasharray: wire.style.strokeDasharray || '',
      animation: wire.style.animation || '',
    }));

    wires.forEach((wire) => {
      wire.style.stroke = 'var(--zen-accent, #10B981)';
      wire.style.strokeDasharray = '8';
      wire.style.animation = 'flowAnimation 0.8s linear infinite';
      wire.classList.add('edge-flow-active');
    });

    // Cleanup guarantee: zero residual styling on canvas
    return () => {
      cancelAnimationFrame(animId);
      originalStyles.forEach(({ el, stroke, strokeDasharray, animation }) => {
        el.style.stroke = stroke;
        el.style.strokeDasharray = strokeDasharray;
        el.style.animation = animation;
        el.classList.remove('edge-flow-active');
      });
    };
  }, [currentStep]);

  // Step 6: Confetti burst
  useEffect(() => {
    if (currentStep === 6) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          disableForReducedMotion: true,
        });
      } catch (e) {
        // Safe fallback in headless/test environments
      }
    }
  }, [currentStep]);

  // Continuous target tracking via rAF
  useEffect(() => {
    let animationFrameId: number;

    const findTargetNode = () => {
      let foundRect: DOMRect | null = null;

      switch (currentStep) {
        case 1: {
          // Wrap all 3 intelligence sources snugly; fallback to top row if individual cards not in DOM
          foundRect = getNodesBoundingBox(['node-ollama', 'node-google', 'node-openrouter']);
          if (!foundRect) {
            const topRow = document.querySelector('[data-testid="router-top-row"]');
            if (topRow) foundRect = topRow.getBoundingClientRect();
          }
          break;
        }
        case 2: {
          // Wrap both agentic harnesses snugly; fallback to bottom row if individual cards not in DOM
          foundRect = getNodesBoundingBox(['node-opencode', 'node-hermes']);
          if (!foundRect) {
            const bottomRow = document.querySelector('[data-testid="router-bottom-row"]');
            if (bottomRow) foundRect = bottomRow.getBoundingClientRect();
          }
          break;
        }
        case 3: {
          // Step 3 CTA is tall with node alias and slider: center directly in viewport and skip arrow
          foundRect = null;
          break;
        }
        case 4: {
          foundRect = getNodesBoundingBox(['node-google', 'node-openrouter']);
          if (!foundRect) {
            const google = document.getElementById('node-google');
            if (google) foundRect = google.getBoundingClientRect();
          }
          break;
        }
        case 5: {
          foundRect = getNodesBoundingBox(['node-opencode', 'node-hermes']);
          if (!foundRect) {
            const opencode = document.getElementById('node-opencode');
            if (opencode) foundRect = opencode.getBoundingClientRect();
          }
          break;
        }
        case 6: {
          const frugallm = document.getElementById('node-frugallm');
          if (frugallm) foundRect = frugallm.getBoundingClientRect();
          break;
        }
        default:
          break;
      }

      // Legacy fallback for tests expecting local-hardware-heading
      if (!foundRect && currentStep !== 3) {
        const heading = document.getElementById('local-hardware-heading');
        if (heading) foundRect = heading.getBoundingClientRect();
      }

      if (foundRect) {
        setTargetRect((prev) => {
          if (
            !prev ||
            Math.abs(prev.top - foundRect!.top) > 0.5 ||
            Math.abs(prev.left - foundRect!.left) > 0.5 ||
            Math.abs(prev.width - foundRect!.width) > 0.5 ||
            Math.abs(prev.height - foundRect!.height) > 0.5
          ) {
            return foundRect;
          }
          return prev;
        });
      } else {
        setTargetRect(null);
      }

      animationFrameId = requestAnimationFrame(findTargetNode);
    };

    animationFrameId = requestAnimationFrame(findTargetNode);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [currentStep]);

  // Tooltip size measurement
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
  }, [currentStep, targetRect, tooltipDimensions.width, tooltipDimensions.height]);

  // Aperture cutout calculations with balanced 16px padding
  const cutoutLeft = targetRect ? Math.max(0, targetRect.left - PAD) : 0;
  const cutoutTop = targetRect ? Math.max(0, targetRect.top - PAD) : 0;
  const cutoutRight = targetRect ? Math.min(viewport.width, targetRect.right + PAD) : 0;
  const cutoutBottom = targetRect ? Math.min(viewport.height, targetRect.bottom + PAD) : 0;
  const cutoutWidth = Math.max(0, cutoutRight - cutoutLeft);
  const cutoutHeight = Math.max(0, cutoutBottom - cutoutTop);

  const isStepCentered = currentStep === 3 || currentStep === 6 || !targetRect;

  // Smart Tooltip Edge Clamping & Dynamic Placement based on cutout bounds
  const targetCenterX = targetRect && !isStepCentered ? targetRect.left + targetRect.width / 2 : viewport.width / 2;
  const tooltipWidth = tooltipDimensions.width || 420;
  const tooltipHeight = tooltipDimensions.height || 280;

  let placement: 'bottom' | 'top' = 'bottom';
  let tooltipTop = 0;

  if (isStepCentered) {
    tooltipTop = Math.max(EDGE_PADDING, (viewport.height - tooltipHeight) / 2);
  } else if (targetRect) {
    const spaceBelow = viewport.height - (cutoutBottom + GAP);
    const spaceAbove = cutoutTop - GAP;
    if (spaceBelow >= tooltipHeight + EDGE_PADDING) {
      placement = 'bottom';
      tooltipTop = cutoutBottom + GAP;
    } else if (spaceAbove >= tooltipHeight + EDGE_PADDING) {
      placement = 'top';
      tooltipTop = cutoutTop - tooltipHeight - GAP;
    } else {
      if (spaceBelow >= spaceAbove) {
        placement = 'bottom';
        tooltipTop = Math.max(
          EDGE_PADDING,
          Math.min(viewport.height - tooltipHeight - EDGE_PADDING, cutoutBottom + GAP)
        );
      } else {
        placement = 'top';
        tooltipTop = Math.max(
          EDGE_PADDING,
          Math.min(viewport.height - tooltipHeight - EDGE_PADDING, cutoutTop - tooltipHeight - GAP)
        );
      }
    }
  } else {
    tooltipTop = Math.max(EDGE_PADDING, (viewport.height - tooltipHeight) / 2);
  }

  const idealLeft = targetCenterX - tooltipWidth / 2;
  const minLeft = EDGE_PADDING;
  const maxLeft = Math.max(EDGE_PADDING, viewport.width - tooltipWidth - EDGE_PADDING);
  const tooltipLeft = Math.min(Math.max(idealLeft, minLeft), maxLeft);

  const idealArrowLeft = targetCenterX - tooltipLeft;
  const arrowLeft = Math.min(Math.max(idealArrowLeft, MIN_ARROW_INSET), tooltipWidth - MIN_ARROW_INSET);
  const showArrow = !isStepCentered && Boolean(targetRect);

  // External link opener
  const handleOpenLink = (url: string) => {
    openUrl(url).catch(() => {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
  };

  // Step 4 Handlers
  const handleSaveGoogleKey = async () => {
    const trimmed = googleKey.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('sk-or-') || trimmed.startsWith('sk-')) {
      setKeyError(
        en.onboarding?.steps?.step4?.errorMismatchedOpenRouter ??
          'This looks like an OpenRouter key. Please paste it into the OpenRouter box below.'
      );
      return;
    }
    setSavingGoogle(true);
    setKeyError(null);
    try {
      let probeOk = true;
      let probeStatus = 200;
      try {
        const fetchFn = safeFetch;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);
          const res = await fetchFn(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${trimmed}`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
            }
          );
          clearTimeout(timeoutId);
          if (!res.ok) {
            probeOk = false;
            probeStatus = res.status;
          }
        } catch (probeErr) {
          console.warn('Google probe network warning:', probeErr);
        }

      if (!probeOk) {
        setKeyError(
          en.onboarding?.steps?.step4?.errorVerificationFailed?.replace('{{status}}', String(probeStatus)) ??
            `Key verification failed (HTTP ${probeStatus}). Please check that your key is valid and active.`
        );
        return;
      }

      await setCredential('google', trimmed);
      await refreshRoutingChain().catch(() => {});
      setGoogleSaved(true);
      onStatusChange?.();
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch (e) {}
    } catch (e: any) {
      setKeyError(en.onboarding?.steps?.step4?.errorInvalidKey || 'Failed to save Google key');
    } finally {
      setSavingGoogle(false);
    }
  };

  const handleSaveOpenRouterKey = async () => {
    const trimmed = openrouterKey.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('AIza')) {
      setKeyError(
        en.onboarding?.steps?.step4?.errorMismatchedGoogle ??
          'This looks like a Google AI Studio key. Please paste it into the Google AI Studio box above.'
      );
      return;
    }
    setSavingOpenrouter(true);
    setKeyError(null);
    try {
      let probeOk = true;
      let probeStatus = 200;
      try {
        const fetchFn = safeFetch;
          const res = await fetchFn(`https://openrouter.ai/api/v1/auth/key`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${trimmed}`,
              'HTTP-Referer': 'https://github.com/chorned/frugaLLM',
              'X-Title': 'FrugaLLM',
            },
          });
          if (!res.ok) {
            probeOk = false;
            probeStatus = res.status;
          }
        } catch (probeErr) {
          console.warn('OpenRouter probe network warning:', probeErr);
        }

      if (!probeOk) {
        setKeyError(
          en.onboarding?.steps?.step4?.errorVerificationFailed?.replace('{{status}}', String(probeStatus)) ??
            `Key verification failed (HTTP ${probeStatus}). Please check that your key is valid and active.`
        );
        return;
      }

      await setCredential('openrouter', trimmed);
      await refreshRoutingChain().catch(() => {});
      setOpenrouterSaved(true);
      onStatusChange?.();
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch (e) {}
    } catch (e: any) {
      setKeyError(en.onboarding?.steps?.step4?.errorInvalidKey || 'Failed to save OpenRouter key');
    } finally {
      setSavingOpenrouter(false);
    }
  };

  // Step 5 Handlers
  const handleInstallOpenCode = async () => {
    setInstallingOpenCode(true);
    setInstallError(null);
    try {
      await installOpenCode();
      setIsOpenCodeInstalled(true);
      onStatusChange?.();
    } catch (e: any) {
      setInstallError(en.onboarding.steps.step5.failed || 'Installation failed');
    } finally {
      setInstallingOpenCode(false);
    }
  };

  const handleInstallHermes = async () => {
    setInstallingHermes(true);
    setInstallError(null);
    try {
      await installHermes();
      setIsHermesInstalled(true);
      onStatusChange?.();
    } catch (e: any) {
      setInstallError(en.onboarding.steps.step5.failed || 'Installation failed');
    } finally {
      setInstallingHermes(false);
    }
  };

  const hasTargetRect = Boolean(targetRect && currentStep !== 3);

  return createPortal(
    <>
      {/* Full-screen backdrop if target element not yet resolved or step is centered */}
      {!hasTargetRect && (
        <div
          className="fixed inset-0 z-[9998] pointer-events-auto"
          style={{
            backgroundColor: BACKDROP_BG,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        />
      )}

      {/* 4-Quadrant Backdrop Blur with physical aperture cutout */}
      {hasTargetRect && (
        <>
          {/* Top panel */}
          <div
            data-testid="spotlight-top"
            className="fixed z-[9998] pointer-events-auto"
            style={{
              top: 0,
              left: 0,
              width: '100vw',
              height: `${cutoutTop}px`,
              backgroundColor: BACKDROP_BG,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          />

          {/* Bottom panel */}
          <div
            data-testid="spotlight-bottom"
            className="fixed z-[9998] pointer-events-auto"
            style={{
              top: `${cutoutBottom}px`,
              left: 0,
              width: '100vw',
              bottom: 0,
              backgroundColor: BACKDROP_BG,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          />

          {/* Left panel */}
          <div
            data-testid="spotlight-left"
            className="fixed z-[9998] pointer-events-auto"
            style={{
              top: `${cutoutTop}px`,
              left: 0,
              width: `${cutoutLeft}px`,
              height: `${cutoutHeight}px`,
              backgroundColor: BACKDROP_BG,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          />

          {/* Right panel */}
          <div
            data-testid="spotlight-right"
            className="fixed z-[9998] pointer-events-auto"
            style={{
              top: `${cutoutTop}px`,
              left: `${cutoutRight}px`,
              right: 0,
              height: `${cutoutHeight}px`,
              backgroundColor: BACKDROP_BG,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          />

          {/* 4 Corner Patches for smooth 16px rounded cutout corners */}
          <svg
            className="fixed pointer-events-none"
            style={{ top: cutoutTop, left: cutoutLeft, width: 16, height: 16, zIndex: 9998 }}
          >
            <path d="M 0 0 H 16 A 16 16 0 0 0 0 16 Z" fill={BACKDROP_BG} />
          </svg>
          <svg
            className="fixed pointer-events-none"
            style={{
              top: cutoutTop,
              left: Math.max(0, cutoutRight - 16),
              width: 16,
              height: 16,
              zIndex: 9998,
            }}
          >
            <path d="M 16 0 H 0 A 16 16 0 0 1 16 16 Z" fill={BACKDROP_BG} />
          </svg>
          <svg
            className="fixed pointer-events-none"
            style={{
              top: Math.max(0, cutoutBottom - 16),
              left: cutoutLeft,
              width: 16,
              height: 16,
              zIndex: 9998,
            }}
          >
            <path d="M 0 16 H 16 A 16 16 0 0 1 0 0 Z" fill={BACKDROP_BG} />
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
            <path d="M 16 16 H 0 A 16 16 0 0 0 16 0 Z" fill={BACKDROP_BG} />
          </svg>

          {/* Glowing Aperture Ring snugly framing target nodes with 16px balanced padding */}
          <div
            className="fixed z-[9998] pointer-events-none rounded-2xl"
            style={{
              top: `${cutoutTop}px`,
              left: `${cutoutLeft}px`,
              width: `${cutoutWidth}px`,
              height: `${cutoutHeight}px`,
              border: '1.5px solid var(--zen-accent)',
              boxShadow: '0 0 24px rgba(79, 191, 103, 0.25)',
              borderRadius: '16px',
            }}
          />
        </>
      )}

      {/* Tooltip Card with theme-native surface colors and elevation */}
      <div
        ref={tooltipRef}
        data-testid="onboarding-tooltip-card"
        style={{
          position: 'fixed',
          top: `${tooltipTop}px`,
          left: `${tooltipLeft}px`,
          width: '420px',
          maxWidth: `calc(100vw - ${EDGE_PADDING * 2}px)`,
          maxHeight: `calc(100vh - ${EDGE_PADDING * 2}px)`,
          overflowY: 'auto',
          zIndex: 9999,
          backgroundColor: 'var(--zen-surface)',
          color: 'var(--zen-text)',
          border: '1px solid var(--zen-border)',
          borderRadius: '24px',
          boxShadow: 'var(--zen-shadow-modal)',
          padding: '24px',
        }}
        className="pointer-events-auto transform transition-all duration-150"
      >
        {/* Pointer Arrow */}
        {showArrow && placement === 'bottom' && (
          <>
            <div
              data-testid="onboarding-arrow-up"
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
        {showArrow && placement === 'top' && (
          <>
            <div
              data-testid="onboarding-arrow-down"
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

        {/* Step Badge */}
        <div className="flex items-center justify-between mb-2">
          <span
            data-testid="onboarding-step-badge"
            style={{
              backgroundColor: 'rgba(79, 191, 103, 0.15)',
              color: 'var(--zen-accent)',
              border: '1px solid rgba(79, 191, 103, 0.3)',
            }}
            className="text-[11px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
          >
            {currentStep === 1 && (en.onboarding?.steps?.step1?.badge ?? 'Step 1: Intelligence Sources')}
            {currentStep === 2 && (en.onboarding?.steps?.step2?.badge ?? 'Step 2: Agentic Harnesses')}
            {currentStep === 3 && (en.onboarding?.steps?.step3?.badge ?? 'Step 3: The FrugaLLM Bridge')}
            {currentStep === 4 && (en.onboarding?.steps?.step4?.badge ?? 'Step 4: Connect Intelligence')}
            {currentStep === 5 && (en.onboarding?.steps?.step5?.badge ?? 'Step 5: Deploy a Harness')}
            {currentStep === 6 && (en.onboarding?.steps?.step6?.badge ?? 'Setup Complete')}
          </span>
          <span style={{ color: 'var(--zen-text-secondary)' }} className="text-xs font-medium">
            {currentStep} / 6
          </span>
        </div>

        {/* STEP 1: Intelligence Sources */}
        {currentStep === 1 && (
          <div data-testid="onboarding-step-1">
            <h3 style={{ color: 'var(--zen-text)' }} className="text-xl font-bold mb-2 tracking-tight">
              {en.onboarding?.steps?.step1?.title ?? 'Where the Brains Live'}
            </h3>
            <p style={{ color: 'var(--zen-text-secondary)' }} className="text-sm mb-4 leading-relaxed">
              {en.onboarding?.steps?.step1?.desc ??
                'At the top are your AI models. You can run 100% private models locally on your hardware via Ollama, or connect generous free cloud tiers from Google AI Studio and OpenRouter.'}
            </p>
            <div
              data-testid="ram-warning-box"
              style={{
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                borderColor: 'var(--zen-border)',
                color: 'var(--zen-text)',
              }}
              className="p-3 rounded-2xl border flex items-start gap-2.5 text-xs"
            >
              <span className="text-base leading-none">⚡</span>
              <p className="leading-snug" style={{ color: 'var(--zen-text)', fontWeight: 500 }}>
                {en.onboarding?.steps?.step1?.ramWarning?.replace('{{ram}}', detectedRamDisplay) ??
                  `Detected: ${detectedRamDisplay} GB RAM. Local models are private and work offline, but cloud models run faster and are more intelligent.`}
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: Agentic Harnesses */}
        {currentStep === 2 && (
          <div data-testid="onboarding-step-2">
            <h3 style={{ color: 'var(--zen-text)' }} className="text-xl font-bold mb-2 tracking-tight">
              {en.onboarding?.steps?.step2?.title ?? 'Giving the AI Hands'}
            </h3>
            <p style={{ color: 'var(--zen-text-secondary)' }} className="text-sm mb-4 leading-relaxed">
              {en.onboarding?.steps?.step2?.desc ??
                'Out of the box, models only talk. Harnesses give them hands to build apps, edit files, and automate tasks. Open Code specializes in building full software projects, while Hermes acts as your autonomous digital butler.'}
            </p>
            <div
              data-testid="safety-note-box"
              style={{
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(254, 243, 199, 0.85)',
                borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(217, 119, 6, 0.45)',
                color: isDark ? '#FCD34D' : '#92400E',
              }}
              className="p-3 rounded-2xl border flex items-start gap-2.5 text-xs leading-relaxed"
            >
              <span className="text-base leading-none">🛡️</span>
              <p style={{ color: isDark ? '#FCD34D' : '#92400E', fontWeight: 500 }}>
                {en.onboarding?.steps?.step2?.safetyNote ??
                  "The AI has hands, but you're the boss. Both tools ask for your permission before modifying files or running commands. You can always reply: 'Explain what that does before I agree.'"}
              </p>
            </div>
          </div>
        )}

        {/* STEP 3: The FrugaLLM Bridge (Ephemeral Simulation & Node Alias) */}
        {currentStep === 3 && (
          <div data-testid="onboarding-step-3">
            <h3 style={{ color: 'var(--zen-text)' }} className="text-xl font-bold mb-2 tracking-tight">
              {en.onboarding?.steps?.step3?.title ?? 'Smart Routing & Cost Shield'}
            </h3>
            <p style={{ color: 'var(--zen-text-secondary)' }} className="text-sm mb-3 leading-relaxed">
              {en.onboarding?.steps?.step3?.desc ??
                'FrugaLLM sits in the center, routing harness tasks through the smartest available free models. When free tiers hit per-minute limits, it automatically cascades to the next best model so your agent never crashes.'}
            </p>

            {/* FrugaLLM Node Alias Card */}
            <div
              data-testid="frugallm-node-alias"
              style={{
                backgroundColor: 'var(--zen-surface)',
                borderColor: 'var(--zen-border)',
                boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.35)' : '0 2px 10px rgba(0, 0, 0, 0.06)',
              }}
              className="rounded-2xl border overflow-hidden mb-2.5"
            >
              {/* Alias Node Header */}
              <div
                style={{
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'var(--zen-surface-header)',
                  color: 'var(--zen-text)',
                }}
                className="px-3.5 py-2 flex items-center justify-between border-b border-zen-border/40"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-zen-accent/15 flex items-center justify-center text-zen-accent">
                    <FrugaLLMIcon size={14} fill="currentColor" />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="font-semibold text-xs text-zen-text tracking-wide">
                      {en.onboarding?.steps?.step3?.aliasHeader ?? 'FrugaLLM'}
                    </span>
                    <span className="text-[10px] text-zen-text-secondary">
                      {en.onboarding?.steps?.step3?.aliasSubheader ?? 'Smart Router & Cost Shield'}
                    </span>
                  </div>
                </div>

                <span
                  style={{
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                    color: isDark ? '#34D399' : '#047857',
                    borderColor: isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.3)',
                  }}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {en.onboarding?.steps?.step3?.aliasHubOnline ?? 'HUB ONLINE'}
                </span>
              </div>

              {/* Alias Node Body */}
              <div className="p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--zen-text-secondary)' }} className="text-[11px] font-medium">
                    {en.routingGraph?.frugallmNode?.sessionTokens ?? 'Session tokens:'}
                  </span>
                  <span
                    data-testid="simulated-tokens"
                    style={{ color: 'var(--zen-text)' }}
                    className="font-mono font-semibold text-xs"
                  >
                    {simulatedTokens.toLocaleString('en-US')}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--zen-text-secondary)' }} className="text-[11px] font-medium">
                    {en.routingGraph?.frugallmNode?.totalTokens ?? 'Total tokens:'}
                  </span>
                  <span
                    data-testid="simulated-total-tokens"
                    style={{ color: 'var(--zen-text)' }}
                    className="font-mono font-semibold text-xs"
                  >
                    {simulatedTokens.toLocaleString('en-US')}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-zen-border/30">
                  <span style={{ color: 'var(--zen-text-secondary)' }} className="text-[11px] font-medium">
                    {en.routingGraph?.frugallmNode?.moneySaved ?? '$ Saved:'}
                  </span>
                  <span
                    data-testid="simulated-saved-pill"
                    style={{
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                      color: isDark ? '#34D399' : '#047857',
                    }}
                    className="px-2 py-0.5 rounded-full font-semibold text-[11px] font-mono animate-pulse"
                  >
                    +${simulatedSavedDisplay} Saved
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Token Flow Slider */}
            <div
              style={{
                backgroundColor: 'var(--zen-surface-hover)',
                borderColor: 'var(--zen-border)',
              }}
              className="p-3 rounded-2xl border mb-3 space-y-2"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span style={{ color: 'var(--zen-text-secondary)' }} className="font-medium">
                  {en.onboarding?.steps?.step3?.sliderLabel ?? 'Simulate Token Flow:'}
                </span>
                <span
                  style={{ color: 'var(--zen-accent)' }}
                  className="font-mono font-semibold text-xs"
                >
                  {simulatedTokens.toLocaleString('en-US')} tokens
                </span>
              </div>

              <input
                type="range"
                data-testid="token-flow-slider"
                aria-label="Token Flow Simulation Slider"
                min="0"
                max="1000"
                value={Math.round(tokensToSlider(simulatedTokens) * 1000)}
                onChange={(e) => {
                  const val = Number(e.target.value) / 1000;
                  setSimulatedTokens(sliderToTokens(val));
                }}
                className="w-full h-1.5 bg-zen-border rounded-lg appearance-none cursor-pointer accent-zen-accent"
              />

              <div className="flex items-center justify-between text-[10px] text-zen-text-secondary font-medium">
                <span>{en.onboarding?.steps?.step3?.sliderMin ?? "Just Vibin'"}</span>
                <span>{en.onboarding?.steps?.step3?.sliderMax ?? 'The Tokens must Flow'}</span>
              </div>
            </div>

            <div style={{ color: 'var(--zen-text-secondary)' }} className="space-y-1 text-[11px] leading-snug">
              <p>💡 {en.onboarding?.steps?.step3?.rateLimitTip}</p>
              <p className="text-[10px] opacity-75">
                {en.onboarding?.steps?.step3?.sonnetBaseline ?? 'Estimated savings based on Anthropic Sonnet pricing ($3/M input, $15/M output tokens).'}
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: Connect Intelligence */}
        {currentStep === 4 && (
          <div data-testid="onboarding-step-4" className="space-y-3">
            <div>
              <h3 style={{ color: 'var(--zen-text)' }} className="text-xl font-bold mb-1 tracking-tight">
                {en.onboarding?.steps?.step4?.title ?? 'Add a Free Cloud Key'}
              </h3>
              <p style={{ color: 'var(--zen-text-secondary)' }} className="text-xs leading-relaxed">
                {en.onboarding?.steps?.step4?.desc ??
                  'Free tiers trade data for intelligence. Providers log your requests to train future models—blending your prompts into massive, aggregated datasets to keep it theoretically anonymous. Paste a key below for maximum speed and smarts at zero dollar cost, or choose local models for total privacy.'}
              </p>
            </div>

            {keyError && (
              <div className="text-xs text-red-400 p-2 rounded-xl bg-red-500/10 border border-red-500/30">
                {keyError}
              </div>
            )}

            {/* Google Key Input */}
            {!googleSaved && (
              <div
                data-testid="box-google-key"
                style={{
                  backgroundColor: 'var(--zen-surface-hover)',
                  borderColor: 'var(--zen-border)',
                }}
                className="p-3 rounded-2xl border space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <label style={{ color: 'var(--zen-text)' }} className="text-xs font-semibold flex items-center gap-1.5">
                    <span>{en.onboarding?.steps?.step4?.googleLabel ?? 'Google AI Studio'}</span>
                  </label>
                  <a
                    href="https://aistudio.google.com/"
                    onClick={(e) => {
                      e.preventDefault();
                      handleOpenLink('https://aistudio.google.com/');
                    }}
                    style={{ color: 'var(--zen-accent)' }}
                    className="text-[11px] hover:underline cursor-pointer font-medium bg-transparent border-none p-0 inline-flex items-center gap-0.5"
                  >
                    <span>{en.onboarding?.steps?.step4?.getKeyGoogle ?? 'Get Free Key (ai.dev)'}</span>
                    <span>↗</span>
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    data-testid="input-google-key"
                    value={googleKey}
                    onChange={(e) => {
                      setGoogleKey(e.target.value);
                      setKeyError(null);
                    }}
                    placeholder={en.onboarding?.steps?.step4?.googleKeyPlaceholder ?? 'Paste Google AI Studio key (AIzaSy...)'}
                    style={{
                      backgroundColor: 'var(--zen-surface)',
                      color: 'var(--zen-text)',
                      borderColor: 'var(--zen-border-input)',
                    }}
                    className="flex-1 text-xs px-3 py-1.5 rounded-xl border focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    data-testid="btn-save-google-key"
                    onClick={handleSaveGoogleKey}
                    disabled={savingGoogle || !googleKey.trim()}
                    style={{
                      backgroundColor: 'var(--zen-accent)',
                      color: '#FFFFFF',
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
                  >
                    {savingGoogle ? (en.onboarding?.steps?.step4?.saving ?? 'Saving...') : (en.onboarding?.steps?.step4?.saveKey ?? 'Save')}
                  </button>
                </div>
                {(googleKey.trim().startsWith('sk-or-') || googleKey.trim().startsWith('sk-')) && (
                  <div data-testid="google-key-mismatch-warning" className="text-[11px] text-amber-500 font-medium pt-0.5">
                    ⚠️ {en.onboarding?.steps?.step4?.errorMismatchedOpenRouter ?? 'This looks like an OpenRouter key. Please paste it into the OpenRouter box below.'}
                  </div>
                )}
              </div>
            )}

            {/* OpenRouter Key Input */}
            {!openrouterSaved && (
              <div
                data-testid="box-openrouter-key"
                style={{
                  backgroundColor: 'var(--zen-surface-hover)',
                  borderColor: 'var(--zen-border)',
                }}
                className="p-3 rounded-2xl border space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <label style={{ color: 'var(--zen-text)' }} className="text-xs font-semibold flex items-center gap-1.5">
                    <span>{en.onboarding?.steps?.step4?.openrouterLabel ?? 'OpenRouter'}</span>
                  </label>
                  <a
                    href="https://openrouter.ai/"
                    onClick={(e) => {
                      e.preventDefault();
                      handleOpenLink('https://openrouter.ai/');
                    }}
                    style={{ color: 'var(--zen-accent)' }}
                    className="text-[11px] hover:underline cursor-pointer font-medium bg-transparent border-none p-0 inline-flex items-center gap-0.5"
                  >
                    <span>{en.onboarding?.steps?.step4?.getKeyOpenRouter ?? 'Get Free Key (openrouter.ai)'}</span>
                    <span>↗</span>
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    data-testid="input-openrouter-key"
                    value={openrouterKey}
                    onChange={(e) => {
                      setOpenrouterKey(e.target.value);
                      setKeyError(null);
                    }}
                    placeholder={en.onboarding?.steps?.step4?.openrouterKeyPlaceholder ?? 'Paste OpenRouter key (sk-or-...)'}
                    style={{
                      backgroundColor: 'var(--zen-surface)',
                      color: 'var(--zen-text)',
                      borderColor: 'var(--zen-border-input)',
                    }}
                    className="flex-1 text-xs px-3 py-1.5 rounded-xl border focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    data-testid="btn-save-openrouter-key"
                    onClick={handleSaveOpenRouterKey}
                    disabled={savingOpenrouter || !openrouterKey.trim()}
                    style={{
                      backgroundColor: 'var(--zen-accent)',
                      color: '#FFFFFF',
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
                  >
                    {savingOpenrouter ? (en.onboarding?.steps?.step4?.saving ?? 'Saving...') : (en.onboarding?.steps?.step4?.saveKey ?? 'Save')}
                  </button>
                </div>
                {openrouterKey.trim().startsWith('AIza') && (
                  <div data-testid="openrouter-key-mismatch-warning" className="text-[11px] text-amber-500 font-medium pt-0.5">
                    ⚠️ {en.onboarding?.steps?.step4?.errorMismatchedGoogle ?? 'This looks like a Google AI Studio key. Please paste it into the Google AI Studio box above.'}
                  </div>
                )}
              </div>
            )}

            {/* Success state when both keys configured */}
            {googleSaved && openrouterSaved && (
              <div
                data-testid="onboarding-all-keys-saved"
                style={{
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(236, 253, 245, 0.9)',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.4)',
                  color: isDark ? '#34D399' : '#047857',
                }}
                className="p-3.5 rounded-2xl border flex items-center gap-3 text-xs font-medium"
              >
                <span className="text-lg">✓</span>
                <span>{en.onboarding?.steps?.step4?.sourcesReady ?? 'Both intelligence sources configured and ready to route!'}</span>
              </div>
            )}
          </div>
        )}

        {/* STEP 5: Deploy a Harness */}
        {currentStep === 5 && (
          <div data-testid="onboarding-step-5" className="space-y-3">
            <div>
              <h3 style={{ color: 'var(--zen-text)' }} className="text-xl font-bold mb-1 tracking-tight">
                {en.onboarding?.steps?.step5?.title ?? 'Install Your First Tool'}
              </h3>
              <p style={{ color: 'var(--zen-text-secondary)' }} className="text-xs leading-relaxed">
                {en.onboarding?.steps?.step5?.desc ??
                  'Coding harnesses are the engine. We recommend starting with Open Code for building software projects.'}
              </p>
            </div>

            {installError && (
              <div className="text-xs text-red-400 p-2 rounded-xl bg-red-500/10 border border-red-500/30">
                {installError}
              </div>
            )}

            {/* Open Code Card */}
            <div
              style={{
                backgroundColor: 'var(--zen-surface-hover)',
                borderColor: 'var(--zen-border)',
              }}
              className="p-3 rounded-2xl border flex items-center justify-between"
            >
              <div>
                <div style={{ color: 'var(--zen-text)' }} className="text-xs font-semibold">
                  Open Code
                </div>
                <div style={{ color: 'var(--zen-text-secondary)' }} className="text-[11px]">
                  {en.onboarding?.steps?.step5?.opencodeSubtitle ?? 'Full project builder'}
                </div>
              </div>
              {effectiveIsOpenCodeInstalled ? (
                <span
                  data-testid="badge-opencode-ready"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    color: '#34D399',
                  }}
                  className="text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1"
                >
                  ✓ Ready
                </span>
              ) : (
                <button
                  type="button"
                  data-testid="btn-install-opencode"
                  onClick={onInstallOpenCode ? onInstallOpenCode : handleInstallOpenCode}
                  disabled={installingOpenCode}
                  style={{
                    backgroundColor: 'var(--zen-accent)',
                    color: '#FFFFFF',
                  }}
                  className="px-3 py-1 text-xs font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
                >
                  {installingOpenCode
                    ? (en.onboarding?.steps?.step5?.installing ?? 'Installing...')
                    : (en.onboarding?.steps?.step5?.installBtn ?? 'Install (1-Click)')}
                </button>
              )}
            </div>

            {/* Hermes Card */}
            <div
              style={{
                backgroundColor: 'var(--zen-surface-hover)',
                borderColor: 'var(--zen-border)',
              }}
              className="p-3 rounded-2xl border flex items-center justify-between"
            >
              <div>
                <div style={{ color: 'var(--zen-text)' }} className="text-xs font-semibold">
                  Hermes
                </div>
                <div style={{ color: 'var(--zen-text-secondary)' }} className="text-[11px]">
                  {en.onboarding?.steps?.step5?.hermesSubtitle ?? 'Autonomous digital butler'}
                </div>
              </div>
              {effectiveIsHermesInstalled ? (
                <span
                  data-testid="badge-hermes-ready"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    color: '#34D399',
                  }}
                  className="text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1"
                >
                  ✓ Ready
                </span>
              ) : (
                <button
                  type="button"
                  data-testid="btn-install-hermes"
                  onClick={onInstallHermes ? onInstallHermes : handleInstallHermes}
                  disabled={installingHermes}
                  style={{
                    backgroundColor: 'var(--zen-accent)',
                    color: '#FFFFFF',
                  }}
                  className="px-3 py-1 text-xs font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
                >
                  {installingHermes
                    ? (en.onboarding?.steps?.step5?.installing ?? 'Installing...')
                    : (en.onboarding?.steps?.step5?.installBtn ?? 'Install (1-Click)')}
                </button>
              )}
            </div>

            {/* The Golden Rule Callout */}
            <div
              data-testid="golden-rule-box"
              style={{
                backgroundColor: isDark ? 'rgba(79, 191, 103, 0.12)' : 'rgba(236, 253, 245, 0.85)',
                borderColor: isDark ? 'rgba(79, 191, 103, 0.35)' : 'rgba(16, 185, 129, 0.4)',
                color: isDark ? '#34D399' : '#14532D',
              }}
              className="p-3 rounded-2xl border flex items-start gap-2.5 text-xs leading-relaxed"
            >
              <span className="text-base leading-none">💡</span>
              <p
                style={{ color: isDark ? '#34D399' : '#14532D', fontWeight: 500 }}
                className="text-xs leading-relaxed"
              >
                {en.onboarding?.steps?.step5?.goldenRule ??
                  'The Golden Rule: Your agent should almost never need your password. Writing code, installing project packages, and running local apps should all happen safely inside your project folder. If the agent asks for your Mac or Windows password, hit pause. Ask it to explain what it is installing before you even think about approving it.'}
              </p>
            </div>
          </div>
        )}

        {/* STEP 6: Setup Complete */}
        {currentStep === 6 && (
          <div data-testid="onboarding-step-6" className="space-y-3">
            <div>
              <h3 style={{ color: 'var(--zen-text)' }} className="text-xl font-bold mb-1 tracking-tight">
                {en.onboarding?.steps?.step6?.title ?? 'Ready to Vibe Code'}
              </h3>
              <p style={{ color: 'var(--zen-text-secondary)' }} className="text-xs leading-relaxed">
                {en.onboarding?.steps?.step6?.desc ??
                  'Your environment is configured. Run your harness terminal commands below or explore recommended projects.'}
              </p>
            </div>

            <div
              style={{
                backgroundColor: 'var(--zen-surface-hover)',
                borderColor: 'var(--zen-border)',
              }}
              className="p-3.5 rounded-2xl border space-y-2 text-xs"
            >
              <div style={{ color: 'var(--zen-text)' }} className="font-semibold mb-1">
                {en.onboarding?.steps?.step6?.whatsNextTitle ?? 'Recommended Next Steps:'}
              </div>
              <button
                type="button"
                onClick={() => handleOpenLink('https://github.com/chorned/frugallm-app#top-10')}
                style={{ color: 'var(--zen-text)' }}
                className="w-full flex items-center justify-between hover:opacity-80 py-1 cursor-pointer transition-opacity"
              >
                <span>🚀 {en.onboarding?.steps?.step6?.top10Link ?? 'Top 10 Things to Build'}</span>
                <span>↗</span>
              </button>
              <div style={{ backgroundColor: 'var(--zen-border)' }} className="h-px" />
              <button
                type="button"
                data-testid="onboarding-report-bug-btn"
                onClick={() => {
                  if (onOpenIssueReporter) {
                    onOpenIssueReporter();
                  } else {
                    handleOpenLink('https://github.com/chorned/frugallm-app/issues');
                  }
                }}
                style={{ color: 'var(--zen-text)' }}
                className="w-full flex items-center justify-between hover:opacity-80 py-1 cursor-pointer transition-opacity"
              >
                <span className="flex items-center gap-1.5">
                  <span>💬</span>
                  <span>{en.header?.reportIssue ?? en.onboarding?.steps?.step6?.reportIssues ?? 'Report Issue'}</span>
                </span>
                <span>↗</span>
              </button>
            </div>
          </div>
        )}

        {/* Tooltip Navigation Footer */}
        <div
          style={{ borderColor: 'var(--zen-border)' }}
          className="mt-5 pt-3 border-t flex items-center justify-between"
        >
          <button
            type="button"
            data-testid="onboarding-skip-tour-btn"
            onClick={onComplete}
            style={{
              backgroundColor: 'var(--zen-surface-hover)',
              color: isDark ? 'var(--zen-text-secondary)' : '#4B5563',
              borderColor: 'var(--zen-border)',
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-full border hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          >
            {en.onboarding?.nav?.skip ?? 'Skip Tour'}
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <button
                type="button"
                data-testid="onboarding-prev-btn"
                onClick={onPrev}
                style={{
                  backgroundColor: 'var(--zen-surface-hover)',
                  color: 'var(--zen-text)',
                  borderColor: 'var(--zen-border)',
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-full border hover:opacity-90 transition-opacity cursor-pointer"
              >
                {en.onboarding?.nav?.back ?? 'Back'}
              </button>
            )}

            {currentStep < 6 ? (
              <button
                type="button"
                data-testid="onboarding-next-btn"
                onClick={onNext}
                style={{
                  backgroundColor: 'var(--zen-accent)',
                  color: '#FFFFFF',
                }}
                className="px-4 py-1.5 text-xs font-semibold rounded-full transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer shadow-sm"
              >
                {en.onboarding?.nav?.next ?? 'Next'}
              </button>
            ) : (
              <button
                type="button"
                data-testid="onboarding-finish-btn"
                onClick={onComplete}
                style={{
                  backgroundColor: 'var(--zen-accent)',
                  color: '#FFFFFF',
                }}
                className="px-5 py-1.5 text-xs font-semibold rounded-full transition-all hover:opacity-90 shadow-sm active:scale-[0.98] cursor-pointer"
              >
                {en.onboarding?.steps?.step6?.finishBtn ?? 'Launch Workspace'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
