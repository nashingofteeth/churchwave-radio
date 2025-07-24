# ChurchWave Radio - User Manual

A JavaScript-based radio station automation system for church/Christian radio broadcasting with algorithmic playback and scheduled programming.

## Overview

ChurchWave Radio is a web-based radio automation system that combines:
- **Algorithmic content selection** based on time of day
- **Scheduled programming** at specific times, dates, or days
- **Intelligent track management** to avoid repeats and ensure smooth transitions
- **Time simulation tools** for testing different broadcast scenarios

## Quick Start

1. **Set up your media directory** according to the structure below
2. **Configure settings** in `config.json`
3. **Validate configuration**: `node validate-config.js`
4. **Generate tracks database**: `node load-tracks.js`
5. **Open `index.html`** in your web browser to start broadcasting

## Media Directory Structure

Your media should be organized into two main categories:

### Algorithmic Content (`media/algorithmic/`)

Content selected automatically based on time of day:

```
media/algorithmic/
├── late-nite-lo-fis/        # Midnight to 5:00 AM
│   ├── ambient1.mp3
│   └── ambient2.mp3
├── morning/                 # 5:00 AM to 8:00 AM (genre-based)
│   ├── genre-country/
│   │   ├── country1.mp3
│   │   └── country2.mp3
│   ├── genre-rock/
│   │   └── rock1.mp3
│   └── genre-praise/
│       └── praise1.mp3
├── standard/                # 8:00 AM to midnight (general rotation)
│   ├── song1.mp3
│   └── song2.mp3
└── junk/                    # Station elements (mixed throughout)
    ├── ads/
    │   └── commercial1.mp3
    ├── scripture/
    │   └── verse1.mp3
    ├── interludes/
    │   └── interlude1.mp3
    ├── bumpers/
    │   └── id1.mp3
    └── ads-2/
        └── commercial2.mp3
```

### Scheduled Content (`media/scheduled/`)

Content that plays at exact times:

```
media/scheduled/
├── daily/                   # Every day at specific times
│   ├── 06-00-00/           # 6:00:00 AM daily
│   │   ├── genre-country/  # Genre-specific content
│   │   └── genre-rock/
│   └── 18-00-00/           # 6:00:00 PM daily
│       └── evening-show.mp3
├── dates/                   # Specific calendar dates
│   └── 2024-12-25/         # Christmas Day
│       └── 09-00-00/       # 9:00:00 AM
│           └── christmas-special.mp3
└── days/                    # Specific days of the week
    └── sunday/
        └── 10-00-00/       # Sunday 10:00:00 AM
            └── sunday-service.mp3
```

## How the Player Logic Works

### Algorithmic Playback System

The radio operates in **algorithmic mode** by default, selecting content based on the current time:

#### Time-Based Content Selection
- **Late Night (00:00-05:00)**: Ambient/lo-fi tracks from `late-nite-lo-fis/`
- **Morning (05:00-08:00)**: Genre-specific music from `morning/genre-*/` folders
- **Standard (08:00-23:59)**: General rotation from `standard/` folder
- **Junk Content**: Station elements mixed throughout all time periods

#### Morning Genre Selection
Each morning (4:00 AM), the system randomly assigns genres to morning hours:
- Hour 5: might get "country"
- Hour 6: might get "rock"  
- Hour 7: might get "praise"

This ensures variety while maintaining consistent genre blocks.

#### Intelligent Track Management
- **No immediate repeats**: Tracks are marked as "used" until the category pool is exhausted
- **Automatic pool refresh**: When all tracks in a category are used, the pool resets
- **Junk cycling**: Station elements follow a shuffled rotation to ensure variety

### Scheduled Content System

#### Pre-Schedule Behavior
Before scheduled content plays, the system switches to "junk-only" mode:
- **15 minutes before**: Only junk content (ads, scripture, bumpers, interludes)
- **5 minutes before**: Only non-bumper junk (no station IDs that might conflict)
- **At scheduled time**: Fades current track and plays scheduled content

#### Schedule Priority Hierarchy
When multiple items are scheduled for the same time:
1. **Dates** (specific calendar dates) - highest priority
2. **Days** (weekdays) - medium priority
3. **Daily** (every day) - lowest priority

#### Genre Matching for Scheduled Content
During morning hours, scheduled content tries to match the current algorithmic genre:
- If current hour is assigned "country" genre, scheduled content looks for `genre-country/` subfolder
- Falls back to non-genre content if no match found

### Pre-Schedule Duration Checking

The system prevents long tracks from interfering with scheduled content:
- Before playing any algorithmic track, checks if it will finish before the next scheduled item
- If track would run past scheduled time, plays junk content instead
- Ensures scheduled content always starts on time

## Front-End Interface

### Main Controls
- **TUNE IN TO THE TRUTH** button: Starts the radio system
- **Loading indicator**: Shows while system initializes
- **Playing indicator**: Animated satellite with music notes when broadcasting
- **Audio element**: HTML5 audio player (hidden, controlled by system)

### Visual Feedback
- **Marquee text**: Scrolling text at top and bottom of page
- **Pulsing satellite**: Indicates active broadcast
- **Animated music notes**: Visual representation of audio playback
- **Prayer text**: Protective blessing for the stream

## Testing Tools (Console Commands)

The application exposes several debugging functions accessible via browser console:

### Time Simulation
```javascript
// Jump to a specific time and simulate progression
simulateTime(14, 30, 0);  // 2:30 PM today
simulateTime(5, 0, 0);    // 5:00 AM today (morning genre time)
simulateTime(1, 0, 0);    // 1:00 AM today (late night time)

// Jump to a specific date and time
simulateTime(10, 0, 0, "12-25-2024");  // Christmas Day 10:00 AM
simulateTime(9, 30, 0, "07-04-2024");  // July 4th 9:30 AM

// Return to real time
clearSimulatedTime();

// Check current time (real or simulated)
getCurrentTime();
```

### Track Management
```javascript
// Skip to next track immediately
skipTrack();

// View current application state
appState;
```


### Testing Workflows

#### Test Morning Genre Selection
1. `simulateTime(4, 59, 50)` - Just before 5 AM
2. Wait for automatic genre assignment at 5:00 AM
3. `simulateTime(5, 0, 30)` - Check which genre was selected
4. `simulateTime(6, 0, 0)` - See if different genre for next hour

#### Test Scheduled Content
1. Add content to `media/scheduled/daily/HH-MM-SS/`
2. `simulateTime(HH, MM-16, 0)` - 16 minutes before
3. Watch system switch to junk-only mode at 15-minute mark
4. Watch fade and scheduled content start at exact time

#### Test Pre-Schedule Duration Logic
1. `simulateTime(17, 58, 0)` - 2 minutes before 6 PM scheduled content
2. Observe system playing only short junk tracks
3. Watch scheduled content start precisely at 6 PM

## Configuration Management

### Basic Setup (`config.json`)
```json
{
  "basePaths": {
    "local": "./media",
    "remote": "https://your-cdn.com/media"
  },
  "outputFile": "tracks.json",
  "timezone": "America/New_York",
  "fileExtensions": {
    "audio": [".mp3"]
  },
  "playback": {
    "fadeOutDuration": 3000
  }
}
```

### Genre Configuration
```json
"genres": {
  "country": "Country",
  "rock": "Rock", 
  "praise": "Praise & Worship"
}
```

### Track Configuration
```json
"tracks": {
  "algorithmic": {
    "lateNightLoFis": {
      "path": "late-nite-lo-fis",
      "startTime": "00:00:00",
      "endTime": "05:00:00"
    },
    "morning": {
      "path": "morning",
      "startTime": "05:00:00", 
      "endTime": "08:00:00"
    },
    "standard": {
      "path": "standard",
      "startTime": "08:00:00",
      "endTime": "00:00:00"
    },
    "junk": {
      "path": "junk",
      "ads": {
        "path": "ads",
        "type": "ads"
      },
      "scripture": {
        "path": "scripture",
        "type": "scripture"
      },
      "interludes": {
        "path": "interludes",
        "type": "interludes"
      },
      "bumpers": {
        "path": "bumpers",
        "type": "bumpers"
      },
      "ads2": {
        "path": "ads-2",
        "type": "ads2"
      }
    }
  },
  "scheduled": {
    "path": "scheduled",
    "recurrenceTypes": ["dates", "days", "daily"]
  }
}
```

## Build Commands

```bash
# Validate configuration file structure
node validate-config.js

# Generate track database from media files
node load-tracks.js
```

### What `load-tracks.js` Does
1. Scans media directory structure according to `config.json`
2. Extracts audio duration using FFmpeg
3. Organizes tracks by category (algorithmic vs scheduled)
4. Creates genre mappings for morning content
5. Generates `tracks.json` with preprocessed data structure
6. Caches duration information for faster subsequent runs

### What `validate-config.js` Does
1. Checks JSON syntax and structure
2. Validates required configuration properties
3. Verifies directory paths exist
4. Confirms genre configurations are complete
5. Validates time slot configurations
6. Checks scheduled content recurrence types

## Troubleshooting

### FFmpeg Issues
- **Error**: "FFmpeg not found"
- **Solution**: Install FFmpeg and add to system PATH
- **Windows**: Download from https://ffmpeg.org, extract, add bin folder to PATH

### Time Format Issues
- **Correct**: `09-30-00` (9:30:00 AM)
- **Wrong**: `09-30` (missing seconds), `9-30-00` (missing leading zero)

### Genre Directory Issues
- **Correct**: `genre-country`, `genre-rock`, `genre-praise`
- **Wrong**: `country` (missing prefix), `genre_country` (underscore instead of hyphen)

### Scheduling Not Working
1. Check that scheduled files exist in correct directory structure
2. Verify time format is `HH-MM-SS` with leading zeros
3. Confirm `tracks.json` was regenerated after adding scheduled content
4. Use time simulation to test: `simulateTime(HH, MM-1, 0)` to test 1 minute before

### Console Error: "Playback not initialized"
- Run `node load-tracks.js` to generate tracks database
- Refresh browser page
- Ensure `tracks.json` exists and contains valid data

## Technical Architecture

### Modules Overview
- **`app.js`**: Main initialization and console function exports
- **`core.js`**: Data loading and playback initialization  
- **`player.js`**: Audio playback logic and track selection algorithms
- **`scheduling.js`**: Scheduled content management and timing
- **`state.js`**: Global application state management
- **`events.js`**: Event listener management for audio element
- **`time.js`**: Time utilities and simulation system
### Performance Architecture
The system uses a **two-phase approach** for optimal performance:

1. **Backend Processing** (`load-tracks.js`): Heavy computation, file scanning, and optimization preprocessing
2. **Frontend Consumption**: Lightweight modules that use preprocessed data for instant operations

### Key Files
- **`index.html`**: Main web interface
- **`config.json`**: System configuration
- **`tracks.json`**: Generated track database (created by `load-tracks.js`)
- **`style.css`**: Interface styling
- **`load-tracks.js`**: Media scanning and database generation
- **`validate-config.js`**: Configuration validation utility

This system provides a robust foundation for automated Christian radio broadcasting with both scheduled programming and intelligent algorithmic content selection.
