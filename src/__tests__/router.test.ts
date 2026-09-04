import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchFreeOpenRouterModels, isOpenRouterFreeAlias } from '../router';

describe('router module', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('isOpenRouterFreeAlias', () => {
    it('returns true for openrouter:free and openrouter/free aliases in any casing or whitespace', () => {
      expect(isOpenRouterFreeAlias('openrouter/free')).toBe(true);
      expect(isOpenRouterFreeAlias('openrouter:free')).toBe(true);
      expect(isOpenRouterFreeAlias('OpenRouter/Free')).toBe(true);
      expect(isOpenRouterFreeAlias('OPENROUTER:FREE')).toBe(true);
      expect(isOpenRouterFreeAlias('  openrouter/free  ')).toBe(true);
    });

    it('returns false for non-alias model IDs, empty strings, and undefined', () => {
      expect(isOpenRouterFreeAlias('google/gemma-4-31b-it:free')).toBe(false);
      expect(isOpenRouterFreeAlias('openrouter/auto')).toBe(false);
      expect(isOpenRouterFreeAlias('meta-llama/llama-3.3-70b-instruct:free')).toBe(false);
      expect(isOpenRouterFreeAlias('')).toBe(false);
      expect(isOpenRouterFreeAlias(undefined)).toBe(false);
    });
  });

  it('sends Authorization header when apiKey is valid (> 5 characters)', async () => {
    // Arrange
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    globalThis.fetch = mockFetch;

    // Act
    await fetchFreeOpenRouterModels('sk-valid-openrouter-key-123');

    // Assert
    expect(mockFetch).toHaveBeenCalledWith('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: 'Bearer sk-valid-openrouter-key-123',
      },
    });
  });

  it('omits Authorization header when apiKey is omitted, empty, or <= 5 characters', async () => {
    // Arrange
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    globalThis.fetch = mockFetch;

    // Act
    await fetchFreeOpenRouterModels('');
    await fetchFreeOpenRouterModels('12345');
    await fetchFreeOpenRouterModels(undefined);

    // Assert
    expect(mockFetch).toHaveBeenNthCalledWith(1, 'https://openrouter.ai/api/v1/models', { headers: {} });
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://openrouter.ai/api/v1/models', { headers: {} });
    expect(mockFetch).toHaveBeenNthCalledWith(3, 'https://openrouter.ai/api/v1/models', { headers: {} });
  });

  it('filters models requiring "tools" supported parameter and zero prompt/completion pricing', async () => {
    // Arrange
    const mockModels = [
      {
        id: 'free/tool-model',
        supported_parameters: ['tools', 'temperature'],
        pricing: { prompt: '0', completion: '0' },
        context_length: 32000,
        created: 100,
      },
      {
        id: 'paid/tool-model',
        supported_parameters: ['tools'],
        pricing: { prompt: '0.0001', completion: '0.0002' },
        context_length: 64000,
        created: 100,
      },
      {
        id: 'free/no-tools-model',
        supported_parameters: ['temperature'],
        pricing: { prompt: '0', completion: '0' },
        context_length: 128000,
        created: 100,
      },
      {
        id: 'paid/completion-only-model',
        supported_parameters: ['tools'],
        pricing: { prompt: '0', completion: '0.0005' },
        context_length: 32000,
        created: 100,
      },
      {
        id: 'openrouter/free',
        supported_parameters: ['tools'],
        pricing: { prompt: '0', completion: '0' },
        context_length: 200000,
        created: 200,
      },
      {
        id: 'openrouter:free',
        supported_parameters: ['tools'],
        pricing: { prompt: '0', completion: '0' },
        context_length: 200000,
        created: 200,
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockModels }),
    });

    // Act
    const result = await fetchFreeOpenRouterModels('sk-test-key-valid');

    // Assert
    expect(result).toEqual(['free/tool-model']);
  });

  it('sorts free models primarily by context length (descending) and secondarily by created timestamp (descending)', async () => {
    // Arrange
    const mockModels = [
      {
        id: 'model/short-ctx',
        supported_parameters: ['tools'],
        pricing: { prompt: '0', completion: '0' },
        context_length: 8000,
        created: 500,
      },
      {
        id: 'model/long-ctx-old',
        supported_parameters: ['tools'],
        pricing: { prompt: '0', completion: '0' },
        context_length: 128000,
        created: 100,
      },
      {
        id: 'model/long-ctx-new',
        supported_parameters: ['tools'],
        pricing: { prompt: '0', completion: '0' },
        context_length: 128000,
        created: 300,
      },
      {
        id: 'model/medium-ctx',
        supported_parameters: ['tools'],
        pricing: { prompt: '0', completion: '0' },
        context_length: 32000,
        created: 200,
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockModels }),
    });

    // Act
    const result = await fetchFreeOpenRouterModels();

    // Assert
    expect(result).toEqual([
      'model/long-ctx-new',
      'model/long-ctx-old',
      'model/medium-ctx',
      'model/short-ctx',
    ]);
  });

  it('gracefully handles HTTP error responses and network rejections', async () => {
    // Arrange: HTTP 500
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    // Act
    const result500 = await fetchFreeOpenRouterModels();

    // Assert
    expect(result500).toEqual([]);

    // Arrange: Network throw
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network timeout'));

    // Act
    const resultError = await fetchFreeOpenRouterModels();

    // Assert
    expect(resultError).toEqual([]);
  });

  it('handles malformed or missing data payload gracefully', async () => {
    // Arrange: malformed JSON without data array
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    // Act
    const result = await fetchFreeOpenRouterModels();

    // Assert
    expect(result).toEqual([]);
  });
});
