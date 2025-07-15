// Player module for audio playback control functions

import { addCurrentTrackListener, cleanupCurrentTrackListeners } from './events.js';
import { clearUsedAlgorithmicTracksForCategory, getState, updateState, markAlgorithmicTrackUsed } from './state.js';
import { getRandomStartTime } from './time.js';

export function playTrack(trackUrl, callback, startTime = null) {
  const state = getState();

  // Clean up any existing current track listeners first
  cleanupCurrentTrackListeners();

  state.theTransmitter.src = trackUrl;
  console.log(`Playing track: ${trackUrl}`);
  state.theTransmitter.currentTime = 0;

  const loadedMetadataHandler = () => {
    if (startTime !== null) {
      state.theTransmitter.currentTime = Math.min(startTime, state.theTransmitter.duration - 1);
    } else if (state.isFirstTrack) {
      state.theTransmitter.currentTime = getRandomStartTime(state.theTransmitter.duration);
      updateState({ isFirstTrack: false });
    }
    state.theTransmitter.play();
  };

  const endedHandler = callback;

  addCurrentTrackListener("loadedmetadata", loadedMetadataHandler, { once: true });
  addCurrentTrackListener("ended", endedHandler, { once: true });
}

export function playAlgorithmicTrack() {
  const state = getState();

  // Check pre-scheduled warnings
  if (state.preScheduledJunkOnly) {
    return playJunkTrack();
  }

  // Play based on time slot
  switch (state.timeOfDay) {
    case "lateNightLoFis":
      return playLateNightLoFi();
    case "morning":
      return playMorningTrack();
    default:
      return playStandardTrack();
  }
}

export function playLateNightLoFi() {
  const state = getState();

  const tracks = state.preprocessed.timeSlots.lateNightLoFis.tracks;
  let availableTracks = tracks.filter(
    (track) => !state.usedAlgorithmicTracks.lateNightLoFis[track.key]
  );

  if (availableTracks.length === 0) {
    clearUsedAlgorithmicTracksForCategory('lateNightLoFis');
    availableTracks = tracks;
  }

  if (availableTracks.length === 0) {
    console.error('No late night tracks available');
    return playStandardTrack();
  }

  const selectedTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
  markAlgorithmicTrackUsed('lateNightLoFis', selectedTrack.key);
  playTrack(selectedTrack.path, playAlgorithmicTrack);
}

export function playMorningTrack() {
  const state = getState();
  const genre = state.currentGenre;

  if (!genre) {
    console.error('No genre selected');
    return playStandardTrack();
  }

  const tracks = state.preprocessed.timeSlots.morning.genres[genre].tracks;
  let availableTracks = tracks.filter(
    (track) => !state.usedAlgorithmicTracks.morning[track.key]
  );

  if (availableTracks.length === 0) {
    clearUsedAlgorithmicTracksForCategory('morning');
    availableTracks = tracks;
  }

  if (availableTracks.length === 0) {
    console.error('No morning tracks available for genre:', genre);
    return playStandardTrack();
  }

  const selectedTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
  markAlgorithmicTrackUsed('morning', selectedTrack.key);
  playTrack(selectedTrack.path, playAlgorithmicTrack);
}

export function playStandardTrack() {
  const state = getState();

  const tracks = state.preprocessed.timeSlots.standard.tracks;
  let availableTracks = tracks.filter(
    (track) => !state.usedAlgorithmicTracks.standard[track.key]
  );

  if (availableTracks.length === 0) {
    clearUsedAlgorithmicTracksForCategory('standard');
    availableTracks = tracks;
  }

  if (availableTracks.length === 0) {
    console.error('No standard tracks available');
    return;
  }

  const selectedTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
  markAlgorithmicTrackUsed('standard', selectedTrack.key);
  playTrack(selectedTrack.path, playAlgorithmicTrack);
}

export function playJunkTrack() {
  const state = getState();
  const junkContent = state.preprocessed.junkContent;

  // Get current junk type from cycle
  let currentJunkType = state.junkCycleOrder[state.junkCycleIndex];

  // If we're in the 5-minute warning period, skip bumpers
  if (state.preScheduledNonBumperJunkOnly && currentJunkType === 'bumpers') {
    // Move to next in cycle
    const nextIndex = (state.junkCycleIndex + 1) % state.junkCycleOrder.length;
    updateState({ junkCycleIndex: nextIndex });
    currentJunkType = state.junkCycleOrder[nextIndex];

    // If we've cycled through all and still hit bumpers, pick a non-bumper type
    if (currentJunkType === 'bumpers') {
      const nonBumperTypes = Object.entries(junkContent.types)
        .filter(([_, typeData]) => typeData.nonBumper)
        .map(([type, _]) => type);
      currentJunkType = nonBumperTypes[Math.floor(Math.random() * nonBumperTypes.length)];
    }
  }

  const junkTypeData = junkContent.types[currentJunkType];
  if (!junkTypeData || junkTypeData.tracks.length === 0) {
    console.error('No junk tracks available for type:', currentJunkType);
    return;
  }

  const selectedTrack = junkTypeData.tracks[Math.floor(Math.random() * junkTypeData.tracks.length)];

  // Move to next junk type for next time
  const nextIndex = (state.junkCycleIndex + 1) % state.junkCycleOrder.length;
  updateState({ junkCycleIndex: nextIndex });

  console.log(`Playing junk content: ${currentJunkType} - ${selectedTrack.filename}`);
  playTrack(selectedTrack.path, playAlgorithmicTrack);
}

export function fadeOut() {
  const state = getState();

  if (state.fadeOutInterval || state.currentScheduledTrack) return; // Prevent multiple fades or if already scheduled

  const steps = 30;
  const originalVolume = state.theTransmitter.volume;
  const volumeStep = originalVolume / steps;
  let currentStep = 0;

  console.log('Starting fade');

  const fadeOutInterval = setInterval(() => {
    currentStep++;
    state.theTransmitter.volume = Math.max(0, originalVolume - (volumeStep * currentStep));

    if (currentStep >= steps) {
      clearInterval(fadeOutInterval);
      updateState({ fadeOutInterval: null });
      state.theTransmitter.volume = originalVolume; // Reset volume for next track
      state.theTransmitter.pause();
    }
  }, state.fadeOutDuration / steps);

  updateState({ fadeOutInterval });
}
