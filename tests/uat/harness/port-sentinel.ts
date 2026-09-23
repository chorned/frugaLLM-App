import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { killProcessesByName } from './host-process-mgr';

/**
 * Checks if a given TCP port is currently accepting connections.
 */
export function isPortOpen(port: number, host = 'localhost'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(800);
    socket.once('connect', () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      // If localhost or 127.0.0.1 failed, try the other as fallback
      if (host === 'localhost') {
        const fallback = new net.Socket();
        fallback.setTimeout(800);
        fallback.once('connect', () => {
          fallback.destroy();
          resolve(true);
        });
        fallback.once('timeout', () => {
          fallback.destroy();
          resolve(false);
        });
        fallback.once('error', () => {
          resolve(false);
        });
        fallback.connect(port, '127.0.0.1');
        return;
      }
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Polls until a port opens or timeout is reached.
 */
export async function waitForPortOpen(
  port: number,
  timeoutMs = 25000,
  host = '127.0.0.1'
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port, host)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/**
 * Polls until a port is closed or timeout is reached.
 */
export async function waitForPortClosed(
  port: number,
  timeoutMs = 15000,
  host = '127.0.0.1'
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await isPortOpen(port, host))) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/**
 * Asserts that none of the provided ports are currently open.
 * Throws an descriptive error if any port is bound.
 */
export async function assertPortsClosed(ports: number[]): Promise<void> {
  const openPorts: number[] = [];
  for (const port of ports) {
    if (await isPortOpen(port)) {
      openPorts.push(port);
    }
  }

  if (openPorts.length > 0) {
    throw new Error(
      `[PortSentinel] Pre-flight port check failed: Ports [${openPorts.join(', ')}] are still open and in use.`
    );
  }
}

/**
 * Simulates a port conflict by binding a raw TCP listener.
 * Returns an object with a `close()` method to release the port.
 */
export async function bindConflictPort(port: number): Promise<{ close: () => Promise<void> }> {
  const server = net.createServer();

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolve();
    });
  });

  return {
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

/**
 * Unconditionally restores FrugaLLM native proxy to the default port (default: 61721).
 * Recovers across multiple tiers:
 * 1. Fast path: returns immediately if targetPort is already open.
 * 2. UI port input change and save (if page is provided and healthy)
 * 3. Direct HTTP POST IPC across candidate ports (8081, 8080, 54321, targetPort)
 * 4. Configuration file synchronization on disk
 * 5. Failsafe: Terminate any lingering frugallm-app process if the target port refuses to open
 *    to guarantee that subsequent test phases do not fail due to single-instance conflicts.
 */
export async function restoreDefaultPort(page?: any, targetPort = 61721): Promise<void> {
  console.log(`[PortSentinel] Restoring default port to ${targetPort}...`);
  if (await isPortOpen(targetPort)) {
    console.log(`[PortSentinel] Port ${targetPort} is already open and responding.`);
    return;
  }

  // Tier 1: Try via UI if page is available and interactive
  if (page && typeof page.isClosed === 'function' && !page.isClosed()) {
    try {
      const frugallmCard = page.locator('[data-testid="node-frugallm"]');
      const drawer = page.locator('.node-config-panel, [data-testid="node-config-panel"]').first();
      if (!await drawer.isVisible().catch(() => false)) {
        if (await frugallmCard.isVisible({ timeout: 2000 }).catch(() => false)) {
          await frugallmCard.click();
          await drawer.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
        }
      }
      const portInput = page.locator('[data-testid="input-frugallm-port"]');
      if (await portInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await portInput.fill(targetPort.toString());
        const saveBtn = page.locator('[data-testid="save-node-config-button"]');
        if (await saveBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
          await saveBtn.click();
          await page.waitForTimeout(500);
        }
      }
    } catch (err) {
      console.warn('[PortSentinel] UI restoration attempt encountered error:', err);
    }
  }

  if (await waitForPortOpen(targetPort, 15000)) {
    console.log(`[PortSentinel] Successfully restored port ${targetPort} via UI.`);
    return;
  }

  // Tier 2: Direct HTTP IPC to candidate ports
  const candidatePorts = [8081, 8080, 54321, targetPort];
  for (const p of candidatePorts) {
    try {
      await fetch(`http://127.0.0.1:${p}/__tauri_ipc__`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cmd: 'set_frugallm_config',
          args: {
            new_config: { port: targetPort },
            newConfig: { port: targetPort },
            port: targetPort,
          },
        }),
      });
    } catch {}
  }

  if (await waitForPortOpen(targetPort, 15000)) {
    console.log(`[PortSentinel] Successfully restored port ${targetPort} via direct IPC.`);
    return;
  }

  // Tier 3: Sync config file on disk
  try {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const possibleConfigPaths = [
      path.join(home, 'Library', 'Application Support', 'com.chorned.frugallm-app', 'frugal_config.json'),
      path.join(home, 'AppData', 'Roaming', 'com.chorned.frugallm-app', 'frugal_config.json'),
      path.join(home, '.config', 'com.chorned.frugallm-app', 'frugal_config.json'),
    ];
    for (const cp of possibleConfigPaths) {
      if (fs.existsSync(cp)) {
        const raw = fs.readFileSync(cp, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.port !== targetPort) {
          parsed.port = targetPort;
          fs.writeFileSync(cp, JSON.stringify(parsed, null, 2));
        }
      }
    }
  } catch {}

  // Tier 4: Failsafe kill lingering frugallm-app process so next test starts fresh on 61721
  if (!await waitForPortOpen(targetPort, 5000)) {
    console.warn(`⚠️ [PortSentinel] Port ${targetPort} is still not open. Killing lingering frugallm-app processes to prevent single-instance deadlock...`);
    await killProcessesByName('frugallm-app');
    await waitForPortClosed(8081, 5000);
    await waitForPortClosed(8080, 5000);
    await waitForPortClosed(54321, 5000);
  }
}
