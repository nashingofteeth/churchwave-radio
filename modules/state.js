/**
 * Application state management module
 * Centralized state container with getters, setters, and initialization functions
 */

import { shuffleJunkCycleOrder } from "./scheduling.js";

/**
 * Global application state object
 * Contains all runtime state for the radio system
 */
export const applicationState = {
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
  fadeOutDuration: null,

  // Time simulation system
  simulatedTime: null,
  simulationInterval: null,
  isTimeSimulated: false,
  simulationSpeed: 1,

  // Algorithmic state
  morningGenres: {},
  junkCycleOrder: [],
  junkCycleIndex: 0,
  preScheduledJunkOnly: false,
  preScheduledNonBumperJunkOnly: false,

  // Scheduling state
  isInScheduledMode: false,
  scheduledTimeouts: [],
  hourlyScheduleTimeout: null,
  dailyMorningGenreTimeout: null,
  upcomingScheduled: [], // Array of {track, scheduledTime} sorted by scheduledTime

  // Event listener management
  currentTrackListeners: [],
  scheduledTrackListeners: [],

  // Browser capabilities
  capabilities: {},
};

/**
 * Initialize DOM element references in application state
 * Must be called after DOM is loaded
 */
export function initializeDOMElements() {
  applicationState.theTransmitter = document.getElementById("theTransmitter");
  applicationState.startButton = document.getElementById("startButton");
  applicationState.loadingIndicator =
    document.getElementById("loadingIndicator");
  applicationState.playingIndicator =
    document.getElementById("playingIndicator");
}

/**
 * Get the complete application state object
 * @returns {Object} Current application state
 */
export function getApplicationState() {
  return applicationState;
}

/**
 * Update application state with new values
 * @param {Object} updates - Object containing state updates
 * @throws {Error} If simulatedTime is not a Date object
 */
export function updateApplicationState(updates) {
  if (updates.simulatedTime && !(updates.simulatedTime instanceof Date)) {
    throw new Error("simulatedTime must be a Date object");
  }

  Object.assign(applicationState, updates);
}

/**
 * Add an item to a nested array in the application state
 * @param {string} arrayPath - Dot-notation path to array (e.g., "listeners.current")
 * @param {*} item - Item to add to the array
 */
export function addToStateArray(arrayPath, item) {
  const pathSegments = arrayPath.split(".");
  let currentObject = applicationState;

  // Navigate to the parent object containing the target array
  for (let i = 0; i < pathSegments.length - 1; i++) {
    currentObject = currentObject[pathSegments[i]];
  }

  const arrayPropertyName = pathSegments[pathSegments.length - 1];
  if (!Array.isArray(currentObject[arrayPropertyName])) {
    currentObject[arrayPropertyName] = [];
  }

  currentObject[arrayPropertyName].push(item);
}

/**
 * Clear a nested array in the application state
 * @param {string} arrayPath - Dot-notation path to array
 */
export function clearStateArray(arrayPath) {
  const pathSegments = arrayPath.split(".");
  let currentObject = applicationState;

  // Navigate to the parent object containing the target array
  for (let i = 0; i < pathSegments.length - 1; i++) {
    currentObject = currentObject[pathSegments[i]];
  }

  const arrayPropertyName = pathSegments[pathSegments.length - 1];
  currentObject[arrayPropertyName] = [];
}

/**
 * Clear all used algorithmic track markers across all categories
 * Resets the "used" status for all algorithmic tracks
 */
export function clearUsedAlgorithmicTracks() {
  const resetUsageTracking = {};
  for (const category in applicationState.usedAlgorithmicTracks) {
    resetUsageTracking[category] = {};
  }
  updateApplicationState({ usedAlgorithmicTracks: resetUsageTracking });
}

/**
 * Clear used track markers for a specific algorithmic category
 * @param {string} category - Category name (e.g., "morning", "standard")
 */
export function clearUsedAlgorithmicTracksForCategory(category) {
  if (applicationState.usedAlgorithmicTracks[category]) {
    applicationState.usedAlgorithmicTracks[category] = {};
  }
}

/**
 * Clear used track markers for a specific junk content type
 * @param {string} junkType - Junk type name (e.g., "ads", "bumpers")
 */
export function clearUsedJunkTracksForType(junkType) {
  if (applicationState.usedJunkTracksByType[junkType]) {
    applicationState.usedJunkTracksByType[junkType] = {};
  }
}

/**
 * Clear all used junk track markers across all types
 * Resets the "used" status for all junk content
 */
export function clearUsedJunkTracks() {
  for (const junkType in applicationState.usedJunkTracksByType) {
    applicationState.usedJunkTracksByType[junkType] = {};
  }
}

/**
 * Mark an algorithmic track as used to prevent immediate replay
 * @param {string} category - Track category (e.g., "morning", "standard")
 * @param {string} trackKey - Unique identifier for the track
 */
export function markAlgorithmicTrackUsed(category, trackKey) {
  if (!applicationState.usedAlgorithmicTracks[category]) {
    applicationState.usedAlgorithmicTracks[category] = {};
  }
  applicationState.usedAlgorithmicTracks[category][trackKey] = true;
}

/**
 * Mark a junk track as used to prevent immediate replay within its type
 * @param {string} junkType - Junk content type (e.g., "ads", "bumpers")
 * @param {string} trackKey - Unique identifier for the track
 */
export function markJunkTrackUsed(junkType, trackKey) {
  if (!applicationState.usedJunkTracksByType[junkType]) {
    applicationState.usedJunkTracksByType[junkType] = {};
  }
  applicationState.usedJunkTracksByType[junkType][trackKey] = true;
}

/**
 * Remove a track from the upcoming scheduled tracks ledger
 * @param {string} trackKey - Unique identifier for the scheduled track
 */
export function removeFromUpcomingScheduled(trackKey) {
  applicationState.upcomingScheduled =
    applicationState.upcomingScheduled.filter(
      (entry) => entry.track.trackKey !== trackKey,
    );
}

/**
 * Mark a scheduled file as used and remove from upcoming schedule
 * @param {string} trackKey - Unique identifier for the track
 * @param {Date} timestamp - When the track was played
 */
export function markScheduledFileUsed(trackKey, timestamp) {
  applicationState.usedScheduledFiles[trackKey] = timestamp;
  removeFromUpcomingScheduled(trackKey);
}

/**
 * Initialize application state from configuration data
 * Sets up usage tracking, playback settings, and default values
 */
export function initializeApplicationState() {
  const state = getApplicationState();

  // Initialize from config if available
  const config = state.config;
  if (config?.playback && !state.fadeOutDuration) {
    // Set playback configuration values
    updateApplicationState({
      fadeOutDuration: config.playback.fadeOutDuration,
    });
  } else {
    console.warn("Playback settings not found");
  }

  // Initialize usedAlgorithmicTracks structure from config
  if (
    config.tracks?.algorithmic &&
    Object.keys(state.usedAlgorithmicTracks).length === 0
  ) {
    const usedAlgorithmicTracks = {};

    // Create tracking objects for each algorithmic subdirectory
    Object.keys(config.tracks.algorithmic).forEach((key) => {
      if (key === "path") return; // Skip the path property

      // Skip junk as it has its own tracking system
      if (key !== "junk") {
        usedAlgorithmicTracks[key] = {};
      }
    });

    updateApplicationState({ usedAlgorithmicTracks });
  } else {
    console.warn("Algorithmic tracks not found");
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

    updateApplicationState({ usedJunkTracksByType });
  }

  // Initialize junk cycle order if preprocessed data is available
  shuffleJunkCycleOrder();

  console.log("Application state initialized successfully");
}
