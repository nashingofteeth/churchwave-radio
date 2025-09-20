/**
 * Scheduled content management module
 * Handles time-based scheduled tracks, morning genres, and preschedule warnings
 */

import { cleanupScheduledTrackListeners } from "./events.js";
import { playAlgorithmicTrack, playAudioTrack } from "./player.js";
import {
  getApplicationState,
  markScheduledFileUsed,
  clearUsedAlgorithmicTracks,
  clearUsedJunkTracks,
  updateApplicationState,
  removeFromUpcomingScheduled,
} from "./state.js";
import {
  getAlgorithmicTimeSlot,
  getCurrentTime,
  parseTimeString,
} from "./time.js";

/**
 * Initialize the complete scheduled content system
 * Sets up hourly scheduling, morning genres, and preschedule warnings
 */
export function startScheduledSystem() {
  const currentTime = getCurrentTime();
  const currentHour = currentTime.getHours();

  setMorningGenres();

  scheduleTracksForHour(currentHour);
  scheduleTracksForHour((currentHour + 1) % 24);

  scheduleHourlyUpdates();
  scheduleDailyMorningGenreUpdate();

  checkAndSetPrescheduleJunkState();
}

export function getScheduledTrackTime(scheduledTrack, referenceDate = null) {
  // Validate input
  if (!scheduledTrack || !scheduledTrack.time) {
    console.warn("Invalid scheduled track or missing time property");
    return null;
  }

  const baseDate = referenceDate || getCurrentTime();
  const { hours, minutes, seconds } = parseTimeString(scheduledTrack.time);

  let startDate = new Date(baseDate.getTime());
  startDate.setHours(hours, minutes, seconds, 0);
  const endDate = new Date(
    startDate.getTime() + scheduledTrack.trackData.duration * 1000,
  );

  // Handle different recurrence types
  if (scheduledTrack.recurrence === "daily") {
    // Daily tracks can play today or tomorrow
    const now = getCurrentTime();
    if (endDate < now) {
      startDate.setDate(startDate.getDate() + 1);
    }
  } else if (
    scheduledTrack.recurrence &&
    scheduledTrack.recurrence !== "daily"
  ) {
    // Day of week scheduling
    const dayMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    const targetDay = dayMap[scheduledTrack.recurrence.toLowerCase()];
    const currentDay = startDate.getDay();

    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget < 0 || (daysUntilTarget === 0 && endDate < baseDate)) {
      daysUntilTarget += 7;
    }

    startDate.setDate(startDate.getDate() + daysUntilTarget);
  } else if (scheduledTrack.date) {
    // Handle date field
    const [year, month, day] = scheduledTrack.date.split("-").map(Number);
    startDate = new Date(year, month - 1, day, hours, minutes, seconds);
  }

  return startDate;
}

export function clearOldUsedScheduledTracks() {
  const state = getApplicationState();
  const now = getCurrentTime();
  const twentyFourHoursAgo = now.getTime() - 24 * 60 * 60 * 1000;

  const cleanedUsedScheduledFiles = {};
  Object.keys(state.usedScheduledFiles).forEach((filePath) => {
    if (state.usedScheduledFiles[filePath].getTime() >= twentyFourHoursAgo) {
      cleanedUsedScheduledFiles[filePath] = state.usedScheduledFiles[filePath];
    }
  });

  updateApplicationState({ usedScheduledFiles: cleanedUsedScheduledFiles });
}

export function clearUsedScheduledTracks() {
  updateApplicationState({ usedScheduledFiles: {} });
}

export function getActiveScheduledTrack() {
  const state = getApplicationState();
  const now = getCurrentTime();
  const currentHour = now.getHours();
  const hourlyTracks =
    state.preprocessed.scheduledTracks.byHour[currentHour] || [];

  const activeTracks = hourlyTracks.filter((track) => {
    try {
      const trackData = track.trackData;

      if (!trackData || !trackData.duration) return false;

      // Skip if this file has been used in last 24 hours
      if (
        state.usedScheduledFiles[track.trackKey] &&
        now - state.usedScheduledFiles[track.trackKey] < 24 * 60 * 60 * 1000
      ) {
        return false;
      }

      const scheduledTime = getScheduledTrackTime(track);
      const trackEndTime = new Date(
        scheduledTime.getTime() + trackData.duration * 1000,
      );

      return now >= scheduledTime && now <= trackEndTime;
    } catch (error) {
      console.error("Error checking scheduled track:", track, error);
      return false;
    }
  });

  return selectTrackByHierarchy(activeTracks);
}

export function selectTrackByHierarchy(tracks, scheduledHour = null) {
  if (tracks.length === 0) return null;
  if (tracks.length === 1) return tracks[0];

  // Filter by genre if we're in morning time slot
  const state = getApplicationState();
  const hourToCheck =
    scheduledHour !== null ? scheduledHour : getCurrentTime().getHours();
  const timeSlot = getAlgorithmicTimeSlot(hourToCheck);
  let filteredTracks = tracks;

  if (timeSlot === "morning" && state.morningGenres) {
    const morningGenre = state.morningGenres[hourToCheck];

    if (morningGenre) {
      const genreMatchedTracks = tracks.filter((track) => {
        return track.genre === morningGenre;
      });

      if (genreMatchedTracks.length > 0) {
        filteredTracks = genreMatchedTracks;
      }
    }
  }

  // Use priority-based selection for preprocessed tracks
  const tracksByPriority = { 1: [], 2: [], 3: [] };
  filteredTracks.forEach((track) => {
    tracksByPriority[track.priority].push(track);
  });

  // Priority: 1 (dates) > 2 (days) > 3 (daily)
  for (let priority = 1; priority <= 3; priority++) {
    if (tracksByPriority[priority].length > 0) {
      return tracksByPriority[priority][
        Math.floor(Math.random() * tracksByPriority[priority].length)
      ];
    }
  }
}

export function returnToAlgorithmicPlayback() {
  console.log("Leaving scheduled mode");
  updateApplicationState({ isInScheduledMode: false });
  playAlgorithmicTrack();
}

/**
 * Schedule all valid tracks for a specific hour
 * @param {number} hour - Hour to schedule tracks for (0-23)
 */
export function scheduleTracksForHour(hour) {
  const state = getApplicationState();
  const now = getCurrentTime();

  const hourTracks = state.preprocessed.scheduledTracks.byHour[hour] || [];
  const filteredTracks = hourTracks.filter((track) => {
    try {
      const trackData = track.trackData;
      if (!trackData) return false;

      // Skip if used in last 24 hours
      if (
        state.usedScheduledFiles[track.trackKey] &&
        now - state.usedScheduledFiles[track.trackKey] < 24 * 60 * 60 * 1000
      ) {
        return false;
      }

      // Check if scheduled time has passed for today
      const { hours, minutes, seconds } = parseTimeString(track.time);
      const todayScheduledTime = new Date(now.getTime());
      todayScheduledTime.setHours(hours, minutes, seconds, 0);

      // If we're scheduling hour 0 and it's not midnight, we need to check tomorrow's date
      if (hour === 0 && now.getHours() !== 0) {
        todayScheduledTime.setDate(todayScheduledTime.getDate() + 1);
      }

      // Skip if the scheduled time has already passed today
      if (todayScheduledTime < now) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error checking track for hour block:", track, error);
      return false;
    }
  });

  // Apply hierarchy and sort by time
  const prioritizedTracks = selectTracksWithHierarchy(filteredTracks);

  // Cache scheduled times to avoid redundant calculations
  const tracksWithTimes = prioritizedTracks.map((track) => ({
    track,
    scheduledTime: getScheduledTrackTime(track),
  }));

  tracksWithTimes.sort((a, b) => a.scheduledTime - b.scheduledTime);
  const sortedTracks = tracksWithTimes.map((item) => item.track);

  // Schedule individual tracks
  scheduleTracks(sortedTracks);

  console.log(`Scheduled ${sortedTracks.length} tracks for hour ${hour}`);
}

export function selectTracksWithHierarchy(tracks) {
  // Group tracks by start time to handle overlaps
  const timeGroups = {};
  const trackTimeCache = new Map();

  tracks.forEach((track) => {
    const scheduledTime = getScheduledTrackTime(track);
    trackTimeCache.set(track, scheduledTime);

    const time = scheduledTime.getTime();
    if (!timeGroups[time]) timeGroups[time] = [];
    timeGroups[time].push(track);
  });

  // Select one track per time slot using hierarchy
  return Object.values(timeGroups)
    .map((group) => {
      const scheduledTime = trackTimeCache.get(group[0]);
      const scheduledHour = scheduledTime.getHours();
      return selectTrackByHierarchy(group, scheduledHour);
    })
    .filter(Boolean);
}

export function scheduleTracks(tracks) {
  const state = getApplicationState();

  // Check if we should use opportunistic scheduling
  const useOpportunistic = state.capabilities?.opportunisticMode || false;

  if (useOpportunistic) {
    scheduleTracksOpportunistic(tracks);
  } else {
    scheduleTracksPrecise(tracks);
  }
}

/**
 * Precise scheduling using setTimeout
 * Used when setTimeout is reliable and fade is supported
 */
function scheduleTracksPrecise(tracks) {
  const state = getApplicationState();
  const newTimeouts = [];
  const newUpcomingScheduled = [];

  tracks.forEach((track) => {
    const startTime = getScheduledTrackTime(track);
    const now = getCurrentTime();

    if (startTime <= now) return; // Skip past times

    // Add to upcoming scheduled ledger
    newUpcomingScheduled.push({ track, scheduledTime: startTime });

    // Check if this track is scheduled during morning hours
    const scheduledHour = startTime.getHours();
    const morningHours = state.preprocessed?.timeSlots?.morningHours;
    const isDuringMorningHours =
      morningHours && morningHours.includes(scheduledHour);

    const timeUntilStart = startTime - now;
    const timeUntilFade = timeUntilStart - state.fadeOutDuration;
    const timeUntil15Min = timeUntilStart - 15 * 60 * 1000; // 15 minutes before
    const timeUntil5Min = timeUntilStart - 5 * 60 * 1000; // 5 minutes before

    // Skip warning timeouts for tracks scheduled during morning hours
    if (!isDuringMorningHours) {
      // Schedule 15-minute warning
      if (timeUntil15Min > 0) {
        const warning15Timeout = setTimeout(() => {
          console.log("15-minute warning: switching to junk-only mode");
          updateApplicationState({ preScheduledJunkOnly: true });
        }, timeUntil15Min);

        newTimeouts.push(warning15Timeout);
      }

      // Schedule 5-minute warning
      if (timeUntil5Min > 0) {
        const warning5Timeout = setTimeout(() => {
          console.log(
            "5-minute warning: switching to non-bumper junk-only mode",
          );
          updateApplicationState({ preScheduledNonBumperJunkOnly: true });
        }, timeUntil5Min);

        newTimeouts.push(warning5Timeout);
      }
    }

    // Schedule fade
    if (timeUntilFade > 0) {
      const fadeTimeout = setTimeout(() => {
        if (!state.isInScheduledMode && !state.theTransmitter.paused) {
          // Import fadeOut dynamically to avoid circular dependencies
          import("./player.js").then(({ fadeOutCurrentTrack }) => {
            fadeOutCurrentTrack();
          });
        }
      }, timeUntilFade);

      newTimeouts.push(fadeTimeout);
    }

    // Schedule track start
    const startTimeout = setTimeout(() => {
      enterScheduledMode(track);
    }, timeUntilStart);

    newTimeouts.push(startTimeout);
  });

  // Sort upcoming scheduled tracks by time and add to existing ledger
  const combinedUpcoming = [
    ...state.upcomingScheduled,
    ...newUpcomingScheduled,
  ].sort((a, b) => a.scheduledTime - b.scheduledTime);

  // Add all timeouts and update ledger atomically
  updateApplicationState({
    scheduledTimeouts: [...state.scheduledTimeouts, ...newTimeouts],
    upcomingScheduled: combinedUpcoming,
  });
}

/**
 * Opportunistic scheduling for mobile/unreliable environments
 * Tracks are queued but played at the end of current tracks instead of exact times
 */
function scheduleTracksOpportunistic(tracks) {
  const state = getApplicationState();
  const newUpcomingScheduled = [];

  tracks.forEach((track) => {
    const startTime = getScheduledTrackTime(track);
    const now = getCurrentTime();

    if (startTime <= now) return; // Skip past times

    // Add to upcoming scheduled ledger
    newUpcomingScheduled.push({ track, scheduledTime: startTime });
  });

  // Sort upcoming scheduled tracks by time and add to existing ledger
  const combinedUpcoming = [
    ...state.upcomingScheduled,
    ...newUpcomingScheduled,
  ].sort((a, b) => a.scheduledTime - b.scheduledTime);

  updateApplicationState({
    upcomingScheduled: combinedUpcoming,
  });
}

export function checkAndSetPrescheduleJunkState() {
  const state = getApplicationState();

  // Early return if no scheduled tracks
  if (state.upcomingScheduled.length === 0) return;

  const now = getCurrentTime();
  const currentHour = now.getHours();

  // Check if we're in morning hours - skip prescheduled junk during this time
  const morningHours = state.preprocessed?.timeSlots?.morningHours;
  if (morningHours && morningHours.includes(currentHour)) {
    return;
  }

  const nextTrackTime = state.upcomingScheduled[0].scheduledTime;
  const minutesUntilTrack = (nextTrackTime - now) / 60000;

  // Early return if outside preschedule range
  if (minutesUntilTrack > 15 || minutesUntilTrack <= 0) return;

  if (minutesUntilTrack > 5) {
    // 15-minute range
    if (!state.preScheduledJunkOnly) {
      console.log(
        `Currently in 15-minute preschedule range (${minutesUntilTrack.toFixed(1)} minutes until scheduled track)`,
      );
      updateApplicationState({ preScheduledJunkOnly: true });
    }
  } else {
    // 5-minute range
    if (!state.preScheduledNonBumperJunkOnly) {
      console.log(
        `Currently in 5-minute preschedule range (${minutesUntilTrack.toFixed(1)} minutes until scheduled track)`,
      );
      updateApplicationState({
        preScheduledJunkOnly: true,
        preScheduledNonBumperJunkOnly: true,
      });
    }
  }
}

export function scheduleHourlyUpdates() {
  const state = getApplicationState();
  const now = getCurrentTime();
  const nextHour = new Date(now.getTime());
  nextHour.setHours(nextHour.getHours() + 1, 0, 5, 0); // Add 5 second buffer
  const timeUntilNextHour = nextHour - now;

  // Clear any existing hourly timeout
  if (state.hourlyScheduleTimeout) {
    clearTimeout(state.hourlyScheduleTimeout);
  }

  const hourlyScheduleTimeout = setTimeout(() => {
    performHourlyTasks(nextHour.getHours());
    scheduleHourlyUpdates(); // Schedule next update
  }, timeUntilNextHour);

  updateApplicationState({ hourlyScheduleTimeout });
}

export function scheduleDailyMorningGenreUpdate() {
  const state = getApplicationState();
  const now = getCurrentTime();
  const nextFourAm = new Date(now.getTime());

  // Set to next 4am
  nextFourAm.setHours(4, 0, 5, 0); // 4am. Add 5 second buffer

  // If it's already 4am or later today, schedule for tomorrow
  if (now.getHours() >= 4 || nextFourAm <= now) {
    nextFourAm.setDate(nextFourAm.getDate() + 1);
  }

  const timeUntilFourAm = nextFourAm - now;

  // Clear any existing daily timeout
  if (state.dailyMorningGenreTimeout) {
    clearTimeout(state.dailyMorningGenreTimeout);
  }

  const dailyMorningGenreTimeout = setTimeout(() => {
    console.log("Daily morning genre update");
    setMorningGenres();
    scheduleDailyMorningGenreUpdate(); // Schedule next update
  }, timeUntilFourAm);

  updateApplicationState({ dailyMorningGenreTimeout });
}

export function performHourlyTasks(currentHour) {
  console.log("Performing hourly tasks");

  // Clean up expired usage tracking
  clearOldUsedScheduledTracks();

  // Clear used algorithmic tracks
  clearUsedAlgorithmicTracks();

  // Clear used junk tracks
  clearUsedJunkTracks();

  // Schedule next hour block of tracks
  scheduleTracksForHour((currentHour + 1) % 24);
}

export function shuffleJunkCycleOrder() {
  const state = getApplicationState();
  if (!state.preprocessed?.junkContent?.cycleOrder) {
    console.warn("No junk cycle order found to shuffle");
    return;
  }

  const shuffled = [...state.preprocessed.junkContent.cycleOrder].sort(
    () => Math.random() - 0.5,
  );
  updateApplicationState({
    junkCycleOrder: shuffled,
    junkCycleIndex: 0,
  });
}

export function setMorningGenres() {
  const state = getApplicationState();

  if (!state.preprocessed?.optimizations?.availableGenres) {
    console.warn("No genres available in tracks data");
    return;
  }

  // Use pre-computed morning hours and available genres
  const hours = state.preprocessed.timeSlots.morningHours;
  const genres = state.preprocessed.optimizations.availableGenres;
  const morningGenres = {};

  hours.forEach((hour) => {
    const selectedGenre = genres[Math.floor(Math.random() * genres.length)];
    morningGenres[hour] = selectedGenre;
  });

  updateApplicationState({
    morningGenres,
  });
}

export function clearAllScheduledTimeouts() {
  const state = getApplicationState();
  state.scheduledTimeouts.forEach((timeout) => clearTimeout(timeout));

  if (state.hourlyScheduleTimeout) {
    clearTimeout(state.hourlyScheduleTimeout);
  }

  if (state.dailyMorningGenreTimeout) {
    clearTimeout(state.dailyMorningGenreTimeout);
  }

  updateApplicationState({
    scheduledTimeouts: [],
    hourlyScheduleTimeout: null,
    dailyMorningGenreTimeout: null,
    upcomingScheduled: [],
  });
}

export function enterScheduledMode(track) {
  const state = getApplicationState();

  if (state.theTransmitter.paused && !state.isFirstTrack) {
    console.log("Player paused, skipping scheduled track");

    removeFromUpcomingScheduled(track.trackKey);

    updateApplicationState({
      preScheduledJunkOnly: false,
      preScheduledNonBumperJunkOnly: false,
    });

    return;
  }

  if (state.isInScheduledMode) {
    console.log("Already in scheduled mode, skipping scheduled track");
    return;
  }

  const trackData = track.trackData;
  const scheduledTime = getScheduledTrackTime(track);
  const now = getCurrentTime();
  const offsetSeconds = Math.max(0, (now - scheduledTime) / 1000);

  if (offsetSeconds >= trackData.duration) {
    console.log(
      "Scheduled track would be finished, returning to algorithmic playback",
    );

    removeFromUpcomingScheduled(track.trackKey);

    updateApplicationState({
      preScheduledJunkOnly: false,
      preScheduledNonBumperJunkOnly: false,
    });

    returnToAlgorithmicPlayback();
    return;
  }

  console.log("Entering scheduled mode");

  updateApplicationState({
    isInScheduledMode: true,
    preScheduledJunkOnly: false,
    preScheduledNonBumperJunkOnly: false,
  });

  markScheduledFileUsed(track.trackKey, now);

  playAudioTrack({
    trackPath: trackData.path,
    startTime: offsetSeconds,
    isScheduled: true,
  });
}

export function onScheduledTrackEnd() {
  // Shuffle junk order
  shuffleJunkCycleOrder();

  // Clean up any remaining player listeners
  cleanupScheduledTrackListeners();

  // Check if we need to enter pre-scheduled junk range immediately
  checkAndSetPrescheduleJunkState();

  returnToAlgorithmicPlayback();
}
