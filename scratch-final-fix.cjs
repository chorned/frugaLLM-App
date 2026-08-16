const fs = require('fs');

let code = fs.readFileSync('tests/pages/HardwareTelemetry.ts', 'utf8');
code = code.replace('/^LOCAL HARDWARE(▼|▲)?.*$/', '/^Local Hardware(▼|▲)?.*$/i');
code = code.replace("'text=LOCAL HARDWARE'", "'text=Local Hardware'");
fs.writeFileSync('tests/pages/HardwareTelemetry.ts', code);

// For MainCanvas.spec.ts to ensure it finds the config panel title
let mcSpec = fs.readFileSync('tests/e2e/main-canvas.spec.ts', 'utf8');
mcSpec = mcSpec.replace("getByRole('heading', { name: 'FRUGALLM CORE' })", "getByRole('heading', { name: 'Configuration' })");
fs.writeFileSync('tests/e2e/main-canvas.spec.ts', mcSpec);

