const fs = require('fs');
const path = require('path');

const LAYOUT_CONFIG_FILE_PATH = path.join(__dirname, 'layout.json');
const SETTINGS_CONFIG_FILE_PATH = path.join(__dirname, 'settings.json'); // New settings file

const defaultLayout = {
    background: '#333333', // Default background color
    variables: []
};

const defaultSettings = {
    port: 3333 // Default port
};

/**
 * Saves the layout configuration to a JSON file.
 * @param {object} layoutConfig The layout configuration object.
 * @returns {boolean} True if successful, false otherwise.
 */
function saveLayout(layoutConfig) {
    try {
        const data = JSON.stringify(layoutConfig, null, 2); // Pretty print JSON
        fs.writeFileSync(LAYOUT_CONFIG_FILE_PATH, data, 'utf8');
        console.log('Layout saved successfully to', LAYOUT_CONFIG_FILE_PATH);
        return true;
    } catch (error) {
        console.error('Error saving layout:', error);
        return false;
    }
}

/**
 * Loads the layout configuration from a JSON file.
 * @returns {object} The layout configuration object or a default layout if not found/error.
 */
function loadLayout() {
    try {
        if (fs.existsSync(LAYOUT_CONFIG_FILE_PATH)) {
            const data = fs.readFileSync(LAYOUT_CONFIG_FILE_PATH, 'utf8');
            const layoutConfig = JSON.parse(data);
            console.log('Layout loaded successfully from', LAYOUT_CONFIG_FILE_PATH);
            return layoutConfig;
        } else {
            console.log('No layout file found, returning default layout.');
            return { ...defaultLayout }; // Return a copy of the default layout
        }
    } catch (error) {
        console.error('Error loading layout:', error);
        return { ...defaultLayout }; // Return a copy of the default layout on error
    }
}

// --- Settings Functions --- 

/**
 * Loads the application settings from a JSON file.
 * @returns {object} The settings object or default settings if not found/error.
 */
function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_CONFIG_FILE_PATH)) {
            const data = fs.readFileSync(SETTINGS_CONFIG_FILE_PATH, 'utf8');
            const settings = JSON.parse(data);
            console.log('Settings loaded successfully from', SETTINGS_CONFIG_FILE_PATH);
            // Merge with defaults to ensure all keys exist
            return { ...defaultSettings, ...settings };
        } else {
            console.log('No settings file found, returning default settings.');
            return { ...defaultSettings };
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        return { ...defaultSettings };
    }
}

/**
 * Saves the application settings to a JSON file.
 * @param {object} settings The settings object.
 * @returns {boolean} True if successful, false otherwise.
 */
function saveSettings(settings) {
    try {
        const data = JSON.stringify(settings, null, 2); // Pretty print JSON
        fs.writeFileSync(SETTINGS_CONFIG_FILE_PATH, data, 'utf8');
        console.log('Settings saved successfully to', SETTINGS_CONFIG_FILE_PATH);
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

module.exports = {
    saveLayout,
    loadLayout,
    loadSettings,
    saveSettings
};
