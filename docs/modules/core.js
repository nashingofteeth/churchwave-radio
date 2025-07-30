/**
 * Core application module
 * Handles data loading, playback initialization, and track skipping
 */

import { playAlgorithmicTrack } from "./player.js";
import {
  enterScheduledMode,
  getActiveScheduledTrack,
  startScheduledSystem,
} from "./scheduling.js";
import { getApplicationState, initializeApplicationState, updateApplicationState } from "./state.js";

/**
 * Load track data
 * @returns {Promise<boolean>} Success status
 */
export async function loadApplicationData() {
  try {
    // Get configuration
    const appState = getApplicationState();
    if (!appState || !appState.config) {
      throw new Error("Configuration not found in application state");
    }
    
    const configurationData = appState.config;
    
    // Validate required configuration properties
    if (!configurationData.mediaPath) {
      throw new Error("Media path not configured");
    }

    // Load track database using media path
    const tracksPath = `${configurationData.mediaPath}/tracks.json`;
    const tracksResponse = await fetch(tracksPath);
    if (!tracksResponse.ok) {
      throw new Error(
        `Tracks loading failed: ${tracksResponse.status} ${tracksResponse.statusText}`,
      );
    }
    const trackData = await tracksResponse.json();

    // Validate track data structure
    if (!trackData || typeof trackData !== 'object') {
      throw new Error("Invalid track data format");
    }
    
    if (!trackData.preprocessed) {
      throw new Error("Track data missing required preprocessed information");
    }

    updateApplicationState({
      preprocessed: trackData.preprocessed,
    });

    console.log("Application data loaded successfully");

    if (trackData.metadata?.lastUpdated) {
      const lastUpdated = new Date(trackData.metadata.lastUpdated);
      console.log(`Tracks database last updated: ${lastUpdated.toLocaleString()}`);
    }
    
    return true;
  } catch (error) {
    console.error("Application data loading failed:", error);
    return false;
  }
}

/**
 * Initialize the complete playback system
 * Loads data, initializes state, starts scheduling, and begins playback
 * @returns {Promise<boolean>} Success status
 */
export async function initializePlayback() {
  const dataLoadSuccess = await loadApplicationData();
  
  if (!dataLoadSuccess) {
    console.error("Playback initialization failed: could not load data");
    return false;
  }

  initializeApplicationState();
  startScheduledSystem();
  beginPlayback();

  return true;
}

/**
 * Begin audio playback, checking for scheduled content first
 * Falls back to algorithmic playback if no scheduled content is active
 */
export function beginPlayback() {
  console.log("Beginning audio playback");

  const currentScheduledTrack = getActiveScheduledTrack();
  if (currentScheduledTrack) {
    enterScheduledMode(currentScheduledTrack);
  } else {
    playAlgorithmicTrack();
  }
}

/**
 * Skip the currently playing track and start algorithmic playback
 * Used for manual track skipping by user or debug functions
 */
export function skipCurrentTrack() {
  const state = getApplicationState();

  console.log("Skipping current track");

  state.theTransmitter.dispatchEvent(new Event('ended'));
}
