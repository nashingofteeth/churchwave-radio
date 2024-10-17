document.addEventListener("DOMContentLoaded", () => {
  const theTransmitter = document.getElementById("theTransmitter");
  const startButton = document.getElementById("startButton");
  const skipButton = document.getElementById("skipButton");

  let mainTracks = [];
  let interludes = {};
  let lateNightLoFis = [];
  const usedPieces = { 0: {}, 1: {}, 2: {}, 3: {}, lateNight: {} };
  let currentMainTrackIndex;
  let isFirstTrack = true;

  const updateTimeOfDay = () => {
    const currentHour = new Date().getHours();
    if (currentHour >= 0 && currentHour < 5) return "lateNight";
    if (currentHour >= 5 && currentHour < 9) return "morning";
    if (currentHour >= 9 && currentHour < 14) return "day";
    if (currentHour >= 14 && currentHour < 19) return "evening";
    if (currentHour >= 19 && currentHour < 24) return "night";
  };

  let timeOfDay = updateTimeOfDay();

  const initialize = () => {
    fetch("tracks.json")
      .then((response) => response.json())
      .then((data) => {
        mainTracks = data.mainTracks;
        interludes = data.interludes;
        lateNightLoFis = data.lateNightLoFis;

        if (timeOfDay === "lateNight") {
          playLateNightLoFi();
        } else {
          currentMainTrackIndex = Math.floor(Math.random() * mainTracks.length);
          playMainTrack();
        }
      })
      .catch((error) => console.error("Error loading tracks:", error));
  };

  const getRandomStartTime = (duration) => {
    return Math.floor(Math.random() * (duration * 0.9));
  };

  const playMainTrack = () => {
    if (mainTracks.length === 0) return;
    currentMainTrackIndex = (currentMainTrackIndex + 1) % mainTracks.length;
    const currentMainTrack = mainTracks[currentMainTrackIndex];
    theTransmitter.src = currentMainTrack;
    console.log(`Playing main track: ${currentMainTrack}`);
    theTransmitter.currentTime = 0;

    theTransmitter.addEventListener("loadedmetadata", () => {
      if (isFirstTrack) {
        theTransmitter.currentTime = getRandomStartTime(
          theTransmitter.duration,
        );
        isFirstTrack = false;
      }
      theTransmitter.play();
    });

    theTransmitter.addEventListener("ended", playInterlude, { once: true });
  };

  const playInterlude = () => {
    timeOfDay = updateTimeOfDay();

    if (timeOfDay === "lateNight") {
      console.log("Transitioning to late night. Switching to LoFi tracks.");
      playLateNightLoFi();
      return;
    }

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
    theTransmitter.src = nextInterlude;
    console.log(`Playing interlude track: ${nextInterlude}`);
    theTransmitter.currentTime = 0;
    usedPieces[currentMainTrackKey][nextInterlude] = true;
    theTransmitter.play();

    theTransmitter.addEventListener("ended", playMainTrack, { once: true });
  };

  const playLateNightLoFi = () => {
    timeOfDay = updateTimeOfDay();

    if (timeOfDay === "morning") {
      console.log("Transitioning to morning and restarting main track cycle.");
      currentMainTrackIndex = 4;
      playMainTrack();
      return;
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
    theTransmitter.src = nextLoFi;
    console.log(`Playing late night lofi: ${nextLoFi}`);
    theTransmitter.currentTime = 0;

    theTransmitter.addEventListener("loadedmetadata", () => {
      if (isFirstTrack) {
        theTransmitter.currentTime = getRandomStartTime(
          theTransmitter.duration,
        );
        isFirstTrack = false;
      }
      theTransmitter.play();
    });

    usedPieces.lateNight[nextLoFi] = true;

    theTransmitter.addEventListener("ended", playLateNightLoFi, { once: true });
  };

  // Set up the skip button to trigger the end event
  skipButton.addEventListener("click", () => {
    console.log("Skip button clicked");
    theTransmitter.pause();
    const endedEvent = new Event("ended");
    theTransmitter.dispatchEvent(endedEvent);
  });

  // KEEP AWAKE
  let wakeLock = null;
  async function requestWakeLock() {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        console.log("Wake Lock was released");
      });
      console.log("Wake Lock is active");
    } catch (err) {
      console.error(`${err.name}, ${err.message}`);
    }
  }

  // Event handler to start the application
  startButton.addEventListener("click", () => {
    console.log("Start button clicked");
    reset();
    initialize();
    requestWakeLock();
  });

  // Function to reset values and states within the application
  function reset() {
    isFirstTrack = true;
    currentMainTrackIndex = undefined;
    // Clear queue
    theTransmitter.removeEventListener("ended", playMainTrack);
    theTransmitter.removeEventListener("ended", playInterlude);
    theTransmitter.removeEventListener("ended", playLateNightLoFi);
  }
});
