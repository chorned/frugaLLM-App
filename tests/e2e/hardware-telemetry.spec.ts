import { test, expect } from '@playwright/test';
import { HardwareTelemetryPage } from '../pages/HardwareTelemetry';
import { MainCanvas } from '../pages/MainCanvas';

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
               win['tauriListeners'][eventName].push(win['tauriEventCallbacks'][handlerId]);
               return Promise.resolve(handlerId);
            }
            
            if (cmd === 'check_ollama_status') return Promise.resolve(false);
            if (cmd === 'check_hermes_status') return Promise.resolve(false);
            if (cmd === 'check_opencode_status') return Promise.resolve(false);
            if (cmd === 'detect_vram') return Promise.resolve(8192);
            if (cmd === 'get_model_tag_for_vram') return Promise.resolve('gemma4:e2b');
            if (cmd === 'get_frugallm_config') return Promise.resolve({ port: 1234 });
            if (cmd === 'get_credential') return Promise.resolve(null);
            
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
    });

    await page.goto('/');
  });

  test('should render offline state by default', async ({ page }) => {
    const telemetry = new HardwareTelemetryPage(page);
    
    // Header should not show standby indicator by default
    await expect(telemetry.statusLight).not.toBeVisible();
    await expect(telemetry.activeModel).toHaveText('None');

    // Expand the widget
    await telemetry.toggle();

    // In offline/CPU mode, labels should be CPU and RAM
    await expect(telemetry.loadLabel).toHaveText('CPU Load');
    await expect(telemetry.loadValue).toHaveText('0.0%');

    await expect(telemetry.memoryLabel).toHaveText('RAM Allocation');
    await expect(telemetry.memoryValue).toHaveText('0.0 / 8.0 GB');

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
    await expect(telemetry.statusLight).toHaveText('Loaded');
    await expect(telemetry.activeModel).toHaveText('llama3:8b-instruct-q4_0');

    // Should switch to GPU labels
    await expect(telemetry.loadLabel).toHaveText('GPU Load');
    await expect(telemetry.loadValue).toHaveText('82.3%');

    await expect(telemetry.memoryLabel).toHaveText('VRAM Allocation');
    await expect(telemetry.memoryValue).toHaveText('4.4 / 8.0 GB');

    await page.waitForTimeout(500);
    await page.screenshot({ path: './copy-audit/hardware-telemetry-widget.png', fullPage: true });
  });

  test('should render Memory Pipeline stacked bar with 128k context and spillover warning', async ({ page }) => {
    const telemetry = new HardwareTelemetryPage(page);
    await telemetry.toggle();

    // Emit telemetry with Pre-Flight state on Discrete GPU exceeding 8GB VRAM (e.g. gemma4:e4b + 128k Q8 context)
    await telemetry.emitTelemetry({
      ollama: { status: 'idle', model_name: 'None', location_state: 'unknown' },
      hardware: { cpu_utilization: 0, vram_total: 8589934592 },
      hardware_profile: {
        is_unified: false,
        dedicated_vram: 8589934592,
        system_ram: 34359738368,
        execution_ceiling: 8589934592,
        os_architecture: 'macos-x86_64'
      },
      segments: {
        phase: 'preflight',
        weights_bytes: 5261335552,
        context_128k_bytes: 17179869184,
        overhead_bytes: 524288000,
        total_projected_bytes: 22965492736,
        execution_ceiling_bytes: 8589934592,
        spillover_bytes: 14375558144,
        spillover_type: 'system_ram',
        triggers_warning: true,
        warning_message: 'Model & 128k context exceed Dedicated VRAM. Spillover will route across PCIe into System RAM.'
      }
    });

    const panel = page.getByTestId('hardware-telemetry-panel');
    await expect(panel.getByTestId('memory-pipeline-widget')).toBeVisible();
    await expect(panel.getByTestId('memory-phase-badge')).toContainText('PRE-FLIGHT ESTIMATION');
    await expect(panel.getByTestId('architecture-badge')).toContainText('Discrete GPU');
    await expect(panel.getByTestId('segment-weights')).toBeVisible();
    await expect(panel.getByTestId('segment-context')).toBeVisible();
    await expect(panel.getByTestId('segment-spillover')).toBeVisible();
    await expect(panel.getByTestId('spillover-warning-banner')).toContainText('PCIe Bus Bottleneck Warning');

    // Transition to Apple Silicon Unified Memory Live state
    await telemetry.emitTelemetry({
      ollama: { status: 'active', model_name: 'gemma4:e2b', location_state: 'gpu', total_size: 1717986918, vram_size: 1717986918 },
      hardware: { cpu_utilization: 12, gpu_utilization: 45, vram_total: 15032385536 },
      hardware_profile: {
        is_unified: true,
        dedicated_vram: 0,
        system_ram: 17179869184,
        execution_ceiling: 15032385536,
        os_architecture: 'macos-arm64'
      },
      segments: {
        phase: 'live',
        weights_bytes: 1717986918,
        context_128k_bytes: 6979321856,
        overhead_bytes: 524288000,
        total_projected_bytes: 9221596774,
        execution_ceiling_bytes: 15032385536,
        spillover_bytes: 0,
        spillover_type: 'none',
        triggers_warning: false,
        warning_message: ''
      }
    });

    await expect(panel.getByTestId('memory-phase-badge')).toContainText('LIVE RUNTIME');
    await expect(panel.getByTestId('architecture-badge')).toContainText('Apple Silicon (Unified Memory)');
    await expect(panel.getByTestId('spillover-warning-banner')).not.toBeVisible();
  });

  test('should update throughput when bytes are emitted', async ({ page }) => {
    const telemetry = new HardwareTelemetryPage(page);
    await telemetry.toggle();
    
    // Emit active payload first so throughput calculation is allowed
    await telemetry.emitTelemetry({
      ollama: { status: 'active', model_name: 'test-model', location_state: 'cpu' },
      hardware: { cpu_utilization: 10, vram_total: 0 }
    });
    
    await expect(telemetry.statusLight).toHaveText('Loaded');

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
    await expect(telemetry.statusLight).toHaveText('Thinking');
    
    // Throughput should be calculated (not 0.0)
    await expect(telemetry.throughputValue).not.toContainText('0.0 t/s');
    
    // Wait for stream timeout (1.2 second pause)
    await page.waitForTimeout(1300);
    
    // Should go back to LOADED
    await expect(telemetry.statusLight).toHaveText('Loaded');
    // Avg throughput should retain the computed average value
    await expect(telemetry.throughputValue).not.toContainText('0.0 t/s');
  });

  test('should support high-throughput speed exceeding 250 t/s without clamping', async ({ page }) => {
    const telemetry = new HardwareTelemetryPage(page);
    await telemetry.toggle();
    
    await telemetry.emitTelemetry({
      ollama: { status: 'active', model_name: 'vllm-engine', location_state: 'gpu' },
      hardware: { cpu_utilization: 20, vram_total: 16000 }
    });
    
    // First high-volume chunk (2000 bytes = 500 tokens)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('pty_bytes', { detail: 2000 }));
    });
    
    await page.waitForTimeout(400); // 0.4s elapsed
    
    // Second chunk (2000 bytes = 500 tokens, total = 1000 tokens / 0.4s = ~2500 t/s)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('pty_bytes', { detail: 2000 }));
    });
    
    // Live throughput should exceed 250 t/s without artificial clamping
    await expect(async () => {
      const text = await telemetry.throughputValue.textContent();
      const speed = parseFloat(text || '0');
      expect(speed).toBeGreaterThan(250);
    }).toPass();
  });

  test('should toggle benchmark reference panel showing Claude Sonnet and cloud tiers', async ({ page }) => {
    const telemetry = new HardwareTelemetryPage(page);
    await telemetry.toggle();

    // Benchmark panel should not be visible initially
    await expect(telemetry.benchmarkPanel).not.toBeVisible();

    // Click ( i ) benchmark info button
    await telemetry.toggleBenchmarks();

    // Benchmark panel should be visible
    await expect(telemetry.benchmarkPanel).toBeVisible();
    await expect(telemetry.benchmarkPanel).toContainText('Claude 3.7 / 3.5 Sonnet');
    await expect(telemetry.benchmarkPanel).toContainText('~75 - 90 t/s');
    await expect(telemetry.benchmarkPanel).toContainText('Gemini 2.5 Flash');
    await expect(telemetry.benchmarkPanel).toContainText('Local Intel x86 (AVX2)');

    // Toggle off
    await telemetry.toggleBenchmarks();
    await expect(telemetry.benchmarkPanel).not.toBeVisible();
  });
});
