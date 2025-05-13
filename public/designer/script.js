document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); // Connect to Socket.IO server

    const canvas = document.getElementById('canvas');
    const backgroundInput = document.getElementById('background-input');
    const backgroundColorPicker = document.getElementById('background-color-picker'); // New picker
    const setBackgroundBtn = document.getElementById('set-background-btn');
    const saveLayoutBtn = document.getElementById('save-layout-btn');

    // Style controls
    const variableControlsDiv = document.getElementById('variable-controls');
    const selectedVariableNameSpan = document.getElementById('selected-variable-name');
    const fontSizeInput = document.getElementById('font-size-input');
    const colorInput = document.getElementById('color-input');

    let currentLayout = {
        background: '',
        variables: [] // This will be the single source of truth for variable configurations
    };
    let draggedElement = null;
    let offsetX, offsetY;
    let selectedElement = null;
    const toastElement = document.getElementById('toast-notification');
    let toastTimeout = null;

    // App Settings Elements
    const appPortInput = document.getElementById('app-port-input');
    const savePortBtn = document.getElementById('save-port-btn');
    const viewerLinksContainer = document.getElementById('viewer-links-container'); // New container
    // const openViewerBtn = document.getElementById('open-viewer-btn'); // Commented out

    // Function to create the DOM element for a variable
    function createVariableElement(variableConf) {
        const varContainer = document.createElement('div');
        varContainer.classList.add('variable-placeholder');
        varContainer.dataset.variableName = variableConf.name;
        varContainer.style.position = 'absolute';

        const titleElement = document.createElement('div');
        titleElement.classList.add('variable-title');
        titleElement.innerText = variableConf.displayTitle || variableConf.name;
        titleElement.contentEditable = "true";
        titleElement.spellcheck = false;
        titleElement.addEventListener('blur', (e) => {
            const newTitle = e.target.innerText.trim();
            const varName = varContainer.dataset.variableName;
            updateVariableInCurrentLayout(varName, { displayTitle: newTitle || varName });
            e.target.innerText = newTitle || varName;
        });
        titleElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
        });
        // Stop the mousedown on the title from starting a drag on the container
        titleElement.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        const textContentElement = document.createElement('div');
        textContentElement.classList.add('variable-text-content');
        textContentElement.innerText = variableConf.text || variableConf.name; // Value or name

        const canvasRect = canvas.getBoundingClientRect();

        // Apply styles from config to the textContentElement or container as appropriate
        if (variableConf.style) {
            // If positions are in %, convert to px for designer's absolute positioning
            if (typeof variableConf.style.top === 'string' && variableConf.style.top.endsWith('%') && canvasRect.height > 0) {
                varContainer.style.top = (parseFloat(variableConf.style.top) / 100) * canvasRect.height + 'px';
            } else {
                varContainer.style.top = variableConf.style.top || '10px'; // Fallback to px or default
            }
            if (typeof variableConf.style.left === 'string' && variableConf.style.left.endsWith('%') && canvasRect.width > 0) {
                varContainer.style.left = (parseFloat(variableConf.style.left) / 100) * canvasRect.width + 'px';
            } else {
                varContainer.style.left = variableConf.style.left || '10px'; // Fallback to px or default
            }

            textContentElement.style.fontSize = variableConf.style.fontSize || '1em';
            textContentElement.style.color = variableConf.style.color || '#000000';
            // titleElement can have its own styles if needed
        }

        const enableCheckbox = document.createElement('input');
        enableCheckbox.type = 'checkbox';
        enableCheckbox.classList.add('variable-enable-checkbox');
        enableCheckbox.checked = variableConf.enabled !== undefined ? variableConf.enabled : true; // Default true
        enableCheckbox.title = 'Enable/Disable this variable in the viewer';
        enableCheckbox.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            const varName = varContainer.dataset.variableName;
            updateVariableInCurrentLayout(varName, { enabled: isEnabled });
            // Maybe add visual feedback like opacity change to the container
            varContainer.style.opacity = isEnabled ? '1' : '0.5';
        });

        varContainer.appendChild(titleElement);
        varContainer.appendChild(textContentElement);
        varContainer.appendChild(enableCheckbox); // Append checkbox

        // Set initial opacity based on loaded state
        varContainer.style.opacity = enableCheckbox.checked ? '1' : '0.5';

        return varContainer;
    }

    // Function to update style controls based on selected element
    function updateStyleControls() {
        if (selectedElement) {
            const textContentElem = selectedElement.querySelector('.variable-text-content');
            variableControlsDiv.style.display = 'block';
            selectedVariableNameSpan.textContent = selectedElement.dataset.variableName || 'Unknown';
            if (textContentElem) {
                fontSizeInput.value = textContentElem.style.fontSize || '1em';
                let currentColor = textContentElem.style.color;
                if (currentColor.startsWith('rgb')) {
                    try {
                        const rgb = currentColor.match(/\d+/g).map(Number);
                        colorInput.value = `#${rgb[0].toString(16).padStart(2, '0')}${rgb[1].toString(16).padStart(2, '0')}${rgb[2].toString(16).padStart(2, '0')}`;
                    } catch (e) { colorInput.value = '#000000'; }
                } else {
                    colorInput.value = currentColor || '#000000';
                }
            }
        } else {
            variableControlsDiv.style.display = 'none';
            selectedVariableNameSpan.textContent = 'None';
        }
    }

    // Function to select an element
    function selectElement(element) {
        // Deselect previous
        if (selectedElement) {
            selectedElement.classList.remove('selected');
        }
        // Select new
        selectedElement = element;
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }
        updateStyleControls();
    }

    // Function to make elements draggable and selectable
    function makeDraggableAndSelectable(element) {
        element.style.position = 'absolute'; // Ensure position is absolute for dragging
        element.style.cursor = 'grab';

        element.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only react to left mouse button

            // Select the element on mousedown
            selectElement(element);

            draggedElement = element;
            // Calculate offset from the element's top-left corner to the mouse pointer
            // Use offsetLeft/Top relative to the parent (canvas)
            offsetX = e.clientX - draggedElement.getBoundingClientRect().left;
            offsetY = e.clientY - draggedElement.getBoundingClientRect().top;
            // Correct Offset calculation relative to the parent (canvas)
            offsetX = e.clientX - canvas.getBoundingClientRect().left - draggedElement.offsetLeft;
            offsetY = e.clientY - canvas.getBoundingClientRect().top - draggedElement.offsetTop;

            draggedElement.style.cursor = 'grabbing';
            draggedElement.style.zIndex = 1000; // Bring to front while dragging
            // Prevent default text selection behavior during drag
            e.preventDefault();
        });
    }

    // Add mousemove listener to the canvas to handle dragging
    canvas.addEventListener('mousemove', (e) => {
        if (!draggedElement) return;

        // Calculate new position relative to the canvas
        const canvasRect = canvas.getBoundingClientRect();
        let newX = e.clientX - canvasRect.left - offsetX;
        let newY = e.clientY - canvasRect.top - offsetY;

        // Constrain within canvas boundaries (optional, adjust as needed)
        const elementRect = draggedElement.getBoundingClientRect();
        newX = Math.max(0, Math.min(newX, canvasRect.width - elementRect.width));
        newY = Math.max(0, Math.min(newY, canvasRect.height - elementRect.height));

        draggedElement.style.left = `${newX}px`;
        draggedElement.style.top = `${newY}px`;

        if (draggedElement) {
            const variableName = draggedElement.dataset.variableName;
            updateVariableInCurrentLayout(variableName, {
                style: {
                    top: draggedElement.style.top,
                    left: draggedElement.style.left,
                }
            });
        }
    });

    // Add mouseup listener to the window to stop dragging
    window.addEventListener('mouseup', (e) => {
        if (draggedElement && e.button === 0) {
            draggedElement.style.cursor = 'grab';
            draggedElement.style.zIndex = ''; // Reset z-index
            draggedElement = null;
        }
    });

    // Deselect when clicking the canvas background
    canvas.addEventListener('mousedown', (e) => {
        if (e.target === canvas && e.button === 0) { // Check if click is directly on canvas
            selectElement(null); // Deselect
        }
    });

    // Initial setup: make existing placeholders draggable and selectable
    document.querySelectorAll('#canvas .variable-placeholder').forEach(makeDraggableAndSelectable);

    socket.on('connect', () => {
        console.log('Connected to server via WebSocket (Designer)', socket.id);
        // Request existing layout when connected
        // socket.emit('requestCurrentLayout'); // Already handled by server sending on connect
        socket.emit('requestCurrentAppSettings'); // Request current app settings
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server (Designer)');
    });

    socket.on('connect_error', (err) => {
        console.error('Designer connection error:', err);
    });

    // Listen for current app settings from server
    socket.on('currentAppSettings', (settings) => {
        console.log('Received current app settings:', settings);
        if (settings && settings.port) {
            appPortInput.value = settings.port;
        }
    });

    // Listen for port save confirmation
    socket.on('portSettingSaved', (message) => {
        showToast(message || 'Port saved. Restart app!');
    });

    // Listen for viewer URLs
    socket.on('viewerURLs', (urls) => {
        viewerLinksContainer.innerHTML = ''; // Clear previous links
        if (urls && urls.localIPs && urls.localIPs.length > 0) {
            urls.localIPs.forEach(url => {
                const p = document.createElement('p');
                p.textContent = url;
                const copyBtn = document.createElement('button');
                copyBtn.textContent = 'Copy';
                copyBtn.onclick = () => navigator.clipboard.writeText(url).then(() => showToast('URL Copied!'));
                p.appendChild(copyBtn);
                viewerLinksContainer.appendChild(p);
            });
        } else {
            viewerLinksContainer.innerHTML = '<p>Could not determine network IPs.</p>';
        }
    });

    // Listen for variable updates from the Companion module (via server)
    socket.on('updateVariables', (updatedVariables) => {
        console.log('Designer received variables update:', updatedVariables);
        if (typeof updatedVariables === 'object' && updatedVariables !== null) {
            for (const variableName in updatedVariables) {
                if (Object.hasOwnProperty.call(updatedVariables, variableName)) {
                    const varData = updatedVariables[variableName]; // {text: '...', color: '...'}
                    const placeholderElement = canvas.querySelector(`.variable-placeholder[data-variable-name="${variableName}"]`);

                    if (placeholderElement && varData) {
                        const textContentElem = placeholderElement.querySelector('.variable-text-content');
                        const titleElement = placeholderElement.querySelector('.variable-title');

                        // Update text content
                        if (textContentElem && typeof varData.text !== 'undefined') {
                            let newText = varData.text;
                            if (typeof newText === 'string') {
                                newText = newText.replace(/\\n/g, '\n');
                            }
                            textContentElem.innerText = newText;
                            // Also update in currentLayout if not just reflecting a transient update
                            // For now, this reflects the live Companion state. Layout saving handles persistence.
                        }

                        // Update color
                        if (varData.color) {
                            if (textContentElem) {
                                textContentElem.style.color = varData.color;
                            }
                            if (titleElement) {
                                titleElement.style.color = varData.color;
                            }

                            // If this is the currently selected element, update the color picker
                            if (selectedElement === placeholderElement) {
                                colorInput.value = varData.color; // Assumes varData.color is a hex string
                            }
                        }
                    }
                }
            }
        }
    });

    // Link background color picker to the text input
    backgroundColorPicker.addEventListener('input', (e) => {
        backgroundInput.value = e.target.value;
        // Optionally, trigger the set background logic immediately or wait for button press
        // For now, we'll wait for the button press to keep behavior consistent.
    });

    // Handle setting the background
    setBackgroundBtn.addEventListener('click', () => {
        const backgroundValue = backgroundInput.value.trim();
        if (backgroundValue) {
            // Check if it's a URL or a color
            if (backgroundValue.startsWith('http') || backgroundValue.startsWith('/') || backgroundValue.startsWith('.')) {
                canvas.style.backgroundImage = `url('${backgroundValue}')`;
                canvas.style.backgroundSize = 'cover'; // Or other appropriate size
                canvas.style.backgroundColor = ''; // Clear color if image is set
            } else {
                canvas.style.backgroundColor = backgroundValue;
                canvas.style.backgroundImage = ''; // Clear image if color is set
            }
            currentLayout.background = backgroundValue;
            console.log('Background set to:', backgroundValue);
        }
    });

    // Function to show the toast message
    function showToast(message = 'Layout Saved!') {
        if (toastTimeout) clearTimeout(toastTimeout);
        toastElement.textContent = message;
        toastElement.classList.remove('hidden');
        toastTimeout = setTimeout(() => {
            toastElement.classList.add('hidden');
        }, 2000); // Hide after 2 seconds
    }

    // Function to update a variable's configuration in currentLayout
    function updateVariableInCurrentLayout(variableName, newProps) {
        let variable = currentLayout.variables.find(v => v.name === variableName);
        if (variable) {
            Object.assign(variable, newProps);
            if (newProps.style) { 
                variable.style = { ...variable.style, ...newProps.style };
                // Note: style.top and style.left here will be in px from dragging
            }
        } else {
            // This case should ideally be handled when variable is first added
            console.warn(`Variable ${variableName} not found in currentLayout for update.`);
        }
    }

    // Handle saving the layout
    saveLayoutBtn.addEventListener('click', () => {
        currentLayout.variables.forEach(varConfig => {
            const elem = document.querySelector(`#canvas .variable-placeholder[data-variable-name="${varConfig.name}"]`);
            const canvasRect = canvas.getBoundingClientRect(); // Get canvas dimensions
            if (elem && canvasRect.width > 0 && canvasRect.height > 0) {
                const titleElem = elem.querySelector('.variable-title');
                const textContentElem = elem.querySelector('.variable-text-content');
                
                varConfig.displayTitle = titleElem ? titleElem.innerText : varConfig.name;
                varConfig.text = textContentElem ? textContentElem.innerText : (elem.innerText || varConfig.name); 
                
                // Save positions as percentages
                const styleTopPx = parseFloat(elem.style.top) || 0;
                const styleLeftPx = parseFloat(elem.style.left) || 0;

                varConfig.style.top = (styleTopPx / canvasRect.height) * 100 + '%';
                varConfig.style.left = (styleLeftPx / canvasRect.width) * 100 + '%';

                if (textContentElem) {
                    varConfig.style.fontSize = textContentElem.style.fontSize;
                    varConfig.style.color = textContentElem.style.color;
                }
            }
        });
        console.log('Saving layout (percentages):', JSON.parse(JSON.stringify(currentLayout)));
        socket.emit('saveLayout', currentLayout);
        showToast(); 
    });

    // Placeholder for loading an existing layout from the server
    socket.on('loadLayout', (layoutConfig) => {
        console.log('Received layout from server:', layoutConfig);
        if (layoutConfig) {
            currentLayout = JSON.parse(JSON.stringify(layoutConfig)); // Deep copy
            
            // Apply background
            if (currentLayout.background) {
                backgroundInput.value = currentLayout.background;
                if (currentLayout.background.startsWith('http') || currentLayout.background.startsWith('/') || currentLayout.background.startsWith('.')) {
                    canvas.style.backgroundImage = `url('${currentLayout.background}')`;
                    canvas.style.backgroundSize = 'cover';
                    canvas.style.backgroundColor = '';
                    backgroundColorPicker.value = '#ffffff'; // Reset picker if URL is used
                } else {
                    canvas.style.backgroundColor = currentLayout.background;
                    canvas.style.backgroundImage = '';
                    backgroundColorPicker.value = currentLayout.background; // Set picker to loaded color
                }
            } else {
                backgroundInput.value = '';
                backgroundColorPicker.value = '#ffffff'; // Default to white or a placeholder
            }

            // Clear existing DOM elements
            canvas.innerHTML = ''; 
            variableControlsDiv.style.display = 'none'; // Hide controls
            selectedElement = null;

            // Re-create and position variable elements based on NEW currentLayout
            if (currentLayout.variables && Array.isArray(currentLayout.variables)) {
                const canvasRect = canvas.getBoundingClientRect(); // For converting % back to px for designer
                currentLayout.variables.forEach(variableConf => {
                    const varElement = createVariableElement(variableConf); // This needs to handle % or px
                    canvas.appendChild(varElement);
                    makeDraggableAndSelectable(varElement);
                });
            }

            // If no variables were loaded from config (e.g. new setup or cleared layout.json)
            // and currentLayout.variables is also empty after assignment
            if (!currentLayout.variables || currentLayout.variables.length === 0) {
                // currentLayout.variables should be empty here if layoutConfig.variables was empty/null
                createDefaultVariablePlaceholders(); // This function will also populate currentLayout.variables
            }
        }
        selectElement(null); // Deselect any selected element
    });

    // Function to create default placeholders if layout is empty
    function createDefaultVariablePlaceholders() {
        console.log('Creating default variable placeholders...');
        currentLayout.variables = [];
        let topOffset = 10;
        let leftOffset = 10;
        for (let i = 1; i <= 10; i++) {
            const varName = `text_${i}`;
            const varConfig = {
                name: varName,
                text: varName,
                displayTitle: varName,
                style: {
                    top: `${topOffset}px`,
                    left: `${leftOffset}px`,
                    fontSize: '1em',
                    color: '#000000',
                },
                enabled: true
            };
            currentLayout.variables.push(varConfig);
            const varElement = createVariableElement(varConfig);
            canvas.appendChild(varElement);
            makeDraggableAndSelectable(varElement);
            topOffset += 60; // Adjust offset for taller elements
            if (topOffset > canvas.clientHeight - 50 && canvas.clientHeight > 0) {
                topOffset = 10;
                leftOffset += 180; // Wider spacing for new column
            }
        }
    }

    // --- Event Listeners for Style Controls ---
    fontSizeInput.addEventListener('input', (e) => {
        if (selectedElement) {
            const textContentElem = selectedElement.querySelector('.variable-text-content');
            if (textContentElem) textContentElem.style.fontSize = e.target.value;
            const variableName = selectedElement.dataset.variableName;
            updateVariableInCurrentLayout(variableName, { style: { fontSize: e.target.value } });
        }
    });

    colorInput.addEventListener('input', (e) => {
        if (selectedElement) {
            const textContentElem = selectedElement.querySelector('.variable-text-content');
            if (textContentElem) textContentElem.style.color = e.target.value;
            const variableName = selectedElement.dataset.variableName;
            updateVariableInCurrentLayout(variableName, { style: { color: e.target.value } });
        }
    });

    savePortBtn.addEventListener('click', () => {
        const newPort = parseInt(appPortInput.value, 10);
        if (newPort && newPort > 0 && newPort < 65536) {
            console.log('Requesting to save new port:', newPort);
            socket.emit('saveAppPortSetting', newPort);
        } else {
            showToast('Invalid port number!');
        }
    });

    // openViewerBtn.addEventListener('click', () => { // Commented out
    //     if (window.electronAPI && typeof window.electronAPI.openViewerWindow === 'function') { // Commented out
    //         window.electronAPI.openViewerWindow(); // Commented out
    //     } else { // Commented out
    //         console.error('Electron API for opening viewer window not found. Ensure preload script is working.'); // Commented out
    //         // Fallback for non-Electron environment or if preload fails // Commented out
    //         window.open('/viewer', '_blank'); // Commented out
    //     } // Commented out
    // }); // Commented out

    // TODO: Implement drag-and-drop for variables within #canvas.
    // TODO: Implement controls for adding/removing variables.
    // TODO: Implement controls for changing font, size, color of variables.
    // TODO: Display list of available Companion variables received from server.
    // socket.on('availableVariablesList', (vars) => { ... });
});

