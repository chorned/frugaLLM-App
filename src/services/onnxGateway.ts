import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js for client-side browser/WebAssembly environment
if (typeof window !== 'undefined') {
  env.allowLocalModels = false;
  env.useBrowserCache = typeof caches !== 'undefined';
}

export const ONNX_MODEL_ID = 'Xenova/nli-deberta-v3-small';

export const REPRIMAND_MESSAGE = 
  '[SYSTEM REPRIMAND: You detailed a plan and informed the user you were taking action, but failed to output the corresponding JSON tool call. Do not apologize. Output the required tool call immediately.]';

let classifierPipeline: any = null;

export interface OnnxDownloadProgressInfo {
  status: string;
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

export const loadOnnxClassifier = async (
  onProgress?: (progress: OnnxDownloadProgressInfo) => void
) => {
  if (typeof window !== 'undefined' && (window as any).__MOCK_ONNX_DOWNLOAD__) {
    if (onProgress) {
      onProgress({ status: 'progress', file: 'model.onnx', loaded: 10000000, total: 10000000 });
      onProgress({ status: 'done', file: 'model.onnx' });
    }
    classifierPipeline = { mock: true };
    return classifierPipeline;
  }

  if (!classifierPipeline) {
    try {
      classifierPipeline = await pipeline('zero-shot-classification', ONNX_MODEL_ID, {
        progress_callback: onProgress,
      });
    } catch (e) {
      console.warn('Could not load Transformers.js ONNX pipeline:', e);
      throw e;
    }
  }
  return classifierPipeline;
};

export const clearOnnxCache = async (): Promise<void> => {
  classifierPipeline = null;
  if (typeof caches !== 'undefined') {
    try {
      const keys = await caches.keys();
      for (const key of keys) {
        if (key.includes('transformers') || key.includes('onnx') || key.includes('huggingface')) {
          await caches.delete(key);
        }
      }
    } catch (e) {
      console.warn('Error clearing Cache API for ONNX models:', e);
    }
  }
  if (typeof indexedDB !== 'undefined') {
    try {
      indexedDB.deleteDatabase('transformers-cache');
    } catch (e) {
      console.warn('Error clearing indexedDB transformers-cache:', e);
    }
  }
};

export const checkOnnxModelDownloaded = async (): Promise<boolean> => {
  if (typeof caches === 'undefined') return false;
  try {
    const keys = await caches.keys();
    for (const key of keys) {
      if (key.includes('transformers') || key.includes('onnx')) {
        const cache = await caches.open(key);
        const requests = await cache.keys();
        if (requests.some(req => req.url.includes('nli-deberta-v3-small') || req.url.includes(ONNX_MODEL_ID))) {
          return true;
        }
      }
    }
  } catch (e) {
    console.warn('Error checking onnx model cache:', e);
  }
  return false;
};

export const isClassifierLoaded = (): boolean => {
  return classifierPipeline !== null;
};
