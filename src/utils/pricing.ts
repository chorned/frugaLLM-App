import { FrugalConfig } from '../services/tauri';

/**
 * Claude Sonnet 5 Benchmark Token Pricing:
 * - Input Tokens: $2.00 per 1 million tokens ($0.000002 per token)
 * - Output Tokens: $10.00 per 1 million tokens ($0.000010 per token)
 * - Cached Input Tokens: $0.20 per 1 million tokens ($0.0000002 per token)
 */
export const CLAUDE_SONNET_5_PRICING = {
  inputPerMillion: 2.00,
  outputPerMillion: 10.00,
  cachedInputPerMillion: 0.20,
  inputPerToken: 0.000002,
  outputPerToken: 0.000010,
  cachedInputPerToken: 0.0000002,
} as const;

/**
 * Calculates estimated money saved from local and free cloud routing,
 * benchmarked against Claude Sonnet 5 commercial rates.
 * Gracefully handles missing, zero, negative, or malformed values.
 *
 * @param config FrugalConfig or partial config containing token metrics
 * @returns Formatted dollar amount string with 2 decimal places (e.g. "0.70")
 */
export function calculateMoneySaved(config?: Partial<FrugalConfig> | null): string {
  if (!config) return '0.00';

  const inputTokens = Math.max(0, Number(config.input_tokens_lifetime) || 0);
  const outputTokens = Math.max(0, Number(config.output_tokens_lifetime) || 0);
  const cachedTokens = Math.max(
    0,
    Number(
      config.cached_tokens_lifetime ??
      (config as any).cached_input_tokens_lifetime ??
      (config as any).input_tokens_cached
    ) || 0
  );

  const inputCost = (inputTokens * CLAUDE_SONNET_5_PRICING.inputPerMillion) / 1_000_000;
  const outputCost = (outputTokens * CLAUDE_SONNET_5_PRICING.outputPerMillion) / 1_000_000;
  const cachedCost = (cachedTokens * CLAUDE_SONNET_5_PRICING.cachedInputPerMillion) / 1_000_000;

  const totalCost = inputCost + outputCost + cachedCost;

  return totalCost.toFixed(2);
}
