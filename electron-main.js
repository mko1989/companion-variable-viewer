const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const os = require('os'); // Require OS module

// --- Server Integration ---
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const configStore = require('./src/configStore');

const expressApp = express();
const httpServer = http.createServer(expressApp);
const io = new Server(httpServer);

let PORT = 3333; // Default port, will be updated

// Function to start the server
function startServer(callback) {
    const currentSettings = configStore.loadSettings();
    PORT = process.env.PORT || currentSettings.port || 3333;

    expressApp.use(express.static(path.join(__dirname, 'public')));
    expressApp.use(express.json());

    expressApp.get('/', (req, res) => {
        res.send('<h1>Companion Variable Viewer Server (Electron)</h1><p><a href="/designer">Designer</a> | <a href="/viewer">Viewer</a></p>');
    });
    expressApp.get('/designer', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'designer', 'index.html'));
    });
    expressApp.get('/viewer', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'viewer', 'index.html'));
    });

    io.on('connection', (socket) => {
        console.log('A user connected via Electron server:', socket.id);
        socket.emit('loadLayout', configStore.loadLayout());

        // Send network interfaces info on connection
        const networkInterfaces = os.networkInterfaces();
        const viewerURLs = [];
        for (const ifaceName in networkInterfaces) {
            const iface = networkInterfaces[ifaceName];
            for (let i = 0; i < iface.length; i++) {
                const alias = iface[i];
                if (alias.family === 'IPv4' && !alias.internal) {
                    viewerURLs.push(`http://${alias.address}:${PORT}/viewer`);
                }
            }
        }
        viewerURLs.push(`http://localhost:${PORT}/viewer`); // Always add localhost
        // Emit an object with a localIPs property, as expected by the client
        socket.emit('viewerURLs', { localIPs: viewerURLs });

        socket.on('disconnect', () => {
            console.log('User disconnected from Electron server:', socket.id);
        });
        socket.on('saveLayout', (layoutConfig) => {
            const saved = configStore.saveLayout(layoutConfig);
            if (saved) {
                io.emit('loadLayout', layoutConfig);
                console.log('Layout saved and broadcasted via Electron server');
            } else {
                socket.emit('saveLayoutError', { message: 'Failed to save layout on server.' });
            }
        });
        socket.on('companionVariables', (data) => {
            console.log('Electron server received variables from Companion:', data);
            io.emit('updateVariables', data);
        });
        socket.on('requestCurrentLayout', () => {
           socket.emit('loadLayout', configStore.loadLayout());
       });

        // Handle App Settings
        socket.on('requestCurrentAppSettings', () => {
            const settings = configStore.loadSettings();
            socket.emit('currentAppSettings', settings);
        });

        socket.on('saveAppPortSetting', (newPort) => {
            console.log('Received request to save new port:', newPort);
            const currentSettings = configStore.loadSettings();
            currentSettings.port = newPort;
            const saved = configStore.saveSettings(currentSettings);
            if (saved) {
                // Update the PORT variable in the current running instance for new connections/windows
                // but the main server is still on the old port until restart.
                PORT = newPort;
                socket.emit('portSettingSaved', `Port set to ${newPort}. Restart app to apply fully.`);
                // Optionally, you could try to close and restart the server here,
                // but it's complex. A dialog might be better.
                // dialog.showMessageBox(mainWindow, { 
                //    type: 'info', 
                //    message: 'Port Saved', 
                //    detail: `Port has been set to ${newPort}. Please restart the application for the change to take full effect.`
                // });
            } else {
                socket.emit('portSettingSaved', 'Error saving port setting.'); // Or a more specific error event
            }
        });
    });

    httpServer.listen(PORT, () => {
        console.log(`Electron app server listening on *:${PORT}`);
        if (callback) callback();
    }).on('error', (error) => {
        console.error("Failed to start server in Electron:", error);
        // TODO: Inform user via dialog
        app.quit();
    });
}
// --- End Server Integration ---

let mainWindow;

// Function to create the viewer window (extracted for reuse)
function createViewerWindow() {
    const viewerWin = new BrowserWindow({
        width: 800, height: 600, parent: mainWindow,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
        // No separate preload needed for viewer unless it also needs to call main process
    });
    viewerWin.loadURL(`http://localhost:${PORT}/viewer`);
    viewerWin.setMenu(null); 
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            // preload: path.join(__dirname, 'preload-designer.js') // No longer needed for just viewer link
        },
        // icon: path.join(__dirname, 'public', 'assets', 'icon.png') 
    });

    mainWindow.loadURL(`http://localhost:${PORT}/designer`);

    // mainWindow.webContents.openDevTools(); // Optional

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
                { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
                { type: 'separator' },
                {
                    label: 'Open Viewer Window',
                    click: () => {
                        createViewerWindow(); // Use the extracted function
                    }
                }
            ]
        }
    ];
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

// Handle IPC call from designer to open viewer
// ipcMain.on('open-viewer-window', () => { // No longer needed
//     if (httpServer && httpServer.listening) { 
//         createViewerWindow();
//     } else {
//         console.error('Cannot open viewer window, server not running.');
//     }
// });

app.on('ready', () => {
    startServer(() => {
        createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        if (httpServer && httpServer.listening) {
            createWindow();
        } else {
            // If server isn't running, try to start it then create window
            startServer(() => {
                createWindow();
            });
        }
    }
}); 