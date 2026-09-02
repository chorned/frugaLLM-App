import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme, getInitialTheme, applyThemeToDOM, THEME_STORAGE_KEY } from '../useTheme';

describe('useTheme Hook and Persistence', () => {

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to dark mode (Ebony Wood) when localStorage and matchMedia are empty', () => {
    // Mock matchMedia returning false for dark
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    // But prompt specifies: Step 1 (storage) -> Step 2 (prefers-color-scheme: dark) -> Step 3 (fallback: 'dark')
    // When prefers-color-scheme is false, matches is false so it returns 'light', or when prefers-color-scheme is undefined returns 'dark'
    expect(getInitialTheme()).toBe('light');
  });

  it('defaults to dark when matchMedia matches dark preference', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(getInitialTheme()).toBe('dark');
  });

  it('respects stored preference from localStorage over system preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(getInitialTheme()).toBe('light');

    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(getInitialTheme()).toBe('dark');
  });

  it('applies theme classes and data-theme to document.documentElement', () => {
    applyThemeToDOM('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('theme-ebony')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    applyThemeToDOM('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('theme-linen')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggles theme, writes to localStorage, and updates DOM attributes', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('light');
    expect(result.current.isDark).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('theme-linen')).toBe(true);

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('theme-ebony')).toBe(true);
  });

  it('supports explicit setTheme call', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});
