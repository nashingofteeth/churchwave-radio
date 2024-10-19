const fs = require("node:fs");

// Load the JSON data
const rawData = fs.readFileSync("tracks.json");
const data = JSON.parse(rawData);

let filePaths = [];

// Collect all file paths
filePaths = filePaths.concat(data.mainTracks);

// biome-ignore lint/complexity/noForEach: <explanation>
Object.values(data.interludes).forEach((interlude) => {
  // biome-ignore lint/complexity/noForEach: <explanation>
  Object.values(interlude).forEach((timeOfDay) => {
    filePaths = filePaths.concat(timeOfDay);
  });
});

filePaths = filePaths.concat(data.lateNightLoFis);

// Check for existence
// biome-ignore lint/complexity/noForEach: <explanation>
filePaths.forEach((filePath) => {
  if (fs.existsSync(filePath)) {
    // console.log(`Exists: ${filePath}`);
  } else {
    console.log(`Missing: ${filePath}`);
  }
});
