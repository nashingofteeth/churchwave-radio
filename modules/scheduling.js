// Scheduling module for managing scheduled tracks

import { cleanupScheduledTrackListeners } from "./events.js";
import { playAlgorithmicTrack, playTrack } from "./player.js";
import {
  getState,
  markScheduledFileUsed,
  clearUsedAlgorithmicTracks,
  clearUsedJunkTracks,
  updateState,
} from "./state.js";
import {
  getAlgorithmicTimeSlot,
  getCurrentTime,
  parseTimeString,
} from "./time.js";

export function startScheduledSystem() {
  const now = getCurrentTime();
  const currentHour = now.getHours();

  // Set initial morning genres
  setMorningGenres();

  // Check if we're currently in a preschedule range
  checkAndSetPrescheduleJunkState();

  // Schedule current and next hour blocks
  scheduleHourBlock(currentHour);
  scheduleHourBlock((currentHour + 1) % 24);

  // Schedule hourly updates
  scheduleHourlyUpdates();

  // Schedule daily morning genre updates
  scheduleDailyMorningGenreUpdate();
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
  const state = getState();
  const now = getCurrentTime();
  const twentyFourHoursAgo = now.getTime() - 24 * 60 * 60 * 1000;

  const cleanedUsedScheduledFiles = {};
  Object.keys(state.usedScheduledFiles).forEach((filePath) => {
    if (state.usedScheduledFiles[filePath].getTime() >= twentyFourHoursAgo) {
      cleanedUsedScheduledFiles[filePath] = state.usedScheduledFiles[filePath];
    }
  });

  updateState({ usedScheduledFiles: cleanedUsedScheduledFiles });
}

export function clearUsedScheduledTracks() {
  updateState({ usedScheduledFiles: {} });
}

export function getActiveScheduledTrack() {
  const state = getState();
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
  const state = getState();
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
  updateState({ isInScheduledMode: false });
  playAlgorithmicTrack();
}

export function scheduleHourBlock(hour) {
  const state = getState();
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
  prioritizedTracks.sort((a, b) => {
    const timeA = getScheduledTrackTime(a);
    const timeB = getScheduledTrackTime(b);
    return timeA - timeB;
  });

  // Schedule individual tracks
  scheduleTracks(prioritizedTracks);

  console.log(`Scheduled ${prioritizedTracks.length} tracks for hour ${hour}`);
}

export function selectTracksWithHierarchy(tracks) {
  // Group tracks by start time to handle overlaps
  const timeGroups = {};
  tracks.forEach((track) => {
    const time = getScheduledTrackTime(track).getTime();
    if (!timeGroups[time]) timeGroups[time] = [];
    timeGroups[time].push(track);
  });

  // Select one track per time slot using hierarchy
  return Object.values(timeGroups)
    .map((group) => {
      const scheduledTime = getScheduledTrackTime(group[0]);
      const scheduledHour = scheduledTime.getHours();
      return selectTrackByHierarchy(group, scheduledHour);
    })
    .filter(Boolean);
}

export function scheduleTracks(tracks) {
  const state = getState();
  const newTimeouts = [];

  tracks.forEach((track) => {
    const startTime = getScheduledTrackTime(track);
    const now = getCurrentTime();

    if (startTime <= now) return; // Skip past times

    const timeUntilStart = startTime - now;
    const timeUntilFade = timeUntilStart - state.fadeOutDuration;
    const timeUntil15Min = timeUntilStart - 15 * 60 * 1000; // 15 minutes before
    const timeUntil5Min = timeUntilStart - 5 * 60 * 1000; // 5 minutes before

    // Schedule 15-minute warning
    if (timeUntil15Min > 0) {
      const warning15Timeout = setTimeout(() => {
        console.log("15-minute warning: switching to junk-only mode");
        updateState({ preScheduledJunkOnly: true });
      }, timeUntil15Min);

      newTimeouts.push(warning15Timeout);
    }

    // Schedule 5-minute warning
    if (timeUntil5Min > 0) {
      const warning5Timeout = setTimeout(() => {
        console.log("5-minute warning: switching to non-bumper junk-only mode");
        updateState({ preScheduledNonBumperJunkOnly: true });
      }, timeUntil5Min);

      newTimeouts.push(warning5Timeout);
    }

    // Schedule fade
    if (timeUntilFade > 0) {
      const fadeTimeout = setTimeout(() => {
        if (!state.isInScheduledMode && !state.theTransmitter.paused) {
          // Import fadeOut dynamically to avoid circular dependencies
          import("./player.js").then(({ fadeOut }) => {
            fadeOut();
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

  // Add all timeouts atomically
  updateState({
    scheduledTimeouts: [...state.scheduledTimeouts, ...newTimeouts],
  });
}

export function checkAndSetPrescheduleJunkState() {
  const state = getState();
  const now = getCurrentTime();
  const currentHour = now.getHours();
  const nextHour = (currentHour + 1) % 24;

  // Collect tracks from current and next hour
  const currentHourTracks =
    state.preprocessed.scheduledTracks.byHour[currentHour] || [];
  const nextHourTracks =
    state.preprocessed.scheduledTracks.byHour[nextHour] || [];
  const allTracks = [...currentHourTracks, ...nextHourTracks];

  // Find next scheduled track across both hours
  const upcomingTracks = allTracks
    .filter((track) => {
      const scheduledTime = getScheduledTrackTime(track);
      return scheduledTime > now;
    })
    .sort((a, b) => {
      const timeA = getScheduledTrackTime(a);
      const timeB = getScheduledTrackTime(b);
      return timeA - timeB;
    });

  if (upcomingTracks.length === 0) return;

  const nextTrack = upcomingTracks[0];
  const nextTrackTime = getScheduledTrackTime(nextTrack);
  const timeUntilTrack = nextTrackTime - now;
  const minutesUntilTrack = timeUntilTrack / (60 * 1000);

  if (minutesUntilTrack <= 15 && minutesUntilTrack > 5) {
    console.log(
      `Currently in 15-minute preschedule range (${minutesUntilTrack.toFixed(1)} minutes until scheduled track)`,
    );
    updateState({ preScheduledJunkOnly: true });
  } else if (minutesUntilTrack <= 5 && minutesUntilTrack > 0) {
    console.log(
      `Currently in 5-minute preschedule range (${minutesUntilTrack.toFixed(1)} minutes until scheduled track)`,
    );
    updateState({
      preScheduledJunkOnly: true,
      preScheduledNonBumperJunkOnly: true,
    });
  }
}

export function scheduleHourlyUpdates() {
  const state = getState();
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

  updateState({ hourlyScheduleTimeout });
}

export function scheduleDailyMorningGenreUpdate() {
  const state = getState();
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

  updateState({ dailyMorningGenreTimeout });
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
  scheduleHourBlock((currentHour + 1) % 24);
}

export function shuffleJunkCycleOrder() {
  const state = getState();
  if (!state.preprocessed?.junkContent?.cycleOrder) {
    console.warn("No junk cycle order found to shuffle");
    return;
  }

  const shuffled = [...state.preprocessed.junkContent.cycleOrder].sort(
    () => Math.random() - 0.5,
  );
  updateState({
    junkCycleOrder: shuffled,
    junkCycleIndex: 0,
  });
}

export function setMorningGenres() {
  const state = getState();

  if (!state.config.genres) {
    console.warn("No genres configured");
    return;
  }

  // Get morning time slot configuration
  const algorithmicTimeSlots =
    state.config.directories.algorithmic.subdirectories;
  const morningSlot = algorithmicTimeSlots.morning;

  if (!morningSlot || !morningSlot.startTime || !morningSlot.endTime) {
    console.warn("Morning time slot not properly configured");
    return;
  }

  const startTime = parseTimeString(morningSlot.startTime);
  const endTime = parseTimeString(morningSlot.endTime);

  // Calculate morning hours
  const morningHours = [];
  let currentHour = startTime.hours;

  // Handle time slots that cross midnight
  if (startTime.hours > endTime.hours) {
    // From start hour to 23
    while (currentHour <= 23) {
      morningHours.push(currentHour);
      currentHour++;
    }
    // From 0 to end hour
    currentHour = 0;
    while (currentHour < endTime.hours) {
      morningHours.push(currentHour);
      currentHour++;
    }
  } else {
    // Normal time slot within same day
    while (currentHour < endTime.hours) {
      morningHours.push(currentHour);
      currentHour++;
    }
  }

  // Set genres for each morning hour
  const genres = Object.keys(state.config.genres);
  const morningGenres = {};

  morningHours.forEach((hour) => {
    const selectedGenre = genres[Math.floor(Math.random() * genres.length)];
    morningGenres[hour] = selectedGenre;
  });

  updateState({
    morningGenres,
  });
}

export function clearAllScheduledTimeouts() {
  const state = getState();
  state.scheduledTimeouts.forEach((timeout) => clearTimeout(timeout));

  if (state.hourlyScheduleTimeout) {
    clearTimeout(state.hourlyScheduleTimeout);
  }

  if (state.dailyMorningGenreTimeout) {
    clearTimeout(state.dailyMorningGenreTimeout);
  }

  updateState({
    scheduledTimeouts: [],
    hourlyScheduleTimeout: null,
    dailyMorningGenreTimeout: null,
  });
}

export function enterScheduledMode(track) {
  const state = getState();

  // Don't start a new scheduled track if we're already playing one
  if (state.isInScheduledMode) {
    console.log("Already in scheduled mode, skipping scheduled track");

    return;
  }

  if (state.theTransmitter.paused) {
    console.log("Player paused, skipping scheduled track");

    updateState({
      preScheduledJunkOnly: false,
      preScheduledNonBumperJunkOnly: false,
    });

    return;
  }

  updateState({
    isInScheduledMode: true,
    currentScheduledTrack: track,
  });

  const trackData = track.trackData;
  const scheduledTime = getScheduledTrackTime(track);
  const now = getCurrentTime();
  const offsetSeconds = Math.max(0, (now - scheduledTime) / 1000);

  if (offsetSeconds >= trackData.duration) {
    console.log(
      "Scheduled track would be finished, returning to algorithmic playback",
    );
    returnToAlgorithmicPlayback();
    return;
  }

  console.log("Entering scheduled mode");
  markScheduledFileUsed(track.trackKey, now);

  playTrack({
    trackPath: trackData.path,
    startTime: offsetSeconds,
    isScheduled: true,
  });
}

export function onScheduledTrackEnd() {
  updateState({
    currentScheduledTrack: null,
    preScheduledJunkOnly: false,
    preScheduledNonBumperJunkOnly: false,
  });

  // Shuffle junk order
  shuffleJunkCycleOrder();

  // Clean up any remaining player listeners
  cleanupScheduledTrackListeners();

  // Check if we need to enter pre-scheduled junk range immediately
  checkAndSetPrescheduleJunkState();

  returnToAlgorithmicPlayback();
}
