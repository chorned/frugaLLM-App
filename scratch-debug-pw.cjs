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

  await page.goto('http://localhost:1420');
  
  await page.waitForTimeout(2000);
  
  const nodes = await page.$$('div');
  let hardwareNodeText = null;
  for (const node of nodes) {
    const text = await node.textContent();
    if (text.includes('Local Hardware')) {
        console.log("MATCH:", JSON.stringify(text));
    }
  }
  
  await browser.close();
  process.exit(0);
})();
