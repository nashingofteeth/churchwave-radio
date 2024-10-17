document.addEventListener("DOMContentLoaded", () => {
  const theTransmitter = document.getElementById("theTransmitter");
  let mainTracks = [];
  let timeBasedTracks = {};
  let lateNightTracks = [];

  const updateTimeOfDay = () => {
    const currentHour = new Date().getHours();

    if (currentHour >= 0 && currentHour < 5) {
      return "lateNight";
    }
    if (currentHour >= 5 && currentHour < 9) {
      return "morning";
    }
    if (currentHour >= 9 && currentHour < 14) {
      return "day";
    }
    if (currentHour >= 14 && currentHour < 19) {
      return "evening";
    }
    if (currentHour >= 19 && currentHour < 24) {
      return "night";
    }
  };

  let timeOfDay = updateTimeOfDay();
  let usedPieces = {};
  let currentMainTrackIndex;
  let isFirstMainTrack = true;

  fetch("tracks.json")
    .then((response) => response.json())
    .then((data) => {
      mainTracks = data.mainTracks;
      timeBasedTracks = data.timeBasedTracks;
      lateNightTracks = data.lateNightTracks;

      if (timeOfDay === "lateNight") {
        usedPieces = { lateNight: {} };
        playLateNightTrack();
      } else {
        usedPieces = { 0: {}, 1: {}, 2: {}, 3: {} };
        currentMainTrackIndex = Math.floor(Math.random() * mainTracks.length);
        playMainTrack();
      }
    })
    .catch((error) => console.error("Error loading tracks:", error));

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
      if (isFirstMainTrack) {
        theTransmitter.currentTime = getRandomStartTime(
          theTransmitter.duration,
        );
        isFirstMainTrack = false;
      }
      theTransmitter.play();
    });

    theTransmitter.addEventListener("ended", playNextTrack, { once: true });
  };

  const playNextTrack = () => {
    timeOfDay = updateTimeOfDay(); // Update time of day before selecting track

    const currentMainTrackKey = currentMainTrackIndex.toString();
    let availableTracks = timeBasedTracks[currentMainTrackKey][
      timeOfDay
    ].filter((track) => !usedPieces[currentMainTrackKey][track]);

    if (availableTracks.length === 0) {
      usedPieces[currentMainTrackKey] = {};
      availableTracks = timeBasedTracks[currentMainTrackKey][timeOfDay];
    }

    const nextTrack =
      availableTracks[Math.floor(Math.random() * availableTracks.length)];
    theTransmitter.src = nextTrack;
    console.log(`Playing time-based track: ${nextTrack}`);
    theTransmitter.currentTime = 0;
    usedPieces[currentMainTrackKey][nextTrack] = true;
    theTransmitter.play();

    theTransmitter.addEventListener("ended", playMainTrack, { once: true });
  };

  const playLateNightTrack = () => {
    timeOfDay = updateTimeOfDay(); // Update time of day before checking

    if (timeOfDay === "morning") {
      console.log("Transitioning to morning. Playing OVERTURE.");
      theTransmitter.src = "media/01-album-pieces/00-OVERTURE-(demo).wav";
      theTransmitter.currentTime = 0;
      theTransmitter.play();

      // After OVERTURE, continue with regular main track logic
      theTransmitter.addEventListener("ended", playMainTrack, { once: true });
      return;
    }

    let availableTracks = lateNightTracks.filter(
      (track) => !usedPieces.lateNight[track],
    );

    if (availableTracks.length === 0) {
      usedPieces.lateNight = {};
      availableTracks = lateNightTracks;
    }

    const nextTrack =
      availableTracks[Math.floor(Math.random() * availableTracks.length)];
    theTransmitter.src = nextTrack;
    console.log(`Playing late night track: ${nextTrack}`);
    theTransmitter.currentTime = 0;
    usedPieces.lateNight[nextTrack] = true;
    theTransmitter.play();

    theTransmitter.addEventListener("ended", playLateNightTrack, {
      once: true,
    });
  };
});
