const fs = require('fs');
const path = require('path');

// Configuration validation script
function validateMediaConfig() {
  console.log('🔍 Validating media configuration...');

  try {
    // Load and parse configuration
    const configPath = './config.json';
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('✅ Configuration file loaded successfully');

    // Validate required top-level properties
    const requiredProps = ['basePaths', 'outputFile', 'tracks', 'genres', 'fileExtensions', 'processing', 'metadata'];
    for (const prop of requiredProps) {
      if (!(prop in config)) {
        throw new Error(`Missing required configuration property: ${prop}`);
      }
    }
    console.log('✅ All required top-level properties present');

    // Validate media directory exists
    const mediaDir = `${config.basePaths.local}/${config.tracks.path}`;
    if (!fs.existsSync(mediaDir)) {
      console.warn(`⚠️  Media directory does not exist: ${mediaDir}`);
    } else {
      console.log(`✅ Media directory exists: ${mediaDir}`);
    }

    // Validate directory configurations
    const requiredDirs = ['algorithmic', 'scheduled'];
    for (const dirKey of requiredDirs) {
      if (!(dirKey in config.tracks)) {
        throw new Error(`Missing tracks configuration: ${dirKey}`);
      }

      const dirConfig = config.tracks[dirKey];
      if (!dirConfig.path) {
        throw new Error(`Directory ${dirKey} missing 'path' property`);
      }

      // Check if directory exists in media folder
      const fullPath = path.join(mediaDir, dirConfig.path);
      if (fs.existsSync(fullPath)) {
        console.log(`✅ Directory exists: ${dirConfig.path}`);
      } else {
        console.warn(`⚠️  Directory not found: ${dirConfig.path}`);
      }
    }

    // Validate algorithmic configuration
    const algorithmicConfig = config.tracks.algorithmic;
    
    // Validate algorithmic time slots in subdirectories
    const timeSensitiveSubdirs = ['lateNightLoFis', 'morning', 'standard'];
    for (const subdir of timeSensitiveSubdirs) {
      if (!(subdir in algorithmicConfig)) {
        throw new Error(`Missing time-sensitive subdirectory: ${subdir}`);
      }
      
      const subdirConfig = algorithmicConfig[subdir];
      if (!subdirConfig.startTime || !subdirConfig.endTime) {
        throw new Error(`Subdirectory ${subdir} missing time slot properties (startTime, endTime)`);
      }
      
      // Validate time format (HH:MM:SS)
      const timeRegex = /^\d{2}:\d{2}:\d{2}$/;
      if (!timeRegex.test(subdirConfig.startTime)) {
        throw new Error(`Invalid startTime format for ${subdir}: ${subdirConfig.startTime} (should be HH:MM:SS)`);
      }
      if (!timeRegex.test(subdirConfig.endTime)) {
        throw new Error(`Invalid endTime format for ${subdir}: ${subdirConfig.endTime} (should be HH:MM:SS)`);
      }
    }
    console.log('✅ Algorithmic time slots configuration valid');

    const requiredAlgorithmicSubdirs = ['lateNightLoFis', 'morning', 'standard', 'junk'];
    for (const subdir of requiredAlgorithmicSubdirs) {
      if (!(subdir in algorithmicConfig)) {
        throw new Error(`Missing algorithmic subdirectory: ${subdir}`);
      }

      const subdirConfig = algorithmicConfig[subdir];
      if (!subdirConfig.path) {
        throw new Error(`Algorithmic subdirectory ${subdir} missing path`);
      }

      // Check if subdirectory exists
      const fullPath = path.join(mediaDir, algorithmicConfig.path, subdirConfig.path);
      if (fs.existsSync(fullPath)) {
        console.log(`✅ Algorithmic subdirectory exists: ${algorithmicConfig.path}/${subdirConfig.path}`);
      } else {
        console.warn(`⚠️  Algorithmic subdirectory not found: ${algorithmicConfig.path}/${subdirConfig.path}`);
      }
    }

    // Validate morning music directory (no longer has fixed subdirectories)
    const morningConfig = algorithmicConfig.morning;
    if (morningConfig) {
      const morningPath = path.join(mediaDir, algorithmicConfig.path, morningConfig.path);
      if (fs.existsSync(morningPath)) {
        console.log(`✅ Morning directory exists: ${algorithmicConfig.path}/${morningConfig.path}`);
        
        // Check for genre directories and validate against config
        try {
          const morningContents = fs.readdirSync(morningPath, { withFileTypes: true })
            .filter(item => item.isDirectory())
            .map(item => item.name);
          
          const genreDirs = morningContents.filter(dir => dir.startsWith('genre-'));
          if (genreDirs.length > 0) {
            console.log(`📁 Found genre directories in morning: ${genreDirs.join(', ')}`);
            
            for (const genreDir of genreDirs) {
              const genreKey = genreDir.replace('genre-', '');
              if (!(genreKey in config.genres)) {
                console.warn(`⚠️  Genre directory '${genreDir}' found but genre '${genreKey}' not configured`);
              } else {
                console.log(`✅ Genre directory '${genreDir}' matches configured genre '${genreKey}'`);
              }
            }
          }
        } catch (error) {
          console.warn(`⚠️  Could not read morning directory contents: ${error.message}`);
        }
      } else {
        console.warn(`⚠️  Morning directory not found: ${algorithmicConfig.path}/${morningConfig.path}`);
      }
    }

    // Validate junk content
    const junkConfig = algorithmicConfig.junk;
    if (junkConfig) {
      const requiredJunkSubdirs = ['ads', 'scripture', 'interludes', 'bumpers', 'ads2'];
      for (const subdir of requiredJunkSubdirs) {
        if (!(subdir in junkConfig)) {
          throw new Error(`Missing junk content subdirectory: ${subdir}`);
        }

        const subdirConfig = junkConfig[subdir];
        if (!subdirConfig.path || !subdirConfig.type) {
          throw new Error(`Junk subdirectory ${subdir} missing path or type`);
        }

        // Check if subdirectory exists
        const fullPath = path.join(mediaDir, algorithmicConfig.path, junkConfig.path, subdirConfig.path);
        if (fs.existsSync(fullPath)) {
          console.log(`✅ Junk subdirectory exists: ${algorithmicConfig.path}/${junkConfig.path}/${subdirConfig.path}`);
        } else {
          console.warn(`⚠️  Junk subdirectory not found: ${algorithmicConfig.path}/${junkConfig.path}/${subdirConfig.path}`);
        }
      }
    }

    // Validate scheduled configuration
    const scheduledConfig = config.tracks.scheduled;
    if (!scheduledConfig.recurrenceTypes) {
      throw new Error('Scheduled configuration missing recurrenceTypes');
    }

    const requiredRecurrenceTypes = ['dates', 'days', 'daily'];
    if (!Array.isArray(scheduledConfig.recurrenceTypes)) {
      throw new Error('Scheduled recurrenceTypes must be an array');
    }
    
    for (const recType of requiredRecurrenceTypes) {
      if (!scheduledConfig.recurrenceTypes.includes(recType)) {
        throw new Error(`Missing scheduled recurrence type: ${recType}`);
      }
    }

    // Check if scheduled directory exists
    const scheduledPath = path.join(mediaDir, scheduledConfig.path);
    if (fs.existsSync(scheduledPath)) {
      console.log(`✅ Scheduled directory exists: ${scheduledConfig.path}`);

      // Check for actual recurrence directories
      const actualRecurrences = fs.readdirSync(scheduledPath, { withFileTypes: true })
        .filter(item => item.isDirectory())
        .map(item => item.name);

      console.log(`📁 Found scheduled recurrence directories: ${actualRecurrences.join(', ')}`);

      // Warn about unknown recurrence types (they will be ignored)
      for (const actual of actualRecurrences) {
        if (!scheduledConfig.recurrenceTypes.includes(actual)) {
          console.warn(`⚠️  Unknown scheduled recurrence type found: ${actual} (will be ignored)`);
        }
      }

      // Validate date and time format in scheduled directories
      for (const recurrence of actualRecurrences) {
        if (scheduledConfig.recurrenceTypes.includes(recurrence)) {
          const recurrencePath = path.join(scheduledPath, recurrence);
          validateScheduledStructure(recurrencePath, recurrence, config);
        }
      }
    } else {
      console.warn(`⚠️  Scheduled directory not found: ${scheduledConfig.path}`);
    }

    // Validate genres
    if (!config.genres || Object.keys(config.genres).length === 0) {
      throw new Error('No genres defined in configuration');
    }
    
    for (const [genreKey, displayName] of Object.entries(config.genres)) {
      if (typeof displayName !== 'string' || displayName.length === 0) {
        throw new Error(`Genre ${genreKey} must have a non-empty display name`);
      }
    }
    console.log(`✅ All genres configured: ${Object.keys(config.genres).join(', ')}`);

    // Validate file extensions
    if (!config.fileExtensions.audio || !Array.isArray(config.fileExtensions.audio)) {
      throw new Error('File extensions for audio not properly configured');
    }

    if (config.fileExtensions.audio.length === 0) {
      throw new Error('No audio file extensions configured');
    }

    // Validate only MP3 is supported
    if (config.fileExtensions.audio.length !== 1 || config.fileExtensions.audio[0] !== '.mp3') {
      throw new Error('Only .mp3 files are supported');
    }
    console.log(`✅ Audio file extensions: ${config.fileExtensions.audio.join(', ')}`);

    // Validate processing settings
    const processingConfig = config.processing;
    const requiredProcessingProps = ['progressReportInterval', 'useCachedDurations'];
    for (const prop of requiredProcessingProps) {
      if (!(prop in processingConfig)) {
        throw new Error(`Missing processing configuration: ${prop}`);
      }
    }

    if (typeof processingConfig.progressReportInterval !== 'number' || processingConfig.progressReportInterval <= 0) {
      throw new Error('progressReportInterval must be a positive number');
    }

    if (typeof processingConfig.useCachedDurations !== 'boolean') {
      throw new Error('useCachedDurations must be a boolean');
    }
    console.log('✅ Processing configuration valid');

    // Validate metadata
    const metadataConfig = config.metadata;
    if (!metadataConfig.version) {
      throw new Error('Metadata configuration incomplete (missing version)');
    }
    console.log(`✅ Metadata configuration valid (version: ${metadataConfig.version})`);

    // Summary
    console.log('\n📊 Configuration Summary:');
    console.log(`   Media Directory: ${mediaDir}`);
    console.log(`   Output File: ${config.outputFile}`);
    console.log(`   Configured Tracks: ${Object.keys(config.tracks).length - 1}`); // -1 for path property
    console.log(`   Configured Genres: ${Object.keys(config.genres).length}`);
    console.log(`   Audio Extensions: ${config.fileExtensions.audio.length}`);
    console.log(`   Scheduled Recurrence Types: ${config.tracks.scheduled.recurrenceTypes.length}`);
    const timeSlotSubdirs = ['lateNightLoFis', 'morning', 'standard'];
    console.log(`   Algorithmic Time Slots: ${timeSlotSubdirs.length}`);
    
    console.log('\n⏰ Time Slot Summary:');
    for (const subdirName of timeSlotSubdirs) {
      const subdirConfig = config.tracks.algorithmic[subdirName];
      if (subdirConfig && subdirConfig.startTime && subdirConfig.endTime) {
        console.log(`   ${subdirName}: ${subdirConfig.startTime} - ${subdirConfig.endTime}`);
      }
    }
    
    console.log('\n✅ Configuration validation completed successfully!');
    return true;

  } catch (error) {
    console.error(`❌ Configuration validation failed: ${error.message}`);
    return false;
  }
}

// Validate scheduled directory structure and formats
function validateScheduledStructure(recurrencePath, recurrence, config) {
  try {
    if (recurrence === 'dates') {
      // Validate date folders (YYYY-MM-DD)
      const dateDirs = fs.readdirSync(recurrencePath, { withFileTypes: true })
        .filter(item => item.isDirectory())
        .map(item => item.name);

      for (const dateDir of dateDirs) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDir)) {
          console.warn(`⚠️  Invalid date format in scheduled/${recurrence}: ${dateDir} (should be YYYY-MM-DD)`);
          continue;
        }

        // Validate time folders within date
        const datePath = path.join(recurrencePath, dateDir);
        const timeDirs = fs.readdirSync(datePath, { withFileTypes: true })
          .filter(item => item.isDirectory())
          .map(item => item.name);

        for (const timeDir of timeDirs) {
          if (!/^\d{2}-\d{2}-\d{2}$/.test(timeDir)) {
            console.warn(`⚠️  Invalid time format in scheduled/${recurrence}/${dateDir}: ${timeDir} (should be HH-MM-SS)`);
          }
        }
      }
    } else if (recurrence === 'days') {
      // Validate day folders
      const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const dayDirs = fs.readdirSync(recurrencePath, { withFileTypes: true })
        .filter(item => item.isDirectory())
        .map(item => item.name);

      for (const dayDir of dayDirs) {
        if (!validDays.includes(dayDir.toLowerCase())) {
          console.warn(`⚠️  Invalid day name in scheduled/${recurrence}: ${dayDir} (should be a day of the week)`);
          continue;
        }

        // Validate time folders within day
        const dayPath = path.join(recurrencePath, dayDir);
        const timeDirs = fs.readdirSync(dayPath, { withFileTypes: true })
          .filter(item => item.isDirectory())
          .map(item => item.name);

        for (const timeDir of timeDirs) {
          if (!/^\d{2}-\d{2}-\d{2}$/.test(timeDir)) {
            console.warn(`⚠️  Invalid time format in scheduled/${recurrence}/${dayDir}: ${timeDir} (should be HH-MM-SS)`);
          }
        }
      }
    } else if (recurrence === 'daily') {
      // Validate time folders for daily recurrence (supports genres)
      const timeDirs = fs.readdirSync(recurrencePath, { withFileTypes: true })
        .filter(item => item.isDirectory())
        .map(item => item.name);
      
      for (const timeDir of timeDirs) {
        if (!/^\d{2}-\d{2}-\d{2}$/.test(timeDir)) {
          console.warn(`⚠️  Invalid time format in scheduled/${recurrence}: ${timeDir} (should be HH-MM-SS)`);
          continue;
        }
        
        // Check for genre directories in daily time folders
        const timePath = path.join(recurrencePath, timeDir);
        try {
          const timeContents = fs.readdirSync(timePath, { withFileTypes: true })
            .filter(item => item.isDirectory())
            .map(item => item.name);
          
          const genreDirs = timeContents.filter(dir => dir.startsWith('genre-'));
          if (genreDirs.length > 0) {
            for (const genreDir of genreDirs) {
              const genreKey = genreDir.replace('genre-', '');
              if (!(genreKey in config.genres)) {
                console.warn(`⚠️  Genre directory '${genreDir}' found in scheduled/${recurrence}/${timeDir}/ but genre '${genreKey}' not configured`);
              } else {
                console.log(`✅ Genre directory '${genreDir}' in scheduled/${recurrence}/${timeDir}/ matches configured genre '${genreKey}'`);
              }
            }
          }
        } catch (error) {
          console.warn(`⚠️  Could not read time directory contents in scheduled/${recurrence}/${timeDir}: ${error.message}`);
        }
      }
    } else {
      // Validate time folders for other recurrence types (no genre support)
      const timeDirs = fs.readdirSync(recurrencePath, { withFileTypes: true })
        .filter(item => item.isDirectory())
        .map(item => item.name);
      
      for (const timeDir of timeDirs) {
        if (!/^\d{2}-\d{2}-\d{2}$/.test(timeDir)) {
          console.warn(`⚠️  Invalid time format in scheduled/${recurrence}: ${timeDir} (should be HH-MM-SS)`);
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️  Could not validate scheduled structure for ${recurrence}: ${error.message}`);
  }
}

// Run validation if called directly
if (require.main === module) {
  const isValid = validateMediaConfig();
  process.exit(isValid ? 0 : 1);
}

module.exports = { validateMediaConfig };
