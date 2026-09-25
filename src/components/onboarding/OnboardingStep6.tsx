import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { detectPlatformOS, getPasteShortcut, getStarterPrompt } from '../../utils/starterPrompts';
import { copyToClipboard } from '../../utils/clipboard';
import { useTheme } from '../../hooks/useTheme';
import en from '../../locales/en.json';

export interface OnboardingStep6Props {
  hasProvider?: boolean;
  harnessStatus?: {
    opencode: boolean;
    hermes: boolean;
  };
  onGoToProviderStep?: () => void;
  onGoToInstallStep?: () => void;
  onLaunch?: (agent: 'opencode' | 'hermes', prompt: string) => Promise<void>;
  onBack?: () => void;
  onComplete?: () => void;
  // Compatibility & optional fallback props
  isHermesInstalled?: boolean;
  isOpenCodeInstalled?: boolean;
  isOllamaInstalled?: boolean;
  hasSourceLinked?: boolean;
  isProviderConfigured?: boolean;
  isDark?: boolean;
  showNavigationFooter?: boolean;
  showBadgeAndHeader?: boolean;
}

export const OnboardingStep6: React.FC<OnboardingStep6Props> = ({
  hasProvider: propHasProvider,
  harnessStatus,
  onGoToProviderStep,
  onGoToInstallStep,
  onLaunch,
  onBack,
  onComplete,
  isHermesInstalled: propIsHermesInstalled,
  isOpenCodeInstalled: propIsOpenCodeInstalled,
  isOllamaInstalled: propIsOllamaInstalled,
  hasSourceLinked: propHasSourceLinked,
  isProviderConfigured: propIsProviderConfigured,
  isDark: propIsDark,
  showNavigationFooter = true,
  showBadgeAndHeader = true,
}) => {
  const { isDark: themeIsDark } = useTheme();
  const isDark = propIsDark ?? themeIsDark;

  const [launchingCompanion, setLaunchingCompanion] = useState<'opencode' | 'hermes' | null>(null);
  const [hasLaunchedCompanion, setHasLaunchedCompanion] = useState(false);

  const effectiveIsOpenCodeInstalled =
    harnessStatus?.opencode ?? propIsOpenCodeInstalled ?? false;
  const effectiveIsHermesInstalled =
    harnessStatus?.hermes ?? propIsHermesInstalled ?? false;
  const effectiveHasProvider = Boolean(
    propHasProvider ??
    propIsProviderConfigured ??
    propHasSourceLinked ??
    propIsOllamaInstalled ??
    false
  );
  const hasAnyHarness = effectiveIsOpenCodeInstalled || effectiveIsHermesInstalled;

  const handleLaunchCompanion = async (tool: 'opencode' | 'hermes') => {
    setHasLaunchedCompanion(true);
    const os = detectPlatformOS();
    const prompt = getStarterPrompt(tool, os);

    if (onLaunch) {
      setLaunchingCompanion(tool);
      try {
        await onLaunch(tool, prompt);
      } finally {
        setTimeout(() => {
          setLaunchingCompanion((prev) => (prev === tool ? null : prev));
        }, 2500);
      }
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(prompt);
      } else {
        await copyToClipboard(prompt);
      }
    } catch (err) {
      try {
        await copyToClipboard(prompt);
      } catch (clipErr) {
        console.warn('Failed to copy starter prompt to clipboard:', clipErr);
      }
    }

    setLaunchingCompanion(tool);
    try {
      await invoke('launch_companion_terminal', { companion: tool });
    } catch (err) {
      console.error('Failed to launch companion terminal:', err);
    }

    setTimeout(() => {
      setLaunchingCompanion((prev) => (prev === tool ? null : prev));
    }, 2500);
  };

  return (
    <div data-testid="onboarding-step-6" className="space-y-3">
      {/* Optional Top Badge and Step Counter for standalone usage */}
      {showBadgeAndHeader && (
        <div className="flex items-center justify-between mb-2">
          <span
            data-testid="onboarding-step-badge"
            style={
              !effectiveHasProvider
                ? {
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(254, 243, 199, 0.85)',
                    color: isDark ? '#FBBF24' : '#D97706',
                    border: isDark ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(217, 119, 6, 0.3)',
                  }
                : !hasAnyHarness
                ? {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                    color: 'var(--zen-text-secondary)',
                    border: '1px solid var(--zen-border)',
                  }
                : {
                    backgroundColor: 'rgba(79, 191, 103, 0.15)',
                    color: 'var(--zen-accent)',
                    border: '1px solid rgba(79, 191, 103, 0.3)',
                  }
            }
            className="text-[11px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full"
          >
            {!effectiveHasProvider
              ? (en.onboarding?.steps?.step6?.badgeNoProvider ?? 'Setup Incomplete')
              : !hasAnyHarness
              ? (en.onboarding?.steps?.step6?.badgeNoHarness ?? 'No Harness Linked')
              : (en.onboarding?.steps?.step6?.badge ?? 'Setup Complete')}
          </span>
          <span style={{ color: 'var(--zen-text-secondary)' }} className="text-xs font-medium">
            6 / 6
          </span>
        </div>
      )}

      {/* Header (Title & Subtitle) */}
      <div>
        <h3 style={{ color: 'var(--zen-text)' }} className="text-xl font-bold mb-1 tracking-tight">
          {!effectiveHasProvider
            ? (en.onboarding?.steps?.step6?.titleNoProvider ?? 'One Last Step: Connect a Brain')
            : !hasAnyHarness
            ? (en.onboarding?.steps?.step6?.titleNoHarness ?? 'AI Proxy is Ready')
            : (en.onboarding?.steps?.step6?.title ?? 'Ready to Build')}
        </h3>
        <p style={{ color: 'var(--zen-text-secondary)' }} className="text-xs leading-relaxed">
          {!effectiveHasProvider
            ? (en.onboarding?.steps?.step6?.descNoProvider ??
                'Your agent companions are ready, but they need an intelligence source to execute instructions.')
            : !hasAnyHarness
            ? (en.onboarding?.steps?.step6?.descNoHarness ??
                'FrugaLLM is serving its OpenAI endpoint, but neither agent binary was detected on your system path.')
            : (en.onboarding?.steps?.step6?.desc ??
                'Your environment is configured. Launch a companion with an optimized starter prompt below, or proceed to the visual canvas.')}
        </p>
      </div>

      {/* Center Section */}
      {!effectiveHasProvider ? (
        /* State 1: Consolidated Resolution Card (Option A) */
        <div
          data-testid="card-consolidated-provider-blocker"
          onClick={onGoToProviderStep}
          style={{
            backgroundColor: 'var(--zen-surface-hover)',
            borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(217, 119, 6, 0.35)',
          }}
          className="p-4 rounded-2xl border flex items-center justify-between gap-4 cursor-pointer hover:border-amber-500/70 transition-colors shadow-sm"
        >
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              style={{
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(254, 243, 199, 0.9)',
                borderColor: isDark ? 'rgba(245, 158, 11, 0.4)' : 'rgba(217, 119, 6, 0.3)',
                color: isDark ? '#FBBF24' : '#D97706',
              }}
              className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 text-lg shadow-sm"
            >
              🔑
            </div>
            <div className="min-w-0 flex-1">
              <h4 style={{ color: 'var(--zen-text)' }} className="text-sm font-bold tracking-tight">
                {en.onboarding?.steps?.step6?.consolidatedHeading ?? 'Activate Your Agents'}
              </h4>
              <p style={{ color: 'var(--zen-text-secondary)' }} className="text-xs leading-relaxed mt-1">
                {en.onboarding?.steps?.step6?.consolidatedBody ??
                  'Connect a free Google AI Studio key (no credit card required) or link a local Ollama instance to power OpenCode and Hermes.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="btn-connect-provider"
            onClick={(e) => {
              e.stopPropagation();
              onGoToProviderStep?.();
            }}
            style={{
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.15)',
              color: isDark ? '#FCD34D' : '#92400E',
              border: isDark ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(217, 119, 6, 0.35)',
            }}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl hover:opacity-90 cursor-pointer transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
          >
            <span>🔑</span>
            <span>{en.onboarding?.steps?.step6?.connectProviderBtn ?? 'Connect Provider'}</span>
          </button>
        </div>
      ) : (
        /* State 2 & 3: Companion Cards (OpenCode & Hermes) */
        <div className="space-y-3">
          {/* OpenCode Card */}
          <div
            data-testid="card-launch-opencode"
            onClick={() => {
              if (!effectiveIsOpenCodeInstalled) {
                onGoToInstallStep?.();
              } else {
                handleLaunchCompanion('opencode');
              }
            }}
            style={{
              backgroundColor: 'var(--zen-surface-hover)',
              borderColor: 'var(--zen-border)',
            }}
            className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
              !effectiveIsOpenCodeInstalled
                ? 'hover:border-emerald-500/50 opacity-80 hover:opacity-100'
                : 'hover:border-emerald-500/50'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--zen-text)' }} className="text-xs font-semibold">
                  {en.onboarding?.steps?.step6?.opencodeTitle ?? 'Open Code'}
                </span>
                <span
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#34D399',
                  }}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                >
                  {en.onboarding?.steps?.step6?.opencodeSubtitle ?? 'Full project builder'}
                </span>
              </div>
              <div
                style={{
                  color: 'var(--zen-text-secondary)',
                  backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.04)',
                  borderColor: 'var(--zen-border)',
                }}
                className="text-[11px] font-mono mt-1 px-2 py-0.5 rounded-lg border truncate"
                title={getStarterPrompt('opencode', detectPlatformOS())}
              >
                {en.onboarding?.steps?.step6?.opencodePreview ?? 'Scaffold neon matrix canvas & launch http://localhost:8001'}
              </div>
            </div>
            {!effectiveIsOpenCodeInstalled ? (
              <button
                type="button"
                data-testid="btn-install-opencode"
                onClick={(e) => {
                  e.stopPropagation();
                  onGoToInstallStep?.();
                }}
                style={{
                  backgroundColor: 'var(--zen-surface-hover)',
                  color: 'var(--zen-text)',
                  borderColor: 'var(--zen-border)',
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border hover:opacity-90 cursor-pointer transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
              >
                <span>⬇️</span>
                <span>{en.onboarding?.steps?.step6?.installBtn ?? 'Install'}</span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="btn-launch-opencode"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLaunchCompanion('opencode');
                }}
                disabled={launchingCompanion === 'opencode'}
                style={{
                  backgroundColor: 'var(--zen-accent)',
                  color: '#FFFFFF',
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl hover:opacity-90 disabled:opacity-75 cursor-pointer transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
              >
                {launchingCompanion === 'opencode' ? (
                  <span>{en.onboarding?.steps?.step6?.launchingBtn ?? '✓ Copied & Launching...'}</span>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>{en.onboarding?.steps?.step6?.launchBtn ?? 'Launch'}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Hermes Card */}
          <div
            data-testid="card-launch-hermes"
            onClick={() => {
              if (!effectiveIsHermesInstalled) {
                onGoToInstallStep?.();
              } else {
                handleLaunchCompanion('hermes');
              }
            }}
            style={{
              backgroundColor: 'var(--zen-surface-hover)',
              borderColor: 'var(--zen-border)',
            }}
            className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
              !effectiveIsHermesInstalled
                ? 'hover:border-emerald-500/50 opacity-80 hover:opacity-100'
                : 'hover:border-emerald-500/50'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--zen-text)' }} className="text-xs font-semibold">
                  {en.onboarding?.steps?.step6?.hermesTitle ?? 'Hermes'}
                </span>
                <span
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: isDark ? '#60A5FA' : '#2563EB',
                  }}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                >
                  {en.onboarding?.steps?.step6?.hermesSubtitle ?? 'Autonomous digital butler'}
                </span>
              </div>
              <div
                style={{
                  color: 'var(--zen-text-secondary)',
                  backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.04)',
                  borderColor: 'var(--zen-border)',
                }}
                className="text-[11px] font-mono mt-1 px-2 py-0.5 rounded-lg border truncate"
                title={getStarterPrompt('hermes', detectPlatformOS())}
              >
                {en.onboarding?.steps?.step6?.hermesPreview ?? 'Non-destructive Estate Clutter Audit & Downloads scan'}
              </div>
            </div>
            {!effectiveIsHermesInstalled ? (
              <button
                type="button"
                data-testid="btn-install-hermes"
                onClick={(e) => {
                  e.stopPropagation();
                  onGoToInstallStep?.();
                }}
                style={{
                  backgroundColor: 'var(--zen-surface-hover)',
                  color: 'var(--zen-text)',
                  borderColor: 'var(--zen-border)',
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border hover:opacity-90 cursor-pointer transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
              >
                <span>⬇️</span>
                <span>{en.onboarding?.steps?.step6?.installBtn ?? 'Install'}</span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="btn-launch-hermes"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLaunchCompanion('hermes');
                }}
                disabled={launchingCompanion === 'hermes'}
                style={{
                  backgroundColor: 'var(--zen-accent)',
                  color: '#FFFFFF',
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl hover:opacity-90 disabled:opacity-75 cursor-pointer transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
              >
                {launchingCompanion === 'hermes' ? (
                  <span>{en.onboarding?.steps?.step6?.launchingBtn ?? '✓ Copied & Launching...'}</span>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>{en.onboarding?.steps?.step6?.launchBtn ?? 'Launch'}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Dynamic Callout Box for State 2 & 3 */}
          <div
            data-testid="handoff-callout-box"
            style={{
              backgroundColor: isDark ? 'rgba(79, 191, 103, 0.12)' : 'rgba(236, 253, 245, 0.85)',
              borderColor: isDark ? 'rgba(79, 191, 103, 0.35)' : 'rgba(16, 185, 129, 0.4)',
              color: isDark ? '#34D399' : '#14532D',
            }}
            className="p-3 rounded-2xl border flex items-start gap-2.5 text-xs leading-relaxed"
          >
            <span className="text-base leading-none">
              {hasLaunchedCompanion ? '✓' : '💡'}
            </span>
            <p
              style={{
                color: isDark ? '#34D399' : '#14532D',
                fontWeight: 500,
              }}
              className="text-xs leading-relaxed"
            >
              {!hasAnyHarness
                ? (en.onboarding?.steps?.step6?.proxyReadyCallout ??
                    'Your local OpenAI proxy (http://127.0.0.1:61721/v1) is active and can be used immediately with external tools (Cursor, Aider, CLI tools), or you can return to Step 5 to add a harness.')
                : hasLaunchedCompanion
                ? (en.onboarding?.steps?.step6?.handoffCalloutLaunched ??
                    'Terminal open in background! Prompt is on your clipboard. Switch to your terminal and press {{shortcut}} + Enter.'
                  ).replace('{{shortcut}}', getPasteShortcut(detectPlatformOS()))
                : (en.onboarding?.steps?.step6?.handoffCalloutDefault ??
                    'The Hand-off: Click Launch on any companion to copy the starter mission and bring your terminal into focus. When the tool is ready, simply Paste and press Enter to run.'
                  )}
            </p>
          </div>
        </div>
      )}

      {/* Optional Bottom Navigation Bar */}
      {showNavigationFooter && (
        <div
          style={{ borderColor: 'var(--zen-border)' }}
          className="mt-5 pt-3 border-t flex items-center justify-between"
        >
          {/* Left Action: Skip to Canvas (State 1) or Skip Tour (State 2 & 3) */}
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
            {!effectiveHasProvider
              ? (en.onboarding?.steps?.step6?.skipToCanvas ?? 'Skip to Canvas')
              : (en.onboarding?.steps?.step6?.skipTour ?? 'Skip Tour')}
          </button>

          {/* Right Action Group */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="onboarding-prev-btn"
              onClick={onBack}
              style={{
                backgroundColor: 'var(--zen-surface-hover)',
                color: 'var(--zen-text)',
                borderColor: 'var(--zen-border)',
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-full border hover:opacity-90 transition-opacity cursor-pointer"
            >
              {en.onboarding?.nav?.back ?? 'Back'}
            </button>

            {!effectiveHasProvider ? (
              <button
                type="button"
                data-testid="onboarding-finish-btn"
                onClick={onComplete}
                style={{
                  backgroundColor: 'var(--zen-surface-hover)',
                  color: 'var(--zen-text)',
                  borderColor: 'var(--zen-border)',
                }}
                className="px-5 py-1.5 text-xs font-semibold rounded-full border transition-all hover:opacity-90 shadow-sm active:scale-[0.98] cursor-pointer"
              >
                {en.onboarding?.steps?.step6?.finishBtn ?? 'Go to Canvas'}
              </button>
            ) : !hasAnyHarness ? (
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
                {en.onboarding?.steps?.step6?.proceedBtn ?? 'Proceed to Canvas →'}
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
                {en.onboarding?.steps?.step6?.finishBtnArrow ?? 'Go to Canvas →'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
