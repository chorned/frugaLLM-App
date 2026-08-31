import { describe, it, expect } from 'vitest';
import {
  AVAILABLE_MODELS,
  GRAPH_OVERHEAD_GB,
  getRecommendedModelForVram,
  computeMemorySegmentsForModel,
} from '../memoryCalculator';

describe('memoryCalculator Service', () => {
  describe('getRecommendedModelForVram', () => {
    it('returns 31b when VRAM is large enough for 31b footprint (33 + 10.36 + 0.5 = 43.86 GB)', () => {
      // Arrange
      const vram = 44.0;
      // Act
      const result = getRecommendedModelForVram(vram);
      // Assert
      expect(result).toBe('gemma4:31b');
    });

    it('returns 26b when VRAM fits 26b (28 + 4.16 + 0.5 = 32.66 GB) but not 31b', () => {
      // Arrange
      const vram = 33.0;
      // Act
      const result = getRecommendedModelForVram(vram);
      // Assert
      expect(result).toBe('gemma4:26b');
    });

    it('returns 12b when VRAM fits 12b (13 + 3.63 + 0.5 = 17.13 GB) but not 26b', () => {
      // Arrange
      const vram = 18.0;
      // Act
      const result = getRecommendedModelForVram(vram);
      // Assert
      expect(result).toBe('gemma4:12b');
    });

    it('returns e4b when VRAM fits e4b (4.9 + 3.10 + 0.5 = 8.5 GB) but not 12b', () => {
      // Arrange
      const vram = 9.0;
      // Act
      const result = getRecommendedModelForVram(vram);
      // Assert
      expect(result).toBe('gemma4:e4b');
    });

    it('returns e2b when VRAM fits e2b (1.4 + 1.29 + 0.5 = 3.19 GB) but not e4b', () => {
      // Arrange
      const vram = 4.0;
      // Act
      const result = getRecommendedModelForVram(vram);
      // Assert
      expect(result).toBe('gemma4:e2b');
    });

    it('falls back to gemma4:e2b when VRAM is below smallest model requirement or zero/negative', () => {
      // Arrange & Act & Assert
      expect(getRecommendedModelForVram(2.0)).toBe('gemma4:e2b');
      expect(getRecommendedModelForVram(0)).toBe('gemma4:e2b');
      expect(getRecommendedModelForVram(-10)).toBe('gemma4:e2b');
    });

    it('validates exact boundary footprint matching for all available models', () => {
      for (const model of AVAILABLE_MODELS) {
        const exactFootprint = model.weightsGb + model.kvCacheGb + GRAPH_OVERHEAD_GB;
        const result = getRecommendedModelForVram(exactFootprint);
        expect(result).toBe(model.tag);
      }
    });
  });

  describe('computeMemorySegmentsForModel', () => {
    const OVERHEAD_BYTES = 524_288_000;

    it('computes preflight memory segments for gemma4:31b within ceiling', () => {
      // Arrange
      const ceiling = 50 * 1024 * 1024 * 1024; // 50 GB
      // Act
      const segments = computeMemorySegmentsForModel('gemma4:31b', ceiling, false, false);
      // Assert
      const expectedWeights = Math.round(33.0 * 1024 * 1024 * 1024);
      const expectedKv = Math.round(10.36 * 1024 * 1024 * 1024);
      expect(segments.phase).toBe('preflight');
      expect(segments.weights_bytes).toBe(expectedWeights);
      expect(segments.context_128k_bytes).toBe(expectedKv);
      expect(segments.overhead_bytes).toBe(OVERHEAD_BYTES);
      expect(segments.total_projected_bytes).toBe(expectedWeights + expectedKv + OVERHEAD_BYTES);
      expect(segments.execution_ceiling_bytes).toBe(ceiling);
      expect(segments.spillover_bytes).toBe(0);
      expect(segments.spillover_type).toBe('none');
      expect(segments.triggers_warning).toBe(false);
      expect(segments.warning_message).toBe('');
      expect(segments.is_unknown).toBe(false);
    });

    it('triggers discrete GPU system_ram spillover warning when total exceeds ceiling', () => {
      // Arrange
      const ceiling = 16 * 1024 * 1024 * 1024; // 16 GB dedicated VRAM
      // Act
      const segments = computeMemorySegmentsForModel('gemma4:31b', ceiling, false, false);
      // Assert
      expect(segments.spillover_bytes).toBeGreaterThan(0);
      expect(segments.spillover_type).toBe('system_ram');
      expect(segments.triggers_warning).toBe(true);
      expect(segments.warning_message).toContain('exceed Dedicated VRAM');
      expect(segments.warning_message).toContain('System RAM');
    });

    it('triggers Apple Silicon ssd_swap spillover warning on unified memory', () => {
      // Arrange
      const ceiling = 16 * 1024 * 1024 * 1024; // 16 GB Unified RAM
      // Act
      const segments = computeMemorySegmentsForModel('gemma4:31b', ceiling, true, false);
      // Assert
      expect(segments.spillover_bytes).toBeGreaterThan(0);
      expect(segments.spillover_type).toBe('ssd_swap');
      expect(segments.triggers_warning).toBe(true);
      expect(segments.warning_message).toContain('Unified Memory');
      expect(segments.warning_message).toContain('disk paging');
    });

    it('correctly matches shorthand model variants (26b, 12b, 4b, 2b)', () => {
      // Arrange & Act
      const seg26 = computeMemorySegmentsForModel('custom-26b-instruct', 64 * 1024 * 1024 * 1024);
      const seg12 = computeMemorySegmentsForModel('gemma:12b', 64 * 1024 * 1024 * 1024);
      const seg4 = computeMemorySegmentsForModel('4b-v1', 64 * 1024 * 1024 * 1024);
      const seg2 = computeMemorySegmentsForModel('model-2b', 64 * 1024 * 1024 * 1024);

      // Assert
      expect(seg26.weights_bytes).toBe(Math.round(28.0 * 1024 * 1024 * 1024));
      expect(seg12.weights_bytes).toBe(Math.round(13.0 * 1024 * 1024 * 1024));
      expect(seg4.weights_bytes).toBe(Math.round(4.9 * 1024 * 1024 * 1024));
      expect(seg2.weights_bytes).toBe(Math.round(1.4 * 1024 * 1024 * 1024));
    });

    it('handles live phase with custom liveTotalSize override', () => {
      // Arrange
      const customLiveSize = 5_000_000_000;
      const ceiling = 10 * 1024 * 1024 * 1024;
      // Act
      const segments = computeMemorySegmentsForModel('gemma4:e4b', ceiling, false, true, customLiveSize);
      // Assert
      expect(segments.phase).toBe('live');
      expect(segments.weights_bytes).toBe(customLiveSize);
      const expectedKv = Math.round(3.10 * 1024 * 1024 * 1024);
      expect(segments.total_projected_bytes).toBe(customLiveSize + expectedKv + OVERHEAD_BYTES);
    });

    it('handles unknown model tags and edge cases (null, empty string, unrecognized tag)', () => {
      // Act & Assert
      // @ts-expect-error test runtime boundary with null
      const segNull = computeMemorySegmentsForModel(null, 10_000_000);
      expect(segNull.is_unknown).toBe(true);
      expect(segNull.total_projected_bytes).toBe(0);
      expect(segNull.spillover_bytes).toBe(0);
      expect(segNull.triggers_warning).toBe(false);

      const segEmpty = computeMemorySegmentsForModel('', 10_000_000);
      expect(segEmpty.is_unknown).toBe(true);
      expect(segEmpty.total_projected_bytes).toBe(0);

      const segUnrec = computeMemorySegmentsForModel('some-random-unknown-model-xyz', 10_000_000);
      expect(segUnrec.is_unknown).toBe(true);
      expect(segUnrec.overhead_bytes).toBe(0);
      expect(segUnrec.spillover_type).toBe('none');
    });
  });
});
