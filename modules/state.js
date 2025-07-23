import { shuffleJunkCycleOrder } from "./scheduling.js";

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
  usedJunkTracksByType: {},

  // Playback state
  isFirstTrack: true,
  fadeOutInterval: null,
  currentScheduledTrack: null,
  fadeOutDuration: null,

  // Time simulation system
  simulatedTime: null,
  simulationInterval: null,
  isTimeSimulated: false,
  simulationSpeed: 1,

  // Algorithmic state
  morningGenres: {},
  lastMorningGenreUpdate: null,
  junkCycleOrder: [],
  junkCycleIndex: 0,
  preScheduledJunkOnly: false,
  preScheduledNonBumperJunkOnly: false,

  // Scheduling state
  isInScheduledMode: false,
  scheduledTimeouts: [],
  hourlyScheduleTimeout: null,
  dailyMorningGenreTimeout: null,

  // Event listener management
  currentTrackListeners: [],
  scheduledTrackListeners: [],
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
  // Validate critical updates
  if (updates.simulatedTime && !(updates.simulatedTime instanceof Date)) {
    throw new Error("simulatedTime must be a Date object");
  }

  Object.assign(state, updates);
}

// Helper function for array operations
export function addToStateArray(arrayPath, item) {
  const keys = arrayPath.split(".");
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
  const keys = arrayPath.split(".");
  let current = state;

  // Navigate to the array
  for (let i = 0; i < keys.length - 1; i++) {
    current = current[keys[i]];
  }

  const arrayName = keys[keys.length - 1];
  current[arrayName] = [];
}

export function clearUsedAlgorithmicTracks() {
  // Reset all existing algorithmic track categories
  const clearUsedAlgorithmicTracks = {};
  for (const category in state.usedAlgorithmicTracks) {
    clearUsedAlgorithmicTracks[category] = {};
  }
  updateState({ usedAlgorithmicTracks: clearUsedAlgorithmicTracks });
}

export function clearUsedAlgorithmicTracksForCategory(category) {
  if (state.usedAlgorithmicTracks[category]) {
    state.usedAlgorithmicTracks[category] = {};
  }
}

export function clearUsedJunkTracksForType(junkType) {
  if (state.usedJunkTracksByType[junkType]) {
    state.usedJunkTracksByType[junkType] = {};
  }
}

export function clearUsedJunkTracks() {
  for (const junkType in state.usedJunkTracksByType) {
    state.usedJunkTracksByType[junkType] = {};
  }
}

// Helper functions for tracking usage
export function markAlgorithmicTrackUsed(category, trackKey) {
  if (!state.usedAlgorithmicTracks[category]) {
    state.usedAlgorithmicTracks[category] = {};
  }
  state.usedAlgorithmicTracks[category][trackKey] = true;
}

export function markJunkTrackUsed(junkType, trackKey) {
  if (!state.usedJunkTracksByType[junkType]) {
    state.usedJunkTracksByType[junkType] = {};
  }
  state.usedJunkTracksByType[junkType][trackKey] = true;
}

export function markScheduledFileUsed(trackKey, timestamp) {
  state.usedScheduledFiles[trackKey] = timestamp;
}

// Initialize state from config and reset to defaults
export function initializeState() {
  const state = getState();

  // Initialize from config if available
  const config = state.config;
  if (
    config?.playback &&
    (!state.fadeOutDuration)
  ) {
    // Set playback configuration values
    updateState({
      fadeOutDuration: config.playback.fadeOutDuration,
    });
  } else {
    console.warn("Playback settings not found");
  }

  // Initialize usedAlgorithmicTracks structure from config
  if (
    config.directories?.algorithmic?.subdirectories &&
    Object.keys(state.usedAlgorithmicTracks).length === 0
  ) {
    const usedAlgorithmicTracks = {};

    // Create tracking objects for each algorithmic subdirectory
    Object.keys(config.directories.algorithmic.subdirectories).forEach(
      (key) => {
        const subdir = config.directories.algorithmic.subdirectories[key];
        // Skip junk as it has its own tracking system
        if (subdir.category !== "junkContent") {
          usedAlgorithmicTracks[key] = {};
        }
      },
    );

    updateState({ usedAlgorithmicTracks });
  } else {
    console.warn("Algorithmic directories not found");
  }

  // Initialize usedJunkTracksByType structure from preprocessed data
  if (
    state.preprocessed?.junkContent?.types &&
    Object.keys(state.usedJunkTracksByType).length === 0
  ) {
    const usedJunkTracksByType = {};

    // Create tracking objects for each junk type
    Object.keys(state.preprocessed.junkContent.types).forEach((junkType) => {
      usedJunkTracksByType[junkType] = {};
    });

    updateState({ usedJunkTracksByType });
  }

  // Initialize junk cycle order if preprocessed data is available
  shuffleJunkCycleOrder();

  console.log("State initialized");
}
