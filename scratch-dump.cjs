const { chromium } = require('playwright');
const fs = require('fs');

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
  
  const nodes = await page.$$('.retro-node');
  for (const node of nodes) {
    const text = await node.textContent();
    if (text.includes('Local Hardware')) {
        const html = await node.innerHTML();
        fs.writeFileSync('hardware-html.txt', html);
        console.log("DUMPED HTML!");
    }
  }
  
  await browser.close();
  process.exit(0);
})();
