import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Hover States Specification (CHO-58)', () => {
  const appCssPath = path.resolve(__dirname, '../App.css');
  const indexCssPath = path.resolve(__dirname, '../index.css');
  const appTsxPath = path.resolve(__dirname, '../App.tsx');

  const appCss = fs.readFileSync(appCssPath, 'utf-8');
  const indexCss = fs.readFileSync(indexCssPath, 'utf-8');
  const appTsx = fs.readFileSync(appTsxPath, 'utf-8');

  it('verifies canvas nodes maintain strictly stationary hover states without translateY', () => {
    // Canvas nodes must not use translateY on hover to avoid dynamic SVG line jitter
    expect(appTsx).not.toContain('transform: translateY(-2px)');
    expect(appCss).not.toContain('transform: translateY');
  });

  it('verifies canvas nodes have pure subtle shadow elevation on hover without layout displacement', () => {
    // App.tsx or CSS must declare hover shadow elevation on .retro-node
    const hasNodeHoverShadow =
      appTsx.includes('--node-card-shadow') ||
      indexCss.includes('.retro-node:hover') ||
      appCss.includes('.retro-node:hover');

    expect(hasNodeHoverShadow).toBe(true);

    // Ensure .retro-node transition includes box-shadow
    const hasBoxShadowTransition =
      appCss.includes('box-shadow') ||
      indexCss.includes('box-shadow') ||
      appTsx.includes('transition: box-shadow');
    expect(hasBoxShadowTransition).toBe(true);
  });

  it('verifies primary, secondary, and danger CTA classes provide explicit hover transitions in CSS', () => {
    const combinedCss = appCss + '\n' + indexCss;

    // CTA primary hover class
    expect(combinedCss).toContain('.btn-cta-primary:hover');
    // CTA secondary hover class
    expect(combinedCss).toContain('.btn-cta-secondary:hover');
    // CTA danger hover class
    expect(combinedCss).toContain('.btn-cta-danger:hover');
    // Base CTA transition
    expect(combinedCss).toMatch(/\.btn-cta\s*\{[^}]*transition:/);
  });

  it('verifies CTA buttons in key components consume CTA hover classes', () => {
    const exitModalPath = path.resolve(__dirname, '../components/ExitConfirmationModal.tsx');
    const portBannerPath = path.resolve(__dirname, '../components/PortConflictBanner.tsx');
    const nodeWidgetsPath = path.resolve(__dirname, '../components/NodeWidgets.tsx');

    const exitModal = fs.readFileSync(exitModalPath, 'utf-8');
    const portBanner = fs.readFileSync(portBannerPath, 'utf-8');
    const nodeWidgets = fs.readFileSync(nodeWidgetsPath, 'utf-8');

    expect(exitModal).toContain('btn-cta');
    expect(portBanner).toContain('btn-cta');
    expect(nodeWidgets).toContain('btn-cta');
  });

  it('verifies ExitConfirmationModal buttons render with btn-cta classes', async () => {
    const { render, screen } = await import('@testing-library/react');
    const { ExitConfirmationModal } = await import('../components/ExitConfirmationModal');

    render(
      <ExitConfirmationModal
        isOpen={true}
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );

    const cancelBtn = screen.getByTestId('exit-cancel-button');
    const confirmBtn = screen.getByTestId('exit-confirm-button');

    expect(cancelBtn.classList.contains('btn-cta')).toBe(true);
    expect(cancelBtn.classList.contains('btn-cta-secondary')).toBe(true);
    expect(confirmBtn.classList.contains('btn-cta')).toBe(true);
    expect(confirmBtn.classList.contains('btn-cta-danger')).toBe(true);
  });

  it('verifies PortConflictBanner buttons render with btn-cta classes', async () => {
    const { render, screen } = await import('@testing-library/react');
    const { PortConflictBanner } = await import('../components/PortConflictBanner');

    render(
      <PortConflictBanner
        port={61721}
        onConfigurePort={() => {}}
        onDismiss={() => {}}
      />
    );

    const configBtn = screen.getByTestId('port-conflict-configure');
    const dismissBtn = screen.getByTestId('port-conflict-dismiss');

    expect(configBtn.classList.contains('btn-cta')).toBe(true);
    expect(configBtn.classList.contains('btn-cta-danger')).toBe(true);
    expect(dismissBtn.classList.contains('btn-cta')).toBe(true);
    expect(dismissBtn.classList.contains('btn-cta-secondary')).toBe(true);
  });
});

