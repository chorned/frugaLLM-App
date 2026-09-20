#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcTauri = resolve(__dirname, '..', 'src-tauri');

const env = {
  ...process.env,
  FRUGAL_OFFLINE_BUILD: process.env.FRUGAL_OFFLINE_BUILD || '1',
};

const args = ['test', '--bin', 'frugallm-app', '--', '--test-threads=1', ...process.argv.slice(2)];

const child = spawn('cargo', args, {
  cwd: srcTauri,
  stdio: 'inherit',
  env,
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
