import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

import { invoke } from '@tauri-apps/api/core';
import { OnboardingStep6 } from '../OnboardingStep6';

describe('OnboardingStep6 Component (Option A - Consolidated Provider Blocker)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
      writable: true,
    });

    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('State 1: No Provider Configured (!hasProvider) — Option A Consolidated Blocker', () => {
    it('renders amber SETUP INCOMPLETE badge, 6 / 6 counter, and "One Last Step: Connect a Brain" title and subtitle', () => {
      render(
        <OnboardingStep6
          hasProvider={false}
          harnessStatus={{ opencode: true, hermes: true }}
        />
      );

      // Top badge
      const badge = screen.getByTestId('onboarding-step-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/setup incomplete/i);

      // Step counter
      expect(screen.getByText('6 / 6')).toBeInTheDocument();

      // Title & Subtitle
      expect(screen.getByText('One Last Step: Connect a Brain')).toBeInTheDocument();
      expect(
        screen.getByText('Your agent companions are ready, but they need an intelligence source to execute instructions.')
      ).toBeInTheDocument();
    });

    it('replaces two agent cards with a single consolidated resolution card with Key icon and copy', () => {
      render(
        <OnboardingStep6
          hasProvider={false}
          harnessStatus={{ opencode: true, hermes: true }}
        />
      );

      // Exactly ONE consolidated card
      const blockerCard = screen.getByTestId('card-consolidated-provider-blocker');
      expect(blockerCard).toBeInTheDocument();
      expect(screen.getByText('Activate Your Agents')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Connect a free Google AI Studio key (no credit card required) or link a local Ollama instance to power OpenCode and Hermes.'
        )
      ).toBeInTheDocument();

      // Exactly ONE action button
      const connectBtn = screen.getByTestId('btn-connect-provider');
      expect(connectBtn).toBeInTheDocument();
      expect(connectBtn).toHaveTextContent('Connect Provider');

      // The individual agent cards and their buttons MUST NOT exist
      expect(screen.queryByTestId('card-launch-opencode')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-launch-hermes')).not.toBeInTheDocument();
      expect(screen.queryByTestId('btn-launch-opencode')).not.toBeInTheDocument();
      expect(screen.queryByTestId('btn-launch-hermes')).not.toBeInTheDocument();
      expect(screen.queryByTestId('btn-configure-provider-opencode')).not.toBeInTheDocument();
      expect(screen.queryByTestId('btn-configure-provider-hermes')).not.toBeInTheDocument();
      expect(screen.queryByTestId('handoff-callout-box')).not.toBeInTheDocument();
    });

    it('invokes onGoToProviderStep when clicking [ 🔑 Connect Provider ] button or the card', () => {
      const onGoToProviderStep = vi.fn();
      render(
        <OnboardingStep6
          hasProvider={false}
          harnessStatus={{ opencode: false, hermes: false }}
          onGoToProviderStep={onGoToProviderStep}
        />
      );

      const connectBtn = screen.getByTestId('btn-connect-provider');
      fireEvent.click(connectBtn);
      expect(onGoToProviderStep).toHaveBeenCalledTimes(1);

      const blockerCard = screen.getByTestId('card-consolidated-provider-blocker');
      fireEvent.click(blockerCard);
      expect(onGoToProviderStep).toHaveBeenCalledTimes(2);
    });

    it('renders Bottom Navigation Bar with "Skip to Canvas", "Back", and secondary neutral "Go to Canvas"', () => {
      const onBack = vi.fn();
      const onComplete = vi.fn();

      render(
        <OnboardingStep6
          hasProvider={false}
          harnessStatus={{ opencode: true, hermes: true }}
          onBack={onBack}
          onComplete={onComplete}
        />
      );

      // Left: "Skip to Canvas"
      const skipBtn = screen.getByTestId('onboarding-skip-tour-btn');
      expect(skipBtn).toHaveTextContent('Skip to Canvas');
      fireEvent.click(skipBtn);
      expect(onComplete).toHaveBeenCalledTimes(1);

      // Right: Back button
      const backBtn = screen.getByTestId('onboarding-prev-btn');
      expect(backBtn).toHaveTextContent('Back');
      fireEvent.click(backBtn);
      expect(onBack).toHaveBeenCalledTimes(1);

      // Right: "Go to Canvas" with secondary styling
      const finishBtn = screen.getByTestId('onboarding-finish-btn');
      expect(finishBtn).toHaveTextContent('Go to Canvas');
      expect(finishBtn.style.backgroundColor).toBe('var(--zen-surface-hover)');
      fireEvent.click(finishBtn);
      expect(onComplete).toHaveBeenCalledTimes(2);
    });
  });

  describe('State 2: Provider Ready + At Least One Harness Installed (Normal Path)', () => {
    it('renders emerald SETUP COMPLETE badge, "Ready to Build" title, and both companion cards with launch actions', () => {
      render(
        <OnboardingStep6
          hasProvider={true}
          harnessStatus={{ opencode: true, hermes: true }}
        />
      );

      // Top badge
      const badge = screen.getByTestId('onboarding-step-badge');
      expect(badge).toHaveTextContent(/setup complete/i);

      // Title & Subtitle
      expect(screen.getByText('Ready to Build')).toBeInTheDocument();
      expect(
        screen.getByText('Your environment is configured. Launch a companion with an optimized starter prompt below, or proceed to the visual canvas.')
      ).toBeInTheDocument();

      // Both agent cards rendered
      expect(screen.getByTestId('card-launch-opencode')).toBeInTheDocument();
      expect(screen.getByTestId('card-launch-hermes')).toBeInTheDocument();
      expect(screen.getByTestId('btn-launch-opencode')).toBeInTheDocument();
      expect(screen.getByTestId('btn-launch-hermes')).toBeInTheDocument();

      // No consolidated blocker card
      expect(screen.queryByTestId('card-consolidated-provider-blocker')).not.toBeInTheDocument();
    });

    it('renders Install button invoking onGoToInstallStep when one harness is missing', () => {
      const onGoToInstallStep = vi.fn();
      render(
        <OnboardingStep6
          hasProvider={true}
          harnessStatus={{ opencode: true, hermes: false }}
          onGoToInstallStep={onGoToInstallStep}
        />
      );

      // OpenCode has launch button
      expect(screen.getByTestId('btn-launch-opencode')).toBeInTheDocument();

      // Hermes has install button
      expect(screen.queryByTestId('btn-launch-hermes')).not.toBeInTheDocument();
      const installHermesBtn = screen.getByTestId('btn-install-hermes');
      expect(installHermesBtn).toBeInTheDocument();
      expect(installHermesBtn).toHaveTextContent('Install');

      fireEvent.click(installHermesBtn);
      expect(onGoToInstallStep).toHaveBeenCalledTimes(1);
    });

    it('flips Callout Box from pre-launch default to post-launch active confirmation, copies prompt, launches terminal, and updates button to ✓ Launched', async () => {
      render(
        <OnboardingStep6
          hasProvider={true}
          harnessStatus={{ opencode: true, hermes: true }}
        />
      );

      const callout = screen.getByTestId('handoff-callout-box');
      // Pre-launch default
      expect(callout).toHaveTextContent(/Click Launch on any companion to copy the starter mission/i);
      expect(callout).not.toHaveTextContent(/Terminal open in background/i);

      // Click Launch on OpenCode
      const opencodeBtn = screen.getByTestId('btn-launch-opencode');
      await act(async () => {
        fireEvent.click(opencodeBtn);
      });

      // Writes starter prompt to clipboard
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('nohup python3 -m http.server 8001')
      );

      // Invokes terminal launcher IPC
      expect(invoke).toHaveBeenCalledWith('launch_companion_terminal', { companion: 'opencode' });

      // Button updates to ✓ Launched
      expect(screen.getByText('✓ Launched')).toBeInTheDocument();

      // Callout updates to active confirmation
      expect(callout).toHaveTextContent(
        'Terminal open in background! Prompt is on your clipboard. Switch to your terminal and press ⌘V + Enter.'
      );
    });

    it('supports custom onLaunch callback prop if provided', async () => {
      const onLaunch = vi.fn().mockResolvedValue(undefined);
      render(
        <OnboardingStep6
          hasProvider={true}
          harnessStatus={{ opencode: true, hermes: true }}
          onLaunch={onLaunch}
        />
      );

      const hermesBtn = screen.getByTestId('btn-launch-hermes');
      await act(async () => {
        fireEvent.click(hermesBtn);
      });

      expect(onLaunch).toHaveBeenCalledTimes(1);
      expect(onLaunch).toHaveBeenCalledWith('hermes', expect.stringContaining('Estate Clutter Audit'));
    });

    it('renders Bottom Navigation Bar with "Skip Tour", "Back", and primary emerald [ Go to Canvas → ]', () => {
      const onComplete = vi.fn();
      render(
        <OnboardingStep6
          hasProvider={true}
          harnessStatus={{ opencode: true, hermes: true }}
          onComplete={onComplete}
        />
      );

      // Left: "Skip Tour"
      const skipBtn = screen.getByTestId('onboarding-skip-tour-btn');
      expect(skipBtn).toHaveTextContent('Skip Tour');

      // Right primary emerald "Go to Canvas →"
      const finishBtn = screen.getByTestId('onboarding-finish-btn');
      expect(finishBtn).toHaveTextContent('Go to Canvas →');
      expect(finishBtn.style.backgroundColor).toBe('var(--zen-accent)');
      fireEvent.click(finishBtn);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('State 3: Provider Ready + Neither Harness Installed', () => {
    it('renders NO HARNESS LINKED badge, "AI Proxy is Ready" title, and both rows showing Install buttons', () => {
      const onGoToInstallStep = vi.fn();
      render(
        <OnboardingStep6
          hasProvider={true}
          harnessStatus={{ opencode: false, hermes: false }}
          onGoToInstallStep={onGoToInstallStep}
        />
      );

      // Top badge
      const badge = screen.getByTestId('onboarding-step-badge');
      expect(badge).toHaveTextContent(/no harness linked/i);

      // Title & Subtitle
      expect(screen.getByText('AI Proxy is Ready')).toBeInTheDocument();
      expect(
        screen.getByText('FrugaLLM is serving its OpenAI endpoint, but neither agent binary was detected on your system path.')
      ).toBeInTheDocument();

      // Both rows show Install buttons
      const installOpencodeBtn = screen.getByTestId('btn-install-opencode');
      const installHermesBtn = screen.getByTestId('btn-install-hermes');
      expect(installOpencodeBtn).toBeInTheDocument();
      expect(installHermesBtn).toBeInTheDocument();
      expect(screen.queryByTestId('btn-launch-opencode')).not.toBeInTheDocument();
      expect(screen.queryByTestId('btn-launch-hermes')).not.toBeInTheDocument();

      fireEvent.click(installOpencodeBtn);
      expect(onGoToInstallStep).toHaveBeenCalledWith();
    });

    it('renders Callout Box explaining local proxy 127.0.0.1:61721 is running and ready for external tools', () => {
      render(
        <OnboardingStep6
          hasProvider={true}
          harnessStatus={{ opencode: false, hermes: false }}
        />
      );

      const callout = screen.getByTestId('handoff-callout-box');
      expect(callout).toHaveTextContent(/http:\/\/127\.0\.0\.1:61721\/v1/i);
      expect(callout).toHaveTextContent(/Cursor, Aider, CLI tools/i);
    });

    it('renders primary emerald button [ Proceed to Canvas → ] in Bottom Navigation Bar', () => {
      const onComplete = vi.fn();
      render(
        <OnboardingStep6
          hasProvider={true}
          harnessStatus={{ opencode: false, hermes: false }}
          onComplete={onComplete}
        />
      );

      const finishBtn = screen.getByTestId('onboarding-finish-btn');
      expect(finishBtn).toHaveTextContent('Proceed to Canvas →');
      expect(finishBtn.style.backgroundColor).toBe('var(--zen-accent)');
      fireEvent.click(finishBtn);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup & Hygiene Requirements', () => {
    it('verifies secondary outward links (Top 10 Things to Build, Report Issue) are completely removed', () => {
      render(
        <OnboardingStep6
          hasProvider={true}
          harnessStatus={{ opencode: true, hermes: true }}
        />
      );

      expect(screen.queryByText(/Top 10 Things to Build/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Report Issue/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId('onboarding-report-bug-btn')).not.toBeInTheDocument();
    });

    it('handles empty/hostile props gracefully without crashing', () => {
      expect(() => {
        render(<OnboardingStep6 onComplete={vi.fn()} />);
      }).not.toThrow();

      // Defaults to hasProvider = false (Option A consolidated blocker)
      expect(screen.getByTestId('card-consolidated-provider-blocker')).toBeInTheDocument();
    });
  });
});
