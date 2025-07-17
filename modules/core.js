// Core module for main application functions

import { cleanupCurrentTrackListeners, cleanupScheduledTrackListeners } from './events.js';
import { playAlgorithmicTrack } from './player.js';
import { clearAllScheduledTimeouts, enterScheduledMode, getActiveScheduledTrack, startScheduledSystem } from './scheduling.js';
import { getState, initializeState, resetUsedAlgorithmicTracks, resetUsedScheduledFiles, updateState } from './state.js';

export async function load() {

  // Load config first
  try {
    const response = await fetch("config.json");
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
    }
    const configData = await response.json();
    updateState({ config: configData });

    const tracksResponse = await fetch("tracks.json");
    if (!tracksResponse.ok) {
      throw new Error(`Failed to load tracks: ${tracksResponse.status} ${tracksResponse.statusText}`);
    }
    const tracksData = await tracksResponse.json();

    if (!tracksData.preprocessed) {
      throw new Error('Tracks data missing preprocessed information');
    }

    updateState({
      preprocessed: tracksData.preprocessed
    });

    console.log('Data loaded successfully');
    return true;

  } catch (error) {
    console.error("Error loading data:", error);
    return false;
  }
}

export async function initializePlayback() {
  // Load configuration and track data
  const loadSuccess = await load();

  if (!loadSuccess) {
    console.error('Failed to load configuration and track data');
    return false;
  }

  initializeState();
  startScheduledSystem();
  startPlayback();

  return true;
}

export function startPlayback() {
  console.log("Starting playback");

  // Check for any currently playing scheduled track
  const activeTrack = getActiveScheduledTrack();
  if (activeTrack) {
    enterScheduledMode(activeTrack);
  } else {
    playAlgorithmicTrack();
  }
}

export function skipTrack() {
  const state = getState();
  console.log("Skipping track");

  state.theTransmitter.pause();

  playAlgorithmicTrack();
}

export function reset() {
  const state = getState();
  state.theTransmitter.pause();

  // Set all default values
  updateState({
    // Playback state
    isFirstTrack: true,
    currentTimeSlot: undefined,
    currentScheduledTrack: null,

    // Algorithmic state
    preScheduledJunkOnly: false,
    preScheduledNonBumperJunkOnly: false,

    // Scheduling state
    isInScheduledMode: false,
  });

  // Clear any existing intervals or timeouts
  if (state.fadeOutInterval) {
    clearInterval(state.fadeOutInterval);
  }

  if (state.hourlyScheduleTimeout) {
    clearTimeout(state.hourlyScheduleTimeout);
  }

  updateState({
    fadeOutInterval: null,
    hourlyScheduleTimeout: null
  });

  clearAllScheduledTimeouts();

  // Clean up listeners
  cleanupCurrentTrackListeners();
  cleanupScheduledTrackListeners();

  // Reset usage tracking
  resetUsedAlgorithmicTracks();
  resetUsedScheduledFiles();

  initializeState();
  startScheduledSystem();
  startPlayback();
}
