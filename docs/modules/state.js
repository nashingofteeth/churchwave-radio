/**
 * Application state management module
 * Centralized state container with getters, setters, and initialization functions
 */

import { shuffleJunkCycleOrder } from "./scheduling.js";
import { getCurrentTime } from "./time.js";

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
  pausePlayButton: null,

  // Preprocessed track data
  preprocessed: null,
  config: null,
  timezoneOffset: null,

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
  applicationState.pausePlayButton = document.getElementById("pausePlayButton");
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
 * Clear old used standard tracks (24-hour cycle) and reset other categories hourly
 */
export function clearUsedAlgorithmicTracks() {
  const now = getCurrentTime();
  const twentyFourHoursAgo = now.getTime() - 24 * 60 * 60 * 1000;
  
  const cleanedUsedAlgorithmicTracks = { ...applicationState.usedAlgorithmicTracks };
  
  for (const category in cleanedUsedAlgorithmicTracks) {
    if (category === 'standard') {
      // Standard tracks use 24-hour cycle
      const cleanedStandardTracks = {};
      Object.keys(cleanedUsedAlgorithmicTracks[category]).forEach((trackKey) => {
        const usedTimestamp = cleanedUsedAlgorithmicTracks[category][trackKey];
        if (usedTimestamp && usedTimestamp.getTime && usedTimestamp.getTime() >= twentyFourHoursAgo) {
          cleanedStandardTracks[trackKey] = usedTimestamp;
        }
      });
      cleanedUsedAlgorithmicTracks[category] = cleanedStandardTracks;
    } else {
      // Late night and morning tracks clear hourly
      cleanedUsedAlgorithmicTracks[category] = {};
    }
  }
  
  updateApplicationState({ usedAlgorithmicTracks: cleanedUsedAlgorithmicTracks });
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
  // Store timestamp for standard tracks, boolean for others
  if (category === 'standard') {
    applicationState.usedAlgorithmicTracks[category][trackKey] = getCurrentTime();
  } else {
    applicationState.usedAlgorithmicTracks[category][trackKey] = true;
  }
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

  // Calculate and cache timezone offset for performance
  if (config?.timezone && !state.timezoneOffset) {
    try {
      const testDate = new Date();
      const localTime = testDate.toLocaleString("en-US", {
        timeZone: config.timezone,
      });
      const timezoneOffset = new Date(localTime).getTime() - testDate.getTime();
      updateApplicationState({ timezoneOffset });
    } catch (error) {
      console.warn("Invalid timezone configuration, using local time");
      updateApplicationState({ timezoneOffset: 0 });
    }
  }

  // Initialize usedAlgorithmicTracks structure from preprocessed data
  if (
    state.preprocessed?.optimizations?.algorithmicTrackTypes &&
    Object.keys(state.usedAlgorithmicTracks).length === 0
  ) {
    const usedAlgorithmicTracks = {};

    // Create tracking objects for each algorithmic track type
    state.preprocessed.optimizations.algorithmicTrackTypes.forEach((trackType) => {
      usedAlgorithmicTracks[trackType] = {};
    });

    updateApplicationState({ usedAlgorithmicTracks });
  } else {
    console.warn("Algorithmic track types not found in preprocessed data");
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
