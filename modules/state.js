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
  console.log('State update:', updates);

  // Validate critical updates
  if (updates.simulatedDate && updates.simulatedDate !== null && !(updates.simulatedDate instanceof Date)) {
    throw new Error('simulatedDate must be a Date object or null');
  }

  Object.assign(state, updates);
}

// Helper function for nested object updates
export function updateNestedState(path, value) {
  const keys = path.split('.');
  let current = state;

  // Navigate to the parent of the target property
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  // Set the final value
  current[keys[keys.length - 1]] = value;
}

// Helper function for array operations
export function addToStateArray(arrayPath, item) {
  const keys = arrayPath.split('.');
  let current = state;

  // Navigate to the array
  for (let i = 0; i < keys.length - 1; i++) {
    current = current[keys[i]];
  }

  const arrayName = keys[keys.length - 1];
  if (!Array.isArray(current[arrayName])) {
    current[arrayName] = [];
  }

  current[arrayName].push(item);
}

export function clearStateArray(arrayPath) {
  const keys = arrayPath.split('.');
  let current = state;

  // Navigate to the array
  for (let i = 0; i < keys.length - 1; i++) {
    current = current[keys[i]];
  }

  const arrayName = keys[keys.length - 1];
  current[arrayName] = [];
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
    state.usedAlgorithmicTracks[category] = {};
  }
}

export function resetUsedScheduledFiles() {
  updateState({ usedScheduledFiles: {} });
}

// Helper functions for tracking usage
export function markAlgorithmicTrackUsed(category, trackKey) {
  if (!state.usedAlgorithmicTracks[category]) {
    state.usedAlgorithmicTracks[category] = {};
  }
  state.usedAlgorithmicTracks[category][trackKey] = true;
}

export function markScheduledFileUsed(trackKey, timestamp) {
  state.usedScheduledFiles[trackKey] = timestamp;
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
