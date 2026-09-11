import { describe, it, expect } from 'vitest';
import { calculateMoneySaved, CLAUDE_SONNET_5_PRICING } from '../pricing';

describe('Claude Sonnet 5 Pricing & Money Saved Algorithm', () => {
  describe('CLAUDE_SONNET_5_PRICING constants', () => {
    it('defines exact rates specified for Claude Sonnet 5', () => {
      // Input: $2.00 per 1M ($0.000002 / token)
      expect(CLAUDE_SONNET_5_PRICING.inputPerMillion).toBe(2.00);
      expect(CLAUDE_SONNET_5_PRICING.inputPerToken).toBe(0.000002);

      // Output: $10.00 per 1M ($0.000010 / token)
      expect(CLAUDE_SONNET_5_PRICING.outputPerMillion).toBe(10.00);
      expect(CLAUDE_SONNET_5_PRICING.outputPerToken).toBe(0.000010);

      // Cached Input: $0.20 per 1M ($0.0000002 / token)
      expect(CLAUDE_SONNET_5_PRICING.cachedInputPerMillion).toBe(0.20);
      expect(CLAUDE_SONNET_5_PRICING.cachedInputPerToken).toBe(0.0000002);
    });
  });

  describe('calculateMoneySaved', () => {
    it('returns 0.00 for null, undefined, or empty config', () => {
      expect(calculateMoneySaved(null)).toBe('0.00');
      expect(calculateMoneySaved(undefined)).toBe('0.00');
      expect(calculateMoneySaved({})).toBe('0.00');
      expect(calculateMoneySaved({ input_tokens_lifetime: 0, output_tokens_lifetime: 0 })).toBe('0.00');
    });

    it('calculates input token savings correctly at $2.00 / 1M tokens', () => {
      // 100,000 input tokens = 100k * 0.000002 = $0.20
      const result = calculateMoneySaved({ input_tokens_lifetime: 100000 });
      expect(result).toBe('0.20');

      // 1,000,000 input tokens = $2.00
      expect(calculateMoneySaved({ input_tokens_lifetime: 1000000 })).toBe('2.00');
    });

    it('calculates output token savings correctly at $10.00 / 1M tokens', () => {
      // 50,000 output tokens = 50k * 0.000010 = $0.50
      const result = calculateMoneySaved({ output_tokens_lifetime: 50000 });
      expect(result).toBe('0.50');

      // 1,000,000 output tokens = $10.00
      expect(calculateMoneySaved({ output_tokens_lifetime: 1000000 })).toBe('10.00');
    });

    it('calculates cached input token savings correctly at $0.20 / 1M tokens', () => {
      // 1,000,000 cached tokens = $0.20
      expect(calculateMoneySaved({ cached_tokens_lifetime: 1000000 })).toBe('0.20');

      // 5,000,000 cached tokens = $1.00
      expect(calculateMoneySaved({ cached_tokens_lifetime: 5000000 })).toBe('1.00');
    });

    it('combines input, output, and cached tokens into total money saved', () => {
      // 100k input ($0.20) + 50k output ($0.50) + 0 cached = $0.70
      const standardMetrics = calculateMoneySaved({
        input_tokens_lifetime: 100000,
        output_tokens_lifetime: 50000,
      });
      expect(standardMetrics).toBe('0.70');

      // 1M input ($2.00) + 500k output ($5.00) + 2M cached ($0.40) = $7.40
      const metricsWithCache = calculateMoneySaved({
        input_tokens_lifetime: 1000000,
        output_tokens_lifetime: 500000,
        cached_tokens_lifetime: 2000000,
      });
      expect(metricsWithCache).toBe('7.40');
    });

    it('supports alternative cached token field keys gracefully', () => {
      expect(
        calculateMoneySaved({
          cached_input_tokens_lifetime: 1000000,
        } as any)
      ).toBe('0.20');

      expect(
        calculateMoneySaved({
          input_tokens_cached: 1000000,
        } as any)
      ).toBe('0.20');
    });

    it('handles hostile, negative, and malformed data without throwing', () => {
      expect(
        calculateMoneySaved({
          input_tokens_lifetime: -5000,
          output_tokens_lifetime: -10000,
          cached_tokens_lifetime: -2000,
        })
      ).toBe('0.00');

      expect(
        calculateMoneySaved({
          input_tokens_lifetime: NaN,
          output_tokens_lifetime: undefined,
          cached_tokens_lifetime: null as any,
        })
      ).toBe('0.00');
    });
  });
});
