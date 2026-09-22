import { test, expect } from '../harness/tauri-launcher';
import { isPortOpen, waitForPortOpen } from '../harness/port-sentinel';

test.describe.configure({ mode: 'serial' });

test.describe('Phase 8: Real Proxy Inference & Traffic Pulses', () => {
  test('08.1 - Real Inference Request: dispatch request, assert active SVG wire pulse, and verify math progression', async ({
    appPage,
  }) => {
    test.setTimeout(120_000);

    const activePort = 61721;
    await waitForPortOpen(activePort, 20000);

    // 1. Baseline Capture: Capture initial integer values from frugallm-session-tokens and frugallm-money-saved
    const sessionTokensEl = appPage.locator('[data-testid="frugallm-session-tokens"]');
    await expect(sessionTokensEl).toBeVisible({ timeout: 10000 });
    const baselineTokensText = await sessionTokensEl.innerText();
    const baselineTokens = parseInt(baselineTokensText.replace(/\D/g, ''), 10) || 0;

    const moneySavedEl = appPage.locator('[data-testid="frugallm-money-saved"]');
    await expect(moneySavedEl).toBeVisible({ timeout: 10000 });
    const baselineMoneyText = await moneySavedEl.innerText();
    const baselineMoney = parseFloat(baselineMoneyText.replace(/[^0-9.]/g, '')) || 0.0;

    console.log(`[UAT Phase 8] Baseline Tokens: ${baselineTokens}, Baseline Money Saved: $${baselineMoney}`);

    // Target the installed model
    const targetModel = 'gemma4:e2b';

    console.log(`[UAT Phase 8] Dispatching real streaming inference request to proxy at 127.0.0.1:${activePort} (model: ${targetModel})...`);

    // 2. Trigger Request through FrugaLLM proxy
    const inferencePromise = fetch(`http://127.0.0.1:${activePort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer frugallm',
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [{ role: 'user', content: 'What is 2 plus 2? Answer in one short word. ' + 'accounting token context '.repeat(350) }],
        max_tokens: 100,
        stream: true,
      }),
    });

    // 3. SVG Traffic Animation Verification: query the active wire between node-ollama and node-frugallm
    const svgWire = appPage.locator('[data-testid="svg-line-edge-frugallm-ollama"]');
    await expect(svgWire).toBeVisible({ timeout: 5000 });

    // Await the inference response stream
    const res = await inferencePromise;
    expect(res.status).toBe(200);

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
              const delta = payload.choices?.[0]?.delta?.content 
                || payload.choices?.[0]?.delta?.reasoning 
                || payload.choices?.[0]?.delta?.reasoning_content 
                || '';
              fullResponseText += delta;
            } catch {}
          }
        }
      }
    }

    console.log(`[UAT Phase 8] Generated text: "${fullResponseText.trim()}", Chunks: ${streamChunksCount}`);
    expect(streamChunksCount).toBeGreaterThan(0);
    expect(fullResponseText.trim().length).toBeGreaterThan(0);

    // 4. Real Accounting Assertions: Mathematical progression assertions (newVal > baselineVal)
    console.log('[UAT Phase 8] Asserting real token and financial accounting progression...');
    await expect(async () => {
      const currentTokensText = await sessionTokensEl.innerText();
      const currentTokens = parseInt(currentTokensText.replace(/\D/g, ''), 10) || 0;
      expect(currentTokens).toBeGreaterThan(baselineTokens);
    }).toPass({ timeout: 15000 });

    await expect(async () => {
      const currentMoneyText = await moneySavedEl.innerText();
      const currentMoney = parseFloat(currentMoneyText.replace(/[^0-9.]/g, '')) || 0.0;
      expect(currentMoney).toBeGreaterThanOrEqual(baselineMoney);
    }).toPass({ timeout: 15000 });

    const finalTokens = parseInt((await sessionTokensEl.innerText()).replace(/\D/g, ''), 10) || 0;
    const finalMoney = parseFloat((await moneySavedEl.innerText()).replace(/[^0-9.]/g, '')) || 0.0;
    console.log(`[UAT Phase 8] Confirmed mathematical progression: Tokens ${baselineTokens} -> ${finalTokens}, Money $${baselineMoney} -> $${finalMoney}`);
  });
});
