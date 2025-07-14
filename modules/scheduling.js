// Scheduling module for managing scheduled tracks

import { addScheduledTrackListener, cleanupCurrentTrackListeners, cleanupScheduledTrackListeners } from './events.js';
import { playAlgorithmicTrack } from './player.js';
import { getState, updateState } from './state.js';
import { getAlgorithmicTimeSlot, getCurrentTime, parseTimeString } from './time.js';

export function initializeScheduledSystem() {
  const now = getCurrentTime();
  const currentHour = now.getHours();

  // Schedule current and next hour blocks
  scheduleHourBlock(currentHour);
  scheduleHourBlock(currentHour + 1);

  // Schedule hourly updates
  scheduleNextHourUpdate();

  // Check for any currently playing scheduled track
  const activeTrack = getActiveScheduledTrack();
  if (activeTrack) {
    enterScheduledMode(activeTrack);
    return true;
  }

  return false;
}

export function getScheduledTrackTime(scheduledTrack, referenceDate = null) {
  // Validate input
  if (!scheduledTrack || !scheduledTrack.time) {
    console.warn('Invalid scheduled track or missing time property');
    return null;
  }

  const baseDate = referenceDate || getCurrentTime();
  const { hours, minutes, seconds } = parseTimeString(scheduledTrack.time);

  let scheduledDate = new Date(baseDate.getTime());
  scheduledDate.setHours(hours, minutes, seconds, 0);

  // Handle different recurrence types
  if (scheduledTrack.recurrence === 'daily') {
    // Daily tracks can play today or tomorrow
    const now = getCurrentTime();
    if (scheduledDate < now) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }
  } else if (scheduledTrack.recurrence && scheduledTrack.recurrence !== 'daily') {
    // Day of week scheduling
    const dayMap = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };
    const targetDay = dayMap[scheduledTrack.recurrence.toLowerCase()];
    const currentDay = scheduledDate.getDay();

    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget < 0 || (daysUntilTarget === 0 && scheduledDate < baseDate)) {
      daysUntilTarget += 7;
    }

    scheduledDate.setDate(scheduledDate.getDate() + daysUntilTarget);
  } else if (scheduledTrack.date) {
    // Handle date field
    const [year, month, day] = scheduledTrack.date.split('-').map(Number);
    scheduledDate = new Date(year, month - 1, day, hours, minutes, seconds);
  }

  return scheduledDate;
}

export function cleanupExpiredUsage() {
  const state = getState();
  const now = getCurrentTime();
  const twentyFourHoursAgo = now.getTime() - (24 * 60 * 60 * 1000);

  Object.keys(state.usedScheduledFiles).forEach(filePath => {
    if (state.usedScheduledFiles[filePath].getTime() < twentyFourHoursAgo) {
      delete state.usedScheduledFiles[filePath];
    }
  });
}

export function getActiveScheduledTrack() {
  const state = getState();
  const now = getCurrentTime();
  const currentHour = now.getHours();
  const hourlyTracks = state.preprocessed.scheduledTracks.byHour[currentHour] || [];

  const activeTracks = hourlyTracks.filter(track => {
    try {
      const trackData = track.trackData;

      if (!trackData || !trackData.duration) return false;

      // Skip if this file has been used in last 24 hours
      if (state.usedScheduledFiles[track.trackKey] &&
        now - state.usedScheduledFiles[track.trackKey] < 24 * 60 * 60 * 1000) {
        return false;
      }

      const scheduledTime = getScheduledTrackTime(track);
      const trackEndTime = new Date(scheduledTime.getTime() + trackData.duration * 1000);

      return now >= scheduledTime && now <= trackEndTime;
    } catch (error) {
      console.error('Error checking scheduled track:', track, error);
      return false;
    }
  });

  return selectTrackByHierarchy(activeTracks);
}

export function selectTrackByHierarchy(tracks) {
  if (tracks.length === 0) return null;
  if (tracks.length === 1) return tracks[0];

  // Filter by genre if we're in morning time slot
  const state = getState();
  const timeSlot = getAlgorithmicTimeSlot();
  let filteredTracks = tracks;

  if (timeSlot === 'morning' && state.currentMorningGenre) {
    const genreMatchedTracks = tracks.filter(track => {
      return track.genre === state.currentMorningGenre;
    });

    if (genreMatchedTracks.length > 0) {
      filteredTracks = genreMatchedTracks;
    }
  }

  // Use priority-based selection for preprocessed tracks
  const tracksByPriority = { 1: [], 2: [], 3: [] };
  filteredTracks.forEach(track => {
    tracksByPriority[track.priority].push(track);
  });

  // Priority: 1 (dates) > 2 (days) > 3 (daily)
  for (let priority = 1; priority <= 3; priority++) {
    if (tracksByPriority[priority].length > 0) {
      return tracksByPriority[priority][Math.floor(Math.random() * tracksByPriority[priority].length)];
    }
  }
}

export function returnToAlgorithmicPlayback() {
  updateState({ isInScheduledMode: false });
  const timeSlot = getAlgorithmicTimeSlot();
  updateState({ timeOfDay: timeSlot });

  playAlgorithmicTrack();
}

export function scheduleHourBlock(hour) {
  const state = getState();
  const now = getCurrentTime();

  // Clean up expired usage tracking but only if not already in a cleanup process
  if (!state.inCleanupProcess) {
    updateState({ inCleanupProcess: true });
    cleanupExpiredUsage();
    updateState({ inCleanupProcess: false });
  }

  const hourTracks = state.preprocessed.scheduledTracks.byHour[hour] || [];
  const filteredTracks = hourTracks.filter(track => {
    try {
      const trackData = track.trackData;
      if (!trackData) return false;

      // Skip if used in last 24 hours
      if (state.usedScheduledFiles[track.trackKey] &&
        now - state.usedScheduledFiles[track.trackKey] < 24 * 60 * 60 * 1000) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking track for hour block:', track, error);
      return false;
    }
  });

  // Apply hierarchy and sort by time
  const prioritizedTracks = selectTracksWithHierarchy(filteredTracks);
  prioritizedTracks.sort((a, b) => {
    const timeA = getScheduledTrackTime(a);
    const timeB = getScheduledTrackTime(b);
    return timeA - timeB;
  });

  // Create track chain with gap detection
  const trackChain = createTrackChain(prioritizedTracks);

  // Schedule timeouts for the chain
  scheduleTrackChain(trackChain);

  console.log(`Scheduled ${trackChain.length} tracks for hour ${hour}:00`);
}

export function selectTracksWithHierarchy(tracks) {
  // Group tracks by start time to handle overlaps
  const timeGroups = {};
  tracks.forEach(track => {
    const time = getScheduledTrackTime(track).getTime();
    if (!timeGroups[time]) timeGroups[time] = [];
    timeGroups[time].push(track);
  });

  // Select one track per time slot using hierarchy
  return Object.values(timeGroups).map(group => selectTrackByHierarchy(group)).filter(Boolean);
}

export function createTrackChain(tracks) {
  const state = getState();
  if (tracks.length === 0) return [];

  const chain = [];
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const trackData = track.trackData;
    const filename = trackData.filename;

    const startTime = getScheduledTrackTime(track);
    const endTime = new Date(startTime.getTime() + trackData.duration * 1000);

    const chainItem = {
      track,
      startTime,
      endTime,
      isChained: false
    };

    // Check if this track should be chained to the previous one
    if (i > 0) {
      const prevItem = chain[chain.length - 1];
      const gap = (startTime - prevItem.endTime) / 1000; // gap in seconds

      if (gap <= state.chainGapThreshold && gap >= 0) {
        chainItem.isChained = true;
        chainItem.chainedStartTime = prevItem.endTime;
        console.log(`Chaining ${filename} (${gap}s gap)`);
      }
    }

    chain.push(chainItem);
  }

  return chain;
}

export function scheduleTrackChain(chain) {
  const state = getState();
  chain.forEach((chainItem) => {
    const { track, startTime, isChained, chainedStartTime } = chainItem;
    const actualStartTime = isChained ? chainedStartTime : startTime;
    const now = getCurrentTime();

    if (actualStartTime <= now) return; // Skip past times

    const timeUntilStart = actualStartTime - now;
    const timeUntilFade = timeUntilStart - state.fadeOutDuration;
    const timeUntil15Min = timeUntilStart - (15 * 60 * 1000); // 15 minutes before
    const timeUntil5Min = timeUntilStart - (5 * 60 * 1000); // 5 minutes before

    // Schedule 15-minute warning
    if (timeUntil15Min > 0) {
      const warning15Timeout = setTimeout(() => {
        console.log('15-minute warning: switching to junk-only mode');
        updateState({ preScheduledJunkOnly: true });
      }, timeUntil15Min);

      state.scheduledTimeouts.push(warning15Timeout);
    }

    // Schedule 5-minute warning
    if (timeUntil5Min > 0) {
      const warning5Timeout = setTimeout(() => {
        console.log('5-minute warning: switching to non-bumper junk-only mode');
        updateState({ preScheduledNonBumperJunkOnly: true });
      }, timeUntil5Min);

      state.scheduledTimeouts.push(warning5Timeout);
    }

    // Schedule fade (if not chained)
    if (!isChained && timeUntilFade > 0) {
      const fadeTimeout = setTimeout(() => {
        if (!state.isInScheduledMode) {
          // Import fadeOut dynamically to avoid circular dependencies
          import('./player.js').then(({ fadeOut }) => {
            fadeOut();
          });
        }
      }, timeUntilFade);

      state.scheduledTimeouts.push(fadeTimeout);
    }

    // Schedule track start
    const startTimeout = setTimeout(() => {
      onScheduledTrackTimeout(track, isChained);
    }, timeUntilStart);

    state.scheduledTimeouts.push(startTimeout);
  });
}

export function onScheduledTrackTimeout(track, isChained) {
  const state = getState();
  if (isChained || state.isInScheduledMode) {
    // Direct play for chained tracks or when already in scheduled mode
    playScheduledTrackDirect(track);
  } else {
    // Should have been faded already, but play directly if not
    enterScheduledMode(track);
  }
}

export function scheduleNextHourUpdate() {
  const now = getCurrentTime();
  const nextHour = new Date(now.getTime());
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  const timeUntilNextHour = nextHour - now;

  const hourlyScheduleTimeout = setTimeout(() => {
    const currentHour = getCurrentTime().getHours();
    scheduleHourBlock(currentHour + 1); // Schedule the hour after next
    scheduleNextHourUpdate(); // Schedule next update
  }, timeUntilNextHour);

  updateState({ hourlyScheduleTimeout });
}

export function clearAllScheduledTimeouts() {
  const state = getState();
  state.scheduledTimeouts.forEach(timeout => clearTimeout(timeout));
  state.scheduledTimeouts = [];
}

export function enterScheduledMode(track) {
  const state = getState();
  updateState({
    isInScheduledMode: true,
    currentScheduledTrack: track
  });

  const trackData = track.trackData;
  const scheduledTime = getScheduledTrackTime(track);
  const now = getCurrentTime();
  const offsetSeconds = Math.max(0, (now - scheduledTime) / 1000);

  if (offsetSeconds >= trackData.duration) {
    console.log('Scheduled track would be finished, returning to algorithmic playback');
    returnToAlgorithmicPlayback();
    return;
  }

  console.log(`Entering scheduled mode: ${trackData.filename} (offset: ${offsetSeconds.toFixed(1)}s)`);
  state.usedScheduledFiles[track.trackKey] = now;

  // Clean up any existing current track listeners first
  cleanupCurrentTrackListeners();

  state.theTransmitter.src = trackData.path;
  state.theTransmitter.currentTime = 0;

  const loadedMetadataHandler = () => {
    state.theTransmitter.currentTime = Math.min(offsetSeconds, state.theTransmitter.duration - 1);
    state.theTransmitter.play();
  };

  const errorHandler = () => {
    console.error('Error playing scheduled track:', trackData.filename);
    returnToAlgorithmicPlayback();
  };

  addScheduledTrackListener("loadedmetadata", loadedMetadataHandler, { once: true });
  addScheduledTrackListener("ended", onScheduledTrackEnd, { once: true });
  addScheduledTrackListener("error", errorHandler, { once: true });
}

export function playScheduledTrackDirect(track) {
  const state = getState();
  updateState({ currentScheduledTrack: track });

  const trackData = track.trackData;
  const now = getCurrentTime();

  console.log(`Playing chained scheduled track: ${trackData.filename}`);
  state.usedScheduledFiles[track.trackKey] = now;

  // Clean up any existing current track listeners first
  cleanupCurrentTrackListeners();

  state.theTransmitter.src = trackData.path;
  state.theTransmitter.currentTime = 0;

  const loadedMetadataHandler = () => {
    state.theTransmitter.play();
  };

  const errorHandler = () => {
    console.error('Error playing scheduled track:', trackData.filename);
    returnToAlgorithmicPlayback();
  };

  addScheduledTrackListener("loadedmetadata", loadedMetadataHandler, { once: true });
  addScheduledTrackListener("ended", onScheduledTrackEnd, { once: true });
  addScheduledTrackListener("error", errorHandler, { once: true });
}

export function onScheduledTrackEnd() {
  updateState({
    currentScheduledTrack: null,
    preScheduledJunkOnly: false,
    preScheduledNonBumperJunkOnly: false
  });
  cleanupScheduledTrackListeners();
  returnToAlgorithmicPlayback();
}
