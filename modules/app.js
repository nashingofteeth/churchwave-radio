/**
 * Application entry point module
 * Handles DOM initialization and exposes debug functions to global scope
 */

import { skipCurrentTrack } from "./core.js";
import { initializeUIEventListeners } from "./events.js";
import { getApplicationState, initializeDOMElements, updateApplicationState } from "./state.js";
import { clearTimeSimulation, simulateTime, getCurrentTime } from "./time.js";

/**
 * Load configuration data during DOM initialization
 * @returns {Promise<Object|null>} Configuration data or null if failed
 */
export async function loadConfiguration() {
  try {
    const configResponse = await fetch("config.json");
    if (!configResponse.ok) {
      throw new Error(
        `Config loading failed: ${configResponse.status} ${configResponse.statusText}`,
      );
    }
    const configurationData = await configResponse.json();
    updateApplicationState({ config: configurationData });
    
    console.log("Configuration loaded successfully");
    return configurationData;
  } catch (error) {
    console.error("Configuration loading failed:", error);
    return null;
  }
}

/**
 * Preload satellite image using remote path from config
 * @param {Object} config - Configuration object with basePaths
 */
export function preloadSatelliteImage(config) {
  if (!config?.basePaths?.remote) {
    console.warn("No remote base path found in config for satellite image");
    return;
  }

  const satelliteImage = document.getElementById('satelliteImage');
  if (satelliteImage) {
    const imageUrl = `${config.basePaths.remote}/satellite.gif`;
    
    // Preload the image
    const preloadImg = new Image();
    preloadImg.onload = () => {
      console.log("Satellite image preloaded successfully");
      satelliteImage.src = imageUrl;
    };
    preloadImg.onerror = () => {
      console.warn("Failed to preload satellite image:", imageUrl);
    };
    preloadImg.src = imageUrl;
  }
}

/**
 * Initialize application
 * @returns {Promise<boolean>} Success status
 */
export async function initialize() {
  try {
    initializeDOMElements();
    initializeUIEventListeners();
    
    const config = await loadConfiguration();
    if (config) {
      preloadSatelliteImage(config);
    }
    
    console.log("DOM initialization completed");
    return true;
  } catch (error) {
    console.error("DOM initialization failed:", error);
    return false;
  }
}

/**
 * Expose debugging functions and state to global window object
 * Available in browser console for testing and debugging
 */
function exposeDebugFunctions() {
  window.skipTrack = skipCurrentTrack;
  window.simulateTime = simulateTime;
  window.clearSimulatedTime = clearTimeSimulation;
  window.getCurrentTime = getCurrentTime;
  window.appState = getApplicationState();
}

// Initialize debug functions
exposeDebugFunctions();
