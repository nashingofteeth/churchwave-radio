document.addEventListener("DOMContentLoaded", () => {
  const theTransmitter = document.getElementById("theTransmitter");
  let mainTracks = [];
  let timeBasedTracks = {};
  let lateNightTracks = [];

  const currentTime = new Date();
  const currentHour = currentTime.getHours();

  let timeOfDay;

  if (currentHour >= 5 && currentHour < 9) {
    timeOfDay = "morning";
  } else if (currentHour >= 9 && currentHour < 14) {
    timeOfDay = "day";
  } else if (currentHour >= 14 && currentHour < 19) {
    timeOfDay = "evening";
  } else if (currentHour >= 19 && currentHour < 24) {
    timeOfDay = "night";
  } else {
    timeOfDay = "lateNight";
  }

  let usedPieces = {};

  let currentMainTrackIndex;

  // Fetch JSON file and load tracks
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
    const currentMainTrack = mainTracks[currentMainTrackIndex];
    theTransmitter.src = currentMainTrack;
    theTransmitter.addEventListener("loadedmetadata", () => {
      theTransmitter.currentTime = getRandomStartTime(theTransmitter.duration);
      theTransmitter.play();
    });

    currentMainTrackIndex = (currentMainTrackIndex + 1) % mainTracks.length;
    theTransmitter.addEventListener("ended", playNextTrack, { once: true });
  };

  const playNextTrack = () => {
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
    usedPieces[currentMainTrackKey][nextTrack] = true;
    theTransmitter.src = nextTrack;
    theTransmitter.play();

    theTransmitter.addEventListener("ended", playMainTrack, { once: true });
  };

  const playLateNightTrack = () => {
    let availableTracks = lateNightTracks.filter(
      (track) => !usedPieces.lateNight[track],
    );

    if (availableTracks.length === 0) {
      usedPieces.lateNight = {};
      availableTracks = lateNightTracks;
    }

    const nextTrack =
      availableTracks[Math.floor(Math.random() * availableTracks.length)];
    usedPieces.lateNight[nextTrack] = true;
    theTransmitter.src = nextTrack;
    theTransmitter.play();

    theTransmitter.addEventListener("ended", playLateNightTrack, {
      once: true,
    });
  };
});
