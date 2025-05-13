document.addEventListener('DOMContentLoaded', () => {
    const displayArea = document.getElementById('variable-display-area');
    let currentLayout = {}; // To store the loaded layout
    let variableElements = {}; // To store references to the created variable CONTAINER DOM elements

    // Connect to the Socket.IO server
    // The server URL will be the same host and port the page is served from
    const socket = io(); // Defaults to window.location

    socket.on('connect', () => {
        console.log('Viewer: Connected to server via WebSocket', socket.id);
        displayArea.innerHTML = '<p>Connected. Waiting for variable data...</p>';
    });

    socket.on('disconnect', () => {
        console.log('Viewer: Disconnected from server');
        displayArea.innerHTML = '<p>Disconnected from server.</p>';
    });

    // Listen for variable updates from the server
    socket.on('updateVariables', (data) => {
        console.log('Viewer: Received variables update payload:', JSON.parse(JSON.stringify(data)));

        if (typeof data === 'object' && data !== null) {
            for (const variableName in data) {
                if (Object.hasOwnProperty.call(data, variableName)) {
                    const varContainer = variableElements[variableName];
                    const varData = data[variableName];

                    console.log(`Viewer: Processing ${variableName}:`, JSON.parse(JSON.stringify(varData)));

                    if (varContainer && varData) {
                        const textElement = varContainer.querySelector('.variable-text-content');
                        const titleElement = varContainer.querySelector('.variable-title');

                        if (textElement) {
                            let valueToDisplay = varData.text;

                            console.log(`Viewer: For ${variableName} - varData.text is:`, JSON.parse(JSON.stringify(valueToDisplay)));
                            console.log(`Viewer: For ${variableName} - typeof varData.text is:`, typeof valueToDisplay);

                            if (typeof valueToDisplay === 'string') {
                                valueToDisplay = valueToDisplay.replace(/\\n/g, '\n');
                            } else if (valueToDisplay === undefined && typeof varData === 'string') {
                                // This case is unlikely given module structure but defensive
                                console.warn(`Viewer: varData.text for ${variableName} was undefined, but varData itself was a string. Using varData directly:`, varData);
                                valueToDisplay = varData;
                            } else if (typeof valueToDisplay !== 'string') {
                                console.error(`Viewer: CRITICAL - varData.text for ${variableName} is NOT a string. It is:`, valueToDisplay, `(type: ${typeof valueToDisplay})`);
                                // To prevent literal [object Object], display a placeholder or stringified version
                                valueToDisplay = `[Error: Not a string - ${typeof valueToDisplay}]`;
                            }

                            textElement.innerText = valueToDisplay;

                            if (varData.color) {
                                textElement.style.color = varData.color;
                                if (titleElement) {
                                    titleElement.style.color = varData.color;
                                }
                            }
                        }
                    } else {
                        if (!varContainer) console.warn(`Viewer: No varContainer for ${variableName}`);
                        if (!varData) console.warn(`Viewer: No varData for ${variableName}`);
                    }
                }
            }
        } else {
            console.warn('Viewer: Received non-object variable data:', data);
        }
    });

    // Handle loading layout configuration from server
    socket.on('loadLayout', (layoutConfig) => {
        console.log('Received layout config:', layoutConfig);
        currentLayout = layoutConfig;
        variableElements = {}; // Clear old element references
        displayArea.innerHTML = ''; // Clear previous content

        // Apply background
        if (layoutConfig.background) {
            if (layoutConfig.background.startsWith('http') || layoutConfig.background.startsWith('/') || layoutConfig.background.startsWith('.')) {
                displayArea.style.backgroundImage = `url('${layoutConfig.background}')`;
                displayArea.style.backgroundSize = 'cover';
                displayArea.style.backgroundColor = '';
            } else {
                displayArea.style.backgroundColor = layoutConfig.background;
                displayArea.style.backgroundImage = '';
            }
        }

        // Create elements for each variable defined in the layout
        if (layoutConfig.variables && Array.isArray(layoutConfig.variables)) {
            layoutConfig.variables.forEach(variableConf => {
                // Only create element if variable is enabled
                if (variableConf.enabled !== false) { // Check if not explicitly false (true or undefined)
                    const varContainer = document.createElement('div');
                    varContainer.classList.add('variable-display');
                    varContainer.style.position = 'absolute';
                    varContainer.dataset.variableName = variableConf.name; // Keep name for potential future use

                    const titleElement = document.createElement('div');
                    titleElement.classList.add('variable-title');
                    // Use displayTitle if available, otherwise the variable name
                    titleElement.innerText = variableConf.displayTitle || variableConf.name;

                    const textContentElement = document.createElement('div');
                    textContentElement.classList.add('variable-text-content');
                    // Set initial text value (will be updated by 'updateVariables' event)
                    textContentElement.innerText = variableConf.text || ''; 

                    // Apply styles from config
                    if (variableConf.style) {
                        // Positions are now expected to be in %
                        varContainer.style.top = variableConf.style.top || '0%';
                        varContainer.style.left = variableConf.style.left || '0%';
                        
                        // Apply font/color to the text content element
                        const fontSize = variableConf.style.fontSize || '1em';
                        const layoutColor = variableConf.style.color || '#ffffff'; // Default from layout
                        textContentElement.style.fontSize = fontSize;
                        textContentElement.style.color = layoutColor;
                        // Apply font/color to the title element as well
                        titleElement.style.fontSize = fontSize;
                        titleElement.style.color = layoutColor;
                        // Apply other styles (e.g., fontFamily) if added later
                    }
                    
                    varContainer.appendChild(titleElement);
                    varContainer.appendChild(textContentElement);

                    displayArea.appendChild(varContainer);
                    // Store reference to the varContainer for updates
                    variableElements[variableConf.name] = varContainer; 
                }
            });
        }
    });

    socket.on('connect_error', (err) => {
        console.error('Connection error:', err);
        displayArea.innerHTML = '<p>Connection failed.</p>';
    });

    // Request layout from the server when the socket connects or page loads
    socket.emit('requestLoadLayout');
});
