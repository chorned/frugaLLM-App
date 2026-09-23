import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { killOrphanProcesses, killProcessesByName, safeDeleteWithRetry } from './host-process-mgr';
import { waitForPortClosed } from './port-sentinel';

/**
 * Global fail-safe emergency teardown.
 * Invoked on Playwright globalTeardown or OS process exit/abort signals.
 */
export async function executeEmergencyTeardown(): Promise<void> {
  console.log('🚨 [EmergencyTeardown] Running fail-safe host sweep...');

  try {
    // 1. Force-kill all relevant process trees
    await killOrphanProcesses();

    // 2. Ensure ports are free
    const trackedPorts = [8080, 8081, 54321, 61721, 11434];
    for (const port of trackedPorts) {
      await waitForPortClosed(port, 3000);
    }

    // 3. Clean up any temporary test directories
    const tempDir = path.resolve(os.tmpdir(), 'frugallm-uat-test');
    await safeDeleteWithRetry(tempDir);

    console.log('✅ [EmergencyTeardown] Host sweep complete.');
  } catch (err) {
    console.error('⚠️ [EmergencyTeardown] Error during emergency sweep:', err);
  }
}

// Hook into Node.js process exit signals for abort/Ctrl+C safety
let hooksInstalled = false;
export function installEmergencyHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;

  const handleSignal = async (signal: string) => {
    console.log(`\n🛑 [EmergencyTeardown] Intercepted signal ${signal}. Executing cleanup...`);
    await executeEmergencyTeardown();
    process.exit(1);
  };

  process.once('SIGINT', () => handleSignal('SIGINT'));
  process.once('SIGTERM', () => handleSignal('SIGTERM'));
  process.once('SIGHUP', () => handleSignal('SIGHUP'));
}

// Default export for Playwright globalTeardown
export default async function globalTeardown(): Promise<void> {
  await executeEmergencyTeardown();
}
