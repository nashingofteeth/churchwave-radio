# Churchwave Radio Configuration Guide

This project is a comprehensive media processing system for radio station management. It scans your media directory structure and generates a `tracks.json` file that organizes content for both algorithmic selection and scheduled playback.

## Overview

The configuration system allows you to customize:
- Media directory structure and paths
- Audio file types to process (currently MP3 only)
- Scheduled content options
- Processing behavior
- Output settings

## Quick Start

1. **Set up your media directory** according to the structure below
2. **Configure settings** in `config.json`
3. **Validate configuration**: `node validate-config.js`
4. **Generate tracks file**: `node populate-tracks.js`

## Media Directory Structure

Your media should be organized into two main categories:

### Algorithmic Content (`algorithmic/`)
Content that will be selected algorithmically by your radio system:

```
media/
└── algorithmic/
    ├── late-nite-lo-fis/        # Late night ambient tracks
    │   ├── track1.mp3
    │   └── track2.mp3
    ├── morning/                 # Morning music by genre
    │   ├── genre-country/       # Country music (genre prefix required)
    │   │   ├── song1.mp3
    │   │   └── song2.mp3
    │   ├── genre-rock/          # Rock music
    │   │   └── song3.mp3
    │   ├── genre-praise/        # Praise music
    │   │   └── song4.mp3
    │   └── genre-worship/       # Worship music (any genre can be added)
    │       └── song5.mp3
    ├── standard/                # General music library
    │   ├── regular1.mp3
    │   └── regular2.mp3
    └── junk/                    # Station elements
        ├── ads/
        │   └── ad1.mp3
        ├── scripture/
        │   └── verse1.mp3
        ├── interludes/
        │   └── interlude1.mp3
        ├── bumpers/
        │   └── bumper1.mp3
        └── ads-2/
            └── ad2.mp3
```

### Scheduled Content (`scheduled/`)
Content that plays at specific times:

```
media/
└── scheduled/
    ├── daily/                   # Every day at specific times
    │   ├── 06-00-00/           # 6:00:00 AM daily
    │   │   ├── genre-country/  # Genre-specific (daily only, with prefix)
    │   │   │   └── morning-country.mp3
    │   │   ├── genre-rock/
    │   │   │   └── morning-rock.mp3
    │   │   ├── genre-praise/
    │   │   │   └── morning-praise.mp3
    │   │   └── genre-worship/  # Any configured genre can be used
    │   │       └── morning-worship.mp3
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

## Configuration File Structure

The `config.json` file controls all system behavior:

### Basic Settings
```json
{
  "mediaDirectory": "./media",
  "outputFile": "tracks.json",
  "fileExtensions": {
    "audio": [".mp3"]
  }
}
```

### Algorithmic Content Configuration
```json
"algorithmic": {
  "path": "algorithmic",
  "category": "algorithmic",
  "subdirectories": {
    "lateNightLoFis": {
      "path": "late-nite-lo-fis",
      "category": "lateNightLoFis",
      "startTime": "00:00:00",
      "endTime": "05:00:00",
      "description": "Late night ambient tracks"
    },
    "morning": {
      "path": "morning",
      "category": "morningMusic",
      "startTime": "05:00:00",
      "endTime": "08:00:00",
      "description": "Morning praise music"
    },
    "standard": {
      "path": "standard",
      "category": "standardTracks",
      "startTime": "08:00:00",
      "endTime": "23:59:59",
      "description": "Standard daytime programming"
    },
    "junk": {
      "path": "junk",
      "category": "junkContent",
      "description": "Mixed throughout the day, not time-specific",
      "subdirectories": {
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
    }
  }
}
```

### Scheduled Content Configuration
```json
"scheduled": {
  "path": "scheduled",
  "category": "scheduled",
  "recurrenceTypes": {
    "dates": {
      "name": "dates",
      "description": "Specific dates (YYYY-MM-DD folders)",
      "supportsGenres": false,
      "structure": "dates/YYYY-MM-DD/HH-MM-SS"
    },
    "days": {
      "name": "days",
      "description": "Days of the week",
      "supportsGenres": false,
      "structure": "days/dayname/HH-MM-SS"
    },
    "daily": {
      "name": "daily",
      "description": "Daily recurring schedule",
      "supportsGenres": true,
      "structure": "daily/HH-MM-SS[/genre]"
    }
  }
}
```

## Time Slot Configuration

The algorithmic content is associated with specific time slots that define when each category should be played. Time slot information is included in each subdirectory configuration:

### Time Slots
- **Late Night Lo-Fis** (00:00:00 - 05:00:00): Ambient tracks for overnight hours
- **Morning Music** (05:00:00 - 08:00:00): Morning praise music
- **Standard Tracks** (08:00:00 - 23:59:59): General daytime programming
- **Junk Content**: Mixed throughout the day, not time-specific

### Time Slot Configuration Format
Each time-sensitive subdirectory includes timing information:
```json
"subdirectories": {
  "categoryName": {
    "path": "folder-name",
    "category": "categoryName",
    "startTime": "HH:MM:SS",
    "endTime": "HH:MM:SS", 
    "description": "Description of when this plays"
  }
}
```

**Note**: This time slot information is separate from the folder structure and tracks.json output. It will be used by the player application to determine which algorithmic content to play at different times of day.

## Scheduled Content Types

### Daily (`daily/`)
Content that plays every day at specific times.
- **Folder format**: `HH-MM-SS` (24-hour format)
- **Genre support**: Yes (any configured genre with `genre-` prefix)
- **Examples**:
  - `daily/17-00-00/` = 5:00:00 PM daily
  - `daily/06-30-15/genre-country/` = 6:30:15 AM daily, country music
  - `daily/20-00-00/genre-worship/` = 8:00:00 PM daily, worship music
  - `daily/12-00-00/` = 12:00:00 PM daily (no genre)

### Days (`days/`)
Content that plays on specific days of the week.
- **Day folders**: `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`
- **Time folders**: `HH-MM-SS` format inside each day
- **Genre support**: No
- **Examples**:
  - `days/friday/21-00-00/` = Friday 9:00:00 PM
  - `days/sunday/10-00-00/` = Sunday 10:00:00 AM

### Dates (`dates/`)
Content that plays on specific calendar dates.
- **Date folders**: `YYYY-MM-DD` format
- **Time folders**: `HH-MM-SS` format inside each date
- **Genre support**: No
- **Examples**:
  - `dates/2024-12-25/12-00-00/` = Christmas Day 12:00:00 PM
  - `dates/2024-01-01/00-00-00/` = New Year midnight

## Genre Configuration

Define the music genres available in your system. **All genre directories must be prefixed with `genre-`**:

```json
"genres": {
  "country": {
    "path": "genre-country",
    "displayName": "Country"
  },
  "rock": {
    "path": "genre-rock", 
    "displayName": "Rock"
  },
  "praise": {
    "path": "genre-praise",
    "displayName": "Praise & Worship"
  },
  "worship": {
    "path": "genre-worship",
    "displayName": "Worship"
  },
  "contemporary": {
    "path": "genre-contemporary",
    "displayName": "Contemporary Christian"
  }
}
```

### Genre System Features:
- **Flexible**: Add any genre with any name
- **Prefix required**: All genre directories must start with `genre-`
- **Auto-discovery**: Genres found in directories but not configured will be ignored with warnings
- **Display names**: Each genre can have a user-friendly display name
- **Key matching**: The genre key should match the folder name after `genre-` prefix
- **Genre-only**: Morning music only accepts `genre-*` directories, non-genre directories are ignored

## Processing Configuration

Control how the system processes your media:

```json
"processing": {
  "progressReportInterval": 50,
  "concurrentDurationScans": 10,
  "useCachedDurations": true
}
```

- **progressReportInterval**: Show progress every N files during duration scanning
- **concurrentDurationScans**: Maximum number of files to scan simultaneously (future use)
- **useCachedDurations**: Whether to use cached duration information from previous runs

## File Processing

- **Only MP3 files are supported** - other formats will be ignored
- The system recursively scans all subdirectories within configured paths
- Duration information is automatically extracted using FFmpeg
- File paths in the output automatically use the `mediaDirectory` setting

## Usage

### Validate Configuration
```bash
node validate-config.js
```

This will verify:
- Configuration file syntax
- Required properties are present
- Directory paths exist
- Genre configurations are complete
- Scheduled recurrence types are valid
- Date and time folder formats are correct
- Only MP3 files are configured
- Algorithmic time slots are properly configured

### Generate Tracks File
```bash
node populate-tracks.js
```

This will:
- Scan your media directory structure
- Extract duration information from MP3 files
- Generate `tracks.json` with organized content categories
- Cache duration information for faster subsequent runs

### Example Output Statistics
```
📊 File statistics:
   Late Night Lo-Fis: 45 tracks
   Morning Music:
     Country: 120 tracks
     Rock: 89 tracks
     Praise & Worship: 67 tracks
     Worship: 45 tracks
     Contemporary Christian: 23 tracks
   Standard Tracks: 1,234 tracks
   Junk - Ads: 25 tracks
   Junk - Scripture: 15 tracks
   Junk - Interludes: 30 tracks
   Junk - Bumpers: 20 tracks
   Junk - Ads 2: 18 tracks
   Scheduled Entries: 156 scheduled items
```

## Important Notes

- **Genre directories must use `genre-` prefix** (e.g., `genre-country`, `genre-rock`)
- **Genre subdirectories are only supported in the `daily` scheduled recurrence type**
- **Unknown recurrence types will be ignored** (not processed)
- **Unknown genres will be ignored** (directories found but not configured)
- Time directories use 24-hour format with hyphens (e.g., `09-30-00` for 9:30:00 AM)
- Date directories use YYYY-MM-DD format (e.g., `2024-12-25`)
- Day directories must use full day names in lowercase (e.g., `monday`)
- Invalid date/time formats will generate warnings and be skipped
- Duration information can be cached to speed up subsequent runs
- Multiple files in the same time folder will be handled according to your radio system logic

## Troubleshooting

### FFmpeg Not Found
If you get an FFmpeg error:
- **macOS**: `brew install ffmpeg`
- **Ubuntu**: `sudo apt install ffmpeg`
- **Windows**: Download from https://ffmpeg.org/

### Invalid Time Formats
Make sure all time directories use `HH-MM-SS` format:
- ✅ `09-30-00` (9:30:00 AM)
- ❌ `09-30` (missing seconds)
- ❌ `9-30-00` (missing leading zero)

### Invalid Genre Formats
Make sure all genre directories use the `genre-` prefix:
- ✅ `genre-country` (correct prefix)
- ✅ `genre-contemporary` (any name after prefix)
- ❌ `country` (missing prefix)
- ❌ `genre_country` (underscore instead of hyphen)

### Missing Directories
The validation script will warn about missing directories. Create them as needed or update your configuration to match your actual structure.

## Customization

To customize the system for your needs:

1. **Change directory names**: Update the `path` properties in the configuration
2. **Add new genres**: Add entries to the `genres` section with `genre-` prefix in path
4. **Add scheduled recurrence types**: Add new entries to `scheduled.recurrenceTypes`
5. **Modify processing behavior**: Adjust values in the `processing` section
6. **Genre flexibility**: Create any `genre-*` directories and configure them in the config file
7. **Adjust time slots**: Modify `timeSlots` to change when algorithmic content plays
