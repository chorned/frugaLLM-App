import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# 1. Add import for TerminalLoader
if 'TerminalLoader' not in content:
    content = content.replace("import { NodeConfigPanel } from './components/NodeConfigPanel';", "import { NodeConfigPanel } from './components/NodeConfigPanel';\nimport { TerminalLoader } from './components/TerminalLoader';")

# 2. Add state variables at the top of the component
state_vars = """  const [isAppLoaded, setIsAppLoaded] = useState(false);
  const [initLogs, setInitLogs] = useState<string[]>([]);
"""
if 'isAppLoaded' not in content:
    content = content.replace("const [frugalConfig, setFrugalConfig] = useState<any>(null);", state_vars + "  const [frugalConfig, setFrugalConfig] = useState<any>(null);")

# 3. Add the orchestrated init effect
init_effect = """
  useEffect(() => {
    let isMounted = true;
    const runInit = async () => {
      const addLog = (msg: string) => {
        if (isMounted) setInitLogs(prev => [...prev, msg]);
      };

      addLog("Booting FrugaLLM core subsystems...");
      await new Promise(r => setTimeout(r, 300));
      
      addLog("Fetching node configuration...");
      try {
        const conf = await invoke('get_frugallm_config');
        setFrugalConfig(conf);
        addLog("OK: Configuration loaded.");
      } catch (e) {
        addLog("WARN: Failed to load config.");
      }
      await new Promise(r => setTimeout(r, 200));

      addLog("Checking Hermes agent status...");
      try {
        const hermesStatus = await invoke('check_hermes_status');
        setIsHermesInstalled(hermesStatus as boolean);
        addLog(hermesStatus ? "OK: Hermes installed." : "INFO: Hermes not installed.");
      } catch(e) {}
      
      addLog("Checking OpenCode agent status...");
      try {
        const opencodeStatus = await invoke('check_opencode_status');
        setIsOpenCodeInstalled(opencodeStatus as boolean);
        addLog(opencodeStatus ? "OK: OpenCode installed." : "INFO: OpenCode not installed.");
      } catch(e) {}
      await new Promise(r => setTimeout(r, 200));

      addLog("Detecting Ollama daemon...");
      try {
        const ollamaStatus = await invoke('check_ollama_status');
        setIsOllamaInstalled(ollamaStatus as boolean);
        addLog(ollamaStatus ? "OK: Ollama detected." : "INFO: Ollama not detected.");
      } catch(e) {}
      
      addLog("Detecting system VRAM...");
      try {
        const vram = await invoke('detect_vram');
        if (vram !== null && vram !== undefined) {
          const vramGb = Math.round(Number(vram) / 1024);
          setDetectedVram(String(vramGb));
          addLog(`OK: Detected ${vramGb}GB VRAM.`);
        }
      } catch(e) {}
      await new Promise(r => setTimeout(r, 300));

      addLog("Verifying OpenRouter credentials...");
      try {
        await invoke('get_credential', { service: 'openrouter' });
        setNodes(nds => nds.map(n => n.id === 'node-openrouter' ? { ...n, data: { ...n.data, status: 'active' } } : n));
        addLog("OK: OpenRouter authenticated.");
      } catch(e) {
        addLog("INFO: OpenRouter credentials missing.");
      }
      await new Promise(r => setTimeout(r, 400));

      addLog("All systems nominal. Launching UI...");
      await new Promise(r => setTimeout(r, 500));
      
      if (isMounted) setIsAppLoaded(true);
    };
    
    runInit();
    return () => { isMounted = false; };
  }, []);
"""
if "Booting FrugaLLM core subsystems" not in content:
    content = content.replace("const [activeProcesses, setActiveProcesses] = useState<Record<string, boolean>>({});", "const [activeProcesses, setActiveProcesses] = useState<Record<string, boolean>>({});\n" + init_effect)

# 4. Remove duplicate individual checks
# Remove get_frugallm_config in the first useEffect
content = re.sub(r"invoke\('get_frugallm_config'\)\.then\(\(conf: any\) => setFrugalConfig\(conf\)\)\.catch\(console\.error\);\s*\}, \[\]\);", "  }, []);", content)
# Remove check_hermes_status
content = re.sub(r"invoke\('check_hermes_status'\)\.then\(\(installed\) => \{\s*setIsHermesInstalled\(installed as boolean\);\s*\}\)\.catch\(console\.error\);", "", content)
# Remove check_opencode_status
content = re.sub(r"invoke\('check_opencode_status'\)\.then\(\(installed\) => \{\s*setIsOpenCodeInstalled\(installed as boolean\);\s*\}\)\.catch\(console\.error\);", "", content)
# Remove auto-detect OpenRouter
content = re.sub(r"// Auto-detect OpenRouter\s*invoke\('get_credential', \{ service: 'openrouter' \}\)\.then\(\(\) => \{\s*setNodes\(nds => nds\.map\(n => n\.id === 'node-openrouter' \? \{ \.\.\.n, data: \{ \.\.\.n\.data, status: 'active' \} \} : n\)\);\s*\}\)\.catch\(\(\) => \{\}\);", "", content)
# Remove auto-detect Ollama
content = re.sub(r"// Auto-detect Ollama and its installation status via backend\s*invoke\('check_ollama_status'\)\.then\(\(installed\) => \{\s*setIsOllamaInstalled\(installed as boolean\);\s*\}\)\.catch\(console\.error\);", "", content)
# Remove detect_vram
content = re.sub(r"invoke\('detect_vram'\)\.then\(\(vram\) => \{\s*if \(vram !== null && vram !== undefined\) \{\s*const vramGb = Math\.round\(Number\(vram\) / 1024\);\s*setDetectedVram\(String\(vramGb\)\);\s*\}\s*\}\)\.catch\(console\.error\);", "", content)

# 5. Add conditional render
if "!isAppLoaded ? <TerminalLoader logs={initLogs} /> :" not in content:
    content = content.replace("  return (\n    <div \n      style={{ display: 'flex', width: '100%', height: '100vh', fontFamily: 'inherit', backgroundColor: 'var(--zen-surface-hover)', borderRadius: '8px', overflow: 'hidden' }}\n    >", "  return !isAppLoaded ? <TerminalLoader logs={initLogs} /> : (\n    <div \n      style={{ display: 'flex', width: '100%', height: '100vh', fontFamily: 'inherit', backgroundColor: 'var(--zen-surface-hover)', borderRadius: '8px', overflow: 'hidden' }}\n    >")

with open('src/App.tsx', 'w') as f:
    f.write(content)
