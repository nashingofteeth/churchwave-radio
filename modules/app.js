// Main app module that imports and initializes all modules

import { skipTrack } from './core.js';
import { initializeUIEventListeners } from './events.js';
import { getState, initializeDOMElements, updateState } from './state.js';
import { clearSimulatedTime, simulateTime, getCurrentTime } from './time.js';

// Initialize the application
export async function initApp() {
  try {
    // Initialize DOM elements
    initializeDOMElements();

    // Initialize UI event listeners
    initializeUIEventListeners();

    console.log('Churchwave Radio initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Churchwave Radio:', error);
    return false;
  }
}

// Export functions for global access (for debugging and console use)
window.skipTrack = skipTrack;
window.simulateTime = simulateTime;
window.clearSimulatedTime = clearSimulatedTime;
window.getCurrentTime = getCurrentTime;

window.setPreScheduledWarnings = (junkOnly = false, nonBumperJunkOnly = false) => {
  updateState({
    preScheduledJunkOnly: junkOnly,
    preScheduledNonBumperJunkOnly: nonBumperJunkOnly
  });
  console.log(`Set pre-scheduled warnings: junkOnly=${junkOnly}, nonBumperJunkOnly=${nonBumperJunkOnly}`);
};

window.appState = getState();
