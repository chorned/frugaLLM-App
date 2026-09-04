/**
 * Checks whether a given model identifier is an OpenRouter free router model alias
 * (e.g. 'openrouter/free' or 'openrouter:free') that should be hidden from model lists.
 */
export function isOpenRouterFreeAlias(id?: string): boolean {
  if (!id) return false;
  const lower = id.toLowerCase().trim();
  return lower === 'openrouter/free' || lower === 'openrouter:free';
}

export async function fetchFreeOpenRouterModels(apiKey?: string): Promise<string[]> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey && apiKey.length > 5) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch("https://openrouter.ai/api/v1/models", { headers });
    if (!response.ok) {
      console.warn("Failed to fetch OpenRouter models");
      return [];
    }
    
    const data = await response.json();
    const models = data.data || [];
    
    const freeModels = models.filter((m: any) => {
      // Hide the openrouter:free / openrouter/free router model alias
      if (isOpenRouterFreeAlias(m?.id)) return false;

      // Must support tools for our gatekeeper
      const params = m.supported_parameters || [];
      if (!params.includes("tools")) return false;
      
      const p = m.pricing || {};
      return parseFloat(p.prompt || "1") === 0 && parseFloat(p.completion || "1") === 0;
    });

    // Sort by context length and recent creation
    freeModels.sort((a: any, b: any) => {
      const ctxA = a.context_length || 0;
      const ctxB = b.context_length || 0;
      if (ctxB !== ctxA) return ctxB - ctxA;
      return (b.created || 0) - (a.created || 0);
    });

    return freeModels.map((m: any) => m.id);
  } catch (error) {
    console.error("OpenRouter fetch error:", error);
    return [];
  }
}
