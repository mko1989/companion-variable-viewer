# Companion Variable Viewer

Companion Variable Viewer is a desktop application that allows you to display selected Bitfocus Companion variables on a customizable webpage. It consists of this web application and a corresponding Companion module (`companion-module-variable-viewer`).

## Features

*   **Designer UI:** Interactively design the layout for your variables.
    *   Drag and drop variable placeholders.
    *   Customize background color or image.
    *   Adjust font size and color for each variable.
    *   Edit display titles for variables.
    *   Enable/disable individual variables.
    *   Save and load layouts.
*   **Viewer Page:** Displays the variables according to the designed layout, updating in real-time.
*   **Configurable Port:** Change the HTTP and WebSocket listening port.
*   **Electron Packaged:** Cross-platform application for macOS and Windows (and potentially Linux).
*   **Network Access:** Viewer URLs (localhost and network IPs) are displayed in the designer for easy access from other devices.

## How It Works

The application runs a local web server (Express.js) and a WebSocket server (Socket.IO).
*   The **Designer** page (`/designer`) allows you to create and save a visual layout.
*   The **Viewer** page (`/viewer`) displays the variables based on this saved layout.
*   The `companion-module-variable-viewer` (running in Bitfocus Companion) connects to this application's WebSocket server to send variable data.

## Getting Started

### Running release version

*   Just download latest version from the releases for your system and run.

### Prerequisites

*   Node.js and npm (for running from source or building).
*   Bitfocus Companion.

### Running from Source

1.  Clone this repository.
2.  Navigate to the `Companion_Variable_Viewer` directory.
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Start the application:
    ```bash
    npm start
    ```
    This will launch the Electron application, and the designer interface should open. The default port is 3333.

### Building from Source

To create distributable packages (e.g., .dmg for macOS, .exe for Windows):

1.  Ensure all dependencies are installed (`npm install`).
2.  Run the build command:
    ```bash
    npm run dist
    ```
    The packaged application will be in the `dist` directory.

### Configuration

*   **Port:** The application's listening port can be configured via the Designer UI (in the sidebar). The default is 3333. A restart is required after changing the port.
*   **Layout:** Layouts created in the designer are saved to `src/layout.json`.
*   **Settings:** Application settings (like the port) are saved to `src/settings.json`.

## Companion Module

This application requires the `companion-module-variable-viewer` to be installed and configured in Bitfocus Companion. The module is responsible for sending variable data from Companion to this application. See the module's README for setup instructions.
