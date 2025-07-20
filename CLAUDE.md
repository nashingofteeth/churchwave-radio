# ChurchWave Radio - Project Overview

## Project Type
JavaScript-based radio station automation system for church/Christian radio broadcasting.

## Architecture
- **Frontend**: Vanilla HTML/CSS/JS with ES6 modules
- **Backend**: Node.js scripts for media processing
- **Audio**: HTML5 Audio API for playback
- **Data**: JSON-based configuration and track database

## Key Components

### Core Modules (`/modules/`)
- `app.js` - Main application initialization
- `core.js` - Core playback functions and data loading
- `player.js` - Audio playback logic and track selection
- `scheduling.js` - Scheduled content management
- `state.js` - Application state management
- `events.js` - UI event handlers
- `time.js` - Time simulation and utilities

### Configuration
- `config.json` - Main configuration file with media paths, genres, and system settings
- `tracks.json` - Generated track database (output from `populate-tracks.js`)

### Media Organization
- `media/algorithmic/` - Content selected algorithmically by time slots
  - `late-nite-lo-fis/` - Late night ambient (00:00-05:00)
  - `morning/` - Morning music with genre subfolders (05:00-08:00)
  - `standard/` - General daytime programming (08:00-23:59)
  - `junk/` - Station elements (ads, scripture, bumpers, interludes)
- `media/scheduled/` - Time-specific scheduled content
  - `daily/` - Every day at specific times
  - `days/` - Specific weekdays
  - `dates/` - Specific calendar dates

### Processing Scripts
- `populate-tracks.js` - Scans media directory and generates tracks database
- `validate-config.js` - Validates configuration structure and paths

## Key Features
- **Algorithmic Playback**: Time-based automatic music selection
- **Scheduled Programming**: Exact-time scheduled content
- **Genre Support**: Multiple Christian music genres (country, rock, praise, worship)
- **Station Elements**: Ads, scripture readings, bumpers, interludes
- **Time Simulation**: Debug feature to test different times
- **Duration Scanning**: FFmpeg integration for audio file analysis

## Development Workflow
1. Organize media files in proper directory structure
2. Configure `config.json` for your media layout and genres
3. Run `node validate-config.js` to check configuration
4. Run `node populate-tracks.js` to generate tracks database
5. Open `index.html` in browser to run the radio system

## Current Git Status
- Branch: `v2`
- Modified files: `modules/player.js`, `modules/scheduling.js`
- Recent commits focus on time simulation and pre-scheduled track handling

## Build/Test Commands
- Configuration validation: `node validate-config.js`
- Track database generation: `node populate-tracks.js`
- No specific linting or testing framework detected

## Technologies
- Vanilla JavaScript (ES6 modules)
- HTML5 Audio API
- Node.js for file processing
- FFmpeg for audio duration analysis
- JSON for configuration and data storage