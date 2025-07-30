/**
 * Audio player module
 * Handles track playback, selection logic, and audio control
 */

import {
  addCurrentTrackListener,
  addScheduledTrackListener,
  cleanupCurrentTrackListeners,
} from "./events.js";
import { checkAndSetPrescheduleJunkState } from "./scheduling.js";
import {
  clearUsedAlgorithmicTracksForCategory,
  clearUsedJunkTracksForType,
  getApplicationState,
  markAlgorithmicTrackUsed,
  markJunkTrackUsed,
  updateApplicationState,
  markScheduledFileUsed,
} from "./state.js";
import {
  getRandomStartTime,
  getAlgorithmicTimeSlot,
  getCurrentTime,
} from "./time.js";

/**
 * Play an audio track with specified parameters
 * @param {Object} options - Playback options
 * @param {string} options.trackPath - Path to the audio file
 * @param {Function} options.callback - Function to call when track ends
 * @param {number|null} options.startTime - Start position in seconds (null for auto)
 * @param {boolean} options.isScheduled - Whether this is a scheduled track
 */
export function playAudioTrack({
  trackPath,
  callback,
  startTime = null,
  isScheduled = false,
}) {
  const state = getApplicationState();

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
      updateApplicationState({ isFirstTrack: false });
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

/**
 * Check if a track will finish before the next scheduled content
 * @param {number} trackDuration - Duration of track in seconds
 * @returns {boolean} True if track will finish before scheduled content
 */
function trackWillFinishBeforeScheduled(trackDuration) {
  const state = getApplicationState();
  const now = getCurrentTime();

  // Use the first entry in upcomingScheduled ledger (already sorted by time)
  if (state.upcomingScheduled.length === 0) return true; // No scheduled tracks, safe to play

  const nextScheduledTime = state.upcomingScheduled[0].scheduledTime;
  const trackEndTime = new Date(now.getTime() + trackDuration * 1000);

  return trackEndTime <= nextScheduledTime;
}

/**
 * Get available algorithmic tracks, filtering out recently used ones
 * @param {Array} tracks - Array of track objects
 * @param {string} category - Track category for usage tracking
 * @param {Function} [trackKey] - Function to extract track key
 * @returns {Array} Available tracks for playback
 */
function getAvailableAlgorithmicTracks(tracks, category, trackKey) {
  const state = getApplicationState();
  let availableTracks = tracks.filter(
    (track) =>
      !state.usedAlgorithmicTracks[category][track.key || trackKey?.(track)],
  );

  if (availableTracks.length === 0) {
    clearUsedAlgorithmicTracksForCategory(category);
    availableTracks = tracks;
  }

  return availableTracks;
}

/**
 * Filter tracks by duration to ensure they finish before scheduled content
 * @param {Array} tracks - Array of track objects
 * @param {Function} fallbackAction - Action to take if no tracks fit
 * @returns {Array} Tracks that will finish before scheduled content
 */
function filterTracksByDuration(tracks, fallbackAction) {
  const state = getApplicationState();

  if (state.preScheduledJunkOnly) {
    return tracks;
  }

  // Skip duration checking during morning hours to maintain genre consistency
  const currentHour = getCurrentTime().getHours();
  const morningHours = state.preprocessed?.timeSlots?.morningHours;
  if (morningHours && morningHours.includes(currentHour)) {
    return tracks;
  }

  const durationsCheckedTracks = tracks.filter((track) =>
    trackWillFinishBeforeScheduled(track.duration),
  );

  if (durationsCheckedTracks.length > 0) {
    return durationsCheckedTracks;
  } else {
    console.log("No tracks will finish before scheduled content, playing junk");
    fallbackAction();
    return [];
  }
}

/**
 * Select and play an algorithmic track from available options
 * @param {Array} tracks - Available tracks to choose from
 * @param {string} category - Track category for usage tracking
 * @param {string} errorMessage - Error message if no tracks available
 * @param {Function} [fallbackTrackFunction] - Fallback function if no tracks
 */
function selectAndPlayAlgorithmicTrack(
  tracks,
  category,
  errorMessage,
  fallbackTrackFunction,
) {
  if (tracks.length === 0) {
    console.error(errorMessage);
    if (fallbackTrackFunction) {
      return fallbackTrackFunction();
    }
    return;
  }

  const filteredTracks = filterTracksByDuration(tracks, playJunkTrack);
  if (filteredTracks.length === 0) return;

  const selectedTrack =
    filteredTracks[Math.floor(Math.random() * filteredTracks.length)];
  markAlgorithmicTrackUsed(category, selectedTrack.key);
  playAudioTrack({
    trackPath: selectedTrack.path,
    callback: () => {
      // Check for preschedule junk state if in opportunistic mode
      const state = getApplicationState();
      if (state.capabilities?.opportunisticMode) {
        checkAndSetPrescheduleJunkState();
      }
      playAlgorithmicTrack();
    },
  });
}

/**
 * Play an algorithmic track based on current time slot
 * Selects appropriate track type (late night, morning, or standard)
 * Checks for opportunistic scheduled tracks first
 */
export function playAlgorithmicTrack() {
  const state = getApplicationState();

  // Check for opportunistic scheduled tracks first
  const opportunisticTrack = checkForOpportunisticScheduledTrack();
  if (opportunisticTrack) {
    return playOpportunisticScheduledTrack(opportunisticTrack);
  }

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

/**
 * Check if there's a scheduled track ready to play opportunistically
 * Only runs when in opportunistic mode
 * @returns {Object|null} Scheduled track object or null
 */
function checkForOpportunisticScheduledTrack() {
  const state = getApplicationState();

  // Only check for opportunistic tracks when in opportunistic mode
  if (!state.capabilities?.opportunisticMode) return null;

  const now = getCurrentTime();

  // Find any scheduled tracks that have passed their scheduled time
  const readyTracks = state.upcomingScheduled.filter((entry) => {
    return entry.scheduledTime <= now;
  });

  if (readyTracks.length === 0) return null;

  // Return the earliest scheduled track
  return readyTracks.sort((a, b) => a.scheduledTime - b.scheduledTime)[0];
}

/**
 * Play an opportunistic scheduled track
 * @param {Object} scheduledEntry - Scheduled track entry
 */
function playOpportunisticScheduledTrack(scheduledEntry) {
  const { track, scheduledTime } = scheduledEntry;
  const now = getCurrentTime();

  console.log(
    `Playing opportunistic scheduled track (${Math.round((now - scheduledTime) / 60000)} minutes after scheduled time)`,
  );

  updateApplicationState({
    isInScheduledMode: true,
    preScheduledJunkOnly: false,
    preScheduledNonBumperJunkOnly: false,
  });

  markScheduledFileUsed(track.trackKey, now);

  playAudioTrack({
    trackPath: track.trackData.path,
    startTime: 0,
    isScheduled: true,
  });
}

/**
 * Play a late night lo-fi track (00:00-05:00)
 */
export function playLateNightLoFi() {
  const state = getApplicationState();
  const tracks = state.preprocessed.timeSlots.lateNightLoFis.tracks;
  const availableTracks = getAvailableAlgorithmicTracks(
    tracks,
    "lateNightLoFis",
  );

  selectAndPlayAlgorithmicTrack(
    availableTracks,
    "lateNightLoFis",
    "No late night tracks available",
    playStandardTrack,
  );
}

/**
 * Play a morning track based on current hour's genre (05:00-08:00)
 */
export function playMorningTrack() {
  const state = getApplicationState();
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
    playStandardTrack,
  );
}

/**
 * Play a standard daytime track (08:00-23:59)
 */
export function playStandardTrack() {
  const state = getApplicationState();
  const tracks = state.preprocessed.timeSlots.standard.tracks;
  const availableTracks = getAvailableAlgorithmicTracks(tracks, "standard");

  selectAndPlayAlgorithmicTrack(
    availableTracks,
    "standard",
    "No standard tracks available",
  );
}

/**
 * Play junk content (ads, bumpers, scripture, interludes)
 * Cycles through different types and respects pre-scheduled restrictions
 */
export function playJunkTrack() {
  const state = getApplicationState();
  const junkContent = state.preprocessed.junkContent;

  // Get current junk type from cycle
  let currentJunkType = state.junkCycleOrder[state.junkCycleIndex];

  // If we're in the 5-minute warning period, skip bumpers
  if (state.preScheduledNonBumperJunkOnly && currentJunkType === "bumpers") {
    // Move to next in cycle
    const nextIndex = (state.junkCycleIndex + 1) % state.junkCycleOrder.length;
    updateApplicationState({ junkCycleIndex: nextIndex });
    currentJunkType = state.junkCycleOrder[nextIndex];

    // If we've cycled through all and still hit bumpers, pick a non-bumper type
    if (currentJunkType === "bumpers") {
      const nonBumperTypes =
        state.preprocessed.optimizations.nonBumperJunkTypes;
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
  updateApplicationState({ junkCycleIndex: nextIndex });

  playAudioTrack({
    trackPath: selectedTrack.path,
    callback: playAlgorithmicTrack,
  });
}

/**
 * Gradually fade out the current track over configured duration
 * Used before scheduled content to provide smooth transitions
 */
export function fadeOutCurrentTrack() {
  const state = getApplicationState();

  if (state.fadeOutInterval) return; // Prevent multiple fades

  // Check if fade effects are supported
  const fadeSupported = state.capabilities?.fadeSupported || false;

  if (!fadeSupported) {
    console.log("Fade not supported");
    return;
  }

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
      updateApplicationState({ fadeOutInterval: null });
      state.theTransmitter.volume = originalVolume; // Reset volume for next track
    }
  }, state.fadeOutDuration / steps);

  updateApplicationState({ fadeOutInterval });
}
