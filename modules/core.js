// Core module for main application functions

import { playAlgorithmicTrack } from './player.js';
import { clearAllScheduledTimeouts, initializeScheduledSystem, shuffleJunkCycleOrder, setGenre } from './scheduling.js';
import { getState, updateState } from './state.js';
import { stopSimulatedTimeProgression } from './time.js';

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

export function initialize() {
  // Initialize scheduled track system
  const playingScheduledTrack = initializeScheduledSystem();

  shuffleJunkCycleOrder();
  setGenre();

  if (!playingScheduledTrack) {
    playAlgorithmicTrack();
  }
}



export function startPlayback() {
  console.log("Starting playback");
  reset();

  // Ensure data is loaded before initializing
  if (!getState().config || !getState().preprocessed) {
    console.log("Config not loaded, attempting to load...");
    load().then(success => {
      if (success) {
        initialize();
      } else {
        console.error("Failed to load required data. Cannot start playback.");
      }
    });
  } else {
    initialize();
  }
}

export function skipTrack() {
  const state = getState();
  console.log("Skipping track");

  // Fade out current track and play next
  state.theTransmitter.pause();

  playAlgorithmicTrack();
}

export function reset() {
  const state = getState();

  updateState({
    isFirstTrack: true,
    currentScheduledTrack: null,
    isInScheduledMode: false,
    currentGenre: null,
    junkCycleIndex: 0,
    preScheduledJunkOnly: false,
    preScheduledNonBumperJunkOnly: false
  });

  state.theTransmitter.pause();

  // Clear intervals and timeouts
  if (state.fadeOutInterval) {
    clearInterval(state.fadeOutInterval);
    updateState({ fadeOutInterval: null });
  }

  if (state.simulatedTimeInterval) {
    stopSimulatedTimeProgression();
  }

  // Clear all scheduled timeouts
  clearAllScheduledTimeouts();

  if (state.hourlyScheduleTimeout) {
    clearTimeout(state.hourlyScheduleTimeout);
    updateState({ hourlyScheduleTimeout: null });
  }
}
