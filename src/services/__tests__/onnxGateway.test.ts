import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @huggingface/transformers module before importing onnxGateway
vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(),
  env: {
    allowLocalModels: true,
    useBrowserCache: false,
  },
}));

import { pipeline } from '@huggingface/transformers';
import {
  ONNX_MODEL_ID,
  REPRIMAND_MESSAGE,
  loadOnnxClassifier,
  clearOnnxCache,
  checkOnnxModelDownloaded,
  isClassifierLoaded,
} from '../onnxGateway';

describe('onnxGateway Service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearOnnxCache();
  });

  describe('Constants & Initialization', () => {
    it('exports expected model ID and reprimand message contracts', () => {
      expect(ONNX_MODEL_ID).toBe('Xenova/nli-deberta-v3-small');
      expect(REPRIMAND_MESSAGE).toContain('SYSTEM REPRIMAND');
      expect(REPRIMAND_MESSAGE).toContain('JSON tool call');
    });

    it('reports isClassifierLoaded as false when freshly initialized', () => {
      expect(isClassifierLoaded()).toBe(false);
    });
  });

  describe('loadOnnxClassifier', () => {
    it('accepts custom pipelineFn factory parameter via dependency injection', async () => {
      // Arrange
      const mockCustomPipeline = vi.fn().mockImplementation(async (_type, _id, options) => {
        if (options?.progress_callback) {
          options.progress_callback({
            status: 'progress',
            file: 'model.onnx',
            loaded: 10000000,
            total: 10000000,
          });
          options.progress_callback({
            status: 'done',
            file: 'model.onnx',
          });
        }
        return { custom: true };
      });
      const progressSpy = vi.fn();

      // Act
      const result = await loadOnnxClassifier(progressSpy, mockCustomPipeline);

      // Assert
      expect(result).toEqual({ custom: true });
      expect(mockCustomPipeline).toHaveBeenCalledWith('zero-shot-classification', ONNX_MODEL_ID, expect.any(Object));
      expect(progressSpy).toHaveBeenCalledTimes(2);
      expect(isClassifierLoaded()).toBe(true);
    });

    it('calls @huggingface/transformers pipeline with correct model ID and options', async () => {
      // Arrange
      const mockInstance = { classify: vi.fn() };
      (pipeline as any).mockResolvedValueOnce(mockInstance);
      const onProgress = vi.fn();

      // Act
      const classifier = await loadOnnxClassifier(onProgress);

      // Assert
      expect(pipeline).toHaveBeenCalledWith('zero-shot-classification', ONNX_MODEL_ID, {
        progress_callback: onProgress,
      });
      expect(classifier).toBe(mockInstance);
      expect(isClassifierLoaded()).toBe(true);
    });

    it('reuses existing singleton classifier instance without re-instantiating pipeline', async () => {
      // Arrange
      const mockInstance = { classify: vi.fn() };
      (pipeline as any).mockResolvedValueOnce(mockInstance);

      // Act
      const first = await loadOnnxClassifier();
      const second = await loadOnnxClassifier();

      // Assert
      expect(pipeline).toHaveBeenCalledTimes(1);
      expect(first).toBe(mockInstance);
      expect(second).toBe(mockInstance);
    });

    it('propagates error when pipeline initialization fails', async () => {
      // Arrange
      const testError = new Error('Wasm failed to load');
      (pipeline as any).mockRejectedValueOnce(testError);

      // Act & Assert
      await expect(loadOnnxClassifier()).rejects.toThrow('Wasm failed to load');
      expect(isClassifierLoaded()).toBe(false);
    });
  });

  describe('clearOnnxCache & checkOnnxModelDownloaded', () => {
    it('clears classifier pipeline and purges browser cache keys', async () => {
      // Arrange
      const mockInstance = { classify: vi.fn() };
      (pipeline as any).mockResolvedValueOnce(mockInstance);
      await loadOnnxClassifier();
      expect(isClassifierLoaded()).toBe(true);

      const deleteCacheSpy = vi.fn().mockResolvedValue(true);
      const mockCaches = {
        keys: vi.fn().mockResolvedValue(['transformers-cache-v1', 'onnx-models', 'unrelated-cache']),
        delete: deleteCacheSpy,
        open: vi.fn(),
      };
      (globalThis as any).caches = mockCaches;

      const deleteDbSpy = vi.fn();
      (globalThis as any).indexedDB = {
        deleteDatabase: deleteDbSpy,
      };

      // Act
      await clearOnnxCache();

      // Assert
      expect(isClassifierLoaded()).toBe(false);
      expect(deleteCacheSpy).toHaveBeenCalledWith('transformers-cache-v1');
      expect(deleteCacheSpy).toHaveBeenCalledWith('onnx-models');
      expect(deleteCacheSpy).not.toHaveBeenCalledWith('unrelated-cache');
      expect(deleteDbSpy).toHaveBeenCalledWith('transformers-cache');
    });

    it('returns true if model is present in caches', async () => {
      // Arrange
      const mockKeys = vi.fn().mockResolvedValue([
        { url: 'https://huggingface.co/Xenova/nli-deberta-v3-small/resolve/main/model.onnx' },
      ]);
      const mockCache = { keys: mockKeys };
      const mockCaches = {
        keys: vi.fn().mockResolvedValue(['transformers-v1']),
        open: vi.fn().mockResolvedValue(mockCache),
        delete: vi.fn(),
      };
      (globalThis as any).caches = mockCaches;

      // Act
      const exists = await checkOnnxModelDownloaded();

      // Assert
      expect(exists).toBe(true);
    });

    it('returns false if caches is undefined or does not contain the model', async () => {
      // Arrange
      delete (globalThis as any).caches;

      // Act
      const result = await checkOnnxModelDownloaded();

      // Assert
      expect(result).toBe(false);
    });
  });
});
