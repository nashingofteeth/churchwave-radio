// Player module for audio playback control functions

import { addCurrentTrackListener, cleanupCurrentTrackListeners } from './events.js';
import { getState, updateState } from './state.js';
import { getRandomStartTime, getTimeOfDay } from './time.js';

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

export function playMainTrack() {
  const state = getState();
  const newIndex = (state.currentMainTrackIndex + 1) % state.mainTracks.length;
  updateState({ currentMainTrackIndex: newIndex });
  playTrack(state.mainTracks[newIndex], playInterlude);
}

export function playInterlude() {
  const state = getState();
  const timeOfDay = getTimeOfDay();
  updateState({ timeOfDay });

  if (timeOfDay === "lateNight") return playLateNightLoFi();

  const currentMainTrackKey = state.currentMainTrackIndex.toString();
  let availableInterludes = state.interludes[currentMainTrackKey][timeOfDay].filter(
    (track) => !state.usedPieces[currentMainTrackKey][track],
  );
  if (availableInterludes.length === 0) {
    state.usedPieces[currentMainTrackKey] = {};
    availableInterludes = state.interludes[currentMainTrackKey][timeOfDay];
  }
  const nextInterlude =
    availableInterludes[Math.floor(Math.random() * availableInterludes.length)];
  state.usedPieces[currentMainTrackKey][nextInterlude] = true;
  playTrack(nextInterlude, playMainTrack);
}

export function playLateNightLoFi() {
  const state = getState();
  const timeOfDay = getTimeOfDay();
  updateState({ timeOfDay });

  if (timeOfDay !== "lateNight") {
    updateState({ currentMainTrackIndex: 3 });
    return playMainTrack();
  }

  let availableLoFis = state.lateNightLoFis.filter(
    (track) => !state.usedPieces.lateNight[track],
  );
  if (availableLoFis.length === 0) {
    state.usedPieces.lateNight = {};
    availableLoFis = state.lateNightLoFis;
  }
  const nextLoFi =
    availableLoFis[Math.floor(Math.random() * availableLoFis.length)];
  state.usedPieces.lateNight[nextLoFi] = true;
  playTrack(nextLoFi, playLateNightLoFi);
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
