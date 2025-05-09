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
        if (e.affectsConfiguration('springBootRunner.urlButtons') && this._view) {
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
        case "runSpringBoot":
          this.runSpringBoot(webviewView.webview);
          break;
        case "openUrl":
          this.openUrl(message.url);
          break;
      }
    });
  }

  private runSpringBoot(webview: vscode.Webview) {
    // Get workspace folder - use the first one if multiple are open
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      webview.postMessage({ log: "\n❌ Error: No workspace folder is open. Please open a CAP project folder first.\n" });
      return;
    }
    
    // Use the first workspace folder as the project root
    const projectRoot = workspaceFolders[0].uri.fsPath;
    
    // Update webview UI to show "running" state with the correct folder
    webview.postMessage({
      log: `\n▶️ Running in ${projectRoot}:\n    Stopping processes on port 4004 and starting CAP app...\n\n`
    });

    // Execute the shell command in the project root directory
    const options = { 
      cwd: projectRoot,
      shell: true 
    };
    
    // First, kill any processes using port 4004
    const killPortProcess = require('child_process').spawn(
      'lsof -ti:4004 | xargs kill -9 || true', 
      [], 
      options
    );
    
    killPortProcess.on('close', (code: number) => {
      webview.postMessage({ 
        log: code === 0 
          ? "✅ Stopped existing processes using port 4004\n\n" 
          : "ℹ️ No processes were using port 4004\n\n" 
      });
      
      // Now start the Maven Spring Boot process
      const childProcess = require('child_process').spawn('mvn spring-boot:run', [], options);
      
      // Stream stdout in real-time
      childProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        webview.postMessage({ log: output });
      });
      
      // Stream stderr in real-time 
      childProcess.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        webview.postMessage({ log: output });
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
      webview.postMessage({ log: `\n⚠️ Warning: Could not check for processes on port 4004: ${err.message}\n` });
      // Still try to run the main command even if the port check fails
      const childProcess = require('child_process').spawn('mvn spring-boot:run', [], options);
      // ... rest of the event listeners for childProcess
    });
  }

  private openUrl(url: string) {
    vscode.env.openExternal(vscode.Uri.parse(url));
  }

  private getWebviewContent(): string {
    // Get the configured URL buttons
    const config = vscode.workspace.getConfiguration('springBootRunner');
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

    return `
      <html>
      <head>
        <style>
          body {
            font-family: sans-serif;
            padding: 10px;
          }
          #runButton {
            background-color: #007acc;
            color: white;
            font-size: 16px;
            padding: 16px;
            width: 100%;
            border: none;
            border-radius: 4px;
            cursor: pointer;
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
            margin-top: 20px;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 10px;
            height: 300px;
            overflow-y: auto;
            border-radius: 4px;
            font-family: monospace;
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
        </style>
      </head>
      <body>
        <button id="runButton">
          (Re)Launch CAP App
        </button>
        <div class="extension-tagline">
          Experimental CAP in the Pocket Extension
        </div>
        <pre id="output"></pre>
        
        ${urlButtonsHtml}

        <script>
          const vscode = acquireVsCodeApi();
          const button = document.getElementById('runButton');
          const output = document.getElementById('output');

          // Run Spring Boot button
          button.onclick = () => {
            output.textContent = "";
            vscode.postMessage({ command: 'runSpringBoot' });
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
              output.textContent += event.data.log;
              output.scrollTop = output.scrollHeight;
            }
          });
        </script>
      </body>
      </html>
    `;
  }
}

export function deactivate() {}