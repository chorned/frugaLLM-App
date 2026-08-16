const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.addInitScript(() => {
    window.localStorage.setItem('onboardingState', 'completed');
    window['tauriEventCallbacks'] = {};
    window['tauriListeners'] = {};
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {
        transformCallback: () => 1,
        invoke: () => Promise.resolve()
      }
    });
  });

  await page.goto('http://localhost:1420'); // Assuming vite runs here
  
  // Wait for the node
  await page.waitForTimeout(2000);
  
  const nodes = await page.$$('.retro-node');
  console.log(`Found ${nodes.length} nodes`);
  
  for (const node of nodes) {
    const text = await node.textContent();
    console.log("TEXT:", JSON.stringify(text));
  }
  
  await browser.close();
})();
