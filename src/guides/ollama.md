## **Setting up a Local LLM with Ollama**

Running a "Local LLM" (Large Language Model) means the AI brain is actually downloaded onto your computer.

**Why do this?** First, it is **100% free forever**. There are no token limits, no subscription fees, and no API requests to track. You only pay for the electricity your computer uses to run it. Second, it offers **total privacy**. Your data never leaves your house, and you don't even need an internet connection to chat\!

To do this easily, we will use a tool called **Ollama**.

### **Step 1: Check Your Hardware (VRAM is King)**

To run AI locally at decent speeds, your Graphics Card (GPU) is more important than your main CPU. Specifically, you need **Video RAM (VRAM)**.

1. **On Windows**: Press Ctrl \+ Shift \+ Esc to open Task Manager. Click the **Performance** tab, then select your **GPU** on the left. Look for "Dedicated GPU memory"—this is your VRAM.  
2. **On Mac (Apple Silicon)**: M-series Macs (M1, M2, M3, M4) use "Unified Memory," meaning your regular RAM acts as VRAM. Click the Apple Logo \> **About This Mac** to see your total Memory.

**The Rule of Thumb**:

* **4GB VRAM/Memory**: Perfect for "mini" models (1.5B to 3B parameters like qwen2.5:1.5b or llama3.2:3b).  
* **8GB VRAM/Memory**: Great for small models (up to 8 Billion parameters like llama3 or gemma).  
* **12GB \- 16GB VRAM/Memory**: Can comfortably run mid-sized models (14B to 32B parameters like qwen2.5:14b).  
* *Note: The general formula for VRAM is 2 bytes per parameter (so a 7B parameter model takes about 14GB of VRAM in pure 16-bit, but Ollama automatically compresses (quantizes) them so a 7B model usually fits in about 4.5GB\!)*

### **Step 2: Install Ollama**

1. Go to https://ollama.com/  
2. Click **Download** and select your operating system (Windows, Mac, or Linux).  
3. Run the installer just like any normal program.  
4. Once installed, Ollama runs silently in the background (you might see a little llama icon in your system tray or menu bar).

### **Step 3: Run Your First Model**

1. Open your computer's terminal:  
   * **Windows**: Open the Start menu, type cmd, and press Enter to open Command Prompt.  
   * **Mac**: Press Cmd \+ Space, type Terminal, and press Enter.  
2. Type the following command and press Enter: ollama run llama3.2:3b *(You can replace llama3.2:3b with a larger model if you have more VRAM)*.  
3. The first time you run this, Ollama will download the model (it may take a few minutes depending on your internet speed).  
4. Once it says "success," you will see a \>\>\> prompt. You are now chatting with an AI running locally on your machine\! Try typing: Why is the sky blue in one paragraph?  
5. To exit the terminal chat, type /bye.

*(Note: You don't need to stay in the terminal\! Now that Ollama is running, FrugaLLM can automatically connect to it and give you a beautiful user interface).*

### **Common Mistakes & Troubleshooting**

* **"Out of Memory" Errors**: You tried to run a model that is too big for your VRAM. Open your terminal and type ollama rm \[modelname\] to delete it, and try a smaller model.  
* **Ollama isn't running**: If other apps can't find Ollama, make sure the program is actually open. Look for the llama icon in your system tray.

### **Further Reading & Video Guides (Ollama & Local AI)**

* **YouTube**:  
  * [Ollama & Open Web UI Setup Tutorial: UNDER 10 MINUTES by GenAISpotlight](https://www.youtube.com/watch?v=Z-qYXWsU-u4) *(Skip the Open Web UI portions, as FrugaLLM handles this for you\!)*  
  * [Learn Ollama in 15 Minutes \- Run LLM Models Locally for FREE](https://www.youtube.com/watch?v=UtSSMs6ObqY)  
* **How-To Geek**:  
  * [Setting up a local LLM is the easy part—here's what you need to do with it next](https://www.howtogeek.com/what-to-do-with-local-llm/)  
  * [I ditched cloud voice assistants for a local LLM and my smart home finally feels private](https://www.howtogeek.com/how-a-local-llm-fixed-my-biggest-smart-home-privacy-problem/)