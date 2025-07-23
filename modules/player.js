// Player module for audio playback control functions

import {
  addCurrentTrackListener,
  addScheduledTrackListener,
  cleanupCurrentTrackListeners,
} from "./events.js";
import {
  clearUsedAlgorithmicTracksForCategory,
  clearUsedJunkTracksForType,
  getState,
  markAlgorithmicTrackUsed,
  markJunkTrackUsed,
  updateState,
} from "./state.js";
import {
  getRandomStartTime,
  getAlgorithmicTimeSlot,
  getCurrentTime,
} from "./time.js";

export function playTrack({
  trackPath,
  callback,
  startTime = null,
  isScheduled = false,
}) {
  const state = getState();

  // Clean up any existing current track listeners first
  cleanupCurrentTrackListeners();

  state.theTransmitter.src = trackPath;
  console.log(`Playing track: ${trackPath}`);
  state.theTransmitter.currentTime = 0;

  const loadedMetadataHandler = () => {
    if (startTime !== null) {
      state.theTransmitter.currentTime = Math.min(
        startTime,
        state.theTransmitter.duration - 1,
      );
    } else if (state.isFirstTrack) {
      state.theTransmitter.currentTime = getRandomStartTime(
        state.theTransmitter.duration,
      );
      updateState({ isFirstTrack: false });
    }
    state.theTransmitter.play();
  };

  // Set up appropriate listeners based on track type
  if (isScheduled) {
    // Import scheduling functions dynamically to avoid circular dependencies
    import("./scheduling.js").then(({ onScheduledTrackEnd }) => {
      addScheduledTrackListener("ended", onScheduledTrackEnd, { once: true });
    });
  } else {
    // Regular algorithmic track
    addCurrentTrackListener("ended", callback, { once: true });
  }

  addCurrentTrackListener("loadedmetadata", loadedMetadataHandler, {
    once: true,
  });
}

function trackWillFinishBeforeScheduled(trackDuration) {
  const state = getState();
  const now = getCurrentTime();
  
  // Use the first entry in upcomingScheduled ledger (already sorted by time)
  if (state.upcomingScheduled.length === 0) return true; // No scheduled tracks, safe to play
  
  const nextScheduledTime = state.upcomingScheduled[0].scheduledTime;
  const trackEndTime = new Date(now.getTime() + trackDuration * 1000);
  
  return trackEndTime <= nextScheduledTime;
}

function getAvailableAlgorithmicTracks(tracks, category, trackKey) {
  const state = getState();
  let availableTracks = tracks.filter(
    (track) => !state.usedAlgorithmicTracks[category][track.key || trackKey?.(track)]
  );

  if (availableTracks.length === 0) {
    clearUsedAlgorithmicTracksForCategory(category);
    availableTracks = tracks;
  }

  return availableTracks;
}

function filterTracksByDuration(tracks, fallbackAction) {
  const state = getState();
  
  if (state.preScheduledJunkOnly) {
    return tracks;
  }

  const durationsCheckedTracks = tracks.filter((track) => 
    trackWillFinishBeforeScheduled(track.duration)
  );
  
  if (durationsCheckedTracks.length > 0) {
    return durationsCheckedTracks;
  } else {
    console.log("No tracks will finish before scheduled content, playing junk");
    fallbackAction();
    return [];
  }
}

function selectAndPlayAlgorithmicTrack(tracks, category, errorMessage, fallbackTrackFunction) {
  if (tracks.length === 0) {
    console.error(errorMessage);
    if (fallbackTrackFunction) {
      return fallbackTrackFunction();
    }
    return;
  }

  const filteredTracks = filterTracksByDuration(tracks, playJunkTrack);
  if (filteredTracks.length === 0) return;

  const selectedTrack = filteredTracks[Math.floor(Math.random() * filteredTracks.length)];
  markAlgorithmicTrackUsed(category, selectedTrack.key);
  playTrack({ trackPath: selectedTrack.path, callback: playAlgorithmicTrack });
}

export function playAlgorithmicTrack() {
  const state = getState();

  // Check pre-scheduled warnings
  if (state.preScheduledJunkOnly) {
    return playJunkTrack();
  }

  // Play based on time slot
  switch (getAlgorithmicTimeSlot()) {
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
  const availableTracks = getAvailableAlgorithmicTracks(tracks, "lateNightLoFis");
  
  selectAndPlayAlgorithmicTrack(
    availableTracks, 
    "lateNightLoFis", 
    "No late night tracks available", 
    playStandardTrack
  );
}

export function playMorningTrack() {
  const state = getState();
  const now = getCurrentTime();
  const currentHour = now.getHours();
  const genre = state.morningGenres?.[currentHour];

  if (!genre) {
    console.error("No genre selected for morning hour", currentHour);
    return playStandardTrack();
  }

  const tracks = state.preprocessed.timeSlots.morning.genres[genre].tracks;
  const availableTracks = getAvailableAlgorithmicTracks(tracks, "morning");
  
  selectAndPlayAlgorithmicTrack(
    availableTracks, 
    "morning", 
    `No morning tracks available for genre: ${genre}`, 
    playStandardTrack
  );
}

export function playStandardTrack() {
  const state = getState();
  const tracks = state.preprocessed.timeSlots.standard.tracks;
  const availableTracks = getAvailableAlgorithmicTracks(tracks, "standard");
  
  selectAndPlayAlgorithmicTrack(
    availableTracks, 
    "standard", 
    "No standard tracks available"
  );
}

export function playJunkTrack() {
  const state = getState();
  const junkContent = state.preprocessed.junkContent;

  // Get current junk type from cycle
  let currentJunkType = state.junkCycleOrder[state.junkCycleIndex];

  // If we're in the 5-minute warning period, skip bumpers
  if (state.preScheduledNonBumperJunkOnly && currentJunkType === "bumpers") {
    // Move to next in cycle
    const nextIndex = (state.junkCycleIndex + 1) % state.junkCycleOrder.length;
    updateState({ junkCycleIndex: nextIndex });
    currentJunkType = state.junkCycleOrder[nextIndex];

    // If we've cycled through all and still hit bumpers, pick a non-bumper type
    if (currentJunkType === "bumpers") {
      const nonBumperTypes = Object.entries(junkContent.types)
        .filter(([_, typeData]) => typeData.nonBumper)
        .map(([type, _]) => type);
      currentJunkType =
        nonBumperTypes[Math.floor(Math.random() * nonBumperTypes.length)];
    }
  }

  const junkTypeData = junkContent.types[currentJunkType];
  if (!junkTypeData || junkTypeData.tracks.length === 0) {
    console.error("No junk tracks available for type:", currentJunkType);
    return;
  }

  // Filter out already used tracks for this specific junk type
  let availableTracks = junkTypeData.tracks.filter(
    (track) => !state.usedJunkTracksByType[currentJunkType]?.[track.key],
  );

  // If all tracks of this type have been used, reset usage for just this type
  if (availableTracks.length === 0) {
    clearUsedJunkTracksForType(currentJunkType);
    availableTracks = junkTypeData.tracks;
  }

  const selectedTrack =
    availableTracks[Math.floor(Math.random() * availableTracks.length)];

  // Mark track as used for this specific junk type
  markJunkTrackUsed(currentJunkType, selectedTrack.key);

  // Move to next junk type for next time
  const nextIndex = (state.junkCycleIndex + 1) % state.junkCycleOrder.length;
  updateState({ junkCycleIndex: nextIndex });

  playTrack({ trackPath: selectedTrack.path, callback: playAlgorithmicTrack });
}

export function fadeOut() {
  const state = getState();

  if (state.fadeOutInterval) return; // Prevent multiple fades

  const steps = 30;
  const originalVolume = state.theTransmitter.volume;
  const volumeStep = originalVolume / steps;
  let currentStep = 0;

  console.log("Fading out");

  const fadeOutInterval = setInterval(() => {
    currentStep++;
    state.theTransmitter.volume = Math.max(
      0,
      originalVolume - volumeStep * currentStep,
    );

    if (currentStep >= steps) {
      clearInterval(fadeOutInterval);
      updateState({ fadeOutInterval: null });
      state.theTransmitter.volume = originalVolume; // Reset volume for next track
    }
  }, state.fadeOutDuration / steps);

  updateState({ fadeOutInterval });
}
