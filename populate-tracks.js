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
    return isNaN(duration) ? null : Math.round(duration);
  } catch (error) {
    console.warn(`Warning: Could not get duration for ${filePath}: ${error.message}`);
    return null;
  }
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
          path: `${mediaConfig.mediaDirectory.replace('./', '')}/${relativePath.replace(/\\/g, '/')}`,
          filename: item.name
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
      return existing.files || {};
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
    const existingFile = Object.values(existingFiles).find(f => f.path === fileInfo.path);
    if (existingFile && existingFile.duration) {
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
    const existingFile = Object.values(existingFiles).find(f => f.path === fileInfo.path);
    if (existingFile && existingFile.duration) {
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
      case 'lateNightLoFis':
        const lateNightFiles = scanDirectory(subdirPath, `${config.path}/${subdirConfig.path}`);
        for (const fileInfo of lateNightFiles) {
          addFileToCollection(fileInfo, fileIndex, existingFiles, files, categories.lateNightLoFis);
        }
        break;

      case 'morning':
        processMorningMusic(subdirPath, `${config.path}/${subdirConfig.path}`, subdirConfig, fileIndex, existingFiles, files, categories);
        break;

      case 'standard':
        const standardFiles = scanDirectory(subdirPath, `${config.path}/${subdirConfig.path}`);
        for (const fileInfo of standardFiles) {
          addFileToCollection(fileInfo, fileIndex, existingFiles, files, categories.standardTracks);
        }
        break;

      case 'junk':
        processJunkContent(subdirPath, `${config.path}/${subdirConfig.path}`, subdirConfig, fileIndex, existingFiles, files, categories);
        break;
    }
  }
}

// Process morning music tracks
function processMorningMusic(mainDirPath, basePath, config, fileIndex, existingFiles, files, categories) {
  if (!config.subdirectories) {
    return;
  }

  const morningSubdirs = fs.readdirSync(mainDirPath, { withFileTypes: true })
    .filter(item => item.isDirectory())
    .map(item => item.name);

  for (const subdir of morningSubdirs) {
    const subdirPath = path.join(mainDirPath, subdir);
    let targetArray = [];
    let genreKey = '';

    // Find matching subdirectory config
    for (const [key, subdirConfig] of Object.entries(config.subdirectories)) {
      if (subdirConfig.path === subdir) {
        genreKey = key;
        targetArray = categories.morningMusic[key];
        break;
      }
    }

    if (targetArray) {
      const morningFiles = scanDirectory(subdirPath, `${basePath}/${subdir}`);
      for (const fileInfo of morningFiles) {
        addFileToCollection(fileInfo, fileIndex, existingFiles, files, targetArray);
      }
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
        targetArray = categories.junkContent[typeKey];
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
  return date instanceof Date && !isNaN(date) && date.toISOString().slice(0, 10) === dateStr;
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

// Process scheduled daily recurrence with genre support
function processScheduledDaily(recurrencePath, recurrence, fileIndex, existingFiles, files, categories) {
  const scheduledConfig = mediaConfig.directories.scheduled;
  const availableGenres = Object.keys(mediaConfig.genres);
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
      item.isDirectory() && availableGenres.includes(item.name)
    );

    if (genreSubdirs.length > 0) {
      // Handle genre subdirectories
      for (const genreItem of genreSubdirs) {
        const genrePath = path.join(timePath, genreItem.name);
        const scheduledFiles = scanDirectory(
          genrePath,
          `${scheduledConfig.path}/${recurrence}/${timeDir}/${genreItem.name}`,
          'scheduled',
          genreItem.name
        );

        for (const fileInfo of scheduledFiles) {
          addScheduledFileToCollection(fileInfo, fileIndex, existingFiles, files, categories, {
            time: timeString,
            recurrence: recurrence,
            genre: genreItem.name
          });
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
    const recurrenceConfig = scheduledConfig.recurrenceTypes[recurrence];

    if (!recurrenceConfig) {
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
  const categories = {
    lateNightLoFis: [],
    morningMusic: {
      country: [],
      rock: [],
      praise: []
    },
    standardTracks: [],
    junkContent: {
      ads: [],
      scripture: [],
      interludes: [],
      bumpers: [],
      ads2: []
    },
    scheduled: []
  };

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
    console.log(`🎵 Scanning durations for ${filesToScan.length} new/changed tracks...`);

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

// Generate the complete tracks.json
async function generateTracksJson() {
  console.log('🔍 Scanning media directory...');
  const { files, categories } = organizeTracksByStructure();

  // Scan durations
  await scanDurations(files);

  const tracksJson = {
    files,
    categories,
    metadata: {
      version: mediaConfig.metadata.version,
      lastUpdated: new Date().toISOString(),
      totalFiles: Object.keys(files).length
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
    console.log(`✅ Successfully generated ${mediaConfig.outputFile} with normalized structure`);
    console.log('📊 File statistics:');

    const data = JSON.parse(newTracksContent);
    console.log(`   Late Night Lo-Fis: ${data.categories.lateNightLoFis.length} tracks`);
    console.log(`   Morning Country: ${data.categories.morningMusic.country.length} tracks`);
    console.log(`   Morning Rock: ${data.categories.morningMusic.rock.length} tracks`);
    console.log(`   Morning Praise: ${data.categories.morningMusic.praise.length} tracks`);
    console.log(`   Standard Tracks: ${data.categories.standardTracks.length} tracks`);

    console.log(`   Junk - Ads: ${data.categories.junkContent.ads.length} tracks`);
    console.log(`   Junk - Scripture: ${data.categories.junkContent.scripture.length} tracks`);
    console.log(`   Junk - Interludes: ${data.categories.junkContent.interludes.length} tracks`);
    console.log(`   Junk - Bumpers: ${data.categories.junkContent.bumpers.length} tracks`);
    console.log(`   Junk - Ads 2: ${data.categories.junkContent.ads2.length} tracks`);

    console.log(`   Scheduled Entries: ${data.categories.scheduled.length} scheduled items`);

    console.log(`\n📊 Metadata summary:`);
    console.log(`   Total files: ${data.metadata.totalFiles}`);

    // Show some example durations with file keys
    const filesWithDurations = Object.entries(data.files)
      .filter(([_, fileInfo]) => fileInfo.duration > 0)
      .slice(0, 5);

    if (filesWithDurations.length > 0) {
      console.log(`\n🎵 Sample files with durations:`);
      filesWithDurations.forEach(([key, fileInfo]) => {
        const minutes = Math.floor(fileInfo.duration / 60);
        const seconds = fileInfo.duration % 60;
        console.log(`   ${key}: ${fileInfo.filename} (${minutes}:${seconds.toString().padStart(2, '0')})`);
      });
    }

  } catch (error) {
    console.error('❌ Error generating tracks.json:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();
