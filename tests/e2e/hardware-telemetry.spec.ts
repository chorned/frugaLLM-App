import { test, expect } from '@playwright/test';
import { HardwareTelemetryPage } from '../pages/HardwareTelemetry';

test.describe('Hardware Telemetry Widget', () => {
  test.beforeEach(async ({ page }) => {
    // Inject the enhanced Tauri mock for event listening
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err));
    await page.addInitScript(() => {
      const win = window as Record<string, any>;
      win.localStorage.setItem("onboardingState", "completed");
      win["__TAURI_EVENT_PLUGIN_INTERNALS__"] = { unregisterListener: () => {} };
      win['invokedCommands'] = [];
      win['tauriEventCallbacks'] = {};
      win['tauriListeners'] = {};
      win['lastPayloads'] = {};
      let nextId = 1;

      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {
          plugins: { event: { unregisterListener: () => {} } },
          transformCallback: (callback: any) => {
             const id = nextId++;
             win['tauriEventCallbacks'][id] = callback;
             return id;
          },
          invoke: (cmd: string, args: any) => {
            win['invokedCommands'].push({ cmd, args });
            
            if (cmd === 'plugin:event|listen') {
               const eventName = args.event;
               const handlerId = args.handler;
               if (!win['tauriListeners'][eventName]) {
                   win['tauriListeners'][eventName] = [];
               }
               const cb = win['tauriEventCallbacks'][handlerId];
               win['tauriListeners'][eventName].push(cb);
               if (win['lastPayloads'][eventName] !== undefined && typeof cb === 'function') {
                   try {
                     cb({ event: eventName, payload: win['lastPayloads'][eventName] });
                   } catch (e) {
                     console.error(e);
                   }
               }
               return Promise.resolve(handlerId);
            }
            
            if (cmd === 'check_ollama_status') return Promise.resolve(false);
            if (cmd === 'check_hermes_status') return Promise.resolve(false);
            if (cmd === 'check_opencode_status') return Promise.resolve(false);
            if (cmd === 'detect_vram') return Promise.resolve(8192);
            if (cmd === 'get_model_tag_for_vram') return Promise.resolve('gemma4:e2b');
            if (cmd === 'get_frugallm_config') return Promise.resolve({ port: 1234 });
            if (cmd === 'get_credential') return Promise.resolve(null);
            if (cmd === 'is_wipe_mode') return Promise.resolve(false);
            
            return Promise.resolve();
          }
        }
      });

      win.emitTauriEvent = (event: string, payload: any) => {
         win['lastPayloads'][event] = payload;
         const listeners = win['tauriListeners'][event] || [];
         for (const listener of listeners) {
             try {
               listener({ event, payload });
             } catch (err) {
               console.error(`Error in listener for ${event}:`, err);
             }
         }
      };
    });

    await page.goto('/');
  });

  test('should render offline state by default and verify legacy drawer is removed', async ({ page }) => {
    const telemetry = new HardwareTelemetryPage(page);
    
    // Header should not show active indicator by default
    await expect(telemetry.statusLight).not.toBeVisible();
    await expect(telemetry.activeModel).toHaveText('None');
    await expect(telemetry.allocation).toHaveText('0.0 / 8.0 GB');

    // Verify removed drawer trigger and panel do not exist (CHO-139)
    await expect(page.getByTestId('hardware-telemetry-trigger')).not.toBeVisible();
    await expect(page.getByTestId('hardware-telemetry-panel')).not.toBeVisible();
  });

  test('should update active model and allocation on active GPU telemetry', async ({ page }) => {
    const telemetry = new HardwareTelemetryPage(page);
    
    // Emit a mock telemetry payload for active GPU model
    await telemetry.emitTelemetry({
      ollama: {
        status: 'active',
        model_name: 'llama3:8b-instruct-q4_0',
        location_state: 'gpu',
        hybrid_percent: 0,
        total_size: 4744265728,
        vram_size: 4744265728
      },
      hardware: {
        cpu_utilization: 15.5,
        gpu_utilization: 82.3,
        vram_used: 4744265728, // 4.4 GB
        vram_total: 8589934592 // 8.0 GB
      }
    });

    // Status should update to LOADED and model/allocation should update
    await expect(telemetry.statusLight).toHaveText('Loaded');
    await expect(telemetry.activeModel).toHaveText('llama3:8b-instruct-q4_0');
    await expect(telemetry.allocation).toHaveText('4.4 / 8.0 GB');
  });

  test('should update status to Ready when Ollama telemetry reports idle with model', async ({ page }) => {
    const telemetry = new HardwareTelemetryPage(page);

    await telemetry.emitTelemetry({
      ollama: {
        status: 'idle',
        model_name: 'gemma4:e4b',
        location_state: 'unknown',
        total_size: 9608350473
      },
      hardware: {
        cpu_utilization: 5.0,
        gpu_utilization: 0.0,
        vram_used: 0,
        vram_total: 16000000000
      }
    });

    await expect(telemetry.statusLight).toHaveText('Ready');
    await expect(telemetry.activeModel).toHaveText('gemma4:e4b');
  });

  test('should reflect custom execution ceiling from hardware profile', async ({ page }) => {
    const telemetry = new HardwareTelemetryPage(page);

    await telemetry.emitTelemetry({
      ollama: {
        status: 'active',
        model_name: 'gemma4:12b',
        location_state: 'gpu',
        total_size: 4294967296
      },
      hardware: {
        cpu_utilization: 10,
        gpu_utilization: 50,
        vram_used: 4294967296
      },
      hardware_profile: {
        is_unified: true,
        execution_ceiling: 17179869184
      }
    });

    await expect(telemetry.activeModel).toHaveText('gemma4:12b');
    await expect(telemetry.allocation).toHaveText('4.0 / 16.0 GB');
  });

  test('should transition to Thinking state on active generation and PTY throughput', async ({ page }) => {
    const telemetry = new HardwareTelemetryPage(page);

    await telemetry.emitTelemetry({
      ollama: { status: 'active', model_name: 'gemma4:e4b', location_state: 'gpu' },
      hardware: { cpu_utilization: 10, vram_total: 8589934592 }
    });

    await expect(telemetry.statusLight).toHaveText('Loaded');

    // Dispatch pty_bytes custom event
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('pty_bytes', { detail: 100 }));
    });

    // Wait for first token calculation threshold
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('pty_bytes', { detail: 100 }));
    });

    await expect(telemetry.statusLight).toHaveText('Thinking');
  });
});
