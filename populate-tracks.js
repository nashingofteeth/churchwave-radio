const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Load media configuration
const mediaConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// Function to get duration of MP3 file using ffprobe
async function getDuration(filePath) {
  try {
    const { stdout } = await execAsync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`);
    const duration = parseFloat(stdout.trim());
    return Number.isNaN(duration) ? null : Math.round(duration);
  } catch (error) {
    console.warn(`Warning: Could not get duration for ${filePath}: ${error.message}`);
    return null;
  }
}

// Function to parse time string (HH:MM:SS)
function parseTimeString(timeString) {
  const [hours, minutes, seconds] = timeString.split(':').map(Number);
  return { hours, minutes, seconds };
}

// Function to recursively scan directories and collect file info
function scanDirectory(dir, basePath = '', category = '', genre = null) {
  const fileInfos = [];

  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      const relativePath = basePath ? path.join(basePath, item.name) : item.name;

      if (item.isDirectory()) {
        // Recursively scan subdirectories
        fileInfos.push(...scanDirectory(fullPath, relativePath, category, genre));
      } else if (item.isFile() && mediaConfig.fileExtensions.audio.some(ext => item.name.toLowerCase().endsWith(ext))) {
        // Add audio files with metadata
        const fileInfo = {
          path: `${mediaConfig.mediaDirectory.replace('./', '')}/${relativePath.replace(/\\/g, '/')}`
        };

        // Add genre if specified
        if (genre) {
          fileInfo.genre = genre;
        }

        fileInfos.push(fileInfo);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dir}: ${error.message}`);
  }

  return fileInfos;
}

// Function to load existing tracks for duration caching
function loadExistingTracks() {
  if (!mediaConfig.processing.useCachedDurations) {
    return {};
  }

  try {
    if (fs.existsSync(mediaConfig.outputFile)) {
      const existing = JSON.parse(fs.readFileSync(mediaConfig.outputFile, 'utf8'));
      const existingFiles = {};

      // Extract tracks from the current data structure
      if (existing.preprocessed) {
        // Extract from timeSlots
        if (existing.preprocessed.timeSlots) {
          const timeSlots = existing.preprocessed.timeSlots;

          // Late night lo-fis
          if (timeSlots.lateNightLoFis?.tracks) {
            timeSlots.lateNightLoFis.tracks.forEach(track => {
              existingFiles[track.path] = track;
            });
          }

          // Morning music
          if (timeSlots.morning?.tracks) {
            timeSlots.morning.tracks.forEach(track => {
              existingFiles[track.path] = track;
            });
          }

          // Standard tracks
          if (timeSlots.standard?.tracks) {
            timeSlots.standard.tracks.forEach(track => {
              existingFiles[track.path] = track;
            });
          }
        }

        // Extract from junkContent
        if (existing.preprocessed.junkContent?.types) {
          Object.values(existing.preprocessed.junkContent.types).forEach(type => {
            if (type.tracks) {
              type.tracks.forEach(track => {
                existingFiles[track.path] = track;
              });
            }
          });
        }

        // Extract from scheduledTracks
        if (existing.preprocessed.scheduledTracks?.byHour) {
          Object.values(existing.preprocessed.scheduledTracks.byHour).forEach(hourTracks => {
            hourTracks.forEach(item => {
              if (item.trackData) {
                existingFiles[item.trackData.path] = item.trackData;
              }
            });
          });
        }
      }

      return existingFiles;
    }
  } catch (error) {
    console.warn(`Warning: Could not load existing ${mediaConfig.outputFile} for caching`);
  }
  return {};
}

// Helper function to add file to collection with duration caching
function addFileToCollection(fileInfo, fileIndex, existingFiles, files, targetArray) {
  const key = fileIndex.value++;
  // Check if we have existing duration data
  if (mediaConfig.processing.useCachedDurations) {
    const existingFile = existingFiles[fileInfo.path];
    if (existingFile?.duration) {
      fileInfo.duration = existingFile.duration;
    }
  }
  files[key] = fileInfo;
  targetArray.push(key);
  return key;
}

// Helper function to add scheduled file to collection
function addScheduledFileToCollection(fileInfo, fileIndex, existingFiles, files, categories, scheduledEntry) {
  const key = fileIndex.value++;
  // Check if we have existing duration data
  if (mediaConfig.processing.useCachedDurations) {
    const existingFile = existingFiles[fileInfo.path];
    if (existingFile?.duration) {
      fileInfo.duration = existingFile.duration;
    }
  }
  files[key] = fileInfo;
  categories.scheduled.push({
    ...scheduledEntry,
    trackKey: key
  });
  return key;
}

// Process algorithmic content (late night lo-fis, morning, standard, junk)
function processAlgorithmic(mainDirPath, fileIndex, existingFiles, files, categories) {
  const config = mediaConfig.directories.algorithmic;

  for (const [subdirKey, subdirConfig] of Object.entries(config.subdirectories)) {
    const subdirPath = path.join(mainDirPath, subdirConfig.path);

    if (!fs.existsSync(subdirPath)) {
      console.warn(`Warning: Algorithmic subdirectory not found: ${subdirConfig.path}`);
      continue;
    }

    switch (subdirKey) {
      case 'lateNightLoFis': {
        const lateNightFiles = scanDirectory(subdirPath, `${config.path}/${subdirConfig.path}`);
        for (const fileInfo of lateNightFiles) {
          addFileToCollection(fileInfo, fileIndex, existingFiles, files, categories.algorithmic.lateNightLoFis);
        }
        break;
      }

      case 'morning':
        processMorningMusic(subdirPath, `${config.path}/${subdirConfig.path}`, subdirConfig, fileIndex, existingFiles, files, categories);
        break;

      case 'standard': {
        const standardFiles = scanDirectory(subdirPath, `${config.path}/${subdirConfig.path}`);
        for (const fileInfo of standardFiles) {
          addFileToCollection(fileInfo, fileIndex, existingFiles, files, categories.algorithmic.standardTracks);
        }
        break;
      }

      case 'junk':
        processJunkContent(subdirPath, `${config.path}/${subdirConfig.path}`, subdirConfig, fileIndex, existingFiles, files, categories);
        break;
    }
  }
}

// Process morning music tracks with flexible genre support
function processMorningMusic(mainDirPath, basePath, config, fileIndex, existingFiles, files, categories) {
  const morningSubdirs = fs.readdirSync(mainDirPath, { withFileTypes: true })
    .filter(item => item.isDirectory())
    .map(item => item.name);

  for (const subdir of morningSubdirs) {
    const subdirPath = path.join(mainDirPath, subdir);

    // Check if this is a genre directory (starts with 'genre-')
    if (subdir.startsWith('genre-')) {
      const genreKey = subdir.replace('genre-', '');

      // Only process if genre is configured
      if (mediaConfig.genres[genreKey]) {
        if (!categories.algorithmic.morningMusic[genreKey]) {
          categories.algorithmic.morningMusic[genreKey] = [];
        }

        const morningFiles = scanDirectory(subdirPath, `${basePath}/${subdir}`);
        for (const fileInfo of morningFiles) {
          addFileToCollection(fileInfo, fileIndex, existingFiles, files, categories.algorithmic.morningMusic[genreKey]);
        }
      } else {
        console.warn(`Warning: Genre '${genreKey}' found in directory but not configured - ignoring ${subdir}`);
      }
    } else {
      // Ignore non-genre directories in morning music
      console.warn(`Warning: Non-genre directory '${subdir}' found in morning music - ignoring (use genre-* format)`);
    }
  }
}



// Process junk content tracks
function processJunkContent(mainDirPath, basePath, config, fileIndex, existingFiles, files, categories) {
  if (!config.subdirectories) {
    return;
  }

  const junkSubdirs = fs.readdirSync(mainDirPath, { withFileTypes: true })
    .filter(item => item.isDirectory())
    .map(item => item.name);

  for (const subdir of junkSubdirs) {
    const subdirPath = path.join(mainDirPath, subdir);
    let targetArray = [];
    let typeKey = '';

    // Find matching subdirectory config
    for (const [key, subdirConfig] of Object.entries(config.subdirectories)) {
      if (subdirConfig.path === subdir) {
        typeKey = subdirConfig.type;
        targetArray = categories.algorithmic.junkContent[typeKey];
        break;
      }
    }

    if (targetArray) {
      const junkFiles = scanDirectory(subdirPath, `${basePath}/${subdir}`);
      for (const fileInfo of junkFiles) {
        addFileToCollection(fileInfo, fileIndex, existingFiles, files, targetArray);
      }
    }
  }
}

// Validate date format (YYYY-MM-DD)
function isValidDateFormat(dateStr) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;

  const date = new Date(dateStr);
  return date instanceof Date && !Number.isNaN(date) && date.toISOString().slice(0, 10) === dateStr;
}

// Validate time format (HH-MM-SS)
function isValidTimeFormat(timeStr) {
  const timeRegex = /^\d{2}-\d{2}-\d{2}$/;
  if (!timeRegex.test(timeStr)) return false;

  const [hours, minutes, seconds] = timeStr.split('-').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59;
}

// Process scheduled dates (specific YYYY-MM-DD folders)
function processScheduledDates(recurrencePath, recurrence, fileIndex, existingFiles, files, categories) {
  const scheduledConfig = mediaConfig.directories.scheduled;
  const dates = fs.readdirSync(recurrencePath, { withFileTypes: true })
    .filter(item => item.isDirectory())
    .map(item => item.name)
    .filter(date => {
      if (!isValidDateFormat(date)) {
        console.warn(`Warning: Invalid date format '${date}' in timeline/${recurrence}/`);
        return false;
      }
      return true;
    });

  for (const date of dates) {
    const datePath = path.join(recurrencePath, date);
    const times = fs.readdirSync(datePath, { withFileTypes: true })
      .filter(item => item.isDirectory())
      .map(item => item.name)
      .filter(timeDir => {
        if (!isValidTimeFormat(timeDir)) {
          console.warn(`Warning: Invalid time format '${timeDir}' in scheduled/${recurrence}/${date}/`);
          return false;
        }
        return true;
      });

    for (const timeDir of times) {
      const timePath = path.join(datePath, timeDir);
      const timeString = timeDir.replace(/-/g, ':');
      const scheduledFiles = scanDirectory(timePath, `${scheduledConfig.path}/${recurrence}/${date}/${timeDir}`);

      for (const fileInfo of scheduledFiles) {
        addScheduledFileToCollection(fileInfo, fileIndex, existingFiles, files, categories, {
          time: timeString,
          date: date
        });
      }
    }
  }
}

// Process scheduled days of the week
function processScheduledDays(recurrencePath, recurrence, fileIndex, existingFiles, files, categories) {
  const scheduledConfig = mediaConfig.directories.scheduled;
  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayDirs = fs.readdirSync(recurrencePath, { withFileTypes: true })
    .filter(item => item.isDirectory())
    .map(item => item.name)
    .filter(day => {
      if (!validDays.includes(day.toLowerCase())) {
        console.warn(`Warning: Invalid day name '${day}' in scheduled/${recurrence}/`);
        return false;
      }
      return true;
    });

  for (const day of dayDirs) {
    const dayPath = path.join(recurrencePath, day);
    const times = fs.readdirSync(dayPath, { withFileTypes: true })
      .filter(item => item.isDirectory())
      .map(item => item.name)
      .filter(timeDir => {
        if (!isValidTimeFormat(timeDir)) {
          console.warn(`Warning: Invalid time format '${timeDir}' in scheduled/${recurrence}/${day}/`);
          return false;
        }
        return true;
      });

    for (const timeDir of times) {
      const timePath = path.join(dayPath, timeDir);
      const timeString = timeDir.replace(/-/g, ':');
      const scheduledFiles = scanDirectory(timePath, `${scheduledConfig.path}/${recurrence}/${day}/${timeDir}`);

      for (const fileInfo of scheduledFiles) {
        addScheduledFileToCollection(fileInfo, fileIndex, existingFiles, files, categories, {
          time: timeString,
          recurrence: day
        });
      }
    }
  }
}

// Process scheduled daily recurrence with flexible genre support
function processScheduledDaily(recurrencePath, recurrence, fileIndex, existingFiles, files, categories) {
  const scheduledConfig = mediaConfig.directories.scheduled;
  const times = fs.readdirSync(recurrencePath, { withFileTypes: true })
    .filter(item => item.isDirectory())
    .map(item => item.name)
    .filter(timeDir => {
      if (!isValidTimeFormat(timeDir)) {
        console.warn(`Warning: Invalid time format '${timeDir}' in scheduled/${recurrence}/`);
        return false;
      }
      return true;
    });

  for (const timeDir of times) {
    const timePath = path.join(recurrencePath, timeDir);
    const timeString = timeDir.replace(/-/g, ':');

    // Check if this time directory has genre subdirectories (only for daily)
    const timeContents = fs.readdirSync(timePath, { withFileTypes: true });
    const genreSubdirs = timeContents.filter(item =>
      item.isDirectory() && item.name.startsWith('genre-')
    );

    if (genreSubdirs.length > 0) {
      // Handle genre subdirectories
      for (const genreItem of genreSubdirs) {
        const genreKey = genreItem.name.replace('genre-', '');

        // Only process if genre is configured
        if (mediaConfig.genres[genreKey]) {
          const genrePath = path.join(timePath, genreItem.name);
          const scheduledFiles = scanDirectory(
            genrePath,
            `${scheduledConfig.path}/${recurrence}/${timeDir}/${genreItem.name}`,
            'scheduled',
            genreKey
          );

          for (const fileInfo of scheduledFiles) {
            addScheduledFileToCollection(fileInfo, fileIndex, existingFiles, files, categories, {
              time: timeString,
              recurrence: recurrence,
              genre: genreKey
            });
          }
        } else {
          console.warn(`Warning: Genre '${genreKey}' found in directory but not configured - ignoring ${genreItem.name}`);
        }
      }
    } else {
      // Handle direct files in time directory
      const scheduledFiles = scanDirectory(timePath, `${scheduledConfig.path}/${recurrence}/${timeDir}`);

      for (const fileInfo of scheduledFiles) {
        addScheduledFileToCollection(fileInfo, fileIndex, existingFiles, files, categories, {
          time: timeString,
          recurrence: recurrence
        });
      }
    }
  }
}



// Process scheduled tracks
function processScheduled(mainDirPath, fileIndex, existingFiles, files, categories) {
  const scheduledConfig = mediaConfig.directories.scheduled;
  const scheduledPath = path.join(mainDirPath, scheduledConfig.path);
  if (!fs.existsSync(scheduledPath)) {
    return;
  }

  const recurrenceTypes = fs.readdirSync(scheduledPath, { withFileTypes: true })
    .filter(item => item.isDirectory())
    .map(item => item.name);

  for (const recurrence of recurrenceTypes) {
    const recurrencePath = path.join(scheduledPath, recurrence);

    if (!scheduledConfig.recurrenceTypes.includes(recurrence)) {
      console.warn(`Warning: Unknown recurrence type '${recurrence}' - ignoring`);
      continue;
    }

    switch (recurrence) {
      case 'dates':
        processScheduledDates(recurrencePath, recurrence, fileIndex, existingFiles, files, categories);
        break;
      case 'days':
        processScheduledDays(recurrencePath, recurrence, fileIndex, existingFiles, files, categories);
        break;
      case 'daily':
        processScheduledDaily(recurrencePath, recurrence, fileIndex, existingFiles, files, categories);
        break;

    }
  }
}

// Function to organize files and create normalized structure
function organizeTracksByStructure() {
  const mediaDir = mediaConfig.mediaDirectory;

  if (!fs.existsSync(mediaDir)) {
    throw new Error(`Media directory not found. Make sure ${mediaDir} exists.`);
  }

  const existingFiles = loadExistingTracks();
  const files = {};

  // Build categories structure dynamically based on config
  const categories = {
    algorithmic: {
      lateNightLoFis: [],
      morningMusic: {},
      standardTracks: [],
      junkContent: {
        ads: [],
        scripture: [],
        interludes: [],
        bumpers: [],
        ads2: []
      }
    },
    scheduled: []
  };

  // Initialize morning music genres dynamically
  for (const genreKey of Object.keys(mediaConfig.genres)) {
    categories.algorithmic.morningMusic[genreKey] = [];
  }

  // Scan each main directory
  const mainDirs = fs.readdirSync(mediaDir, { withFileTypes: true })
    .filter(item => item.isDirectory())
    .map(item => item.name)
    .sort();

  // Use object to pass by reference for fileIndex
  const fileIndex = { value: 1 };

  for (const mainDir of mainDirs) {
    const mainDirPath = path.join(mediaDir, mainDir);

    // Find matching directory configuration
    let processed = false;
    for (const [configKey, dirConfig] of Object.entries(mediaConfig.directories)) {
      if (dirConfig.path === mainDir) {
        switch (configKey) {
          case 'algorithmic':
            processAlgorithmic(mainDirPath, fileIndex, existingFiles, files, categories);
            break;
          case 'scheduled':
            processScheduled(mediaDir, fileIndex, existingFiles, files, categories);
            break;
        }
        processed = true;
        break;
      }
    }

    if (!processed) {
      console.warn(`Warning: Unknown directory '${mainDir}' - skipping`);
    }
  }

  return { files, categories };
}

// Function to scan durations
async function scanDurations(files) {
  const fileKeys = Object.keys(files);
  const filesToScan = fileKeys.filter(key => !files[key].duration);
  const cachedCount = fileKeys.length - filesToScan.length;

  if (cachedCount > 0) {
    console.log(`📋 Using cached durations for ${cachedCount} files`);
  }

  if (filesToScan.length > 0) {
    console.log(`🎵 Scanning durations for ${filesToScan.length} new tracks...`);

    let processed = 0;

    for (const key of filesToScan) {
      processed++;

      // Show progress every 50 files
      if (processed % mediaConfig.processing.progressReportInterval === 0) {
        console.log(`   Progress: ${processed}/${filesToScan.length} (${Math.round(processed / filesToScan.length * 100)}%)`);
      }

      const fileInfo = files[key];

      // Get duration
      const duration = await getDuration(fileInfo.path);
      if (duration !== null) {
        fileInfo.duration = duration;
      }
    }

    console.log(`✅ Duration scanning complete for ${filesToScan.length} files`);
  } else {
    console.log(`✅ All durations found in cache - no scanning needed`);
  }
}

// Function to pre-process time slots for algorithmic tracks
function preprocessTimeSlots(files, categories) {
  // Extract time ranges from config
  const lateNightLoFisConfig = mediaConfig.directories.algorithmic.subdirectories.lateNightLoFis;
  const morningConfig = mediaConfig.directories.algorithmic.subdirectories.morning;
  const standardConfig = mediaConfig.directories.algorithmic.subdirectories.standard;

  // Parse time ranges to get hour arrays
  const parseTimeToHours = (startTime, endTime) => {
    const getHours = (timeStr) => parseInt(timeStr.split(':')[0], 10);
    const startHour = getHours(startTime);
    const endHour = getHours(endTime);

    const hours = [];
    let currentHour = startHour;

    // Handle cases where end time is on the next day
    if (endHour <= startHour) {
      // Add hours from start hour to midnight
      while (currentHour < 24) {
        hours.push(currentHour);
        currentHour++;
      }
      // Add hours from midnight to end hour
      currentHour = 0;
      while (currentHour <= endHour) {
        hours.push(currentHour);
        currentHour++;
      }
    } else {
      // Simple case: start hour to end hour
      while (currentHour <= endHour) {
        hours.push(currentHour);
        currentHour++;
      }
    }

    return hours;
  };

  const lateNightLoFisHours = parseTimeToHours(lateNightLoFisConfig.startTime, lateNightLoFisConfig.endTime);
  const morningHours = parseTimeToHours(morningConfig.startTime, morningConfig.endTime);
  const standardHours = parseTimeToHours(standardConfig.startTime, standardConfig.endTime);

  const timeSlots = {
    lateNightLoFis: {
      tracks: categories.algorithmic.lateNightLoFis.map(key => ({
        key,
        ...files[key]
      }))
    },
    morning: {
      genres: {},
      tracks: []
    },
    standard: {
      tracks: categories.algorithmic.standardTracks.map(key => ({
        key,
        ...files[key]
      }))
    }
  };

  // Process morning genres
  for (const [genreKey, trackKeys] of Object.entries(categories.algorithmic.morningMusic)) {
    timeSlots.morning.genres[genreKey] = {
      tracks: trackKeys.map(key => ({
        key,
        ...files[key],
        genre: genreKey
      }))
    };

    // Also add to main morning tracks array
    timeSlots.morning.tracks.push(...timeSlots.morning.genres[genreKey].tracks);
  }

  return timeSlots;
}

// Function to pre-process junk content for cycling
function preprocessJunkContent(files, categories) {
  const junkContent = {
    cycleOrder: ['ads', 'scripture', 'interludes', 'ads2', 'bumpers'],
    types: {}
  };

  for (const [junkType, trackKeys] of Object.entries(categories.algorithmic.junkContent)) {
    junkContent.types[junkType] = {
      tracks: trackKeys.map(key => ({
        key,
        ...files[key]
      }))
    };
  }

  return junkContent;
}

// Function to pre-process scheduled tracks with parsed times and dates
function preprocessScheduledTracks(files, categories) {
  const processedScheduled = categories.scheduled.map(scheduledItem => {
    const trackData = files[scheduledItem.trackKey];
    const { hours, minutes, seconds } = parseTimeString(scheduledItem.time);

    const processed = {
      ...scheduledItem,
      trackData: trackData,
      parsedTime: {
        hours,
        minutes,
        seconds
      },
      priority: scheduledItem.date ? 1 : (scheduledItem.recurrence && scheduledItem.recurrence !== 'daily' ? 2 : 3)
    };

    // Add day of week info if exists
    if (scheduledItem.recurrence && scheduledItem.recurrence !== 'daily') {
      const dayMap = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6
      };
      processed.dayOfWeek = dayMap[scheduledItem.recurrence.toLowerCase()];
    }

    return processed;
  });

  // Group by hour for efficient lookups (only what frontend uses)
  const byHour = {};

  processedScheduled.forEach(item => {
    const hourKey = item.parsedTime.hours;
    if (!byHour[hourKey]) byHour[hourKey] = [];
    byHour[hourKey].push(item);
  });

  return {
    byHour
  };
}


// Generate the complete tracks.json
async function generateTracksJson() {
  console.log('🔍 Scanning media directory...');
  const { files, categories } = organizeTracksByStructure();

  // Scan durations
  await scanDurations(files);

  console.log('🔧 Pre-processing data for front-end optimization...');

  // Pre-process different track types
  const timeSlots = preprocessTimeSlots(files, categories);
  const junkContent = preprocessJunkContent(files, categories);
  const scheduledTracks = preprocessScheduledTracks(files, categories);

  const tracksJson = {
    preprocessed: {
      timeSlots,
      junkContent,
      scheduledTracks
    },

    metadata: {
      lastUpdated: new Date().toISOString()
    }
  };

  return JSON.stringify(tracksJson, null, 2);
}

// Write the new tracks.json
async function main() {
  try {
    console.log('🚀 Starting track population with normalized structure...');

    // Check if ffprobe is available
    try {
      await execAsync('ffprobe -version');
    } catch (error) {
      console.error('❌ ffprobe not found. Please install FFmpeg to scan durations.');
      console.log('   On macOS: brew install ffmpeg');
      console.log('   On Ubuntu: sudo apt install ffmpeg');
      console.log('   On Windows: Download from https://ffmpeg.org/');
      process.exit(1);
    }

    const newTracksContent = await generateTracksJson();
    fs.writeFileSync(mediaConfig.outputFile, newTracksContent);
    console.log(`✅ Successfully generated optimized ${mediaConfig.outputFile}`);
    
    const data = JSON.parse(newTracksContent);
    
    // Simple statistics
    const totalAlgorithmic = data.preprocessed.timeSlots.lateNightLoFis.tracks.length + 
                           data.preprocessed.timeSlots.morning.tracks.length + 
                           data.preprocessed.timeSlots.standard.tracks.length;
    
    const totalJunk = Object.values(data.preprocessed.junkContent.types)
                           .reduce((sum, type) => sum + type.tracks.length, 0);
    
    const totalScheduled = Object.values(data.preprocessed.scheduledTracks.byHour)
                               .reduce((sum, hour) => sum + hour.length, 0);
    
    console.log(`📊 ${totalAlgorithmic} algorithmic tracks, ${totalJunk} junk tracks, ${totalScheduled} scheduled tracks`);

  } catch (error) {
    console.error('❌ Error generating tracks.json:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();
