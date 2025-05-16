import * as vscode from "vscode";
import { exec } from "child_process";

export function activate(context: vscode.ExtensionContext) {
  console.log("Activating CAP-in-the-Pocket extension...");
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "runSpringBootView",
      new RunSpringBootViewProvider(context)
    )
  );
}

class RunSpringBootViewProvider implements vscode.WebviewViewProvider {
  private context: vscode.ExtensionContext;
  private _view?: vscode.WebviewView;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    // Listen for configuration changes to update the buttons
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('cap-in-the-pocket.urlButtons') && this._view) {
          this._view.webview.html = this.getWebviewContent();
        }
      })
    );
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    
    // Set up the webview content
    webviewView.webview.options = { 
      enableScripts: true 
    };
    webviewView.webview.html = this.getWebviewContent();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "restart":
          this.restart(webviewView.webview);
          break;
        case "recompile":
          this.recompile(webviewView.webview);
          break;
        case "openUrl":
          this.openUrl(message.url);
          break;
      }
    });
  }

  private restart(webview: vscode.Webview) {
    // Get workspace folder - use the first one if multiple are open
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      webview.postMessage({ log: "\n❌ Error: No workspace folder is open. Please open a CAP project folder first.\n" });
      return;
    }
    
    // Use the first workspace folder as the project root
    const projectRoot = workspaceFolders[0].uri.fsPath;
    
    // Get configured commands from settings
    const config = vscode.workspace.getConfiguration('cap-in-the-pocket');
    const port = config.get('serverPort') as number || 4004;
    const killPortCommand = config.get('killPortCommand') as string || 
      `(lsof -ti:${port} | xargs kill -9) || killall java || true`;
    const runCommand = config.get('runCommand') as string || 'mvn spring-boot:run -B';
    
    // Update webview UI to show "running" state with the correct folder
    webview.postMessage({
      log: `\n▶️ Running in ${projectRoot}:\n    Stopping processes on port ${port} and starting CAP app...\n\n`
    });

    // Execute the shell command in the project root directory
    const options = { 
      cwd: projectRoot,
      shell: true,
      env: {
        ...process.env
      }
    };
    
    // First, kill any processes using the configured port
    const killPortProcess = require('child_process').spawn(
      killPortCommand, 
      [], 
      options
    );
    
    killPortProcess.on('close', (code: number) => {
      webview.postMessage({ 
        log: code === 0 
          ? `✅ Stopped existing processes using port ${port}\n\n` 
          : `ℹ️ No processes were using port ${port}\n\n` 
      });
      
      // Now start the configured run process
      const childProcess = require('child_process').spawn(runCommand, [], options);
      
      // Stream stdout in real-time
      childProcess.stdout.on('data', (data: Buffer) => {
        const rawOutput = data.toString();
        const formattedOutput = this.formatLogOutput(rawOutput);
        webview.postMessage({ log: formattedOutput });
      });
      
      // Stream stderr in real-time 
      childProcess.stderr.on('data', (data: Buffer) => {
        const rawOutput = data.toString();
        const formattedOutput = this.formatLogOutput(rawOutput);
        webview.postMessage({ log: formattedOutput });
      });
      
      // Handle process completion
      childProcess.on('close', (code: number) => {
        const exitMessage = code === 0 
          ? "\n✅ Process completed successfully.\n" 
          : `\n⚠️ Process exited with code ${code}.\n`;
        webview.postMessage({ log: exitMessage });
      });
      
      // Handle process errors
      childProcess.on('error', (err: Error) => {
        webview.postMessage({ log: `\n❌ Error: ${err.message}\n` });
      });
    });
    
    // Handle errors from the kill port process
    killPortProcess.on('error', (err: Error) => {
      webview.postMessage({ log: `\n⚠️ Warning: Could not check for processes on port ${port}: ${err.message}\n` });
    });
  }


  private recompile(webview: vscode.Webview) {
    // Get workspace folder - use the first one if multiple are open
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      webview.postMessage({ log: "\n❌ Error: No workspace folder is open. Please open a CAP project folder first.\n" });
      return;
    }
    
    // Use the first workspace folder as the project root
    const projectRoot = workspaceFolders[0].uri.fsPath;
    
    // Get configured commands from settings
    const config = vscode.workspace.getConfiguration('cap-in-the-pocket');
    const compileCommand = config.get('compileCommand') as string || 'mvn compile -B';
    
    // Execute the shell command in the project root directory
    const options = { 
      cwd: projectRoot,
      shell: true,
      env: {
        ...process.env
      }
    };

    webview.postMessage({
      log: `\n▶️ Recompiling the CAP app, the Spring Boot Dev Tools should reload the Java part...\n\n`
    });
      
    // Now start the configured compile process
    const childProcess = require('child_process').spawn(compileCommand, [], options);
    
    // Stream stdout in real-time
    childProcess.stdout.on('data', (data: Buffer) => {
      const rawOutput = data.toString();
      const formattedOutput = this.formatLogOutput(rawOutput);
      webview.postMessage({ log: formattedOutput });
    });
    
    // Stream stderr in real-time 
    childProcess.stderr.on('data', (data: Buffer) => {
      const rawOutput = data.toString();
      const formattedOutput = this.formatLogOutput(rawOutput);
      webview.postMessage({ log: formattedOutput });
    });
    
    // Handle process completion
    childProcess.on('close', (code: number) => {
      const exitMessage = code === 0 
        ? "\n✅ Process completed successfully.\n" 
        : `\n⚠️ Process exited with code ${code}.\n`;
      webview.postMessage({ log: exitMessage });
    });
    
    // Handle process errors
    childProcess.on('error', (err: Error) => {
      webview.postMessage({ log: `\n❌ Error: ${err.message}\n` });
    });
  }

  private openUrl(url: string) {
    // Use the shell directly to open URLs, which may prevent reload issues on mobile
    const platform = process.platform;
    
    // Choose the appropriate open command based on platform
    let openCommand: string;
    
    switch (platform) {
      case 'darwin':
        // macOS
        openCommand = `open "${url}"`;
        break;
      case 'win32':
        // Windows
        openCommand = `start "" "${url}"`;
        break;
      default:
        // Linux and others
        openCommand = `open "${url}"`;
        break;
    }
    
    // Execute the shell command to open the URL
    exec(openCommand, (error) => {
      if (error) {
        // Fall back to VS Code's method if the shell command fails
        vscode.env.openExternal(vscode.Uri.parse(url));
      }
    });
  }

  private getWebviewContent(): string {
    // Get the configured URL buttons
    const config = vscode.workspace.getConfiguration('cap-in-the-pocket');
    let urlButtons = config.get('urlButtons') as Array<{label: string, url: string}>;
    
    // Check if we're using default buttons
    const usingDefaultButtons = !urlButtons || urlButtons.length === 0;
    
    // If no buttons are configured, use default buttons
    if (usingDefaultButtons) {
      urlButtons = [
        {
          "label": "Travel Processor",
          "url": "http://localhost:4004/travel_processor/dist/index.html"
        },
        {
          "label": "Travel Analytics",
          "url": "http://localhost:4004/travel_analytics/dist/index.html"
        }
      ];
    }

    // Generate button HTML
    let urlButtonsHtml = '';
    if (urlButtons && urlButtons.length > 0) {
      urlButtonsHtml = `
        <div class="url-buttons">
          <h3>Application Links</h3>
          <div class="button-container">
            ${urlButtons.map(button => `
              <button class="url-button" data-url="${button.url}">
                ${button.label}
              </button>
            `).join('')}
          </div>
          ${usingDefaultButtons ? `
          <p class="configuration-hint">
            These are default buttons. You can configure custom links in VS Code settings.
          </p>
          ` : ''}
        </div>
      `;
    }

    // Get proper URI for the logo image
    const logoPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'sapmachine.svg');
    const logoUri = this._view?.webview.asWebviewUri(logoPath);

    return `
      <html>
      <head>
        <style>
          body {
            font-family: sans-serif;
            padding: 10px;
          }
          .large-button {
            background-color: #007acc;
            color: white;
            font-size: 16px;
            padding: 16px;
            width: 100%;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-bottom: 5px;
          }
          .extension-tagline {
            margin: 12px 0;
            text-align: center;
            color: #888888;
            font-size: 12px;
            font-style: italic;
            padding: 6px;
            border-top: 1px solid #3c3c3c;
            border-bottom: 1px solid #3c3c3c;
            background-color: rgba(60, 60, 60, 0.1);
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .extension-tagline::before {
            content: "⚡";
            margin-right: 6px;
            font-size: 14px;
          }
          #output {
            margin-top: 15px;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 10px;
            height: 300px;
            overflow-y: auto;
            border-radius: 4px;
            font-family: monospace;
            line-height: 1;
            font-size: 13px;
          }
          
          .timestamp {
            color: #8a8a8a;
            margin-right: 0px;
          }
          
          .log-level {
            display: inline-block;
            width: 5px;        /* Fixed width for all emoji icons */
            text-align: center; /* Center the emoji within its container */
            margin-right: 5px;
          }
          
          .component-name {
            color: #569cd6;
            font-weight: bold;
            display: inline-block;
            max-width: 200px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: hide;
            vertical-align: bottom;
          }
          
          .maven-line {
            color: #b0b0b0;
            font-size: 0.95em;
          }
        
          @media (max-width: 320px) {
            .component-name {
              max-width: 60px; /* About 5 characters */
            }
            
            #output {
              font-size: 12px;
            }
            
            .timestamp {
              font-size: 0.9em;
            }
          }
          
          @media (max-width: 280px) {
            .component-name {
              max-width: 40px; /* About 3 characters */
            }
          }

          @media (max-width: 200px) {
            .component-name {
              max-width: 20px; /* About one character */
            }
          }

          .url-buttons {
            margin-top: 20px;
          }
          .button-container {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          .url-button {
            background-color: #2c2c32;
            color: #cccccc;
            border: 1px solid #3c3c3c;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            flex-grow: 1;
            text-align: center;
            font-size: 13px;
          }
          .url-button:hover {
            background-color: #3c3c3c;
          }
          h3 {
            margin-bottom: 10px;
            color: #cccccc;
            font-size: 14px;
          }
          .configuration-hint {
            margin-top: 8px;
            font-size: 11px;
            color: #888888;
            text-align: center;
            font-style: italic;
          }
          /* Mobile optimizations */
          @media (max-width: 480px) {
            .button-container {
              flex-direction: column;
            }
            .url-button {
              width: 100%;
              padding: 12px;
              font-size: 16px;
            }
          }
          /* Modified lurking logo styling - removed hover animation */
          .lurking-logo {
            position: fixed;
            bottom: -120px; /* Half hidden: adjust based on actual logo size */
            right: 20px;
            width: 180px;
            height: 180px;
            z-index: 1;
            opacity: 0.7;
            cursor: pointer; /* Add cursor pointer to indicate it's clickable */
            transition: bottom 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
          }
          
          /* Removed the hover rule */
          
          .lurking-logo.revealed {
            bottom: 0px; /* Fully revealed */
            opacity: 1;
          }
          
          /* Bubble animations */
          .bubble {
            position: absolute;
            background-color: rgba(131, 220, 243, 0.6); /* Light blue color */
            border-radius: 50%;
            pointer-events: none;
            z-index: 2; /* Make bubbles appear over the logo */
          }
          
          @keyframes float {
            0% {
              transform: translateY(0);
              opacity: 0;
            }
            20% {
              opacity: 0.7;
            }
            100% {
              transform: translateY(-100px);
              opacity: 0;
            }
          }
          
          /* Modified bubble container to overlap with the logo */
          .bubble-container {
            position: fixed;
            bottom: 0;
            right: 0;
            width: 220px;
            height: 220px;
            overflow: hidden;
            pointer-events: none;
            z-index: 2; /* Position above the logo */
          }
        </style>
      </head>
      <body>
        <button id="restartButton" class="large-button">
          (Re)Launch CAP App
        </button>
        <button id="recompileButton" class="large-button">
          Recompile CAP App
        </button>
        <div class="extension-tagline">
          Experimental CAP-in-the-Pocket Extension
        </div>
        <pre id="output"></pre>
        
        ${urlButtonsHtml}
        
        <div class="bubble-container" id="bubbleContainer"></div>
        <img src="${logoUri}" class="lurking-logo" id="sapLogo" alt="SAP Machine logo lurking" />

        <script>
          const vscode = acquireVsCodeApi();
          const restartButton = document.getElementById('restartButton');
          const recompileButton = document.getElementById('recompileButton');
          const output = document.getElementById('output');
          const logo = document.getElementById('sapLogo');
          const bubbleContainer = document.getElementById('bubbleContainer');
          let revealed = false;
          let bubbleInterval;
          
          // Logo click handler - no change here, just keep the click logic
          logo.addEventListener('click', () => {
            revealed = !revealed;
            
            if (revealed) {
              logo.classList.add('revealed');
              startBubbles();
            } else {
              logo.classList.remove('revealed');
              stopBubbles();
            }
          });
          
          // Create and animate bubbles
          function startBubbles() {
            // Clear any existing interval
            if (bubbleInterval) clearInterval(bubbleInterval);
            
            // Create new bubbles every 300ms
            bubbleInterval = setInterval(() => {
              if (!revealed) return;
              
              // Create 1-3 bubbles
              for (let i = 0; i < Math.floor(1 + Math.random() * 2); i++) {
                createBubble();
              }
            }, 300);
          }
          
          function stopBubbles() {
            if (bubbleInterval) {
              clearInterval(bubbleInterval);
              bubbleInterval = null;
            }
          }
          
          function createBubble() {
            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            
            // Random size between 5px and 15px
            const size = 5 + Math.random() * 10;
            bubble.style.width = \`\${size}px\`;
            bubble.style.height = \`\${size}px\`;
            
            // Position randomly within container
            // Adjusted to allow bubbles to overlap with the logo more
            bubble.style.left = \`\${10 + Math.random() * 160}px\`;
            bubble.style.bottom = \`\${10 + Math.random() * 50}px\`;
            
            // Random animation duration
            const duration = 2 + Math.random() * 2;
            bubble.style.animation = \`float \${duration}s ease-in-out\`;
            
            bubbleContainer.appendChild(bubble);
            
            // Remove bubble after animation completes
            setTimeout(() => {
              if (bubbleContainer.contains(bubble)) {
                bubbleContainer.removeChild(bubble);
              }
            }, duration * 1000);
          }

          // Your existing event handlers
          restartButton.onclick = () => {
            vscode.postMessage({ command: 'restart' });
          };

          recompileButton.onclick = () => {
            vscode.postMessage({ command: 'recompile' });
          };

          // URL buttons
          document.querySelectorAll('.url-button').forEach(btn => {
            btn.addEventListener('click', () => {
              const url = btn.getAttribute('data-url');
              vscode.postMessage({ command: 'openUrl', url });
            });
          });

          // Listen for messages from the extension
          window.addEventListener('message', event => {
            if (event.data.log) {
              // Check if the log content appears to be HTML
              if (event.data.log.includes('<span') || event.data.log.includes('<div')) {
                // Append as HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = event.data.log;
                output.appendChild(tempDiv);
              } else {
                // Legacy plaintext append
                const textNode = document.createTextNode(event.data.log);
                output.appendChild(textNode);
              }
              output.scrollTop = output.scrollHeight;
            }
          });
        </script>
      </body>
      </html>
    `;
  }

  private formatLogOutput(output: string): string {
    // Get configuration for log formatting
    const config = vscode.workspace.getConfiguration('cap-in-the-pocket');
    const enableLogFiltering = config.get('enableLogFiltering') as boolean || true;
    
    if (!enableLogFiltering) {
      return output; // Return unmodified if filtering is disabled
    }
    
    // Split output into lines for processing
    const lines = output.split('\n');
    const formattedLines = lines.map(line => {
      // Skip empty lines
      if (!line.trim()) {
        return line;
      }
      
      // Special handling for Maven's Spring Boot ASCII art
      if (line.includes('____') || line.includes('\\/') || line.includes('/\\\\') || 
          line.includes('( ( )') || line.includes("'  |") || line.includes(' ====')){
        return line; // Keep Spring Boot ASCII art untouched
      }
      
      // Spring Boot version line
      if (line.includes(':: Spring Boot ::')) {
        return `\n${line}\n`; // Add spacing around Spring Boot version line
      }
      
      // Format Spring Boot log lines
      if (line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d+[+-]\d{2}:\d{2}\s+\w+\s+\d+\s+---/)) {
        // Extract just the time portion from ISO timestamp (HH:MM:SS)
        const timeMatch = line.match(/T(\d{2}:\d{2}:\d{2})/);
        const timeString = timeMatch ? timeMatch[1] : '';
        
        // Get log level and convert to emoji
        let logLevel = '💡';
        if (line.includes(' INFO ')) logLevel = '💡';
        else if (line.includes(' WARN ')) logLevel = '⚠️';
        else if (line.includes(' ERROR ')) logLevel = '❌';
        else if (line.includes(' DEBUG ')) logLevel = '🔍';
        
        // Extract class/component name - shorter version
        const componentMatch = line.match(/([a-z]+\.)+([A-Z][a-zA-Z0-9_$]+)(\s+|\s*:)/);
        let component = '';
        if (componentMatch) {
          component = componentMatch[2];
          // Use HTML with a special class
          component = `<span class="component-name">${component}</span>`;
        }
        
        // Extract actual message
        const messageMatch = line.match(/\s+:\s+(.+)$/);
        const message = messageMatch ? messageMatch[1] : line;
        
        // Format: [time] emoji component: message
        return `<div class="log-line"><span class="timestamp">[${timeString}]</span> <span class="log-level">${logLevel}</span> ${component}: <span class="message">${message}</span></div>`;
      }
      
      // Format Maven build output - keep emoji but make more compact
      if (line.includes('[INFO]') || line.includes('[WARNING]') || line.includes('[ERROR]')) {
        let simplified = line;
        
        // Replace Maven log indicators with emoji
        simplified = simplified.replace(/\[INFO\]/, '📦')
                            .replace(/\[WARNING\]/, '⚠️')
                            .replace(/\[ERROR\]/, '❌');
        
        // Remove common redundant parts in Maven output
        simplified = simplified.replace(/ \(default-[a-z]+\)/g, '');
        simplified = simplified.replace(/--- [a-z]+:[0-9.]+:[a-z]+ /g, '--- ');
        
        return `<div class="maven-line">${simplified}</div>`;
      }
      
      // Return unmodified line if no patterns match
      return line;
    });
    
    return formattedLines.join('\n');
  }
}

export function deactivate() {}
