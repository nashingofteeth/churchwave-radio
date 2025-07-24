/**
 * Application entry point module
 * Handles DOM initialization and exposes debug functions to global scope
 */

import { skipCurrentTrack } from "./core.js";
import { initializeUIEventListeners } from "./events.js";
import { getApplicationState, initializeDOMElements } from "./state.js";
import { clearTimeSimulation, simulateTime, getCurrentTime } from "./time.js";

/**
 * Initialize DOM elements and UI event listeners
 * @returns {Promise<boolean>} Success status
 */
export async function initializeDOM() {
  try {
    initializeDOMElements();
    initializeUIEventListeners();
    
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
