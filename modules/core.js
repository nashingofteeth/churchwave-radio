// Core module for main application functions

import { playAlgorithmicTrack } from './player.js';
import { clearAllScheduledTimeouts, initializeScheduledSystem } from './scheduling.js';
import { getState, updateState, clearUsedAlgorithmicTracksForCategory } from './state.js';
import { getAlgorithmicTimeSlot, stopSimulatedTimeProgression, getCurrentTime } from './time.js';

export async function load() {

  // Load config first
  try {
    const response = await fetch("config.json");
    const configData = await response.json();
    updateState({ config: configData });
    const tracksResponse = await fetch("tracks.json");
    const tracksData = await tracksResponse.json();

    updateState({
      // Use new tracks structure
      scheduledTracks: tracksData.categories?.scheduled || [],
      tracksData: tracksData.files || {},
      algorithmicCategories: tracksData.categories?.algorithmic || {}
    });

    // Initialize junk cycle order
    initializeJunkCycleOrder();

  } catch (error) {
    return console.error("Error loading tracks:", error);
  }
}

function initializeJunkCycleOrder() {
  const state = getState();
  const junkTypes = ['ads', 'scripture', 'interludes', 'ads2', 'bumpers'];
  // Create random order for junk content cycling
  const shuffled = [...junkTypes].sort(() => Math.random() - 0.5);
  updateState({
    junkCycleOrder: shuffled,
    junkCycleIndex: 0
  });
}

export function initialize() {
  const state = getState();

  // Initialize scheduled track system
  const playingScheduledTrack = initializeScheduledSystem();

  if (!playingScheduledTrack) {
    const timeSlot = getAlgorithmicTimeSlot();
    updateState({ timeOfDay: timeSlot });

    // Set morning genre if in morning time slot
    if (timeSlot === "morning") {
      setMorningGenre();
    }

    // Set up hourly cleanup for algorithmic tracks
    setupHourlyCleanup();

    playAlgorithmicTrack();
  }
}

export function setMorningGenre() {
  const state = getState();
  const currentHour = (state.simulatedDate || new Date()).getHours();

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

  // Calculate time until next hour
  const now = getCurrentTime();
  const nextHour = new Date(now);
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
  initialize();
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
    currentMainTrackIndex: undefined,
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
