document.addEventListener("DOMContentLoaded", () => {
  const theTransmitter = document.getElementById("theTransmitter");
  const startButton = document.getElementById("startButton");
  const seekButton = document.getElementById("seekButton");
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
  let scheduledCheckInterval = null;
  let upcomingScheduledBuffer = 60; // 1 minute buffer in seconds
  let immediateScheduledBuffer = 30; // 30 seconds for immediate next track
  let simulatedTimeInterval = null;

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

        // Check for scheduled tracks first
        const activeScheduledTrack = getActiveScheduledTrack();
        if (activeScheduledTrack) {
          playScheduledTrack(activeScheduledTrack);
        } else {
          timeOfDay = getTimeOfDay();
          if (timeOfDay === "lateNight") playLateNightLoFi();
          else {
            currentMainTrackIndex = Math.floor(Math.random() * mainTracks.length);
            playMainTrack();
          }
        }

        // Start checking for upcoming scheduled tracks
        startScheduledTrackMonitoring();
      })
      .catch((error) => console.error("Error loading tracks:", error));
  }

  function playTrack(trackUrl, callback, startTime = null) {
    theTransmitter.src = trackUrl;
    console.log(`Playing track: ${trackUrl}`);
    theTransmitter.currentTime = 0;
    theTransmitter.addEventListener(
      "loadedmetadata",
      () => {
        if (startTime !== null) {
          theTransmitter.currentTime = Math.min(startTime, theTransmitter.duration - 1);
        } else if (isFirstTrack) {
          theTransmitter.currentTime = getRandomStartTime(
            theTransmitter.duration,
          );
          isFirstTrack = false;
        }
        theTransmitter.play();
      },
      { once: true },
    );

    theTransmitter.addEventListener("ended", callback, { once: true });
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
    }

    const endedEvent = new Event("ended");
    theTransmitter.dispatchEvent(endedEvent);
  }
  window.skipTrack = skipTrack;

  function handleSeekButtonClick() {
    // Check for scheduled tracks first
    const activeScheduledTrack = getActiveScheduledTrack();
    if (activeScheduledTrack) {
      playScheduledTrack(activeScheduledTrack);
      return;
    }

    timeOfDay = getTimeOfDay();
    if (timeOfDay === "lateNight") {
      skipTrack();
      return;
    }

    startPlayback();
  }

  seekButton.addEventListener("click", handleSeekButtonClick);

  startButton.addEventListener("click", () => {
    loadingIndicator.style.display = "block";
    startPlayback();
    startButton.style.display = "none";

    theTransmitter.addEventListener("playing", () => {
      loadingIndicator.style.display = "none";
      document.getElementById("revealed").style.display = "block";
    });
  });

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

  function reset() {
    isFirstTrack = true;
    currentMainTrackIndex = undefined;
    currentScheduledTrack = null;
    theTransmitter.pause();

    // Remove all event listeners
    theTransmitter.removeEventListener("ended", playMainTrack);
    theTransmitter.removeEventListener("ended", playInterlude);
    theTransmitter.removeEventListener("ended", playLateNightLoFi);

    // Clear intervals
    if (scheduledCheckInterval) {
      clearInterval(scheduledCheckInterval);
      scheduledCheckInterval = null;
    }
    
    if (fadeOutInterval) {
      clearInterval(fadeOutInterval);
      fadeOutInterval = null;
    }
    
    if (simulatedTimeInterval) {
      clearInterval(simulatedTimeInterval);
      simulatedTimeInterval = null;
    }
  }

  function getRandomStartTime(duration) {
    return Math.floor(Math.random() * (duration * 0.9));
  }

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
  function getCurrentTimeInEST() {
    const date = simulatedDate || new Date();
    return new Date(date.toLocaleString("en-US", { timeZone: config.timezone }));
  }

  function parseTimeString(timeStr) {
    const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
    return { hours, minutes, seconds };
  }

  function getScheduledTrackTime(scheduledTrack, referenceDate = null) {
    const baseDate = referenceDate || getCurrentTimeInEST();
    const { hours, minutes, seconds } = parseTimeString(scheduledTrack.time);

    let scheduledDate = new Date(baseDate);
    scheduledDate.setHours(hours, minutes, seconds, 0);

    // Handle different recurrence types
    if (scheduledTrack.recurrence === 'daily') {
      // Daily tracks can play today or tomorrow
      const now = getCurrentTimeInEST();
      if (scheduledDate < now) {
        scheduledDate.setDate(scheduledDate.getDate() + 1);
      }
    } else if (scheduledTrack.recurrence && scheduledTrack.recurrence.startsWith('2024-')) {
      // Specific date
      const [year, month, day] = scheduledTrack.recurrence.split('-').map(Number);
      scheduledDate = new Date(year, month - 1, day, hours, minutes, seconds);
    } else if (scheduledTrack.date) {
      // Handle date field
      const [year, month, day] = scheduledTrack.date.split('-').map(Number);
      scheduledDate = new Date(year, month - 1, day, hours, minutes, seconds);
    } else if (scheduledTrack.recurrence && ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(scheduledTrack.recurrence.toLowerCase())) {
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
    }

    return scheduledDate;
  }

  function cleanupExpiredUsage() {
    const now = getCurrentTimeInEST();
    const twentyFourHoursAgo = now.getTime() - (24 * 60 * 60 * 1000);

    Object.keys(usedScheduledFiles).forEach(filePath => {
      if (usedScheduledFiles[filePath].getTime() < twentyFourHoursAgo) {
        delete usedScheduledFiles[filePath];
      }
    });
  }

  function getActiveScheduledTrack() {
    const now = getCurrentTimeInEST();

    // Clean up expired usage tracking
    cleanupExpiredUsage();

    const activeTracks = scheduledTracks.filter(track => {
      try {
        const trackData = tracksData[track.trackKey]; // track.trackKey references files array

        if (!trackData || !trackData.duration) return false;

        // Skip if this file has been used in last 24 hours
        if (usedScheduledFiles[trackData.path] &&
          now - usedScheduledFiles[trackData.path] < 24 * 60 * 60 * 1000) {
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

    // Implement recurrence hierarchy: dates > days > daily
    return selectTrackByHierarchy(activeTracks);
  }

  function selectTrackByHierarchy(tracks) {
    if (tracks.length === 0) return null;
    if (tracks.length === 1) return tracks[0];

    // Separate tracks by recurrence type
    const dateTracks = tracks.filter(track => track.date);
    const dailyTracks = tracks.filter(track => track.recurrence === 'daily');
    const dayTracks = tracks.filter(track => track.recurrence && track.recurrence !== 'daily');

    // Priority: dates > days > daily
    if (dateTracks.length > 0) {
      return dateTracks[Math.floor(Math.random() * dateTracks.length)];
    } else if (dayTracks.length > 0) {
      return dayTracks[Math.floor(Math.random() * dayTracks.length)];
    } else if (dailyTracks.length > 0) {
      return dailyTracks[Math.floor(Math.random() * dailyTracks.length)];
    }
  }

  function getUpcomingScheduledTrack() {
    const now = getCurrentTimeInEST();
    const bufferTime = new Date(now.getTime() + upcomingScheduledBuffer * 1000);

    const upcomingTracks = scheduledTracks.filter(track => {
      try {
        const trackData = tracksData[track.trackKey]; // track.trackKey references files array

        if (!trackData) return false;

        // Skip if this file has been used in last 24 hours
        if (usedScheduledFiles[trackData.path] &&
          now - usedScheduledFiles[trackData.path] < 24 * 60 * 60 * 1000) {
          return false;
        }

        const scheduledTime = getScheduledTrackTime(track);
        return scheduledTime >= now && scheduledTime <= bufferTime;
      } catch (error) {
        console.error('Error checking upcoming scheduled track:', track, error);
        return false;
      }
    });

    // Apply hierarchy to upcoming tracks as well
    return selectTrackByHierarchy(upcomingTracks);
  }

  function getImmediateNextScheduledTrack() {
    const now = getCurrentTimeInEST();
    const immediateBufferTime = new Date(now.getTime() + immediateScheduledBuffer * 1000);

    const immediateTracks = scheduledTracks.filter(track => {
      try {
        const trackData = tracksData[track.trackKey];

        if (!trackData) return false;

        // Skip if this file has been used in last 24 hours
        if (usedScheduledFiles[trackData.path] &&
          now - usedScheduledFiles[trackData.path] < 24 * 60 * 60 * 1000) {
          return false;
        }

        const scheduledTime = getScheduledTrackTime(track);
        return scheduledTime >= now && scheduledTime <= immediateBufferTime;
      } catch (error) {
        console.error('Error checking immediate next scheduled track:', track, error);
        return false;
      }
    });

    return selectTrackByHierarchy(immediateTracks);
  }

  function playScheduledTrack(scheduledTrack) {
    if (!scheduledTrack || !tracksData[scheduledTrack.trackKey]) {
      console.error('Invalid scheduled track or track data not found:', scheduledTrack);
      returnToAlgorithmicPlayback();
      return;
    }

    const trackData = tracksData[scheduledTrack.trackKey];

    try {
      const scheduledTime = getScheduledTrackTime(scheduledTrack);
      const now = getCurrentTimeInEST();

      // Calculate offset for resume functionality
      const offsetSeconds = Math.max(0, (now - scheduledTime) / 1000);

      // Check if track would be over by now
      if (offsetSeconds >= trackData.duration) {
        console.log('Scheduled track would be finished, returning to algorithmic playback');
        returnToAlgorithmicPlayback();
        return;
      }

      currentScheduledTrack = scheduledTrack;

      console.log(`Playing scheduled track: ${trackData.filename} (offset: ${offsetSeconds.toFixed(1)}s)`);

      // Mark this file as used for 24-hour exclusion
      usedScheduledFiles[scheduledTrack.trackKey] = now;

      // Play the track
      theTransmitter.src = trackData.path;
      theTransmitter.currentTime = 0;

      theTransmitter.addEventListener("loadedmetadata", () => {
        theTransmitter.currentTime = Math.min(offsetSeconds, theTransmitter.duration - 1);
        theTransmitter.play();
      }, { once: true });

      theTransmitter.addEventListener("ended", () => {
        currentScheduledTrack = null;
        // Check for immediate next scheduled track (within 30 seconds)
        const immediateNext = getImmediateNextScheduledTrack();
        if (immediateNext) {
          console.log('Immediate next scheduled track found, playing now');
          playScheduledTrack(immediateNext);
        } else {
          // Check for any currently active scheduled track
          const nextScheduled = getActiveScheduledTrack();
          if (nextScheduled) {
            playScheduledTrack(nextScheduled);
          } else {
            returnToAlgorithmicPlayback();
          }
        }
      }, { once: true });

      theTransmitter.addEventListener("error", () => {
        console.error('Error playing scheduled track:', trackData.filename);
        currentScheduledTrack = null;
        returnToAlgorithmicPlayback();
      }, { once: true });

    } catch (error) {
      console.error('Error in playScheduledTrack:', error);
      currentScheduledTrack = null;
      returnToAlgorithmicPlayback();
    }
  }

  function returnToAlgorithmicPlayback() {
    timeOfDay = getTimeOfDay();
    if (timeOfDay === "lateNight") {
      playLateNightLoFi();
    } else {
      currentMainTrackIndex = Math.floor(Math.random() * mainTracks.length);
      playMainTrack();
    }
  }

  function startScheduledTrackMonitoring() {
    // Clear existing interval
    if (scheduledCheckInterval) {
      clearInterval(scheduledCheckInterval);
    }

    // Check every 30 seconds for upcoming scheduled tracks
    scheduledCheckInterval = setInterval(() => {
      if (currentScheduledTrack) return; // Already playing scheduled content

      const upcomingTrack = getUpcomingScheduledTrack();
      if (upcomingTrack) {
        console.log(`Upcoming scheduled track detected: ${tracksData[upcomingTrack.trackKey]?.filename}`);
        fadeAndTransitionToScheduled(upcomingTrack);
      }
    }, 30000);
  }

  function fadeAndTransitionToScheduled(scheduledTrack) {
    if (fadeOutInterval || currentScheduledTrack) return; // Prevent multiple fades or if already scheduled

    const fadeOutDuration = 3000; // 3 seconds fade
    const steps = 30;
    const originalVolume = theTransmitter.volume;
    const volumeStep = originalVolume / steps;
    let currentStep = 0;

    console.log(`Fading out current track for scheduled track: ${tracksData[scheduledTrack.trackKey]?.filename}`);

    fadeOutInterval = setInterval(() => {
      currentStep++;
      theTransmitter.volume = Math.max(0, originalVolume - (volumeStep * currentStep));

      if (currentStep >= steps) {
        clearInterval(fadeOutInterval);
        fadeOutInterval = null;
        theTransmitter.volume = originalVolume; // Reset volume for next track
        theTransmitter.pause();

        // Wait for the exact scheduled time
        const scheduledTime = getScheduledTrackTime(scheduledTrack);
        const now = getCurrentTimeInEST();
        const waitTime = Math.max(0, scheduledTime - now);

        if (waitTime > 0) {
          setTimeout(() => {
            playScheduledTrack(scheduledTrack);
          }, waitTime);
        } else {
          playScheduledTrack(scheduledTrack);
        }
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

  window.getUpcomingScheduled = () => {
    const upcoming = getUpcomingScheduledTrack();
    if (upcoming) {
      console.log('Upcoming scheduled track:', {
        time: upcoming.time,
        recurrence: upcoming.recurrence || upcoming.date,
        filename: tracksData[upcoming.trackKey]?.filename,
        scheduledFor: getScheduledTrackTime(upcoming)
      });
    }
    return upcoming;
  };

  window.clearUsedScheduled = () => {
    Object.keys(usedScheduledFiles).forEach(key => delete usedScheduledFiles[key]);
    console.log('Cleared all used scheduled files');
  };

  window.setScheduledBuffer = (seconds) => {
    upcomingScheduledBuffer = seconds;
    console.log(`Set scheduled buffer to ${seconds} seconds`);
  };

  window.setImmediateBuffer = (seconds) => {
    immediateScheduledBuffer = seconds;
    console.log(`Set immediate scheduled buffer to ${seconds} seconds`);
  };

  window.forceScheduledTrack = (trackIndex) => {
    const track = scheduledTracks[trackIndex];
    if (track) {
      console.log('Forcing scheduled track:', tracksData[track.trackKey]?.filename);
      fadeAndTransitionToScheduled(track);
    } else {
      console.log('Track not found at index:', trackIndex);
    }
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

  window.getImmediateNext = () => {
    const immediate = getImmediateNextScheduledTrack();
    if (immediate) {
      console.log('Immediate next scheduled track:', {
        time: immediate.time,
        recurrence: immediate.recurrence || immediate.date,
        filename: tracksData[immediate.trackKey]?.filename,
        scheduledFor: getScheduledTrackTime(immediate)
      });
    }
    return immediate;
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

  const fadeAndSkip = () => {
    if (fadeOutInterval) return; // Prevent multiple fades

    const fadeOutDuration = 2000; // 2 seconds fade
    const steps = 20; // Number of volume steps
    const originalVolume = theTransmitter.volume;
    const volumeStep = originalVolume / steps;
    let currentStep = 0;

    fadeOutInterval = setInterval(() => {
      currentStep++;
      theTransmitter.volume = Math.max(0, originalVolume - (volumeStep * currentStep));

      if (currentStep >= steps) {
        clearInterval(fadeOutInterval);
        fadeOutInterval = null;
        theTransmitter.volume = originalVolume; // Reset volume for next track
        skipTrack(); // Skip to next track
      }
    }, fadeOutDuration / steps);
  };

  window.fadeAndSkip = fadeAndSkip;
});
