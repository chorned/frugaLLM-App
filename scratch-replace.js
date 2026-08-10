const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Remove node-antigravity and edge-ag-frugallm
content = content.replace(/\{\s*id:\s*'node-antigravity'[\s\S]*?\},\s*/, '');
content = content.replace(/\{\s*id:\s*'edge-ag-frugallm'[\s\S]*?\},\s*/, '');

// 2. Change node-hermes status to inactive
content = content.replace(/(id:\s*'node-hermes'[\s\S]*?status:\s*)'error'/, "$1'inactive'");

// 3. Change node-ollama and node-openrouter status to needs_activation
content = content.replace(/(id:\s*'node-ollama'[\s\S]*?status:\s*)'active'/, "$1'needs_activation'");
content = content.replace(/(id:\s*'node-openrouter'[\s\S]*?status:\s*)'active'/, "$1'needs_activation'");

// 4. Add needs_activation option to select
content = content.replace(/(<option value="active">ACTIVE<\/option>)/, '$1\n              <option value="needs_activation">NEEDS ACTIVATION</option>');

// 5. Add needs_activation styling
const errorStyling = `} else if (node.data.status === 'error') {`;
const needsActivationStyling = `} else if (node.data.status === 'needs_activation') {
                stateColors.border = '#111827';
                stateColors.headerBg = '#111827';
                stateColors.headerText = '#ffffff';
                stateColors.dot = '#ea580c'; 
                stateColors.statusText = '#ea580c';
              } else if (node.data.status === 'error') {`;

content = content.replace(errorStyling, needsActivationStyling);

fs.writeFileSync('src/App.tsx', content);
