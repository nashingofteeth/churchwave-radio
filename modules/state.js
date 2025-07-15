import { setGenre, shuffleJunkCycleOrder } from './scheduling.js';

// State management module for global application state

export const state = {
  // DOM elements
  theTransmitter: null,
  startButton: null,
  loadingIndicator: null,
  playingIndicator: null,

  // Preprocessed track data
  preprocessed: null,
  config: {},

  // Usage tracking
  usedScheduledFiles: {},
  usedAlgorithmicTracks: {},

  // Playback state
  isFirstTrack: true,
  simulatedDate: null, // Initialize with null for using real time by default
  timeOfDay: undefined,
  fadeOutInterval: null,
  currentScheduledTrack: null,
  simulatedTimeInterval: null,
  fadeOutDuration: null,

  // Algorithmic state
  currentGenre: null,
  junkCycleOrder: [],
  junkCycleIndex: 0,
  preScheduledJunkOnly: false,
  preScheduledNonBumperJunkOnly: false,

  // Scheduling state
  isInScheduledMode: false,
  scheduledTimeouts: [],
  hourlyScheduleTimeout: null,
  chainGapThreshold: null,

  // Event listener management
  currentTrackListeners: [],
  scheduledTrackListeners: []
};

// Initialize DOM elements
export function initializeDOMElements() {
  state.theTransmitter = document.getElementById("theTransmitter");
  state.startButton = document.getElementById("startButton");
  state.loadingIndicator = document.getElementById("loadingIndicator");
  state.playingIndicator = document.getElementById("playingIndicator");
}

// State getters
export function getState() {
  return state;
}

// State setters
export function updateState(updates) {
  Object.assign(state, updates);
}

export function resetUsedAlgorithmicTracks() {
  // Reset all existing algorithmic track categories
  const resetUsedAlgorithmicTracks = {};
  for (const category in state.usedAlgorithmicTracks) {
    resetUsedAlgorithmicTracks[category] = {};
  }
  updateState({ usedAlgorithmicTracks: resetUsedAlgorithmicTracks });
}

export function clearUsedAlgorithmicTracksForCategory(category) {
  if (state.usedAlgorithmicTracks[category]) {
    const updatedUsedAlgorithmicTracks = { ...state.usedAlgorithmicTracks };
    updatedUsedAlgorithmicTracks[category] = {};
    updateState({ usedAlgorithmicTracks: updatedUsedAlgorithmicTracks });
  }
}

export function resetUsedScheduledFiles() {
  updateState({ usedScheduledFiles: {} });
}

// Initialize state from config and reset to defaults
export function initializeState() {
  const state = getState();

  // Initialize from config if available
  const config = state.config;
  if (config?.playback) {
    // Set playback configuration values
    updateState({
      fadeOutDuration: config.playback.fadeOutDuration,
      chainGapThreshold: config.playback.chainGapThreshold
    });
  } else {
    console.warn('Playback settings not found');
  }

  // Initialize usedAlgorithmicTracks structure from config
  if (config.directories?.algorithmic?.subdirectories) {
    const usedAlgorithmicTracks = {};

    // Create tracking objects for each algorithmic subdirectory
    Object.keys(config.directories.algorithmic.subdirectories).forEach(key => {
      const subdir = config.directories.algorithmic.subdirectories[key];
      // Skip junk as it's not tracked in usedAlgorithmicTracks
      if (subdir.category !== 'junkContent') {
        usedAlgorithmicTracks[key] = {};
      }
    });

    updateState({ usedAlgorithmicTracks });
  }
  else {
    console.warn('Algorithmic directories not found');
  }

  // Initialize junk cycle order if preprocessed data is available
  shuffleJunkCycleOrder();

  // Initialize genre selection
  setGenre();

  console.log('State initialized from config');
}
