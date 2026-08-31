import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock localStorage if missing or experimental in Node/JSDOM
class LocalStorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }
}

const mockStorage = new LocalStorageMock();
Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true,
  });
}

// Mock transformers.js for Node/jsdom
vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue({}),
  env: {
    allowLocalModels: false,
    useBrowserCache: true,
  },
}));

// Mock Tauri internals and globals if accessed in browser/jsdom
if (typeof window !== "undefined") {
  // @ts-expect-error Mock Tauri internals
  window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {
    invoke: vi.fn(),
    transformCallback: vi.fn((cb) => cb),
  };
}
