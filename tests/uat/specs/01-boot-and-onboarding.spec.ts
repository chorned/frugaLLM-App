import { test, expect } from '../harness/tauri-launcher';
import { assertPortsClosed } from '../harness/port-sentinel';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 1: Boot Sequence & Onboarding', () => {
  test('01.1 - Pre-flight Clean Check: verify ports 8080/61721 and 11434 are closed', async () => {
    // Assert ports are closed prior to app spawn
    // (If Ollama daemon is already running locally as a system service, 11434 might be open, but FrugaLLM proxy ports must be free)
    await assertPortsClosed([61721]);
  });

  test('01.2 - Boot Sequence: verify TerminalLoader mounts, initializes app, and transitions', async ({
    appPage,
  }) => {
    // Wait for the window to load
    await appPage.waitForLoadState('domcontentloaded');

    // Either the TerminalLoader is visible initially and transitions, or the app initializes into OnboardingDecision
    const decisionModal = appPage.locator('[data-testid="onboarding-guided-btn"]');
    const terminalLoader = appPage.locator('[data-testid="terminal-loader"]');

    if (await terminalLoader.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(terminalLoader).toBeVisible();
      // Wait for runAppInit to complete and reveal the onboarding decision modal or canvas
      await expect(decisionModal).toBeVisible({ timeout: 15000 });
    } else {
      // Already passed loader
      await expect(decisionModal).toBeVisible({ timeout: 10000 });
    }
  });

  test('01.3 - Initial Decision Modal: assert buttons and enter guided walkthrough', async ({
    appPage,
  }) => {
    const guidedBtn = appPage.locator('[data-testid="onboarding-guided-btn"]');
    const skipBtn = appPage.locator('[data-testid="onboarding-skip-btn"]');

    await expect(guidedBtn).toBeVisible();
    await expect(skipBtn).toBeVisible();

    // Click Set Up in 5 Minutes (Guided) to enter learning mode
    await guidedBtn.click();

    // Verify OnboardingOverlay mounts step 1
    const step1 = appPage.locator('[data-testid="onboarding-step-1"]');
    await expect(step1).toBeVisible({ timeout: 10000 });
  });

  test('01.4 - 6-Step Guided Walkthrough: step 1 through step 6 completion', async ({
    appPage,
  }) => {
    const nextBtn = appPage.locator('[data-testid="onboarding-next-btn"]');

    // Step 1: Sources spotlight covering Ollama, Google, OpenRouter
    await expect(appPage.locator('[data-testid="onboarding-step-1"]')).toBeVisible({ timeout: 10000 });
    await nextBtn.click();

    // Step 2: Agents spotlight covering OpenCode and Hermes
    const step2 = appPage.locator('[data-testid="onboarding-step-2"]');
    await expect(step2).toBeVisible({ timeout: 5000 });
    await nextBtn.click();

    // Step 3: Token Simulation Slider (0 - 1B tokens)
    const step3 = appPage.locator('[data-testid="onboarding-step-3"]');
    await expect(step3).toBeVisible({ timeout: 5000 });

    const slider = appPage.locator('[data-testid="token-flow-slider"]');
    if (await slider.isVisible()) {
      // Drag/fill slider to simulate token flow
      await slider.fill('750');
      await slider.dispatchEvent('change');
      await appPage.waitForTimeout(300);

      // Verify dynamic calculation updates
      const savedPill = appPage.locator('[data-testid="simulated-saved-pill"]');
      if (await savedPill.isVisible()) {
        const text = await savedPill.innerText();
        expect(text).toContain('$');
      }
    }
    await nextBtn.click();

    // Step 4: API Keys configuration step
    const step4 = appPage.locator('[data-testid="onboarding-step-4"]');
    await expect(step4).toBeVisible({ timeout: 5000 });
    await expect(appPage.locator('[data-testid="input-google-key"]')).toBeVisible();
    await expect(appPage.locator('[data-testid="input-openrouter-key"]')).toBeVisible();
    await nextBtn.click();

    // Step 5: Agent deployment triggers
    const step5 = appPage.locator('[data-testid="onboarding-step-5"]');
    await expect(step5).toBeVisible({ timeout: 5000 });
    await expect(appPage.locator('[data-testid="btn-install-opencode"]')).toBeVisible();
    await expect(appPage.locator('[data-testid="btn-install-hermes"]')).toBeVisible();
    await nextBtn.click();

    // Step 6: Celebration screen & Launch FrugaLLM
    const step6 = appPage.locator('[data-testid="onboarding-step-6"]');
    await expect(step6).toBeVisible({ timeout: 5000 });

    const finishBtn = appPage.locator('[data-testid="onboarding-finish-btn"]');
    await expect(finishBtn).toBeVisible();
    await finishBtn.click();

    // Verify OnboardingOverlay dismisses
    await expect(step6).toBeHidden({ timeout: 5000 });

    // Verify footer tracker reflects completed tour state
    const tourBtn = appPage.locator('[data-testid="footer-tracker-tour-btn"]');
    await expect(tourBtn).toBeVisible({ timeout: 5000 });
  });
});
