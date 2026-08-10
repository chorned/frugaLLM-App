## **Next Steps \- Using AI Agents**

FrugaLLM is a local proxy that makes it easy to use open-source AI agents.

Currently, user-friendly tools like Claude Code, Codex, and Antigravity bind you to their specific providers. While the open-source ecosystem offers great alternatives like **Hermes**, **OpenCode**, and **OpenClaw**, connecting them to different LLMs often requires complex configurations.

FrugaLLM solves this by acting as a universal, frictionless bridge. Simply install FrugaLLM, configure your preferred local or cloud model once, and whenever an agent requests an API connection, point it to your FrugaLLM endpoint.

Here are two of the best open-source agents you can plug your new LLM setup into.

### **Tool A: Hermes Agent (The Everyday Assistant)**

Hermes (by Nous Research) is a powerful desktop and terminal agent that acts as a 24/7 assistant. It has a persistent memory—it remembers your preferences across sessions and even writes its own "skills" as it learns how you work.

**How to use it:**

1. Download the Hermes Desktop installer from https://hermes-agent.nousresearch.com/.  
2. Run the installer.  
3. When you launch Hermes for the first time, it will ask for a provider.  
   * **To use OpenRouter**: Select OpenRouter and paste the API key you made in Guide 1\.  
   * **To use Local Ollama**: Select "Custom OpenAI-compatible endpoint". Use the URL http://localhost:11434/v1 and set the API key to just the word ollama.  
4. Start asking it to do things\! Try: *"Search the web for the latest Anthropic news and summarize it in a text file on my desktop."*

### **Tool B: OpenCode (The Coding Worker)**

OpenCode is an autonomous coding agent. Instead of just giving you code snippets to copy-paste, it works inside your project folders to build, refactor, and review code.

**How to use it:**

1. You need Node.js installed on your computer first.  
2. Open your terminal and run: npm i \-g opencode-ai@latest  
3. You will need to authenticate it with your provider. If using OpenRouter, you can run opencode auth login or set an environment variable OPENROUTER\_API\_KEY.  
4. Navigate to a code project folder in your terminal, type opencode, and you will enter an interactive coding session\!

### **Common Mistakes & Troubleshooting**

* **API Costs with Agents**: Agents "think" in loops, making multiple API calls for a single task. If you are using OpenRouter with a paid model (like GPT-4o), keep an eye on your balance\! Agents can spend money much faster than standard chatting. Using a local Ollama model prevents this entirely.  
* **Tool Permissions**: When using local models with agents, ensure the model you chose is good at "function calling" or "tool use" (like qwen2.5 or llama3.2). Smaller or older models will struggle to execute commands properly.

### **Further Reading & Video Guides (Agents)**

* **YouTube**:  
  * [*Hermes Agent Setup with Free AI API \- Full Tutorial (2026)*](https://www.youtube.com/watch?v=56IT3Q-h0kg) (Excellent guide for combining OpenRouter's free tier with Hermes).  
  * [*The Only Hermes Agent Tutorial You'll Need in 2026*](https://www.youtube.com/watch?v=8bYMgvJt5Ws)  
  * [*OpenCode CRASH Course | OPEN SOURCE AI CODING AGENT*](https://www.youtube.com/watch?v=Pg_3OfAs4N8)  
* **How-To Geek**: [*Codex has dethroned Claude as the king of AI programming, and it's not even close*](https://www.howtogeek.com/i-was-a-diehard-claude-code-fanthen-codex-showed-me-what-i-was-missing/) (Discusses using Codex with OpenCode and Hermes).