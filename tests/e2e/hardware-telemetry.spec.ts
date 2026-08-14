import { test, expect } from '@playwright/test';
import { HardwareTelemetryPage } from '../pages/HardwareTelemetry';
import { MainCanvasPage } from '../pages/MainCanvas';

test.describe('Hardware Telemetry Widget', () => {
  test.beforeEach(async ({ page }) => {
    // Inject the enhanced Tauri mock for event listening
    await page.addInitScript(() => {
      window.localStorage.setItem('onboardingState', 'completed');
      window['invokedCommands'] = [];
      window['tauriEventCallbacks'] = {};
      window['tauriListeners'] = {};
      let nextId = 1;

      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {
          transformCallback: (callback: any) => {
             const id = nextId++;
             window['tauriEventCallbacks'][id] = callback;
             return id;
          },
          invoke: (cmd: string, args: any) => {
            window['invokedCommands'].push({ cmd, args });
            
            if (cmd === 'plugin:event|listen') {
               const eventName = args.event;
               const handlerId = args.handler;
               if (!window['tauriListeners'][eventName]) {
                   window['tauriListeners'][eventName] = [];
               }
               window['tauriListeners'][eventName].push(window['tauriEventCallbacks'][handlerId]);
               return Promise.resolve(handlerId);
            }
            
            if (cmd === 'check_ollama_status') return Promise.resolve(false);
            if (cmd === 'check_hermes_status') return Promise.resolve(false);
            if (cmd === 'check_opencode_status') return Promise.resolve(false);
            if (cmd === 'detect_vram') return Promise.resolve(8192);
            if (cmd === 'get_frugallm_config') return Promise.resolve({ port: 1234 });
            if (cmd === 'get_credential') return Promise.resolve(null);
            
            return Promise.resolve();
          }
        }
      });

      (window as any).emitTauriEvent = (event: string, payload: any) => {
         const listeners = window['tauriListeners'][event] || [];
         for (const listener of listeners) {
             listener({ event, payload });
         }
      };
    });

    await page.goto('/');
  });

  test('should render offline state by default', async ({ page }) => {
    const telemetry = new HardwareTelemetryPage(page);
    
    // Header should show IDLE
    await expect(telemetry.statusLight).toHaveText('IDLE');
    await expect(telemetry.activeModel).toHaveText('None');

    // Expand the widget
    await telemetry.toggle();

    // In offline/CPU mode, labels should be CPU and RAM
    await expect(telemetry.loadLabel).toHaveText('CPU Load');
    await expect(telemetry.loadValue).toHaveText('0.0%');

    await expect(telemetry.memoryLabel).toHaveText('RAM Allocation');
    await expect(telemetry.memoryValue).toHaveText('0.0 / 0.0 GB');

    await expect(telemetry.throughputValue).toContainText('0.0');
  });

  test('should update UI on active GPU telemetry', async ({ page }) => {
    const telemetry = new HardwareTelemetryPage(page);
    await telemetry.toggle();
    
    // Emit a mock telemetry payload for GPU
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

    // Header should update to LOADED (since it's active but not generating)
    await expect(telemetry.statusLight).toHaveText('LOADED');
    await expect(telemetry.activeModel).toHaveText('llama3:8b-instruct-q4_0');

    // Should switch to GPU labels
    await expect(telemetry.loadLabel).toHaveText('GPU Load');
    await expect(telemetry.loadValue).toHaveText('82.3%');

    await expect(telemetry.memoryLabel).toHaveText('VRAM Allocation');
    await expect(telemetry.memoryValue).toHaveText('4.4 / 8.0 GB');

    await page.waitForTimeout(500);
    await page.screenshot({ path: './copy-audit/hardware-telemetry-widget.png', fullPage: true });
  });

  test('should update throughput when bytes are emitted', async ({ page }) => {
    const telemetry = new HardwareTelemetryPage(page);
    await telemetry.toggle();
    
    // Emit active payload first so throughput calculation is allowed
    await telemetry.emitTelemetry({
      ollama: { status: 'active', model_name: 'test-model', location_state: 'cpu' },
      hardware: { cpu_utilization: 10, vram_total: 0 }
    });
    
    await expect(telemetry.statusLight).toHaveText('LOADED');

    // Throughput is calculated using a custom DOM event 'pty_bytes'
    // in NodeWidgets.tsx: window.addEventListener('pty_bytes', handleBytes);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('pty_bytes', { detail: 100 }));
    });
    
    // We need to wait > 0.5 seconds for the throughput average to calculate
    await page.waitForTimeout(600);
    
    // Dispatch another chunk so elapsed time is > 0.5
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('pty_bytes', { detail: 100 }));
    });
    
    // It should now transition to THINKING since throughput > 0
    await expect(telemetry.statusLight).toHaveText('THINKING');
    
    // Throughput should be calculated (not 0.0)
    await expect(telemetry.throughputValue).not.toContainText('0.0');
    
    // Wait for throughput timeout to reset (1 second pause)
    await page.waitForTimeout(1100);
    
    // Should go back to LOADED and throughput 0.0
    await expect(telemetry.statusLight).toHaveText('LOADED');
    await expect(telemetry.throughputValue).toContainText('0.0');
  });
});
