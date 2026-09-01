import assert from 'node:assert';

describe('FrugaLLM Release Binary Smoke Test', () => {
  it('boots the compiled binary and initializes the webview without crashing', async () => {
    // Wait 5 seconds to ensure the webview initialized without crashing
    await browser.pause(5000);

    // Verify main window title is visible
    const title = await browser.getTitle();
    console.log(`[Smoke Test] Verified main window title: "${title}"`);

    assert.ok(title !== undefined && title !== null, 'Main window title should be defined');
    assert.strictEqual(typeof title, 'string', 'Main window title should be a string');
    assert.ok(title.length > 0, 'Main window title should be non-empty and visible');
  });
});
