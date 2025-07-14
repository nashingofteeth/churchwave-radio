// Core module for main application functions

import { playAlgorithmicTrack } from './player.js';
import { clearAllScheduledTimeouts, initializeScheduledSystem } from './scheduling.js';
import { clearUsedAlgorithmicTracksForCategory, getState, updateState } from './state.js';
import { getCurrentTime, stopSimulatedTimeProgression } from './time.js';

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

  initializeJunkCycleOrder();
  setMorningGenre();

  if (!playingScheduledTrack) {
    // Set up hourly cleanup for algorithmic tracks
    setupHourlyCleanup();
    playAlgorithmicTrack();
  }
}

function initializeJunkCycleOrder() {
  const state = getState();
  const shuffled = [...state.preprocessed.junkContent.cycleOrder].sort(() => Math.random() - 0.5);
  updateState({
    junkCycleOrder: shuffled,
    junkCycleIndex: 0
  });
}

export function setMorningGenre() {
  const state = getState();
  const currentHour = (state.simulatedDate || getCurrentTime()).getHours();

  // Only change genre if we're at a new hour
  if (state.lastGenreChangeHour !== currentHour) {
    const genres = ['country', 'rock', 'praise'];
    const selectedGenre = genres[Math.floor(Math.random() * genres.length)];
    updateState({
      currentMorningGenre: selectedGenre,
      lastGenreChangeHour: currentHour
    });
    console.log(`Morning genre set to: ${selectedGenre} for hour ${currentHour}`);
  }
}

export function setupHourlyCleanup() {
  const state = getState();

  // Clear any existing hourly cleanup
  if (state.hourlyCleanupTimeout) {
    clearTimeout(state.hourlyCleanupTimeout);
  }

  const now = getCurrentTime();
  const nextHour = new Date(now.getTime());
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  const timeUntilNextHour = nextHour - now;

  const hourlyCleanupTimeout = setTimeout(() => {
    // Clear used algorithmic tracks
    clearUsedAlgorithmicTracksForCategory('lateNight');
    clearUsedAlgorithmicTracksForCategory('morning');
    clearUsedAlgorithmicTracksForCategory('standard');

    console.log('Hourly cleanup: cleared used algorithmic tracks');

    // Schedule next cleanup
    setupHourlyCleanup();
  }, timeUntilNextHour);

  updateState({ hourlyCleanupTimeout });
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
    currentMorningGenre: null,
    lastGenreChangeHour: null,
    junkCycleIndex: 0,
    preScheduledJunkOnly: false,
    preScheduledNonBumperJunkOnly: false
  });

  // Clear hourly cleanup timeout
  if (state.hourlyCleanupTimeout) {
    clearTimeout(state.hourlyCleanupTimeout);
    updateState({ hourlyCleanupTimeout: null });
  }

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
