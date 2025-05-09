CAP-in-the-Pocket Demo Plugin
=============================

This is the corresponding plugin for my demo.
It allows you to run

```
killall mvn
mvn spring-boot:run
``´

with the click of a simple button, show you the output
and allow you to create short-cut links.

**
This is highly experimental and used for one single demo.
**


## Installation

### Option 1: Latest Release (Recommended)

1. Go to the [Releases page](https://github.com/parttimenerd/cap-in-the-pocket-extension/releases)
2. Download the latest `.vsix` file 
3. In VS Code:
   - Open Extensions view (Ctrl+Shift+X or Cmd+Shift+X on macOS)
   - Click the "..." at the top of the Extensions view
   - Select "Install from VSIX..."
   - Browse to the downloaded file

### Option 2: Build from Source

If you prefer to build the extension yourself:

```bash
git clone https://github.com/parttimenerd/cap-in-the-pocket-extension.git
cd cap-in-the-pocket-extension
npm install
npm run compile
npx @vscode/vsce package
```

Usage
-----
1. After installation, you'll see a new "CAP App" icon in the activity bar
2. Click it to open the "Run CAP App" panel
3. Click the "(Re)Launch CAP App" button to start your application
4. Access your application's endpoints using the buttons below the console output

Configuring Application Links
-----------------------------

You can customize the application links that appear below the console output. These links provide quick access to different parts of your CAP application.

If you don't configure them,
default links for the CAP-in-the-Pocket [SFlight](https://github.com/SAP-samples/cap-sflight)
demo are used (as seen below).

### Method 1: Using VS Code Settings UI

1. Open VS Code settings (File > Preferences > Settings)
2. Search for "CAP-in-the-Pocket"
3. Find the "springBootRunner.urlButtons" setting
4. Click "Edit in settings.json"
5. Modify the JSON array to add, edit, or remove entries

### Method 2: Directly Editing settings.json

1. Open your VS Code settings.json file (Ctrl+Shift+P > "Preferences: Open Settings (JSON)")
2. Add or modify the following configuration:
An example is given for [CAP SFlight](https://github.com/SAP-samples/cap-sflight)

```json
"springBootRunner.urlButtons": [
  {
    "label": "Travel Processor",
    "url": "http://localhost:4004/travel_processor/dist/index.html"
  },
  {
    "label": "Travel Analytics",
    "url": "http://localhost:4004/travel_analytics/dist/index.html"
  }
]
```

**Notes**

- The port number (4004) is the default for CAP applications but may differ depending on your configuration
- URLs are opened in your default web browser
- Any changes to the configuration take effect immediately

Development
-----------
This has been generated with the help of Claude Sonnet and GitHub Copilot.

Contributing
------------
Contributions are welcome! Please feel free to submit a Pull Request. This is an experimental plugin, but if it helps someone.

Icon
----
The icon is the [CAP](https://cap.cloud.sap/) icon. It belongs to CAP. 
The demo is created in collaboration with the CAP Java team.

License
-------
MIT