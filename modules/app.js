// Main app module that imports and initializes all modules

import { load, skipTrack } from './core.js';
import { forceCleanupAllEventListeners, initializeUIEventListeners } from './events.js';
import { getState, initializeDOMElements, updateState } from './state.js';
import { clearSimulatedTime, simulateTime, startSimulatedTimeProgression, stopSimulatedTimeProgression } from './time.js';

// Initialize the application
export async function initApp() {
  try {
    // Initialize DOM elements
    initializeDOMElements();

    // Initialize UI event listeners
    initializeUIEventListeners();

    // Load configuration and track data
    const loadSuccess = await load();

    if (!loadSuccess) {
      console.warn('Data loading may have failed - proceeding with limited functionality');
    }

    // Verify state contains required data
    const state = getState();
    if (!state.config || !state.preprocessed) {
      console.error('Required configuration or track data missing');
      return false;
    }

    console.log('Churchwave Radio initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Churchwave Radio:', error);
    return false;
  }
}

// Export functions for global access (for debugging and console use)
window.skipTrack = skipTrack;
window.forceCleanupAllEventListeners = forceCleanupAllEventListeners;
window.simulateTime = simulateTime;
window.startSimulatedTimeProgression = startSimulatedTimeProgression;
window.stopSimulatedTimeProgression = stopSimulatedTimeProgression;
window.clearSimulatedTime = clearSimulatedTime;

window.setPreScheduledWarnings = (junkOnly = false, nonBumperJunkOnly = false) => {
  updateState({
    preScheduledJunkOnly: junkOnly,
    preScheduledNonBumperJunkOnly: nonBumperJunkOnly
  });
  console.log(`Set pre-scheduled warnings: junkOnly=${junkOnly}, nonBumperJunkOnly=${nonBumperJunkOnly}`);
};

window.appState = getState();

// Public API
export default { initApp };
