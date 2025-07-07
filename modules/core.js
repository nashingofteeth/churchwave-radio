// Core module for main application functions

import { playLateNightLoFi, playMainTrack } from './player.js';
import { clearAllScheduledTimeouts, initializeScheduledSystem } from './scheduling.js';
import { getState, updateState } from './state.js';
import { getTimeOfDay, stopSimulatedTimeProgression } from './time.js';

export async function load() {

  // Load config first
  try {
    const response = await fetch("config.json");
    const configData = await response.json();
    updateState({ config: configData });
    const [newTracks, oldTracks] = await Promise.all([
      fetch("tracks.json").then(r => r.json()),
      fetch("tracks-old.json").then(r_1 => r_1.json())
    ]);
    // Use old tracks structure temporarily
    updateState({
      mainTracks: oldTracks.mainTracks,
      interludes: oldTracks.interludes,
      lateNightLoFis: oldTracks.lateNightLoFis,
      // Use new scheduled tracks structure
      scheduledTracks: newTracks.categories?.scheduled || [],
      tracksData: newTracks.files || {}
    });
  } catch (error) {
    return console.error("Error loading tracks:", error);
  }
}

export function initialize() {
  const state = getState();

  // Initialize scheduled track system
  const playingScheduledTrack = initializeScheduledSystem();

  if (!playingScheduledTrack) {
    const timeOfDay = getTimeOfDay();
    updateState({ timeOfDay });

    if (timeOfDay === "lateNight") {
      playLateNightLoFi();
    } else {
      updateState({ currentMainTrackIndex: Math.floor(Math.random() * state.mainTracks.length) });
      playMainTrack();
    }
  }
}

export function startPlayback() {
  console.log("Starting playback");
  reset();
  initialize();
}

export function reset() {
  const state = getState();

  updateState({
    isFirstTrack: true,
    currentMainTrackIndex: undefined,
    currentScheduledTrack: null,
    isInScheduledMode: false
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
