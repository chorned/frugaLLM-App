export interface HardwareProfile {
  is_unified: boolean;
  dedicated_vram: number;
  system_ram: number;
  execution_ceiling: number;
  os_architecture: string;
}

export interface MemorySegments {
  phase: string; // 'preflight' | 'live'
  weights_bytes: number;
  context_128k_bytes: number;
  overhead_bytes: number;
  total_projected_bytes: number;
  execution_ceiling_bytes: number;
  spillover_bytes: number;
  spillover_type: string; // 'none' | 'system_ram' | 'ssd_swap'
  triggers_warning: boolean;
  warning_message: string;
  is_unknown?: boolean;
}

export interface ModelProfile {
  tag: string;
  weightsGb: number;
  kvCacheGb: number;
}

export const GRAPH_OVERHEAD_GB = 0.5;

export const AVAILABLE_MODELS: ModelProfile[] = [
  { tag: 'gemma4:31b', weightsGb: 33.0, kvCacheGb: 10.36 },
  { tag: 'gemma4:26b', weightsGb: 28.0, kvCacheGb: 4.16 },
  { tag: 'gemma4:12b', weightsGb: 13.0, kvCacheGb: 3.63 },
  { tag: 'gemma4:e4b', weightsGb: 4.9, kvCacheGb: 3.10 },
  { tag: 'gemma4:e2b', weightsGb: 1.4, kvCacheGb: 1.29 },
];

export function parseQuantizationLevel(tagOrQuant?: string): string | null {
  if (!tagOrQuant) return null;
  const s = tagOrQuant.toLowerCase();
  if (s.includes('fp16') || s.includes('f16') || s.includes('bf16')) return 'fp16';
  if (s.includes('f32')) return 'f32';
  if (s.includes('q8_0') || s.includes('q8_k') || s.includes('q8')) return 'q8';
  if (s.includes('q6_k') || s.includes('q6')) return 'q6';
  if (s.includes('q5_k_m') || s.includes('q5_0') || s.includes('q5_1') || s.includes('q5')) return 'q5';
  if (s.includes('q4_k_m') || s.includes('q4_k_s') || s.includes('q4_0') || s.includes('q4_1') || s.includes('q4')) return 'q4';
  if (s.includes('q3_k') || s.includes('q3')) return 'q3';
  if (s.includes('q2_k') || s.includes('q2')) return 'q2';
  return null;
}

export function getQuantizationMultiplier(quant: string): number {
  switch (quant) {
    case 'q2': return 2.7 / 8.5;
    case 'q3': return 3.5 / 8.5;
    case 'q4': return 4.5 / 8.5;
    case 'q5': return 5.5 / 8.5;
    case 'q6': return 6.5 / 8.5;
    case 'q8': return 1.0;
    case 'fp16': return 16.0 / 8.5;
    case 'f32': return 32.0 / 8.5;
    default: return 1.0;
  }
}

export function getRecommendedModelForVram(vramGb: number): string {
  for (const model of AVAILABLE_MODELS) {
    const totalFootprint = model.weightsGb + model.kvCacheGb + GRAPH_OVERHEAD_GB;
    if (totalFootprint <= vramGb) {
      return model.tag;
    }
  }
  return 'gemma4:e2b';
}

export function computeMemorySegmentsForModel(
  modelTag: string,
  ceilingBytes: number,
  isUnified: boolean = false,
  isLive: boolean = false,
  liveTotalSize: number = 0,
  quantizationLevel?: string
): MemorySegments {
  const overheadBytes = 524_288_000; // 0.5 GB (500 MB)
  const normalized = (modelTag || '').toLowerCase().trim();

  let matched: ModelProfile | undefined = undefined;
  if (normalized.includes('31b')) {
    matched = AVAILABLE_MODELS[0];
  } else if (normalized.includes('26b')) {
    matched = AVAILABLE_MODELS[1];
  } else if (normalized.includes('12b')) {
    matched = AVAILABLE_MODELS[2];
  } else if (normalized.includes('e4b') || normalized.includes('4b')) {
    matched = AVAILABLE_MODELS[3];
  } else if (normalized.includes('e2b') || normalized.includes('2b')) {
    matched = AVAILABLE_MODELS[4];
  } else {
    const exact = AVAILABLE_MODELS.find(m => normalized === m.tag || normalized === m.tag.replace('gemma4:', ''));
    if (exact) matched = exact;
  }

  const is_unknown = !matched;
  const activeProfile = matched || { tag: 'unknown', weightsGb: 0, kvCacheGb: 0 };

  // Inspect Ollama quantization levels alongside parameter count
  const detectedQuant = parseQuantizationLevel(quantizationLevel) || parseQuantizationLevel(normalized);
  const quantMultiplier = detectedQuant ? getQuantizationMultiplier(detectedQuant) : 1.0;
  const effectiveWeightsGb = activeProfile.weightsGb * quantMultiplier;

  const weightsBytes = (isLive && liveTotalSize > 0)
    ? liveTotalSize
    : Math.round(effectiveWeightsGb * 1024 * 1024 * 1024);

  const contextBytes = Math.round(activeProfile.kvCacheGb * 1024 * 1024 * 1024);
  const totalProjectedBytes = is_unknown ? 0 : weightsBytes + contextBytes + overheadBytes;

  let spilloverBytes = 0;
  let spilloverType: 'none' | 'system_ram' | 'ssd_swap' = 'none';
  let triggersWarning = false;
  let warningMessage = '';

  if (!is_unknown && totalProjectedBytes > ceilingBytes) {
    spilloverBytes = totalProjectedBytes - ceilingBytes;
    if (isUnified) {
      spilloverType = 'ssd_swap';
      triggersWarning = true;
      warningMessage = 'Memory exceeds available Unified Memory. Severe disk paging & performance degradation will occur.';
    } else {
      spilloverType = 'system_ram';
      triggersWarning = true;
      warningMessage = 'Model & 128k context exceed Dedicated VRAM. Spillover will route across PCIe into System RAM.';
    }
  }

  return {
    phase: isLive ? 'live' : 'preflight',
    weights_bytes: weightsBytes,
    context_128k_bytes: contextBytes,
    overhead_bytes: is_unknown ? 0 : overheadBytes,
    total_projected_bytes: totalProjectedBytes,
    execution_ceiling_bytes: ceilingBytes,
    spillover_bytes: spilloverBytes,
    spillover_type: spilloverType,
    triggers_warning: triggersWarning,
    warning_message: warningMessage,
    is_unknown,
  };
}
