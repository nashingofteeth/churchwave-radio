// Core module for main application functions

import { cleanupCurrentTrackListeners, cleanupScheduledTrackListeners } from './events.js';
import { playAlgorithmicTrack } from './player.js';
import { clearAllScheduledTimeouts, enterScheduledMode, getActiveScheduledTrack, startScheduledSystem, shuffleJunkCycleOrder } from './scheduling.js';
import { getState, initializeState, resetUsedAlgorithmicTracks, resetUsedScheduledFiles, updateState } from './state.js';
import { stopClock, startRealTimeClock } from './time.js';

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

  // Clear any existing intervals or timeouts
  if (state.fadeOutInterval) {
    clearInterval(state.fadeOutInterval);
  }

  if (state.hourlyScheduleTimeout) {
    clearTimeout(state.hourlyScheduleTimeout);
  }

  // Stop the current clock and restart it (preserves current time but clears intervals)
  const wasSimulated = state.isSimulatedTime;
  const currentSpeed = state.simulatedSpeed;
  stopClock();

  clearAllScheduledTimeouts();

  // Set all default values
  updateState({
    // Playback state
    isFirstTrack: true,
    currentScheduledTrack: null,

    // Algorithmic state
    preScheduledJunkOnly: false,
    preScheduledNonBumperJunkOnly: false,

    // Scheduling state
    isInScheduledMode: false,

    // Timing events state
    fadeOutInterval: null,
    hourlyScheduleTimeout: null,

    // Clock state (don't reset currentTime, just intervals)
    clockInterval: null
  });

  // Clean up listeners
  cleanupCurrentTrackListeners();
  cleanupScheduledTrackListeners();

  // Reset usage tracking
  resetUsedAlgorithmicTracks();
  resetUsedScheduledFiles();

  // Initialize junk cycle order
  shuffleJunkCycleOrder();


  // Start scheduling
  startScheduledSystem();

  // Restart the clock with the same mode it was in
  if (wasSimulated) {
    import('./time.js').then(({ startSimulatedClock }) => {
      startSimulatedClock(currentSpeed);
    });
  } else {
    startRealTimeClock();
  }

  // Pick something to play now
  startPlayback();
}
