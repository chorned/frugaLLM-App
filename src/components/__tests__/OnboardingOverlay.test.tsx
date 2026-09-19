import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/plugin-opener
vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

// Mock @tauri-apps/plugin-http
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
  }),
}));

import confetti from 'canvas-confetti';
import { invoke } from '@tauri-apps/api/core';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { OnboardingOverlay, sliderToTokens, tokensToSlider } from '../OnboardingOverlay';

describe('OnboardingOverlay Component', () => {
  let topRow: HTMLDivElement;
  let bottomRow: HTMLDivElement;
  let frugallmNode: HTMLDivElement;
  let googleWire: SVGLineElement;
  let opencodeWire: SVGLineElement;

  beforeEach(() => {
    vi.clearAllMocks();

    (invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'detect_hardware_profile') {
        return Promise.resolve({
          is_unified: false,
          dedicated_vram: 0,
          system_ram: 32 * 1024 * 1024 * 1024,
          execution_ceiling: 8 * 1024 * 1024 * 1024,
          os_architecture: 'macos-x86_64',
        });
      }
      if (cmd === 'check_hermes_status') return Promise.resolve({ is_installed: false });
      if (cmd === 'check_opencode_status') return Promise.resolve({ is_installed: false });
      if (cmd === 'get_credential') return Promise.resolve(null);
      if (cmd === 'set_credential') return Promise.resolve();
      if (cmd === 'refresh_routing_chain') return Promise.resolve();
      if (cmd === 'install_opencode') return Promise.resolve();
      if (cmd === 'install_hermes') return Promise.resolve();
      return Promise.resolve(null);
    });

    // Create DOM targets
    topRow = document.createElement('div');
    topRow.setAttribute('data-testid', 'router-top-row');
    topRow.getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      right: 900,
      bottom: 150,
      width: 800,
      height: 100,
      x: 100,
      y: 50,
      toJSON: () => {},
    });
    document.body.appendChild(topRow);

    bottomRow = document.createElement('div');
    bottomRow.setAttribute('data-testid', 'router-bottom-row');
    bottomRow.getBoundingClientRect = () => ({
      left: 150,
      top: 500,
      right: 850,
      bottom: 600,
      width: 700,
      height: 100,
      x: 150,
      y: 500,
      toJSON: () => {},
    });
    document.body.appendChild(bottomRow);

    frugallmNode = document.createElement('div');
    frugallmNode.id = 'node-frugallm';
    frugallmNode.getBoundingClientRect = () => ({
      left: 400,
      top: 250,
      right: 600,
      bottom: 350,
      width: 200,
      height: 100,
      x: 400,
      y: 250,
      toJSON: () => {},
    });
    document.body.appendChild(frugallmNode);

    // Mock SVG wires
    googleWire = document.createElementNS('http://www.w3.org/2000/svg', 'line') as SVGLineElement;
    googleWire.id = 'edge-frugallm-google';
    document.body.appendChild(googleWire);

    opencodeWire = document.createElementNS('http://www.w3.org/2000/svg', 'line') as SVGLineElement;
    opencodeWire.id = 'edge-opencode-frugallm';
    document.body.appendChild(opencodeWire);
  });

  afterEach(() => {
    [topRow, bottomRow, frugallmNode, googleWire, opencodeWire].forEach((el) => {
      if (document.body.contains(el)) document.body.removeChild(el);
    });
  });

  it('renders Step 1 with spotlight panels, title, desc, and RAM detection callout', async () => {
    // Arrange
    const onNext = vi.fn();
    const onComplete = vi.fn();

    // Act
    render(
      <OnboardingOverlay
        currentStep={1}
        onNext={onNext}
        onComplete={onComplete}
      />
    );

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    // Assert: 4-quadrant spotlight panels
    expect(screen.getByTestId('spotlight-top')).toBeInTheDocument();
    expect(screen.getByTestId('spotlight-bottom')).toBeInTheDocument();
    expect(screen.getByTestId('spotlight-left')).toBeInTheDocument();
    expect(screen.getByTestId('spotlight-right')).toBeInTheDocument();

    // Step 1 copy: RAM allocation matches Ollama node (8.0 GB) and updated copy
    expect(screen.getByText('Where the Brains Live')).toBeInTheDocument();
    expect(screen.getByTestId('ram-warning-box')).toBeInTheDocument();
    expect(screen.getByText(/8\.0 GB RAM/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Local models are private and work offline, but cloud models run faster and are more intelligent/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-arrow-up')).toBeInTheDocument();

    // Click Next
    const nextBtn = screen.getByTestId('onboarding-next-btn');
    fireEvent.click(nextBtn);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('renders Step 2 with the updated copy and safety notice', async () => {
    // Act
    render(<OnboardingOverlay currentStep={2} onComplete={vi.fn()} />);

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    // Assert
    expect(screen.getByText('Giving the AI Hands')).toBeInTheDocument();
    expect(screen.getByText(/Out of the box, models only talk/i)).toBeInTheDocument();
    expect(screen.getByTestId('safety-note-box')).toBeInTheDocument();
    expect(screen.getByText(/The AI has hands, but you're the boss/i)).toBeInTheDocument();
  });

  it('renders Step 3, pulses SVG wires, displays node alias and interactive Ease-Out-In slider', async () => {
    // Arrange
    expect(googleWire.classList.contains('edge-flow-active')).toBe(false);

    // Act
    const { unmount } = render(<OnboardingOverlay currentStep={3} onComplete={vi.fn()} />);

    // Assert: active wire animation applied
    expect(googleWire.classList.contains('edge-flow-active')).toBe(true);
    expect(opencodeWire.classList.contains('edge-flow-active')).toBe(true);
    expect(screen.getByText('Smart Routing & Cost Shield')).toBeInTheDocument();

    // FrugaLLM Node Alias verification
    expect(screen.getByTestId('frugallm-node-alias')).toBeInTheDocument();
    expect(screen.getByText('HUB ONLINE')).toBeInTheDocument();
    expect(screen.getByTestId('simulated-tokens')).toBeInTheDocument();
    expect(screen.getByTestId('simulated-saved-pill')).toBeInTheDocument();

    // Slider verification
    const slider = screen.getByTestId('token-flow-slider');
    expect(slider).toBeInTheDocument();
    expect(screen.getByText("Just Vibin'")).toBeInTheDocument();
    expect(screen.getByText('The Tokens must Flow')).toBeInTheDocument();

    // Interactive slider changes: move to 0 ("Just Vibin'")
    fireEvent.change(slider, { target: { value: '0' } });
    expect(screen.getByTestId('simulated-tokens')).toHaveTextContent('0');
    expect(screen.getByTestId('simulated-total-tokens')).toHaveTextContent('0');
    expect(screen.getByTestId('simulated-saved-pill')).toHaveTextContent('+$0.00 Saved');

    // Move to 500 (middle of the slider -> realistic tokens = 10,000,000)
    fireEvent.change(slider, { target: { value: '500' } });
    expect(screen.getByTestId('simulated-tokens')).toHaveTextContent('10,000,000');
    expect(screen.getByTestId('simulated-total-tokens')).toHaveTextContent('10,000,000');
    expect(screen.getByTestId('simulated-saved-pill')).toHaveTextContent('+$230.00 Saved');

    // Move to 1000 (max -> 999,999,999 tokens)
    fireEvent.change(slider, { target: { value: '1000' } });
    expect(screen.getByTestId('simulated-tokens')).toHaveTextContent('999,999,999');
    expect(screen.getByTestId('simulated-total-tokens')).toHaveTextContent('999,999,999');

    // Arrow verification: centered tall Step 3 box skips pointer arrows
    expect(screen.queryByTestId('onboarding-arrow-up')).not.toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-arrow-down')).not.toBeInTheDocument();

    // Unmount
    unmount();

    // Assert cleanup: wire classes removed cleanly
    expect(googleWire.classList.contains('edge-flow-active')).toBe(false);
    expect(opencodeWire.classList.contains('edge-flow-active')).toBe(false);
  });

  it('renders Step 4, unmounts individual key boxes when saved, and shows celebratory banner', async () => {
    // Arrange
    const onStatusChange = vi.fn();
    render(
      <OnboardingOverlay
        currentStep={4}
        onComplete={vi.fn()}
        onStatusChange={onStatusChange}
      />
    );

    // Enter Google Key
    const googleInput = screen.getByTestId('input-google-key');
    fireEvent.change(googleInput, { target: { value: 'AIzaSyTestGoogleKey123' } });

    const saveGoogleBtn = screen.getByTestId('btn-save-google-key');
    fireEvent.click(saveGoogleBtn);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('set_credential', {
        service: 'google',
        secret: 'AIzaSyTestGoogleKey123',
      });
      expect(onStatusChange).toHaveBeenCalled();
      // Google box should be removed
      expect(screen.queryByTestId('box-google-key')).not.toBeInTheDocument();
    });

    // Enter OpenRouter Key
    const openrouterInput = screen.getByTestId('input-openrouter-key');
    fireEvent.change(openrouterInput, { target: { value: 'sk-or-test-key-456' } });

    const saveOpenrouterBtn = screen.getByTestId('btn-save-openrouter-key');
    fireEvent.click(saveOpenrouterBtn);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('set_credential', {
        service: 'openrouter',
        secret: 'sk-or-test-key-456',
      });
      // OpenRouter box should be removed
      expect(screen.queryByTestId('box-openrouter-key')).not.toBeInTheDocument();
      // Celebratory banner should be visible
      expect(screen.getByTestId('onboarding-all-keys-saved')).toBeInTheDocument();
    });
  });

  it('detects mismatched keys and shows inline warning in Step 4', async () => {
    render(<OnboardingOverlay currentStep={4} onComplete={vi.fn()} />);

    // Paste OpenRouter key into Google box
    const googleInput = screen.getByTestId('input-google-key');
    fireEvent.change(googleInput, { target: { value: 'sk-or-mismatched-key' } });
    expect(screen.getByTestId('google-key-mismatch-warning')).toBeInTheDocument();

    // Paste Google key into OpenRouter box
    const openrouterInput = screen.getByTestId('input-openrouter-key');
    fireEvent.change(openrouterInput, { target: { value: 'AIzaSyMismatchedGoogleKey' } });
    expect(screen.getByTestId('openrouter-key-mismatch-warning')).toBeInTheDocument();
  });

  it('rejects invalid key when upstream verification fails with HTTP 400', async () => {
    (tauriFetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid API key' }),
    });

    render(<OnboardingOverlay currentStep={4} onComplete={vi.fn()} />);

    const googleInput = screen.getByTestId('input-google-key');
    fireEvent.change(googleInput, { target: { value: 'AIzaSyBadKey' } });

    const saveGoogleBtn = screen.getByTestId('btn-save-google-key');
    fireEvent.click(saveGoogleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Key verification failed \(HTTP 400\)/i)).toBeInTheDocument();
      expect(screen.getByTestId('box-google-key')).toBeInTheDocument();
    });
  });

  it('renders Step 5 and delegates installation to provided handlers with updated Golden Rule', async () => {
    // Arrange
    const onInstallOpenCode = vi.fn();
    const onInstallHermes = vi.fn();
    render(
      <OnboardingOverlay
        currentStep={5}
        onComplete={vi.fn()}
        onInstallOpenCode={onInstallOpenCode}
        onInstallHermes={onInstallHermes}
      />
    );

    expect(screen.getByText('Install Your First Tool')).toBeInTheDocument();
    expect(screen.getByTestId('golden-rule-box')).toBeInTheDocument();
    expect(screen.getByText(/Your agent should almost never need your password/i)).toBeInTheDocument();

    // Install Open Code
    const installOpencodeBtn = screen.getByTestId('btn-install-opencode');
    fireEvent.click(installOpencodeBtn);
    expect(onInstallOpenCode).toHaveBeenCalledTimes(1);

    // Install Hermes
    const installHermesBtn = screen.getByTestId('btn-install-hermes');
    fireEvent.click(installHermesBtn);
    expect(onInstallHermes).toHaveBeenCalledTimes(1);
  });

  it('renders Step 6, fires confetti, and launches workspace and bug reporter', async () => {
    // Arrange
    const onComplete = vi.fn();
    const onOpenIssueReporter = vi.fn();
    render(
      <OnboardingOverlay
        currentStep={6}
        onComplete={onComplete}
        onOpenIssueReporter={onOpenIssueReporter}
      />
    );

    // Assert: Confetti called
    expect(confetti).toHaveBeenCalled();
    expect(screen.getByText('Ready to Vibe Code')).toBeInTheDocument();

    // Click Report Bug CTA
    const reportBugBtn = screen.getByTestId('onboarding-report-bug-btn');
    fireEvent.click(reportBugBtn);
    expect(onOpenIssueReporter).toHaveBeenCalledTimes(1);

    // Click Launch Workspace
    const finishBtn = screen.getByTestId('onboarding-finish-btn');
    fireEvent.click(finishBtn);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('triggers onComplete when Skip Tour button is clicked and has rounded pill styling', async () => {
    // Arrange
    const onComplete = vi.fn();
    render(<OnboardingOverlay currentStep={2} onComplete={onComplete} />);

    const skipBtn = screen.getByTestId('onboarding-skip-tour-btn');
    expect(skipBtn).toHaveClass('rounded-full', 'border');
    fireEvent.click(skipBtn);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('snugly frames individual node cards rather than stretched row containers', async () => {
    // Create individual node cards inside DOM
    const ollamaNode = document.createElement('div');
    ollamaNode.id = 'node-ollama';
    ollamaNode.getBoundingClientRect = () => ({
      left: 100,
      top: 60,
      right: 320,
      bottom: 180,
      width: 220,
      height: 120,
      x: 100,
      y: 60,
      toJSON: () => {},
    });
    document.body.appendChild(ollamaNode);

    const googleNode = document.createElement('div');
    googleNode.id = 'node-google';
    googleNode.getBoundingClientRect = () => ({
      left: 380,
      top: 60,
      right: 600,
      bottom: 180,
      width: 220,
      height: 120,
      x: 380,
      y: 60,
      toJSON: () => {},
    });
    document.body.appendChild(googleNode);

    const openrouterNode = document.createElement('div');
    openrouterNode.id = 'node-openrouter';
    openrouterNode.getBoundingClientRect = () => ({
      left: 660,
      top: 60,
      right: 880,
      bottom: 180,
      width: 220,
      height: 120,
      x: 660,
      y: 60,
      toJSON: () => {},
    });
    document.body.appendChild(openrouterNode);

    // Stretched row container has height 350px (simulating flex: 1), while cards are only 120px high
    topRow.getBoundingClientRect = () => ({
      left: 100,
      top: 60,
      right: 880,
      bottom: 410,
      width: 780,
      height: 350,
      x: 100,
      y: 60,
      toJSON: () => {},
    });

    render(<OnboardingOverlay currentStep={1} onComplete={vi.fn()} />);

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    // Top cutout should be 60 - PAD (16) = 44px
    expect(screen.getByTestId('spotlight-top')).toHaveStyle({ height: '44px' });

    // Bottom cutout starts at 180 + PAD (16) = 196px (snug to card bottom, NOT stretched row bottom 410px)
    expect(screen.getByTestId('spotlight-bottom')).toHaveStyle({ top: '196px' });

    // Clean up
    document.body.removeChild(ollamaNode);
    document.body.removeChild(googleNode);
    document.body.removeChild(openrouterNode);
  });

  it('renders safety-note-box with high contrast colors in light and dark modes', () => {
    window.localStorage.setItem('frugallm-theme', 'light');
    const { unmount } = render(<OnboardingOverlay currentStep={2} onComplete={vi.fn()} />);
    const safetyBoxLight = screen.getByTestId('safety-note-box');
    expect(safetyBoxLight).toHaveStyle({ color: '#92400E' });
    unmount();

    window.localStorage.setItem('frugallm-theme', 'dark');
    render(<OnboardingOverlay currentStep={2} onComplete={vi.fn()} />);
    const safetyBoxDark = screen.getByTestId('safety-note-box');
    expect(safetyBoxDark).toHaveStyle({ color: '#FCD34D' });
  });

  it('renders golden-rule-box with high contrast colors in light and dark modes', () => {
    window.localStorage.setItem('frugallm-theme', 'light');
    const { unmount } = render(<OnboardingOverlay currentStep={5} onComplete={vi.fn()} />);
    const goldenBoxLight = screen.getByTestId('golden-rule-box');
    expect(goldenBoxLight).toHaveStyle({ color: '#14532D' });
    unmount();

    window.localStorage.setItem('frugallm-theme', 'dark');
    render(<OnboardingOverlay currentStep={5} onComplete={vi.fn()} />);
    const goldenBoxDark = screen.getByTestId('golden-rule-box');
    expect(goldenBoxDark).toHaveStyle({ color: '#34D399' });
  });

  describe('sliderToTokens and tokensToSlider curve mathematical properties', () => {
    it('accurately maps 0 to 0 tokens', () => {
      expect(sliderToTokens(0)).toBe(0);
      expect(tokensToSlider(0)).toBe(0);
    });

    it('accurately maps 0.25 to 2,500,000 tokens', () => {
      expect(sliderToTokens(0.25)).toBe(2500000);
      expect(tokensToSlider(2500000)).toBeCloseTo(0.25, 5);
    });

    it('accurately maps midpoint 0.5 to exactly 10,000,000 tokens', () => {
      expect(sliderToTokens(0.5)).toBe(10000000);
      expect(tokensToSlider(10000000)).toBe(0.5);
    });

    it('accurately maps 0.75 to 100,000,000 tokens', () => {
      expect(sliderToTokens(0.75)).toBe(100000000);
      expect(tokensToSlider(100000000)).toBeCloseTo(0.75, 5);
    });

    it('accurately maps 1.0 to 999,999,999 tokens', () => {
      expect(sliderToTokens(1.0)).toBe(999999999);
      expect(tokensToSlider(999999999)).toBe(1.0);
    });

    it('ensures roundtrip fidelity across various slider positions', () => {
      const testPositions = [0, 0.1, 0.25, 0.35, 0.5, 0.65, 0.75, 0.9, 1.0];
      for (const pos of testPositions) {
        const tokens = sliderToTokens(pos);
        const mappedBack = tokensToSlider(tokens);
        expect(mappedBack).toBeCloseTo(pos, 2);
      }
    });
  });
});
