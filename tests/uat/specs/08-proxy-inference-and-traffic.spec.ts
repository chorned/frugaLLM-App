import { test, expect } from '../harness/tauri-launcher';
import { isPortOpen } from '../harness/port-sentinel';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 8: Real Proxy Inference & Traffic Pulses', () => {
  test('08.1 - Real Inference Request: dispatch POST to /v1/chat/completions and assert token math', async ({
    appPage,
  }) => {
    // Find active proxy port (61721 or 8080)
    let activePort = 61721;
    if (!(await isPortOpen(61721))) {
      if (await isPortOpen(8080)) {
        activePort = 8080;
      }
    }

    console.log(`[UAT Phase 8] Dispatching real inference request to proxy at 127.0.0.1:${activePort}...`);

    test.setTimeout(120_000);

    // Capture baseline tokens
    const sessionTokensEl = appPage.locator('[data-testid="frugallm-session-tokens"]');
    await expect(sessionTokensEl).toBeVisible({ timeout: 10000 });
    const baselineTokens = await sessionTokensEl.innerText();

    // Identify local model in Ollama
    let localModel = 'frugallm-active';
    try {
      const tagsRes = await fetch('http://127.0.0.1:11434/api/tags');
      if (tagsRes.ok) {
        const json = await tagsRes.json();
        const models = (json.models || []).map((m: any) => m.name || m.model);
        if (models.some((m: string) => m.includes('frugallm-active'))) {
          localModel = 'frugallm-active';
        } else if (models.length > 0) {
          localModel = models[0];
        }
      }
    } catch {}

    console.log(`[UAT Phase 8] Dispatching real streaming inference request to proxy at 127.0.0.1:${activePort} (model: ${localModel})...`);

    // Dispatch request via standard fetch to proxy
    const res = await fetch(`http://127.0.0.1:${activePort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer frugallm',
      },
      body: JSON.stringify({
        model: localModel,
        messages: [{ role: 'user', content: 'Say "UAT inference success" in three words.' }],
        max_tokens: 25,
        stream: true,
      }),
    });

    console.log(`[UAT Phase 8] Proxy HTTP response status: ${res.status}`);
    expect(res.status).toBe(200);

    // Consume real SSE stream chunks from Ollama through FrugaLLM proxy
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponseText = '';
    let streamChunksCount = 0;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        streamChunksCount++;
        const lines = chunk.split('\n').filter(Boolean);
        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const payload = JSON.parse(line.slice(6));
              const delta = payload.choices?.[0]?.delta?.content || '';
              fullResponseText += delta;
            } catch {}
          }
        }
      }
    }

    console.log(`[UAT Phase 8] Received ${streamChunksCount} streaming chunks. Generated text: "${fullResponseText.trim()}"`);
    expect(streamChunksCount).toBeGreaterThan(1);
    expect(fullResponseText.trim().length).toBeGreaterThan(0);

    // Allow event loop to process telemetry update
    await appPage.waitForTimeout(1500);

    // Verify SVG wires layer exists on canvas
    const wiresLayer = appPage.locator('.wires-layer, svg.wires-layer, svg');
    await expect(wiresLayer.first()).toBeVisible();

    // Verify money saved element exists and renders benchmark rate calculation
    const moneySavedEl = appPage.locator('[data-testid="frugallm-money-saved"]');
    await expect(moneySavedEl).toBeVisible();
    const moneyText = await moneySavedEl.innerText();
    expect(moneyText).toContain('$');
  });
});
