import net from 'node:net';

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
