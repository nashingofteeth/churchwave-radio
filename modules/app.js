// Main app module that imports and initializes all modules

import { skipTrack } from "./core.js";
import { initializeUIEventListeners } from "./events.js";
import { getState, initializeDOMElements } from "./state.js";
import { clearSimulatedTime, simulateTime, getCurrentTime } from "./time.js";

// Initialize the application
export async function initDOM() {
  try {
    // Initialize DOM elements
    initializeDOMElements();

    // Initialize UI event listeners
    initializeUIEventListeners();

    console.log("DOM listeners initialized");
    return true;
  } catch (error) {
    console.error("Failed to initialize DOM:", error);
    return false;
  }
}

// Export functions for global access (for debugging and console use)
window.skipTrack = skipTrack;
window.simulateTime = simulateTime;
window.clearSimulatedTime = clearSimulatedTime;
window.getCurrentTime = getCurrentTime;

// Export full app state
window.appState = getState();
