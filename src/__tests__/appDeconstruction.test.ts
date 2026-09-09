import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('CHO-116: App.tsx Deconstruction and Modularization', () => {
  const appPath = path.resolve(__dirname, '../App.tsx');

  it('enforces src/App.tsx line count is under 600 lines', () => {
    const content = fs.readFileSync(appPath, 'utf-8');
    const lines = content.split('\n');
    expect(lines.length).toBeLessThan(600);
  });

  it('exports extracted modular domain components from src/components/', async () => {
    const nodeConfigModule = await import('../components/NodeConfigPanel');
    expect(nodeConfigModule.NodeConfigPanel).toBeDefined();

    const terminalViewModule = await import('../components/TerminalView');
    expect(terminalViewModule.TerminalView).toBeDefined();

    const canvasModule = await import('../components/TopologyCanvas');
    expect(canvasModule.TopologyCanvas).toBeDefined();

    const headerModule = await import('../components/Header');
    expect(headerModule.Header).toBeDefined();

    const footerModule = await import('../components/Footer');
    expect(footerModule.Footer).toBeDefined();
  });
});
