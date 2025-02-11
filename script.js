document.addEventListener("DOMContentLoaded", () => {
  const theTransmitter = document.getElementById("theTransmitter");
  const startButton = document.getElementById("startButton");
  const seekButton = document.getElementById("seekButton");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const playingIndicator = document.getElementById("playingIndicator");

  let mainTracks = [];
  let interludes = {};
  let lateNightLoFis = [];
  const usedPieces = { 0: {}, 1: {}, 2: {}, 3: {}, lateNight: {} };
  let currentMainTrackIndex;
  let isFirstTrack = true;
  let simulatedDate = null; // Initialize with null for using real time by default
  let timeOfDay;
  let fadeOutInterval = null;

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
    fetch("tracks.json")
      .then((response) => response.json())
      .then((data) => {
        mainTracks = data.mainTracks;
        interludes = data.interludes;
        lateNightLoFis = data.lateNightLoFis;
        timeOfDay = getTimeOfDay();
        if (timeOfDay === "lateNight") playLateNightLoFi();
        else {
          currentMainTrackIndex = Math.floor(Math.random() * mainTracks.length);
          playMainTrack();
        }
      })
      .catch((error) => console.error("Error loading tracks:", error));
  }

  function playTrack(trackUrl, callback) {
    theTransmitter.src = trackUrl;
    console.log(`Playing track: ${trackUrl}`);
    theTransmitter.currentTime = 0;
    theTransmitter.addEventListener(
      "loadedmetadata",
      () => {
        if (isFirstTrack) {
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
      availableInterludes[
        Math.floor(Math.random() * availableInterludes.length)
      ];
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
    const endedEvent = new Event("ended");
    theTransmitter.dispatchEvent(endedEvent);
  }
  window.skipTrack = skipTrack;

  function handleSeekButtonClick() {
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
    theTransmitter.pause();
    theTransmitter.removeEventListener("ended", playMainTrack);
    theTransmitter.removeEventListener("ended", playInterlude);
    theTransmitter.removeEventListener("ended", playLateNightLoFi);
  }

  function getRandomStartTime(duration) {
    return Math.floor(Math.random() * (duration * 0.9));
  }

  // Simulation function to set any time
  const simulateTime = (hour) => {
    simulatedDate = new Date();
    simulatedDate.setHours(hour);
    console.log(`Simulating time: ${getTimeOfDay(simulatedDate)}`);
  };

  window.simulateTime = simulateTime;

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
