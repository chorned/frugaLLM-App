import { test, expect, Page } from '@playwright/test';
import { MainCanvas } from '../pages/MainCanvas';

/**
 * Injects clean Tauri IPC mocks into the browser window before page load.
 */
async function setupTauriMock(page: Page, vramMb: number) {
  await page.addInitScript((mockVram) => {
    const win = window as Record<string, any>;
    win.localStorage.setItem("onboardingState", "completed");
    win["__TAURI_EVENT_PLUGIN_INTERNALS__"] = { unregisterListener: () => {} };
    win['invokedCommands'] = [];
    win['tauriEventCallbacks'] = {};
    win['tauriListeners'] = {};
    let nextId = 1;

    const vramBytes = mockVram * 1024 * 1024;
    const isUnified = false;

    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {
        transformCallback: (callback: any) => {
          const id = nextId++;
          win['tauriEventCallbacks'][id] = callback;
          return id;
        },
        plugins: {
          event: {
            unregisterListener: () => {}
          }
        },
        invoke: (cmd: string, args: any) => {
          win['invokedCommands'].push({ cmd, args });

          if (cmd === 'plugin:event|listen') {
            const eventName = args.event;
            const handlerId = args.handler;
            if (!win['tauriListeners'][eventName]) {
              win['tauriListeners'][eventName] = [];
            }
            win['tauriListeners'][eventName].push(win['tauriEventCallbacks'][handlerId]);
            return Promise.resolve(handlerId);
          }

          if (cmd === 'detect_vram') {
            return Promise.resolve(mockVram);
          }

          if (cmd === 'detect_hardware_profile') {
            return Promise.resolve({
              is_unified: isUnified,
              dedicated_vram: vramBytes,
              system_ram: 34359738368,
              execution_ceiling: vramBytes,
              os_architecture: 'macos-x86_64'
            });
          }

          if (cmd === 'get_model_tag_for_vram') {
            const gb = args?.detectedVramGb || (mockVram / 1024);
            if (gb >= 48) return Promise.resolve('gemma4:31b');
            if (gb >= 40) return Promise.resolve('gemma4:26b');
            if (gb >= 24) return Promise.resolve('gemma4:12b');
            if (gb >= 12) return Promise.resolve('gemma4:e4b');
            return Promise.resolve('gemma4:e2b');
          }
          if (cmd === 'check_ollama_status') return Promise.resolve(false);
          if (cmd === 'check_hermes_status') return Promise.resolve(false);
          if (cmd === 'check_opencode_status') return Promise.resolve(false);
          if (cmd === 'check_tool_gateway_status') return Promise.resolve(false);
          if (cmd === 'get_frugallm_config') return Promise.resolve({ port: 1234 });
          if (cmd === 'get_credential') return Promise.resolve(null);
          if (cmd === 'is_wipe_mode') return Promise.resolve(false);

          return Promise.resolve();
        }
      }
    });

    win.emitTauriEvent = (event: string, payload: any) => {
      const listeners = win['tauriListeners'][event] || [];
      for (const listener of listeners) {
        listener({ event, payload });
      }
    };
  }, vramMb);
}

test.describe('Memory Pipeline & Strict Zero-Spillover Model Recommendation', () => {
  const vramMatrix = [
    { vramMb: 8192, expectedModel: 'gemma4:e2b', expectedVramInput: '8', label: '8GB VRAM' },
    { vramMb: 12288, expectedModel: 'gemma4:e4b', expectedVramInput: '12', label: '12GB VRAM' },
  ];

  for (const { vramMb, expectedModel, expectedVramInput, label } of vramMatrix) {
    test(`should recommend ${expectedModel} and render zero-spillover green zone for ${label}`, async ({ page }) => {
      await setupTauriMock(page, vramMb);

      const canvas = new MainCanvas(page);
      await canvas.goto();

      // Open Ollama node configuration panel
      await canvas.clickNode('Ollama');

      // Verify VRAM input reflects the detected capacity
      const vramInput = page.getByTestId('vram-detected-input');
      await expect(vramInput).toBeVisible();
      await expect(vramInput).toHaveValue(expectedVramInput);

      // Verify recommended model strictly adheres to zero-spillover threshold
      const recommendedModelInput = page.getByTestId('recommended-model-input');
      await expect(recommendedModelInput).toBeVisible();
      await expect(recommendedModelInput).toHaveValue(expectedModel);

      // Verify Memory Pipeline widget is rendered
      const pipelineWidget = page.getByTestId('memory-pipeline-widget');
      await expect(pipelineWidget).toBeVisible();
      await expect(page.getByTestId('memory-phase-badge')).toContainText('ESTIMATED');

      if (expectedModel === 'gemma4:e2b') {
        await expect(page.getByTestId('segment-weights')).toContainText('1.4G');
        await expect(page.getByTestId('segment-context')).toContainText('1.3G');
        await expect(page.getByTestId('total-required-stat')).toContainText('3.2 GB');
      } else if (expectedModel === 'gemma4:e4b') {
        await expect(page.getByTestId('segment-weights')).toContainText('4.9G');
        await expect(page.getByTestId('segment-context')).toContainText('3.1G');
        await expect(page.getByTestId('total-required-stat')).toContainText('8.5 GB');
      }

      // Verify no warning banner is visible in the zero-spillover green zone
      await expect(page.getByTestId('spillover-warning-banner')).not.toBeVisible();
    });
  }

  test('should render yellow PCIe Bus Bottleneck Warning when heavier model gemma4:e4b overflows 8GB VRAM', async ({ page }) => {
    // Mock 8192 MB VRAM environment
    await setupTauriMock(page, 8192);

    const canvas = new MainCanvas(page);
    await canvas.goto();

    // Open Ollama config panel
    await canvas.clickNode('Ollama');

    const recommendedModelInput = page.getByTestId('recommended-model-input');
    await expect(recommendedModelInput).toHaveValue('gemma4:e2b');

    // Emit a telemetry update where user selects or runs the heavier gemma4:e4b on 8GB VRAM
    await page.evaluate(() => {
      (window as any).emitTauriEvent('telemetry_update', {
        ollama: {
          status: 'idle',
          model_name: 'gemma4:e4b',
          location_state: 'gpu',
          total_size: 5261335552
        },
        hardware: {
          cpu_utilization: 5.0,
          gpu_utilization: 0.0,
          vram_used: 0,
          vram_total: 8589934592
        },
        hardware_profile: {
          is_unified: false,
          dedicated_vram: 8589934592,
          system_ram: 34359738368,
          execution_ceiling: 8589934592,
          os_architecture: 'macos-x86_64'
        },
        segments: {
          phase: 'preflight',
          weights_bytes: 5261335552,      // ~4.9 GB
          context_128k_bytes: 3330277376, // ~3.10 GB (Gemma 5:1 sliding window)
          overhead_bytes: 524288000,      // ~0.5 GB
          total_projected_bytes: 9115900928, // ~8.49 GB total footprint
          execution_ceiling_bytes: 8589934592, // 8.0 GB limit
          spillover_bytes: 525966336,     // ~0.49 GB spillover
          spillover_type: 'system_ram',
          triggers_warning: true,
          warning_message: 'Model & 128k context exceed Dedicated VRAM. Spillover will route across PCIe into System RAM.'
        }
      });
    });

    // Assert that the PCIe Bus Bottleneck Warning banner is displayed
    const warningBanner = page.getByTestId('spillover-warning-banner');
    await expect(warningBanner).toBeVisible();
    await expect(warningBanner).toContainText('PCIe Bus Bottleneck Warning');
    await expect(warningBanner).toContainText('Model & 128k context exceed Dedicated VRAM');

    // Assert that the spillover segment in the stacked bar is visible
    await expect(page.getByTestId('segment-spillover')).toBeVisible();
  });

  test('should dynamically recalculate and trigger spillover warning when user manually edits recommended model to gemma4:31b', async ({ page }) => {
    await setupTauriMock(page, 8192); // 8GB VRAM

    const canvas = new MainCanvas(page);
    await canvas.goto();

    // Open Ollama config panel
    await canvas.clickNode('Ollama');

    const recommendedModelInput = page.getByTestId('recommended-model-input');
    await expect(recommendedModelInput).toHaveValue('gemma4:e2b');

    // Initially in green zone (no warning banner)
    await expect(page.getByTestId('spillover-warning-banner')).not.toBeVisible();
    await expect(page.getByTestId('total-required-stat')).toContainText('3.2 GB');

    // User selects "gemma4:31b" from dropdown
    await recommendedModelInput.selectOption('gemma4:31b');

    // Verify Memory Pipeline instantly recalculates to ~43.8 / 43.9 GB total required
    await expect(page.getByTestId('total-required-stat')).toContainText('43.8 GB');

    // Verify yellow PCIe Bus Bottleneck Warning banner renders immediately
    const warningBanner = page.getByTestId('spillover-warning-banner');
    await expect(warningBanner).toBeVisible();
    await expect(warningBanner).toContainText('PCIe Bus Bottleneck Warning');
    await expect(warningBanner).toContainText('Model & 128k context exceed Dedicated VRAM');

    // Verify spillover segment is displayed in the stacked bar
    await expect(page.getByTestId('segment-spillover')).toBeVisible();

    // Verify collapsed canvas node does not render compact estimation bar
    await expect(page.getByTestId('compact-memory-stacked-bar')).not.toBeVisible();
  });

  test('should hide estimation functionality on collapsed Ollama node and display it in settings modal for 8GB VRAM', async ({ page }) => {
    await setupTauriMock(page, 8192);

    const canvas = new MainCanvas(page);
    await canvas.goto();

    // Verify collapsed canvas Ollama node renders allocation telemetry but hides estimation functionality
    await expect(page.getByTestId('hardware-node-allocation')).toBeVisible();
    await expect(page.getByTestId('compact-memory-stacked-bar')).not.toBeVisible();
    await expect(page.getByText('Pre-Flight 128k Allocation')).not.toBeVisible();

    // Open Ollama settings modal
    await canvas.clickNode('Ollama');

    // Assert modal's recommended model input is gemma4:e2b and total required is 3.2 GB
    const recommendedModelInput = page.getByTestId('recommended-model-input');
    await expect(recommendedModelInput).toHaveValue('gemma4:e2b');
    await expect(page.getByTestId('memory-pipeline-widget')).toBeVisible();
    await expect(page.getByTestId('total-required-stat')).toContainText('3.2 GB');
    await expect(page.getByTestId('hardware-ceiling-stat')).toContainText('8.0 GB');
  });

});
