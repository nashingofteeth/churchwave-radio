// Main app module that imports and initializes all modules

import { initialize, load, reset, skipTrack, startPlayback } from './core.js';
import { forceCleanupAllEventListeners, initializeUIEventListeners } from './events.js';
import { cleanupExpiredUsage, clearAllScheduledTimeouts, getActiveScheduledTrack, initializeScheduledSystem } from './scheduling.js';
import { getState, initializeDOMElements, updateState } from './state.js';
import { getLocaleString, setSimulatedTime, startSimulatedTimeProgression, stopSimulatedTimeProgression } from './time.js';

// Initialize the application
export async function initApp() {
  try {
    // Initialize DOM elements
    initializeDOMElements();

    // Initialize UI event listeners
    initializeUIEventListeners();

    // Load configuration and track data
    await load();

    console.log('Churchwave Radio initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Churchwave Radio:', error);
  }
}

// Simulation function that properly handles reset and initialization
function simulateTime(hour, minute = 0, second = 0, date = null) {
  // Reset application to clear existing state
  reset();

  // Set the simulated date
  setSimulatedTime(hour, minute, second, date);

  // Start continuous time progression
  startSimulatedTimeProgression();

  // Reinitialize the application with simulated time
  initialize();
}

// Export functions for global access (for debugging and console use)
window.forceCleanupAllEventListeners = forceCleanupAllEventListeners;
window.simulateTime = simulateTime;
window.startSimulatedTimeProgression = startSimulatedTimeProgression;
window.stopSimulatedTimeProgression = stopSimulatedTimeProgression;

// Additional debug functions
window.skipTrack = skipTrack;

window.getActiveScheduled = () => {
  const state = getState();
  const active = getActiveScheduledTrack();
  if (active) {
    console.log('Active scheduled track:', {
      time: active.time,
      recurrence: active.recurrence || active.date,
      filename: state.tracksData[active.trackKey]?.filename
    });
  }
  return active;
};

window.clearUsedScheduled = () => {
  const state = getState();
  Object.keys(state.usedScheduledFiles).forEach(key => delete state.usedScheduledFiles[key]);
  console.log('Cleared all used scheduled files');
};

window.reinitializeScheduled = () => {
  const state = getState();
  clearAllScheduledTimeouts();
  if (state.hourlyScheduleTimeout) {
    clearTimeout(state.hourlyScheduleTimeout);
    state.hourlyScheduleTimeout = null;
  }
  initializeScheduledSystem();
  console.log('Reinitialized scheduled system');
};

window.getScheduledTimeouts = () => {
  const state = getState();
  console.log(`Active scheduled timeouts: ${state.scheduledTimeouts.length}`);
  return state.scheduledTimeouts.length;
};

window.listScheduledTracks = () => {
  const state = getState();
  console.log('All scheduled tracks:');
  state.scheduledTracks.forEach((track, index) => {
    const recurrenceType = track.date ? 'DATE' :
      track.recurrence === 'daily' ? 'DAILY' :
        track.recurrence ? 'DAY' : 'OTHER';
    console.log(`${index}: ${track.time} (${track.recurrence || track.date}) [${recurrenceType}] - ${state.tracksData[track.trackKey]?.filename}`);
  });
};

window.cleanupUsage = () => {
  cleanupExpiredUsage();
  console.log('Cleaned up expired usage tracking');
};

window.stopTimeProgression = () => {
  stopSimulatedTimeProgression();
  console.log('Stopped simulated time progression');
};

window.resumeTimeProgression = () => {
  const state = getState();
  if (state.simulatedDate) {
    startSimulatedTimeProgression();
    console.log('Resumed simulated time progression');
  } else {
    console.log('No simulated time set - use simulateTime() first');
  }
};

window.getCurrentSimulatedTime = () => {
  const state = getState();
  if (state.simulatedDate) {
    console.log(`Current simulated time: ${getLocaleString(state.simulatedDate)}`);
    return state.simulatedDate;
  } else {
    console.log('No simulated time active - using real time');
    return new Date();
  }
};

window.clearSimulatedTime = () => {
  const state = getState();
  stopSimulatedTimeProgression();
  state.simulatedDate = null;
  console.log('Cleared simulated time - now using real time');

  // Reset and reinitialize with real time
  // This ensures a clean transition back to real-time scheduling
  reset();
  initialize();
};

window.getAlgorithmicState = () => {
  const state = getState();
  console.log('Algorithmic state:', {
    currentMorningGenre: state.currentMorningGenre,
    lastGenreChangeHour: state.lastGenreChangeHour,
    junkCycleOrder: state.junkCycleOrder,
    junkCycleIndex: state.junkCycleIndex,
    preScheduledJunkOnly: state.preScheduledJunkOnly,
    preScheduledNonBumperJunkOnly: state.preScheduledNonBumperJunkOnly,
    usedAlgorithmicTracks: state.usedAlgorithmicTracks
  });
  return state;
};

window.clearAlgorithmicUsage = () => {
  const state = getState();
  state.usedAlgorithmicTracks = {
    lateNight: {},
    morning: {},
    standard: {}
  };
  console.log('Cleared algorithmic usage tracking');
};

window.setPreScheduledWarnings = (junkOnly = false, nonBumperJunkOnly = false) => {
  updateState({
    preScheduledJunkOnly: junkOnly,
    preScheduledNonBumperJunkOnly: nonBumperJunkOnly
  });
  console.log(`Set pre-scheduled warnings: junkOnly=${junkOnly}, nonBumperJunkOnly=${nonBumperJunkOnly}`);
};

// Public API
export default {
  initApp,
  startPlayback,
  reset,
  skipTrack,
  simulateTime,
  startSimulatedTimeProgression,
  stopSimulatedTimeProgression
};
