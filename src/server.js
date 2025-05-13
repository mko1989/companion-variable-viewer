const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

// Import handlers (we'll create these later)
// const setupSocketHandlers = require('./socketHandler');
const configStore = require('./configStore'); // Import configStore
// const designerRoutes = require('./routes/designer');
// const viewerRoutes = require('./routes/viewer');
// const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const currentSettings = configStore.loadSettings();
const PORT = process.env.PORT || currentSettings.port || 3333; // Use loaded port

// --- Middleware ---
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json()); // Middleware to parse JSON bodies for API routes

// --- Routes ---
// Simple root route
app.get('/', (req, res) => {
  // Maybe redirect to designer or send a simple welcome message
  res.send('<h1>Companion Variable Viewer Server</h1><p><a href="/designer">Designer</a> | <a href="/viewer">Viewer</a></p>');
});

// Route for the designer page
app.get('/designer', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'designer', 'index.html'));
});

// Route for the viewer page
app.get('/viewer', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'viewer', 'index.html'));
});

// TODO: Mount API routes (e.g., app.use('/api', apiRoutes);)

// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Send the current layout to the newly connected client
  socket.emit('loadLayout', configStore.loadLayout());

  // Pass the socket to the handler function
  // setupSocketHandlers(io, socket); // We'll implement this

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  // Placeholder for messages from Companion module
  socket.on('companionVariables', (data) => {
    console.log('Received variables from Companion:', data);
    // TODO: Broadcast to viewer clients
    io.emit('updateVariables', data); // Example broadcast
  });

   // Placeholder for messages from Designer client (saving config)
   socket.on('saveLayout', (layoutConfig) => {
    console.log('Received layout config to save:', layoutConfig);
    // Use configStore to save the layout
    const saved = configStore.saveLayout(layoutConfig);
    if (saved) {
        // Broadcast the updated layout to all other clients (viewers)
        // socket.broadcast.emit('loadLayout', layoutConfig);
        // Or emit to all including sender if designer should also confirm
        io.emit('loadLayout', layoutConfig);
        console.log('Layout saved and broadcasted');
    } else {
        // Handle save error - maybe notify the sender?
        socket.emit('saveLayoutError', { message: 'Failed to save layout on server.' });
    }
   });

   // Handle client requesting layout explicitly (optional, already sent on connect)
   socket.on('requestCurrentLayout', () => {
       console.log('Client requested layout explicitly:', socket.id);
       socket.emit('loadLayout', configStore.loadLayout());
   });

   // TODO: Add handler for designer requesting current layout on connect
   // socket.emit('loadLayout', configStore.loadLayout());

});

// --- Start Server ---
server.listen(PORT, () => {
  console.log(`Server listening on *:${PORT}`);
});

// --- Graceful Shutdown (Optional but good practice) ---
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    // Close database connections, etc.
    process.exit(0);
  });
});
