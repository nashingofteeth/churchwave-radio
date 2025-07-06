document.addEventListener("DOMContentLoaded", () => {
  const theTransmitter = document.getElementById("theTransmitter");
  const startButton = document.getElementById("startButton");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const playingIndicator = document.getElementById("playingIndicator");

  let mainTracks = [];
  let interludes = {};
  let lateNightLoFis = [];
  let scheduledTracks = [];
  let tracksData = {};
  let config = {};
  const usedPieces = { 0: {}, 1: {}, 2: {}, 3: {}, lateNight: {} };
  const usedScheduledFiles = {};
  let currentMainTrackIndex;
  let isFirstTrack = true;
  let simulatedDate = null; // Initialize with null for using real time by default
  let timeOfDay;
  let fadeOutInterval = null;
  let currentScheduledTrack = null;
  let simulatedTimeInterval = null;
  const fadeOutDuration = 3000; // 3 seconds in milliseconds

  let isInScheduledMode = false;
  let scheduledTimeouts = [];
  let hourlyScheduleTimeout = null;
  const chainGapThreshold = 10; // seconds - if tracks end within this time, chain them

  // Event listener management
  let currentTrackListeners = [];
  let scheduledTrackListeners = [];

  function getTimeOfDay() {
    const date = simulatedDate || new Date();
    const currentHour = date.getHours();
    if (currentHour >= 0 && currentHour < 5) return "lateNight";
    if (currentHour >= 5 && currentHour < 10) return "morning";
    if (currentHour >= 10 && currentHour < 16) return "day";
    if (currentHour >= 16 && currentHour < 19) return "evening";
    if (currentHour >= 19 && currentHour < 24) return "night";
  }

  function initialize() {
    // Load config first
    fetch("config.json")
      .then((response) => response.json())
      .then((configData) => {
        config = configData;
        // Load tracks data
        return Promise.all([
          fetch("tracks.json").then(r => r.json()),
          fetch("tracks-old.json").then(r => r.json())
        ]);
      })
      .then(([newTracks, oldTracks]) => {
        // Use old tracks structure temporarily
        mainTracks = oldTracks.mainTracks;
        interludes = oldTracks.interludes;
        lateNightLoFis = oldTracks.lateNightLoFis;

        // Use new scheduled tracks structure
        scheduledTracks = newTracks.categories?.scheduled || [];
        tracksData = newTracks.files || {};

        // Initialize scheduled track system
        const playingScheduledTrack = initializeScheduledSystem();

        if (!playingScheduledTrack) {
          timeOfDay = getTimeOfDay();
          if (timeOfDay === "lateNight") playLateNightLoFi();
          else {
            currentMainTrackIndex = Math.floor(Math.random() * mainTracks.length);
            playMainTrack();
          }
        }
      })
      .catch((error) => console.error("Error loading tracks:", error));
  }

  function playTrack(trackUrl, callback, startTime = null) {
    // Clean up any existing current track listeners first
    cleanupCurrentTrackListeners();

    theTransmitter.src = trackUrl;
    console.log(`Playing track: ${trackUrl}`);
    theTransmitter.currentTime = 0;

    const loadedMetadataHandler = () => {
      if (startTime !== null) {
        theTransmitter.currentTime = Math.min(startTime, theTransmitter.duration - 1);
      } else if (isFirstTrack) {
        theTransmitter.currentTime = getRandomStartTime(
          theTransmitter.duration,
        );
        isFirstTrack = false;
      }
      theTransmitter.play();
    };

    const endedHandler = callback;

    addCurrentTrackListener("loadedmetadata", loadedMetadataHandler, { once: true });
    addCurrentTrackListener("ended", endedHandler, { once: true });
  }

  function playMainTrack() {
    currentMainTrackIndex = (currentMainTrackIndex + 1) % mainTracks.length;
    playTrack(mainTracks[currentMainTrackIndex], playInterlude);
  }

  function playInterlude() {
    timeOfDay = getTimeOfDay();
    if (timeOfDay === "lateNight") return playLateNightLoFi();

    const currentMainTrackKey = currentMainTrackIndex.toString();
    let availableInterludes = interludes[currentMainTrackKey][timeOfDay].filter(
      (track) => !usedPieces[currentMainTrackKey][track],
    );
    if (availableInterludes.length === 0) {
      usedPieces[currentMainTrackKey] = {};
      availableInterludes = interludes[currentMainTrackKey][timeOfDay];
    }
    const nextInterlude =
      availableInterludes[Math.floor(Math.random() * availableInterludes.length)];
    usedPieces[currentMainTrackKey][nextInterlude] = true;
    playTrack(nextInterlude, playMainTrack);
  }

  function playLateNightLoFi() {
    timeOfDay = getTimeOfDay();
    if (timeOfDay !== "lateNight") {
      currentMainTrackIndex = 3;
      return playMainTrack();
    }

    let availableLoFis = lateNightLoFis.filter(
      (track) => !usedPieces.lateNight[track],
    );
    if (availableLoFis.length === 0) {
      usedPieces.lateNight = {};
      availableLoFis = lateNightLoFis;
    }
    const nextLoFi =
      availableLoFis[Math.floor(Math.random() * availableLoFis.length)];
    usedPieces.lateNight[nextLoFi] = true;
    playTrack(nextLoFi, playLateNightLoFi);
  }

  function startPlayback() {
    console.log("Start");
    reset();
    initialize();
  }

  function skipTrack() {
    console.log("Skip");
    theTransmitter.pause();

    // Clear any active scheduled track
    if (currentScheduledTrack) {
      currentScheduledTrack = null;
      cleanupScheduledTrackListeners();
    } else {
      cleanupCurrentTrackListeners();
    }

    const endedEvent = new Event("ended");
    theTransmitter.dispatchEvent(endedEvent);
  }
  window.skipTrack = skipTrack;

  function initializeUIEventListeners() {
    const startButtonHandler = () => {
      loadingIndicator.style.display = "block";
      startPlayback();
      startButton.style.display = "none";

      const playingHandler = () => {
        loadingIndicator.style.display = "none";
        document.getElementById("revealed").style.display = "block";
      };

      theTransmitter.addEventListener("playing", playingHandler, { once: true });
    };

    startButton.addEventListener("click", startButtonHandler);

    // These UI indicator listeners are permanent
    theTransmitter.addEventListener("pause", () => {
      playingIndicator.classList.remove("playing");
    });
    theTransmitter.addEventListener("waiting", () => {
      playingIndicator.classList.remove("playing");
    });
    theTransmitter.addEventListener("ended", () => {
      playingIndicator.classList.remove("playing");
    });
    theTransmitter.addEventListener("playing", () => {
      playingIndicator.classList.add("playing");
    });
  }

  function reset() {
    isFirstTrack = true;
    currentMainTrackIndex = undefined;
    currentScheduledTrack = null;
    theTransmitter.pause();

    // Clear intervals and timeouts
    if (fadeOutInterval) {
      clearInterval(fadeOutInterval);
      fadeOutInterval = null;
    }

    if (simulatedTimeInterval) {
      clearInterval(simulatedTimeInterval);
      simulatedTimeInterval = null;
    }

    // Clear all scheduled timeouts
    clearAllScheduledTimeouts();

    if (hourlyScheduleTimeout) {
      clearTimeout(hourlyScheduleTimeout);
      hourlyScheduleTimeout = null;
    }

    isInScheduledMode = false;
  }

  function getRandomStartTime(duration) {
    return Math.floor(Math.random() * (duration * 0.9));
  }

  // Event listener management functions
  function addCurrentTrackListener(eventType, handler, options = {}) {
    theTransmitter.addEventListener(eventType, handler, options);
    currentTrackListeners.push({ eventType, handler, options });
  }

  function addScheduledTrackListener(eventType, handler, options = {}) {
    theTransmitter.addEventListener(eventType, handler, options);
    scheduledTrackListeners.push({ eventType, handler, options });
  }

  function cleanupCurrentTrackListeners() {
    currentTrackListeners.forEach(({ eventType, handler }) => {
      try {
        theTransmitter.removeEventListener(eventType, handler);
      } catch (error) {
        console.warn('Error removing current track listener:', error);
      }
    });
    currentTrackListeners = [];
  }

  function cleanupScheduledTrackListeners() {
    scheduledTrackListeners.forEach(({ eventType, handler }) => {
      try {
        theTransmitter.removeEventListener(eventType, handler);
      } catch (error) {
        console.warn('Error removing scheduled track listener:', error);
      }
    });
    scheduledTrackListeners = [];
  }

  // Private console debugging tool - clears ALL event listeners
  function forceCleanupAllEventListeners() {
    cleanupCurrentTrackListeners();
    cleanupScheduledTrackListeners();

    // Nuclear option - remove all event listeners from theTransmitter
    const newTransmitter = theTransmitter.cloneNode(true);
    theTransmitter.parentNode.replaceChild(newTransmitter, theTransmitter);

    console.log('All event listeners forcibly removed - reinitialization required');
  }
  
  // Expose to console for debugging
  window.forceCleanupAllEventListeners = forceCleanupAllEventListeners;

  // Enhanced simulation function to set date and time to the second
  const simulateTime = (hour, minute = 0, second = 0, date = null) => {
    simulatedDate = date ? new Date(date) : new Date();
    simulatedDate.setHours(hour, minute, second, 0);
    console.log(`Simulating time: ${simulatedDate.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);

    // Start continuous time progression
    startSimulatedTimeProgression();
  };

  function startSimulatedTimeProgression() {
    // Clear any existing time progression
    if (simulatedTimeInterval) {
      clearInterval(simulatedTimeInterval);
    }

    // Progress time by 1 second every 1000ms (real time)
    simulatedTimeInterval = setInterval(() => {
      if (simulatedDate) {
        simulatedDate.setSeconds(simulatedDate.getSeconds() + 1);

        // Optional: Log time every minute for debugging
        if (simulatedDate.getSeconds() === 0) {
          console.log(`Simulated time: ${simulatedDate.toLocaleString('en-US', { timeZone: config.timezone || 'America/New_York' })}`);
        }
      }
    }, 1000);
  }

  function stopSimulatedTimeProgression() {
    if (simulatedTimeInterval) {
      clearInterval(simulatedTimeInterval);
      simulatedTimeInterval = null;
    }
  }

  // Timezone conversion utilities
  function getCurrentTime() {
    const date = simulatedDate || new Date();
    return new Date(date.toLocaleString("en-US", { timeZone: config.timezone }));
  }

  function parseTimeString(timeStr) {
    const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
    return { hours, minutes, seconds };
  }

  function getScheduledTrackTime(scheduledTrack, referenceDate = null) {
    const baseDate = referenceDate || getCurrentTime();
    const { hours, minutes, seconds } = parseTimeString(scheduledTrack.time);

    let scheduledDate = new Date(baseDate);
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

  function cleanupExpiredUsage() {
    const now = getCurrentTime();
    const twentyFourHoursAgo = now.getTime() - (24 * 60 * 60 * 1000);

    Object.keys(usedScheduledFiles).forEach(filePath => {
      if (usedScheduledFiles[filePath].getTime() < twentyFourHoursAgo) {
        delete usedScheduledFiles[filePath];
      }
    });
  }

  function getActiveScheduledTrack() {
    const now = getCurrentTime();

    // Clean up expired usage tracking
    cleanupExpiredUsage();

    const activeTracks = scheduledTracks.filter(track => {
      try {
        const trackData = tracksData[track.trackKey]; // track.trackKey references files array

        if (!trackData || !trackData.duration) return false;

        // Skip if this file has been used in last 24 hours
        if (usedScheduledFiles[track.trackKey] &&
          now - usedScheduledFiles[track.trackKey] < 24 * 60 * 60 * 1000) {
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

  function selectTrackByHierarchy(tracks) {
    if (tracks.length === 0) return null;
    if (tracks.length === 1) return tracks[0];

    // Separate tracks by recurrence type
    const dateTracks = tracks.filter(track => track.date);
    const dayTracks = tracks.filter(track => track.recurrence && track.recurrence !== 'daily');
    const dailyTracks = tracks.filter(track => track.recurrence === 'daily');

    // Priority: dates > days > daily
    // Pick randomly from each category
    if (dateTracks.length > 0) {
      return dateTracks[Math.floor(Math.random() * dateTracks.length)];
    } else if (dayTracks.length > 0) {
      return dayTracks[Math.floor(Math.random() * dayTracks.length)];
    } else if (dailyTracks.length > 0) {
      return dailyTracks[Math.floor(Math.random() * dailyTracks.length)];
    }
  }

  function returnToAlgorithmicPlayback() {
    isInScheduledMode = false;
    timeOfDay = getTimeOfDay();
    if (timeOfDay === "lateNight") {
      playLateNightLoFi();
    } else {
      currentMainTrackIndex = Math.floor(Math.random() * mainTracks.length);
      playMainTrack();
    }
  }

  function initializeScheduledSystem() {
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

  function scheduleHourBlock(hour) {
    const now = getCurrentTime();
    const blockStart = new Date(now);
    blockStart.setHours(hour, 0, 0, 0);
    const blockEnd = new Date(blockStart);
    blockEnd.setHours(hour + 1, 0, 0, 0);

    // Get all scheduled tracks for this hour
    const hourTracks = scheduledTracks.filter(track => {
      try {
        const trackData = tracksData[track.trackKey];
        if (!trackData) return false;

        // Skip if used in last 24 hours
        if (usedScheduledFiles[track.trackKey] &&
          now - usedScheduledFiles[track.trackKey] < 24 * 60 * 60 * 1000) {
          return false;
        }

        const scheduledTime = getScheduledTrackTime(track);
        return scheduledTime >= blockStart && scheduledTime < blockEnd;
      } catch (error) {
        console.error('Error checking track for hour block:', track, error);
        return false;
      }
    });

    // Apply hierarchy and sort by time
    const prioritizedTracks = selectTracksWithHierarchy(hourTracks);
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

  function selectTracksWithHierarchy(tracks) {
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

  function createTrackChain(tracks) {
    if (tracks.length === 0) return [];

    const chain = [];
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const trackData = tracksData[track.trackKey];
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

        if (gap <= chainGapThreshold && gap >= 0) {
          chainItem.isChained = true;
          chainItem.chainedStartTime = prevItem.endTime;
          console.log(`Chaining ${trackData.filename} (${gap}s gap)`);
        }
      }

      chain.push(chainItem);
    }

    return chain;
  }

  function scheduleTrackChain(chain) {
    chain.forEach((chainItem) => {
      const { track, startTime, isChained, chainedStartTime } = chainItem;
      const actualStartTime = isChained ? chainedStartTime : startTime;
      const now = getCurrentTime();

      if (actualStartTime <= now) return; // Skip past times

      const timeUntilStart = actualStartTime - now;
      const timeUntilFade = timeUntilStart - fadeOutDuration;

      // Schedule fade (if not chained)
      if (!isChained && timeUntilFade > 0) {
        const fadeTimeout = setTimeout(() => {
          if (!isInScheduledMode) {
            fadeOut();
          }
        }, timeUntilFade);

        scheduledTimeouts.push(fadeTimeout);
      }

      // Schedule track start
      const startTimeout = setTimeout(() => {
        onScheduledTrackTimeout(track, isChained);
      }, timeUntilStart);

      scheduledTimeouts.push(startTimeout);
    });
  }

  function onScheduledTrackTimeout(track, isChained) {
    if (isChained || isInScheduledMode) {
      // Direct play for chained tracks or when already in scheduled mode
      playScheduledTrackDirect(track);
    } else {
      // Should have been faded already, but play directly if not
      enterScheduledMode(track);
    }
  }

  function scheduleNextHourUpdate() {
    const now = getCurrentTime();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    const timeUntilNextHour = nextHour - now;

    hourlyScheduleTimeout = setTimeout(() => {
      const currentHour = getCurrentTime().getHours();
      scheduleHourBlock(currentHour + 1); // Schedule the hour after next
      scheduleNextHourUpdate(); // Schedule next update
    }, timeUntilNextHour);
  }

  function clearAllScheduledTimeouts() {
    scheduledTimeouts.forEach(timeout => clearTimeout(timeout));
    scheduledTimeouts = [];
  }

  function enterScheduledMode(track) {
    isInScheduledMode = true;
    currentScheduledTrack = track;

    const trackData = tracksData[track.trackKey];
    const scheduledTime = getScheduledTrackTime(track);
    const now = getCurrentTime();
    const offsetSeconds = Math.max(0, (now - scheduledTime) / 1000);

    if (offsetSeconds >= trackData.duration) {
      console.log('Scheduled track would be finished, returning to algorithmic playback');
      returnToAlgorithmicPlayback();
      return;
    }

    console.log(`Entering scheduled mode: ${trackData.filename} (offset: ${offsetSeconds.toFixed(1)}s)`);
    usedScheduledFiles[track.trackKey] = now;

    // Clean up any existing current track listeners first
    cleanupCurrentTrackListeners();

    theTransmitter.src = trackData.path;
    theTransmitter.currentTime = 0;

    const loadedMetadataHandler = () => {
      theTransmitter.currentTime = Math.min(offsetSeconds, theTransmitter.duration - 1);
      theTransmitter.play();
    };

    const errorHandler = () => {
      console.error('Error playing scheduled track:', trackData.filename);
      returnToAlgorithmicPlayback();
    };

    addScheduledTrackListener("loadedmetadata", loadedMetadataHandler, { once: true });
    addScheduledTrackListener("ended", onScheduledTrackEnd, { once: true });
    addScheduledTrackListener("error", errorHandler, { once: true });
  }

  function playScheduledTrackDirect(track) {
    currentScheduledTrack = track;
    const trackData = tracksData[track.trackKey];
    const now = getCurrentTime();

    console.log(`Playing chained scheduled track: ${trackData.filename}`);
    usedScheduledFiles[track.trackKey] = now;

    // Clean up any existing current track listeners first
    cleanupCurrentTrackListeners();

    theTransmitter.src = trackData.path;
    theTransmitter.currentTime = 0;

    const loadedMetadataHandler = () => {
      theTransmitter.play();
    };

    const errorHandler = () => {
      console.error('Error playing scheduled track:', trackData.filename);
      returnToAlgorithmicPlayback();
    };

    addScheduledTrackListener("loadedmetadata", loadedMetadataHandler, { once: true });
    addScheduledTrackListener("ended", onScheduledTrackEnd, { once: true });
    addScheduledTrackListener("error", errorHandler, { once: true });
  }

  function onScheduledTrackEnd() {
    currentScheduledTrack = null;
    cleanupScheduledTrackListeners();
    returnToAlgorithmicPlayback();
  }

  function fadeOut() {
    if (fadeOutInterval || currentScheduledTrack) return; // Prevent multiple fades or if already scheduled

    const steps = 30;
    const originalVolume = theTransmitter.volume;
    const volumeStep = originalVolume / steps;
    let currentStep = 0;

    console.log('Starting fade');

    fadeOutInterval = setInterval(() => {
      currentStep++;
      theTransmitter.volume = Math.max(0, originalVolume - (volumeStep * currentStep));

      if (currentStep >= steps) {
        clearInterval(fadeOutInterval);
        fadeOutInterval = null;
        theTransmitter.volume = originalVolume; // Reset volume for next track
        theTransmitter.pause();
      }
    }, fadeOutDuration / steps);
  }

  window.simulateTime = simulateTime;

  // Additional debug functions
  window.getActiveScheduled = () => {
    const active = getActiveScheduledTrack();
    if (active) {
      console.log('Active scheduled track:', {
        time: active.time,
        recurrence: active.recurrence || active.date,
        filename: tracksData[active.trackKey]?.filename
      });
    }
    return active;
  };

  window.clearUsedScheduled = () => {
    Object.keys(usedScheduledFiles).forEach(key => delete usedScheduledFiles[key]);
    console.log('Cleared all used scheduled files');
  };

  window.reinitializeScheduled = () => {
    clearAllScheduledTimeouts();
    if (hourlyScheduleTimeout) {
      clearTimeout(hourlyScheduleTimeout);
      hourlyScheduleTimeout = null;
    }
    initializeScheduledSystem();
    console.log('Reinitialized scheduled system');
  };

  window.getScheduledTimeouts = () => {
    console.log(`Active scheduled timeouts: ${scheduledTimeouts.length}`);
    return scheduledTimeouts.length;
  };

  window.listScheduledTracks = () => {
    console.log('All scheduled tracks:');
    scheduledTracks.forEach((track, index) => {
      const recurrenceType = track.date ? 'DATE' :
        track.recurrence === 'daily' ? 'DAILY' :
          track.recurrence ? 'DAY' : 'OTHER';
      console.log(`${index}: ${track.time} (${track.recurrence || track.date}) [${recurrenceType}] - ${tracksData[track.trackKey]?.filename}`);
    });
  };

  window.cleanupUsage = () => {
    cleanupExpiredUsage();
    console.log('Cleaned up expired usage tracking');
  };

  window.stopTimeProgression = () => {
    stopSimulatedTimeProgression();
    console.log('Stopped simulated time progression');
  };

  window.resumeTimeProgression = () => {
    if (simulatedDate) {
      startSimulatedTimeProgression();
      console.log('Resumed simulated time progression');
    } else {
      console.log('No simulated time set - use simulateTime() first');
    }
  };

  window.getCurrentSimulatedTime = () => {
    if (simulatedDate) {
      console.log(`Current simulated time: ${simulatedDate.toLocaleString('en-US', { timeZone: config.timezone || 'America/New_York' })}`);
      return simulatedDate;
    } else {
      console.log('No simulated time active - using real time');
      return new Date();
    }
  };

  window.clearSimulatedTime = () => {
    stopSimulatedTimeProgression();
    simulatedDate = null;
    console.log('Cleared simulated time - now using real time');
  };

  initializeUIEventListeners();
});
