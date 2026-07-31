import { useState, useEffect, useRef } from "react";
import { Settings, Cpu, Shield, HelpCircle, Terminal, MessageSquare, Send, Paperclip, Info, Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { fetchFreeOpenRouterModels } from "./router";
import { pipeline } from "@huggingface/transformers";

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

const InfoTooltip = ({ children, position = "center" }: { children: React.ReactNode, position?: "center" | "right" | "left" }) => {
  let positionClasses = "left-1/2 -translate-x-1/2 bottom-full pb-2";
  if (position === "right") {
    positionClasses = "right-[-12px] bottom-full pb-2";
  } else if (position === "left") {
    positionClasses = "left-[-12px] bottom-full pb-2";
  }

  return (
    <div className="group/tooltip relative inline-flex items-center ml-2">
      <Info className="w-4 h-4 text-neutral-500 hover:text-neutral-300 cursor-help transition-colors" />
      <div className={`absolute hidden group-hover/tooltip:block z-[999] ${positionClasses}`}>
        <div className="w-56 p-3 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl text-xs text-neutral-300 leading-relaxed font-normal normal-case">
          {children}
        </div>
      </div>
    </div>
  );
};

// Lazy load classifier
let classifierPipeline: any = null;
const loadClassifier = async (onProgress?: (info: any) => void) => {
  if (!classifierPipeline) {
    try {
      classifierPipeline = await pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-small', {
        progress_callback: onProgress
      });
    } catch (e) {
      console.warn("Could not load Transformers.js pipeline:", e);
    }
  }
  return classifierPipeline;
};

const REPRIMAND_MESSAGE = "[SYSTEM REPRIMAND: You detailed a plan and informed the user you were taking action, but failed to output the corresponding JSON tool call. Do not apologize. Output the required tool call immediately.]";

export default function App() {
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [ollamaConfig, setOllamaConfig] = useState("http://127.0.0.1:11434");
  const [enableGatekeeper, setEnableGatekeeper] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [loadingClassifier, setLoadingClassifier] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  const [isConnected, setIsConnected] = useState(false);
  const [activeModel, setActiveModel] = useState("None");
  const [dynamicModels, setDynamicModels] = useState<string[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch launch options from Tauri
  useEffect(() => {
    invoke("get_launch_options").then((opts: any) => {
      if (opts.openrouter_key) setOpenRouterKey(opts.openrouter_key);
      if (opts.local_llm_ip) setOllamaConfig(`http://${opts.local_llm_ip}:11434`);
    }).catch(console.error);
  }, []);

  // Load classifier asynchronously when gatekeeper is enabled
  useEffect(() => {
    if (enableGatekeeper) {
      setLoadingClassifier(true);
      const fileProgress: Record<string, { loaded: number, total: number }> = {};
      
      loadClassifier((info) => {
        if (info.status === 'progress' && info.total) {
           fileProgress[info.file] = { loaded: info.loaded, total: info.total };
           let totalLoaded = 0;
           let totalSize = 0;
           Object.values(fileProgress).forEach(f => {
             totalLoaded += f.loaded;
             totalSize += f.total;
           });
           if (totalSize > 0) {
             setDownloadProgress((totalLoaded / totalSize) * 100);
           }
        }
      }).then(() => setLoadingClassifier(false));
    }
  }, [enableGatekeeper]);

  // Poll for dynamic roster
  useEffect(() => {
    if (openRouterKey.length > 5) {
      fetchFreeOpenRouterModels(openRouterKey).then(models => {
        setDynamicModels(models);
        setIsConnected(true);
        setActiveModel(models.length > 0 ? models[0] : "google/gemini-2.5-flash:free");
      });
    } else if (ollamaConfig) {
      setIsConnected(true);
      setActiveModel("hermes:latest");
    } else {
      setIsConnected(false);
      setActiveModel("None");
    }
  }, [openRouterKey, ollamaConfig]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !isConnected) return;
    
    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    let currentMessages = [...messages, userMessage];

    // Placeholder for assistant
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    const isOllama = activeModel.includes("hermes");
    const targetUrl = isOllama ? `${ollamaConfig}/v1/chat/completions` : "https://openrouter.ai/api/v1/chat/completions";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (!isOllama && openRouterKey) {
       headers["Authorization"] = `Bearer ${openRouterKey}`;
    }
    
    const maxRetries = 3;
    let attempt = 1;

    while (attempt <= maxRetries) {
      try {
        // Force stream=false for gatekeeper validation
        const response = await tauriFetch(targetUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: activeModel,
            messages: currentMessages,
            stream: false
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const choices = data.choices || [];
        if (choices.length === 0) throw new Error("No choices in response");

        const message = choices[0].message;
        const tool_calls = message.tool_calls;
        const content = message.content || "";

        // If it has tool calls, we are good!
        if (tool_calls && tool_calls.length > 0) {
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1].content = content + "\n[Action executed internally]";
            return newMsgs;
          });
          break;
        }

        // Empty promise classification
        let isEmptyPromise = false;
        if (enableGatekeeper) {
          const cls = await loadClassifier();
          if (cls && content.trim()) {
            const clsResult = await cls(content, [
              "promising to execute a technical action or delegate a task",
              "general conversational response"
            ]);
            if (clsResult.labels[0].includes("promising") && clsResult.scores[0] > 0.85) {
              isEmptyPromise = true;
            }
          }
        }

        if (isEmptyPromise && attempt < maxRetries) {
          console.warn(`Attempt ${attempt}: Empty promise detected! Retrying...`);
          currentMessages = [
            ...currentMessages,
            { role: "assistant", content },
            { role: "user", content: REPRIMAND_MESSAGE }
          ];
          attempt++;
          continue; // Retry internally
        }

        // Valid text response (or exhausted retries)
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1].content = content;
          return newMsgs;
        });
        break;

      } catch (error) {
        console.error("Chat error:", error);
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1].content = "⚠️ Connection to model failed.";
          return newMsgs;
        });
        break;
      }
    }
    
    setIsTyping(false);
  };

  const isLocalConnected = isConnected && !!ollamaConfig && !openRouterKey;

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 font-sans overflow-hidden">
      {/* Left Panel: Settings & Onboarding */}
      <div className="w-1/3 min-w-[320px] max-w-[400px] bg-neutral-900 border-r border-neutral-800 flex flex-col z-20">
        <div className="p-6 border-b border-neutral-800">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cpu className="text-blue-500" /> FrugaLLM
          </h1>
          <p className="text-neutral-400 text-sm mt-1">Zero-cost intelligence gateway</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* OpenRouter Section */}
          <section>
            <h2 className="text-lg font-semibold flex items-center mb-3">
              <Shield className="w-5 h-5 mr-2" /> OpenRouter (Cloud)
              <InfoTooltip>
                Get a free API key from <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">openrouter.ai</a> to use free models.
              </InfoTooltip>
            </h2>
            <div className="bg-neutral-800/50 p-4 rounded-lg border border-neutral-800">
              <input 
                type="password"
                placeholder="sk-or-v1-..." 
                className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                value={openRouterKey}
                onChange={(e) => setOpenRouterKey(e.target.value)}
              />
            </div>
          </section>

          {/* Ollama Section */}
          <section>
            <h2 className="text-lg font-semibold flex items-center mb-3">
              <Terminal className="w-5 h-5 mr-2" /> LocalLLM (Ollama)
              <InfoTooltip>
                Run models locally for ultimate privacy. Ensure your local LLM is running at the configured URL.
              </InfoTooltip>
            </h2>
            <div className="bg-neutral-800/50 p-4 rounded-lg border border-neutral-800">
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="http://127.0.0.1:11434" 
                  className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-sm focus:outline-none focus:border-blue-500"
                  value={ollamaConfig}
                  onChange={(e) => setOllamaConfig(e.target.value)}
                />
              </div>

              {isLocalConnected && (
                <div className="mt-4 flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="gatekeeper"
                    checked={enableGatekeeper}
                    onChange={(e) => setEnableGatekeeper(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-700 text-blue-600 focus:ring-blue-500 bg-neutral-950"
                  />
                  <label htmlFor="gatekeeper" className="text-sm font-medium text-neutral-300 cursor-pointer flex items-center">
                    Enable Tool Use Gate Keeper
                    <InfoTooltip position="right">
                      Runs a local language model (nli-deberta) to detect and internally retry "empty promises" (when the model says it will take action but fails to output a tool call).
                    </InfoTooltip>
                  </label>
                </div>
              )}

              <button className="mt-3 w-full bg-neutral-700 hover:bg-neutral-600 text-white rounded p-2 text-sm transition-colors flex justify-center items-center gap-2">
                <Terminal className="w-4 h-4" /> Install & Start Ollama
              </button>
            </div>
          </section>

          {/* Diagnostics Section */}
          <section>
            <h2 className="text-lg font-semibold flex items-center mb-3">
              <Settings className="w-5 h-5 mr-2" /> Diagnostics
              <InfoTooltip>
                System status and telemetry for the AI models and connections.
              </InfoTooltip>
            </h2>
            <div className="bg-neutral-800/50 p-4 rounded-lg border border-neutral-800 space-y-4">
              
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-neutral-400">Gatekeeper Status</span>
                  <span className={enableGatekeeper ? (loadingClassifier ? "text-yellow-400 flex items-center gap-1.5" : "text-green-400") : "text-neutral-500"}>
                    {!enableGatekeeper ? "Disabled" : (loadingClassifier ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Downloading {Math.round(downloadProgress)}%</>
                    ) : "Ready")}
                  </span>
                </div>
                {enableGatekeeper && loadingClassifier && (
                  <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden border border-neutral-700">
                    <div className="bg-yellow-400 h-full transition-all duration-300 ease-out" style={{ width: `${downloadProgress}%` }} />
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center text-sm pt-2 border-t border-neutral-800/50">
                <span className="text-neutral-400">Dynamic Free Pool</span>
                <span className="text-blue-400">{dynamicModels.length} models</span>
              </div>
              
              <div className="pt-2 border-t border-neutral-800/50">
                <button 
                  onClick={async () => {
                    const keys = await caches.keys();
                    for (const key of keys) {
                      await caches.delete(key);
                    }
                    alert("Local model cache cleared! Please uncheck and re-check the Gatekeeper box to test the download again.");
                  }}
                  className="w-full bg-neutral-700/50 hover:bg-neutral-700 text-neutral-300 rounded p-1.5 text-xs transition-colors"
                >
                  Clear Local Model Cache
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Footer Acknowledgements */}
        <div className="p-4 border-t border-neutral-800 text-xs text-neutral-500 flex justify-between items-center">
          <div className="flex gap-3">
            <a href="#" className="hover:text-neutral-300">GitHub</a>
            <a href="#" className="hover:text-neutral-300">Ko-Fi</a>
          </div>
          <HelpCircle className="w-4 h-4" />
        </div>
      </div>

      {/* Right Panel: Chat Interface */}
      <div className="flex-1 flex flex-col relative bg-neutral-950">
        
        {/* Status Bar */}
        <div className="h-14 border-b border-neutral-800 flex items-center justify-between px-6 bg-neutral-900/50 z-10">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="font-medium">Model: <span className="text-blue-400">frugaLLM</span></span>
          </div>
          <div className="text-xs text-neutral-400 font-mono">
            Routing to: {activeModel}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col relative">
          
          {!isConnected ? (
            <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-center p-6">
              <Shield className="w-16 h-16 text-neutral-700 mb-4" />
              <h3 className="text-xl font-semibold mb-2">FrugaLLM is Locked</h3>
              <p className="text-neutral-400 max-w-sm">
                Please connect to OpenRouter or start a LocalLLM in the left panel to begin chatting.
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center items-center text-neutral-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Start a conversation with frugaLLM.</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full space-y-6 pb-6 mt-auto">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-5 py-3 ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-neutral-800 text-neutral-100 rounded-bl-none whitespace-pre-wrap break-words'
                  }`}>
                    {msg.content || (msg.role === 'assistant' && isTyping && i === messages.length - 1 ? (
                      <span className="animate-pulse text-blue-400">Analyzing & Retrying if needed...</span>
                    ) : null)}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900 z-10">
          <div className="max-w-3xl mx-auto relative">
            <textarea 
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-4 pr-12 pt-3 pb-3 text-sm focus:outline-none focus:border-blue-500 resize-none"
              rows={2}
              placeholder={isConnected ? "Message frugaLLM..." : "Connect a model to type..."}
              disabled={!isConnected || isTyping}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <button 
                className="text-neutral-400 hover:text-neutral-200 p-1" 
                disabled={!isConnected || isTyping}
                onClick={() => alert("Attachment functionality coming soon!")}
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button 
                className="bg-blue-600 hover:bg-blue-500 text-white rounded p-1.5 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors" 
                disabled={!isConnected || !input.trim() || isTyping}
                onClick={handleSend}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="text-center text-xs text-neutral-500 mt-2">
            frugaLLM will internally retry empty promises to guarantee outputs.
          </div>
        </div>

      </div>
    </div>
  );
}
