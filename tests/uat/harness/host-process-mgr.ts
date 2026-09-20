import { spawnSync } from 'node:child_process';

export const isWindows = process.platform === 'win32';

/**
 * Gracefully or forcefully kills a process tree across Windows, macOS, and Linux.
 * On Windows, executes `taskkill /F /T /PID <pid>` with stderr routed to ignore
 * to avoid "ERROR: The process not found" noise.
 * On macOS/Linux, retrieves child PIDs and sends SIGTERM, then SIGKILL if needed.
 */
export async function killProcessTree(pid: number, signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
  if (!pid || pid <= 0) return;

  if (isWindows) {
    try {
      spawnSync('taskkill', ['/F', '/T', '/PID', pid.toString()], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch {
      // Ignored per cross-platform silent termination mandate
    }
    return;
  }

  // Unix (macOS / Linux): Find children and terminate bottom-up
  try {
    const pgrep = spawnSync('pgrep', ['-P', pid.toString()], { encoding: 'utf8' });
    if (pgrep.stdout) {
      const childPids = pgrep.stdout.trim().split(/\s+/).filter(Boolean);
      for (const cPid of childPids) {
        const numeric = parseInt(cPid, 10);
        if (!isNaN(numeric) && numeric > 0) {
          await killProcessTree(numeric, signal);
        }
      }
    }
  } catch {
    // pgrep not available or no children
  }

  try {
    process.kill(pid, signal);
  } catch {
    // Process may have already exited
  }

  // Grace period before SIGKILL
  if (signal !== 'SIGKILL') {
    await new Promise((r) => setTimeout(r, 200));
    try {
      process.kill(pid, 0); // Check if alive
      process.kill(pid, 'SIGKILL');
    } catch {
      // Successfully dead
    }
  }
}

/**
 * Kills all running instances of a given process name silently.
 */
export async function killProcessesByName(name: string): Promise<void> {
  if (isWindows) {
    const exeName = name.endsWith('.exe') ? name : `${name}.exe`;
    try {
      spawnSync('taskkill', ['/F', '/T', '/IM', exeName], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch {}
    return;
  }

  try {
    // Strictly match exact executable name (-x), never pattern-match full cmdline (-f)
    // to prevent accidentally killing IDE servers whose paths contain workspace directory names
    spawnSync('pkill', ['-9', '-x', name], { stdio: 'ignore' });
  } catch {}
}

/**
 * Deep sweep to terminate any orphaned FrugaLLM, Ollama, Hermes, or OpenCode daemons.
 */
export async function killOrphanProcesses(): Promise<void> {
  const processNames = [
    'frugallm-app',
    'ollama',
    'hermes',
    'opencode',
  ];

  for (const proc of processNames) {
    await killProcessesByName(proc);
  }
}
