import { expect, type Locator, type Page } from '@playwright/test';

export class MainCanvas {
  readonly page: Page;
  readonly canvas: Locator;
  readonly nodes: Locator;
  readonly edges: Locator;

  constructor(page: Page) {
    this.page = page;
    this.canvas = page.locator('div[style*="cursor: grab"], div[style*="cursor: grabbing"]').first();
    this.nodes = page.locator('[data-node-id]');
    this.edges = page.locator('svg line');
  }

  async goto() {
    await this.page.goto('/');
  }

  async getNode(label: string) {
    return this.nodes.filter({ hasText: label });
  }

  async panCanvas(dx: number, dy: number) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 5 });
    await this.page.mouse.up();
  }

  async zoomCanvas(deltaY: number) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.wheel(0, deltaY);
  }

  async dragNode(label: string, dx: number, dy: number) {
    const node = await this.getNode(label);
    const box = await node.boundingBox();
    if (!box) throw new Error(`Node ${label} not found`);

    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 5 });
    await this.page.mouse.up();
  }

  async clickNode(label: string) {
    const node = await this.getNode(label);
    // Click slightly below the center to hit the body of the node, avoiding any headers that might stop propagation
    await node.click({ position: { x: 110, y: 50 } });
  }
}
