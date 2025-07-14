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
  usedAlgorithmicTracks: {
    lateNightLoFis: {},
    morning: {},
    standard: {}
  },

  // Playback state
  isFirstTrack: true,
  simulatedDate: null, // Initialize with null for using real time by default
  timeOfDay: undefined,
  fadeOutInterval: null,
  currentScheduledTrack: null,
  simulatedTimeInterval: null,
  fadeOutDuration: 3000, // 3 seconds in milliseconds

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
  chainGapThreshold: 10, // seconds - if tracks end within this time, chain them

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
  for (const category in state.usedAlgorithmicTracks) {
    state.usedAlgorithmicTracks[category] = {};
  }
}

export function clearUsedAlgorithmicTracksForCategory(category) {
  if (state.usedAlgorithmicTracks[category]) {
    state.usedAlgorithmicTracks[category] = {};
  }
}

export function resetUsedScheduledFiles() {
  state.usedScheduledFiles = {};
}
