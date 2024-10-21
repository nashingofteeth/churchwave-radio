document.addEventListener("DOMContentLoaded", () => {
  const theTransmitter = document.getElementById("theTransmitter");
  const startButton = document.getElementById("startButton");
  const seekButton = document.getElementById("seekButton");
  const loadingIndicator = document.getElementById("loading");

  let mainTracks = [];
  let interludes = {};
  let lateNightLoFis = [];
  const usedPieces = { 0: {}, 1: {}, 2: {}, 3: {}, lateNight: {} };
  let currentMainTrackIndex;
  let isFirstTrack = true;
  let simulatedDate = null; // Initialize with null for using real time by default
  let timeOfDay;

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

        loadingIndicator.style.display = "none";
        document.getElementById("revealed").style.display = "block";
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
    // requestWakeLock();
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
  });

  function reset() {
    isFirstTrack = true;
    currentMainTrackIndex = undefined;
    theTransmitter.pause();
    theTransmitter.removeEventListener("ended", playMainTrack);
    theTransmitter.removeEventListener("ended", playInterlude);
    theTransmitter.removeEventListener("ended", playLateNightLoFi);
  }

  async function requestWakeLock() {
    try {
      const wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        console.log("Wake Lock was released");
      });
      console.log("Wake Lock is active");
    } catch (err) {
      console.error(`${err.name}, ${err.message}`);
    }
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
});
