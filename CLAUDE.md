# ChurchWave Radio - Project Overview

## Project Type
JavaScript-based radio station automation system for church/Christian radio broadcasting.

## Architecture
- **Frontend**: Vanilla HTML/CSS/JS with ES6 modules (located in `/docs/` for GitHub Pages)
- **Backend**: Node.js scripts for media processing (root directory)
- **Audio**: HTML5 Audio API for playback
- **Data**: JSON-based configuration and track database
- **Media Storage**: Supports both local and remote media paths via configurable base paths
- **Deployment**: Frontend served from `/docs/` folder for GitHub Pages compatibility

## Key Components

### Frontend (`/docs/`)
- `index.html` - Main web interface
- `style.css` - Interface styling  
- `satellite.gif` - Animated satellite image
- `favicon.ico` - Site favicon
- `config.json` - Frontend-specific configuration
- `/modules/` - Frontend JavaScript modules:
  - `app.js` - Main application initialization
  - `core.js` - Core playback functions and data loading
  - `player.js` - Audio playback logic and track selection
  - `scheduling.js` - Scheduled content management
  - `state.js` - Application state management
  - `events.js` - UI event handlers
  - `time.js` - Time simulation and utilities
  - `capabilities.js` - Feature detection and browser compatibility
  - `indicator.js` - Currently playing atmospheric text indicator
  - `messages.js` - Atmospheric message content for the indicator

### Backend (Root Directory)
- `app.js` - Media processing and track database generation (renamed from `load-tracks.js`)
- `validate-config.js` - Configuration file validation
- `package.json` - Node.js dependencies and scripts
- `config.json` - Backend processing configuration

### Configuration
- `/config.json` - Backend configuration for media processing
- `/docs/config.json` - Frontend configuration for playback
- `media/tracks.json` - Generated track database (output from backend processing)

### Media Organization
- `media/tracks/` - Main media directory containing all audio content
  - `algorithmic/` - Content selected algorithmically by time slots
    - `late-nite-lo-fis/` - Late night ambient content (00:00-05:00)
    - `morning/` - Morning music with genre subfolders (05:00-08:00)
      - `genre-country/`, `genre-praise/`, `genre-rock/` - Genre-specific morning content
    - `standard/` - General daytime programming (08:00-00:00)
    - `junk/` - Station elements (ads, ads-2, scripture, bumpers, interludes)
  - `scheduled/` - Time-specific scheduled content
    - `daily/` - Every day at specific times (00-00-00 through 23-00-00 folders)
    - `days/` - Specific weekdays (monday/, tuesday/, etc.)
    - `dates/` - Specific calendar dates

### Processing Scripts
- `app.js` - Scans media directory and generates tracks database
- `validate-config.js` - Validates configuration file formatting and structure
  - Only for validating the structure of config.json

## Key Features
- **Algorithmic Playback**: Time-based automatic music selection
- **Scheduled Programming**: Exact-time scheduled content with daily/weekly/date-specific options
- **Genre Support**: Multiple Christian music genres (country, rock, praise & worship)
- **Station Elements**: Multiple ad sets, scripture readings, bumpers, interludes
- **Morning Hour Protection**: Pre-scheduled junk cycles disabled during morning hours (05:00-08:00) to maintain genre consistency
- **Currently Playing Indicator**: Dynamic atmospheric text display that updates with each track change
- **Time Simulation**: Debug feature to test different broadcast times
- **Duration Scanning**: FFmpeg integration for audio file analysis
- **Remote Media Support**: Configurable local/remote media base paths
- **Fade Transitions**: Configurable fade-out duration between tracks

## Development Workflow
1. Organize media files in proper directory structure under `media/tracks/`
2. Configure `config.json` for your media layout and genres
3. Run `node validate-config.js` to check configuration
4. Run `node app.js` to generate tracks database
5. Open `docs/index.html` in browser to run the radio system

## Current Git Status
- Branch: `main` (merged from v2)
- Working tree clean
- Recent commits: README updates, config loading improvements, remote path changes

## Build/Test Commands
- Configuration validation: `node validate-config.js`
- Track database generation: `node app.js` (also available as `npm run update-tracks`)
- Process all: `npm run process` (validates config and generates tracks)
- Start processing: `npm start`
- Testing requires opening `docs/index.html` in browser and using time simulation features

## Current Version (v3.1)
Based on config metadata and recent optimizations:
- **Optimized data structure**: Streamlined tracks.json and config.json formats
- **Performance improvements**: Frontend preprocessing optimizations
- **Enhanced scheduling**: Improved scheduled content handling with proper caching
- **Remote media support**: Configurable base paths for local/remote media storage
- **Time zone support**: Configurable timezone (America/New_York)

## Media Statistics
Current media library includes:
- **Late night content**: ~100+ ambient/lo-fi tracks
- **Morning genres**: ~99 country, ~76 praise, ~99 rock tracks
- **Standard daytime**: 100 tracks
- **Station elements**: 20 ads, 20 ads-2, 20 scripture, 15 bumpers, 20 interludes
- **Scheduled content**: Hourly programming from 00:00-23:00 with genre-specific morning shows

## Technologies
- Vanilla JavaScript (ES6 modules)
- HTML5 Audio API
- Node.js for file processing
- FFmpeg for audio duration analysis
- JSON for configuration and data storage
- CSS for styling and responsive design