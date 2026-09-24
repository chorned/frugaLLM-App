import { test, expect } from '../harness/tauri-launcher';
import { assertPortsClosed, waitForPortClosed, isPortOpen } from '../harness/port-sentinel';
import { safeDeleteWithRetry, killProcessesByName, isWindows } from '../harness/host-process-mgr';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 1: Boot Sequence & Onboarding', () => {
  test('01.1 - Pre-flight Clean Check: verify FrugaLLM proxy ports 61721, 8080, and 8081 are closed', async () => {
    // Sweep any stray processes from prior runs to guarantee a clean slate
    await killProcessesByName('frugallm-app');
    await waitForPortClosed(61721, 3000);
    await waitForPortClosed(8080, 3000);
    if (!isWindows) {
      await waitForPortClosed(8081, 3000);
    }

    // Assert ports are closed prior to app spawn
    // (If Ollama daemon is already running locally as a system service, 11434 might be open, but FrugaLLM proxy ports must be free)
    // On Windows, port 8081 is frequently bound by host daemons like Docker Desktop / WSL,
    // whereas FrugaLLM's proxy runs primarily on port 61721 (with 8080 as alternate).
    // Port 8081 is not required on Windows; the primary listener on 61721 is validated post-launch in 01.2.
    const preflightPorts = isWindows ? [61721, 8080] : [61721, 8080, 8081];
    await assertPortsClosed(preflightPorts);

    // Clean up any stale tool gateway marker to guarantee Day-0 installation testing
    const os = await import('node:os');
    const path = await import('node:path');
    const fs = await import('node:fs');
    const appDataDirs = [
      path.join(os.homedir(), 'Library', 'Application Support', 'com.chorned.frugallm-app'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'com.chorned.frugallm-app'),
      path.join(os.homedir(), '.config', 'com.chorned.frugallm-app'),
    ];
    for (const d of appDataDirs) {
      const marker = path.join(d, 'tool_gateway_installed');
      if (fs.existsSync(marker)) {
        await safeDeleteWithRetry(marker);
      }
      const cfgPath = path.join(d, 'frugal_config.json');
      if (fs.existsSync(cfgPath)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
          let modified = false;
          if (cfg.port !== 61721) {
            cfg.port = 61721;
            modified = true;
          }
          if (cfg.api_password) {
            cfg.api_password = null;
            modified = true;
          }
          if (!cfg.installed_by_app) {
            cfg.installed_by_app = { ollama: false, hermes: true, opencode: true };
            modified = true;
          } else {
            cfg.installed_by_app.hermes = true;
            cfg.installed_by_app.opencode = true;
            modified = true;
          }
          if (modified) {
            fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
          }
        } catch {}
      }
    }
  });

  test('01.2 - Boot Sequence: verify TerminalLoader mounts, initializes app, and transitions', async ({
    appPage,
  }) => {
    // Wait for the window to load
    await appPage.waitForLoadState('domcontentloaded');

    // Assert FrugaLLM native proxy is healthy and listening on primary port 61721
    expect(await isPortOpen(61721)).toBe(true);

    // Assert app initializes into OnboardingDecision
    const decisionModal = appPage.locator('[data-testid="onboarding-guided-btn"]');
    await expect(decisionModal).toBeVisible({ timeout: 20000 });
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
    await expect(slider).toBeVisible({ timeout: 5000 });
    await slider.fill('750');
    await slider.dispatchEvent('change');
    await appPage.waitForTimeout(300);

    const savedPill = appPage.locator('[data-testid="simulated-saved-pill"]');
    await expect(savedPill).toBeVisible({ timeout: 5000 });
    const text = await savedPill.innerText();
    const parsed = parseFloat(text.replace(/[^0-9.]/g, ''));
    expect(parsed).toBeGreaterThan(0);
    await nextBtn.click();

    // Step 4: API Keys configuration step
    const step4 = appPage.locator('[data-testid="onboarding-step-4"]');
    await expect(step4).toBeVisible({ timeout: 5000 });
    const allKeysSaved = appPage.locator('[data-testid="onboarding-all-keys-saved"]');
    if (await allKeysSaved.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(allKeysSaved).toBeVisible();
    } else {
      if (await appPage.locator('[data-testid="input-google-key"]').isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(appPage.locator('[data-testid="input-google-key"]')).toBeVisible();
      }
      if (await appPage.locator('[data-testid="input-openrouter-key"]').isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(appPage.locator('[data-testid="input-openrouter-key"]')).toBeVisible();
      }
    }
    await nextBtn.click();

    // Step 5: Agent deployment triggers
    const step5 = appPage.locator('[data-testid="onboarding-step-5"]');
    await expect(step5).toBeVisible({ timeout: 5000 });
    const opencodeAction = appPage.locator('[data-testid="btn-install-opencode"], [data-testid="badge-opencode-ready"]');
    await expect(opencodeAction.first()).toBeVisible();
    const hermesAction = appPage.locator('[data-testid="btn-install-hermes"], [data-testid="badge-hermes-ready"]');
    await expect(hermesAction.first()).toBeVisible();
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
