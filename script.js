document.addEventListener("DOMContentLoaded", () => {
  const theTransmitter = document.getElementById("theTransmitter");
  let mainTracks = [];
  let timeBasedTracks = {};

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

  const usedPieces = {
    morning: {},
    day: {},
    evening: {},
    night: {},
    lateNight: {},
  };

  let currentMainTrackIndex;

  // Fetch JSON file and load tracks
  fetch("tracks.json")
    .then((response) => response.json())
    .then((data) => {
      mainTracks = data.mainTracks;
      timeBasedTracks = data.timeBasedTracks;
      currentMainTrackIndex = Math.floor(Math.random() * mainTracks.length);
      playMainTrack(); // Start with a random main track
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

    // Set up to play the next time-based track when this main track ends
    theTransmitter.addEventListener("ended", playNextTrack, { once: true });
  };

  const playNextTrack = () => {
    let availableTracks = timeBasedTracks[timeOfDay].filter(
      (track) => !usedPieces[timeOfDay][track],
    );

    if (availableTracks.length === 0) {
      usedPieces[timeOfDay] = {};
      availableTracks = timeBasedTracks[timeOfDay];
    }

    const nextTrack =
      availableTracks[Math.floor(Math.random() * availableTracks.length)];
    usedPieces[timeOfDay][nextTrack] = true;
    theTransmitter.src = nextTrack;
    theTransmitter.play();

    // After the time-based track, schedule the next main track in sequence
    theTransmitter.addEventListener("ended", playMainTrack, { once: true });
  };
});
