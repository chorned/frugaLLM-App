/**
 * Dev-Only Screenshot Mode Harness
 * 
 * Provides production-grade, believably real placeholder data and copy overrides
 * optimized for App Store homepage screenshots.
 * 
 * STRICT MANDATE:
 * - This module is ONLY compiled/evaluated in DEV mode (import.meta.env.DEV).
 * - It is 100% dead-code eliminated and stripped in production builds.
 * - NO "EXAMPLE", "PLACEHOLDER", or "TEST" strings are ever used.
 */

export const APPSTORE_STRING_OVERRIDES = {
  routingGraph: {
    nodes: {
      frugallmCore: {
        label: "FrugaLLM",
        subheader: "Core Gateway",
        description: "The intelligent neural proxy. Dynamically orchestrates requests between local hardware accelerators and cloud providers to optimize cost, latency, and throughput."
      },
      ollamaLocal: {
        label: "Ollama",
        subheader: "Local Accelerator",
        description: "Zero-latency private neural engine. Runs quantized open-weights locally with full Apple Metal and AVX2 GPU/CPU acceleration, keeping proprietary data strictly on-device."
      },
      openRouter: {
        label: "OpenRouter",
        subheader: "Global Multiplexer",
        description: "Unified cloud routing mesh. Seamlessly cascades across 200+ frontier models with automatic rate-limit failover, latency minimization, and consolidated usage tracking."
      },
      googleAIStudio: {
        label: "AI Studio",
        subheader: "Gemini Frontier",
        description: "Direct high-throughput pipeline to Google DeepMind Gemini models, featuring multi-modal reasoning and ultra-long 1M+ token context windows."
      },
      hermes: {
        label: "Hermes",
        subheader: "Autonomous Agent",
        description: "Autonomous reasoning and tool orchestration agent with continuous memory indexing, self-healing code execution, and native background gateway integration."
      },
      openCode: {
        label: "Opencode",
        subheader: "Coding Engine",
        description: "Autonomous software development agent specialized in AST-level repository refactoring, test suite generation, and multi-file code synthesis."
      }
    }
  }
};

export const APPSTORE_BOOT_LOGS = [
  "Booting FrugaLLM core subsystems...",
  "Initializing neural proxy routing mesh...",
  "OK: Configuration loaded.",
  "Probing Apple Metal / Vulkan GPU hardware layer...",
  "OK: Detected unified system VRAM: 16 GB.",
  "Checking local Ollama daemon (127.0.0.1:11434)...",
  "OK: Ollama engine online. Active model: llama3.3:70b-instruct.",
  "Checking Tool Enforcing Gateway WASM runtime...",
  "OK: Tool Gateway runtime active (Xenova/nli-deberta-v3-small).",
  "Verifying OpenRouter cloud multiplexer credentials...",
  "OK: OpenRouter API authenticated (Tier 3 - sk-or-v1-...).",
  "Verifying Google AI Studio credentials...",
  "OK: Google AI Studio authenticated (Gemini Pro/Flash pool ready).",
  "Checking Hermes autonomous agent daemon...",
  "OK: Hermes Agent v0.4.2 connected on 127.0.0.1:3001.",
  "Checking OpenCode autonomous agent daemon...",
  "OK: OpenCode Agent v1.2.0 connected on 127.0.0.1:3000.",
  "Verifying zero-latency local proxy bridge (127.0.0.1:8080)...",
  "OK: Reverse proxy initialized. Port 8080 listening.",
  "All neural topology subsystems nominal. Launching UI..."
];

export const APPSTORE_ROUTING_CHAIN = [
  { provider: 'OPENROUTER', model: 'anthropic/claude-3.5-sonnet', iq: 98.4, context_length: 200000 },
  { provider: 'GOOGLE', model: 'google/gemini-2.0-flash', iq: 95.1, context_length: 1048576 },
  { provider: 'OPENROUTER', model: 'meta-llama/llama-3.3-70b-instruct', iq: 92.0, context_length: 128000 },
  { provider: 'OPENROUTER', model: 'deepseek/deepseek-chat', iq: 89.6, context_length: 128000 },
  { provider: 'OPENROUTER', model: 'openai/gpt-4o', iq: 88.2, context_length: 128000 }
];

export const APPSTORE_FRUGAL_CONFIG = {
  port: 8080,
  bind_all_interfaces: true,
  require_password: true,
  api_password: "frg_live_9b4a1c72e0d5",
  tool_enforcing_gateway: true,
  start_on_login: true,
  start_minimized: false,
  global_cli_enabled: true,
  manual_model_overrides: [
    "anthropic/claude-3.5-sonnet",
    "google/gemini-2.0-flash",
    "meta-llama/llama-3.3-70b-instruct"
  ],
  hermes_workspace: "/Users/alexander/Projects/neural-routing",
  opencode_workspace: "/Users/alexander/Workspace/vision-pipeline"
};

export const APPSTORE_FORM_DATA = {
  schemaPath: "schemas/agent-action.json",
  cwd: "/Users/alexander/Projects/neural-router",
  bin: "hermes-cli",
  extraArgs: "--max-iterations=50, --sandbox",
  prompt: "Synthesize high-frequency telemetry, optimize prompt routing cascades, and enforce strict type contracts on downstream tool executions.",
  ip: "127.0.0.1",
  port: "8080",
  apiKey: "sk-or-v1-98a3f82b7c41e0d5a7f201b94c33",
  googleApiKey: "AIzaSyD849aFk2cL30198qZmbXeR5-u",
  api_password: "frg_live_9b4a1c72e0d5",
  bind_all_interfaces: true,
  start_on_login: true,
  start_minimized: false,
  global_cli_enabled: true,
  manual_model_overrides: [
    "anthropic/claude-3.5-sonnet",
    "google/gemini-2.0-flash",
    "meta-llama/llama-3.3-70b-instruct"
  ],
  hermes_workspace: "/Users/alexander/Projects/neural-routing",
  opencode_workspace: "/Users/alexander/Workspace/vision-pipeline"
};

export const APPSTORE_TELEMETRY = {
  ollama: {
    status: 'active',
    model_name: 'gemma4:e4b',
    location_state: 'gpu',
    hybrid_percent: 0,
    total_size: 8500000000,
    vram_size: 8500000000
  },
  hardware: {
    cpu_utilization: 18.4,
    gpu_utilization: 42.1,
    vram_used: 8.4,
    vram_total: 16.0
  },
  hardware_profile: {
    device_type: 'apple_silicon',
    chip_name: 'Apple M3 Max',
    total_memory_gb: 36,
    integrated_vram_gb: 16
  }
};

export function isScreenshotMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (!import.meta.env.DEV) return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('screenshot_mode') === 'true' || (window as any).__SCREENSHOT_MODE__ === true;
}

export function getScreenshotScreen(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('screen') || (window as any).__SCREENSHOT_SCREEN__ || null;
}

export function getScreenshotInitialNodes(baseNodes: any[]): any[] {
  return baseNodes.map(node => {
    switch (node.id) {
      case 'node-ollama':
        return {
          ...node,
          data: {
            ...node.data,
            subheader: "Local Accelerator",
            description: APPSTORE_STRING_OVERRIDES.routingGraph.nodes.ollamaLocal.description,
            ip: '127.0.0.1',
            port: '11434',
            status: 'active'
          }
        };
      case 'node-openrouter':
        return {
          ...node,
          data: {
            ...node.data,
            subheader: "Global Multiplexer",
            description: APPSTORE_STRING_OVERRIDES.routingGraph.nodes.openRouter.description,
            ip: 'openrouter.ai',
            port: '443',
            status: 'active',
            keyPrefix: 'sk-or-v1-98a3f82b',
            lastStatus: '200 OK'
          }
        };
      case 'node-google':
        return {
          ...node,
          data: {
            ...node.data,
            subheader: "Gemini Frontier",
            description: APPSTORE_STRING_OVERRIDES.routingGraph.nodes.googleAIStudio.description,
            ip: 'generativelanguage.googleapis.com',
            port: '443',
            status: 'active',
            keyPrefix: 'AIzaSyD849aF',
            lastStatus: '200 OK'
          }
        };
      case 'node-frugallm':
        return {
          ...node,
          data: {
            ...node.data,
            subheader: "Core Gateway",
            description: APPSTORE_STRING_OVERRIDES.routingGraph.nodes.frugallmCore.description,
            ip: '127.0.0.1',
            port: '8080',
            status: 'active'
          }
        };
      case 'node-hermes':
        return {
          ...node,
          data: {
            ...node.data,
            subheader: "Autonomous Agent",
            description: APPSTORE_STRING_OVERRIDES.routingGraph.nodes.hermes.description,
            ip: '127.0.0.1',
            port: '3001',
            status: 'active'
          }
        };
      case 'node-opencode':
        return {
          ...node,
          data: {
            ...node.data,
            subheader: "Coding Engine",
            description: APPSTORE_STRING_OVERRIDES.routingGraph.nodes.openCode.description,
            ip: '127.0.0.1',
            port: '3000',
            status: 'active'
          }
        };
      default:
        return node;
    }
  });
}

/**
 * Mutates the localized en dictionary in-place in dev mode to guarantee
 * rich, descriptive marketing copy in screenshots.
 */
export function applyScreenshotLocaleOverrides(enObject: any): void {
  if (!isScreenshotMode()) return;

  const overrides = APPSTORE_STRING_OVERRIDES.routingGraph.nodes;
  if (enObject?.routingGraph?.nodes) {
    if (overrides.frugallmCore) {
      Object.assign(enObject.routingGraph.nodes.frugallmCore, overrides.frugallmCore);
    }
    if (overrides.ollamaLocal) {
      Object.assign(enObject.routingGraph.nodes.ollamaLocal, overrides.ollamaLocal);
    }
    if (overrides.openRouter) {
      Object.assign(enObject.routingGraph.nodes.openRouter, overrides.openRouter);
    }
    if (overrides.googleAIStudio) {
      Object.assign(enObject.routingGraph.nodes.googleAIStudio, overrides.googleAIStudio);
    }
    if (overrides.hermes) {
      Object.assign(enObject.routingGraph.nodes.hermes, overrides.hermes);
    }
    if (overrides.openCode) {
      Object.assign(enObject.routingGraph.nodes.openCode, overrides.openCode);
    }
  }
}

/**
 * Installs Tauri IPC mock responses for dev screenshot capture.
 */
export function installScreenshotIpcMocks(): void {
  if (typeof window === 'undefined') return;
  if (!isScreenshotMode()) return;

  // Set local storage so onboarding modal doesn't occlude landing screens
  window.localStorage.setItem('onboardingState', 'completed');
  window.localStorage.setItem('frugallm_avg_throughput', '84.6');

  const listeners: Record<string, ((event: any) => void)[]> = {};

  const win = window as any;
  win.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: () => {}
  };
  win.__MOCK_ONNX_DOWNLOAD__ = true;

  const originalInternals = win.__TAURI_INTERNALS__;
  win.__TAURI_INTERNALS__ = {
    transformCallback: () => 1234,
    plugins: {
      event: {
        unregisterListener: () => {},
        listen: (eventName: string, handler: (event: any) => void) => {
          if (!listeners[eventName]) listeners[eventName] = [];
          listeners[eventName].push(handler);
          if (eventName === 'telemetry_update') {
            setTimeout(() => {
              handler({ payload: APPSTORE_TELEMETRY });
            }, 100);
          }
          return Promise.resolve(1234);
        }
      }
    },
    invoke: (cmd: string, args: any) => {
      const mockResult = handleScreenshotInvoke(cmd, args, listeners);
      if (mockResult !== undefined) return mockResult;
      return originalInternals?.invoke ? originalInternals.invoke(cmd, args) : Promise.resolve();
    }
  };

  // Emit telemetry after listeners attach
  setTimeout(() => {
    if (listeners['telemetry_update']) {
      listeners['telemetry_update'].forEach(cb => cb({ payload: APPSTORE_TELEMETRY }));
    }
  }, 300);
}

function handleScreenshotInvoke(cmd: string, args: any, listeners: Record<string, ((event: any) => void)[]>): any {
  switch (cmd) {
    case 'plugin:event|listen': {
      const eventName = args?.event;
      if (eventName && !listeners[eventName]) {
        listeners[eventName] = [];
      }
      return Promise.resolve(1234);
    }
    case 'get_frugallm_config':
      return Promise.resolve(APPSTORE_FRUGAL_CONFIG);
    case 'set_frugallm_config':
      return Promise.resolve();
    case 'check_ollama_status':
      return Promise.resolve(true);
    case 'check_hermes_status':
      return Promise.resolve(true);
    case 'get_hermes_version':
      return Promise.resolve('v0.4.2');
    case 'check_opencode_status':
      return Promise.resolve(true);
    case 'get_opencode_version':
      return Promise.resolve('v1.2.0');
    case 'check_tool_gateway_status':
      return Promise.resolve(true);
    case 'set_tool_gateway_installed':
      return Promise.resolve();
    case 'detect_vram':
      return Promise.resolve(16384);
    case 'get_model_tag_for_vram':
      return Promise.resolve('gemma4:e4b');
    case 'get_credential':
      if (args?.service === 'openrouter') {
        return Promise.resolve('sk-or-v1-98a3f82b7c41e0d5a7f201b94c33');
      }
      if (args?.service === 'google') {
        return Promise.resolve('AIzaSyD849aFk2cL30198qZmbXeR5-u');
      }
      return Promise.reject('No key');
    case 'get_routing_chain':
    case 'refresh_routing_chain':
      return Promise.resolve(APPSTORE_ROUTING_CHAIN);
    case 'get_frugallm_server_status':
      return Promise.resolve({ status: 'Running' });
    case 'is_wipe_mode':
      return Promise.resolve(false);
    case 'set_credential':
    case 'delete_credential':
    case 'set_model_override':
    case 'edit_hermes_soul':
      return Promise.resolve();
    default:
      return undefined;
  }
}
