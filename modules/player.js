// Player module for audio playback control functions

import { addCurrentTrackListener, cleanupCurrentTrackListeners } from './events.js';
import { clearUsedAlgorithmicTracksForCategory, getState, updateState } from './state.js';
import { getAlgorithmicTimeSlot, getRandomStartTime } from './time.js';

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
  const timeSlot = getAlgorithmicTimeSlot();
  updateState({ timeOfDay: timeSlot });

  // Check if we need to change morning genre
  if (timeSlot === "morning") {
    // Import setMorningGenre dynamically to avoid circular dependencies
    import('./core.js').then(({ setMorningGenre }) => {
      setMorningGenre();
    });
  }

  // Check pre-scheduled warnings
  if (state.preScheduledJunkOnly) {
    return playJunkTrack();
  }

  // Play based on time slot
  switch (timeSlot) {
    case "lateNightLoFis":
      return playLateNightLoFi();
    case "morning":
      return playMorningTrack();
    case "standard":
      return playStandardTrack();
    default:
      return playStandardTrack();
  }
}

export function playLateNightLoFi() {
  const state = getState();
  const timeSlot = getAlgorithmicTimeSlot();
  updateState({ timeOfDay: timeSlot });

  if (timeSlot !== "lateNight") {
    return playAlgorithmicTrack();
  }

  const lateNightTracks = state.algorithmicCategories.lateNightLoFis || [];
  let availableTracks = lateNightTracks.filter(
    (trackKey) => !state.usedAlgorithmicTracks.lateNight[trackKey]
  );

  if (availableTracks.length === 0) {
    clearUsedAlgorithmicTracksForCategory('lateNight');
    availableTracks = lateNightTracks;
  }

  if (availableTracks.length === 0) {
    console.error('No late night tracks available');
    return;
  }

  const selectedTrackKey = availableTracks[Math.floor(Math.random() * availableTracks.length)];
  const trackData = state.tracksData[selectedTrackKey];

  if (!trackData) {
    console.error('Track data not found for key:', selectedTrackKey);
    return;
  }

  state.usedAlgorithmicTracks.lateNight[selectedTrackKey] = true;
  playTrack(trackData.path, playAlgorithmicTrack);
}

export function playMorningTrack() {
  const state = getState();
  const genre = state.currentMorningGenre;

  if (!genre) {
    console.error('No morning genre selected');
    return playStandardTrack();
  }

  const genreTracks = state.algorithmicCategories.morningMusic?.[genre] || [];
  let availableTracks = genreTracks.filter(
    (trackKey) => !state.usedAlgorithmicTracks.morning[trackKey]
  );

  if (availableTracks.length === 0) {
    clearUsedAlgorithmicTracksForCategory('morning');
    availableTracks = genreTracks;
  }

  if (availableTracks.length === 0) {
    console.error('No morning tracks available for genre:', genre);
    return playStandardTrack();
  }

  const selectedTrackKey = availableTracks[Math.floor(Math.random() * availableTracks.length)];
  const trackData = state.tracksData[selectedTrackKey];

  if (!trackData) {
    console.error('Track data not found for key:', selectedTrackKey);
    return;
  }

  state.usedAlgorithmicTracks.morning[selectedTrackKey] = true;
  playTrack(trackData.path, playAlgorithmicTrack);
}

export function playStandardTrack() {
  const state = getState();
  const standardTracks = state.algorithmicCategories.standardTracks || [];
  let availableTracks = standardTracks.filter(
    (trackKey) => !state.usedAlgorithmicTracks.standard[trackKey]
  );

  if (availableTracks.length === 0) {
    clearUsedAlgorithmicTracksForCategory('standard');
    availableTracks = standardTracks;
  }

  if (availableTracks.length === 0) {
    console.error('No standard tracks available');
    return;
  }

  const selectedTrackKey = availableTracks[Math.floor(Math.random() * availableTracks.length)];
  const trackData = state.tracksData[selectedTrackKey];

  if (!trackData) {
    console.error('Track data not found for key:', selectedTrackKey);
    return;
  }

  state.usedAlgorithmicTracks.standard[selectedTrackKey] = true;
  playTrack(trackData.path, playAlgorithmicTrack);
}

export function playJunkTrack() {
  const state = getState();
  const junkContent = state.algorithmicCategories.junkContent || {};

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
      const nonBumperTypes = ['ads', 'scripture', 'interludes', 'ads2'];
      currentJunkType = nonBumperTypes[Math.floor(Math.random() * nonBumperTypes.length)];
    }
  }

  const junkTracks = junkContent[currentJunkType] || [];

  if (junkTracks.length === 0) {
    console.error('No junk tracks available for type:', currentJunkType);
    return playAlgorithmicTrack();
  }

  const selectedTrackKey = junkTracks[Math.floor(Math.random() * junkTracks.length)];
  const trackData = state.tracksData[selectedTrackKey];

  if (!trackData) {
    console.error('Track data not found for key:', selectedTrackKey);
    return;
  }

  // Move to next junk type for next time
  const nextIndex = (state.junkCycleIndex + 1) % state.junkCycleOrder.length;
  updateState({ junkCycleIndex: nextIndex });

  console.log(`Playing junk content: ${currentJunkType} - ${trackData.filename}`);
  playTrack(trackData.path, playAlgorithmicTrack);
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
