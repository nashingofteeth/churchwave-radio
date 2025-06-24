# ChurchWave Radio Configuration Guide

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
    │   ├── country/
    │   │   ├── song1.mp3
    │   │   └── song2.mp3
    │   ├── rock/
    │   │   └── song3.mp3
    │   └── praise/
    │       └── song4.mp3
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
    │   │   ├── country/        # Genre-specific (daily only)
    │   │   │   └── morning-country.mp3
    │   │   ├── rock/
    │   │   │   └── morning-rock.mp3
    │   │   └── praise/
    │   │       └── morning-praise.mp3
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
      "category": "lateNightLoFis"
    },
    "morning": {
      "path": "morning",
      "category": "morningMusic",
      "subdirectories": {
        "country": {
          "path": "country",
          "genre": "country"
        },
        "rock": {
          "path": "rock",
          "genre": "rock"
        },
        "praise": {
          "path": "praise",
          "genre": "praise"
        }
      }
    },
    "standard": {
      "path": "standard",
      "category": "standardTracks"
    },
    "junk": {
      "path": "junk",
      "category": "junkContent",
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

## Scheduled Content Types

### Daily (`daily/`)
Content that plays every day at specific times.
- **Folder format**: `HH-MM-SS` (24-hour format)
- **Genre support**: Yes (country, rock, praise subdirectories allowed)
- **Examples**:
  - `daily/17-00-00/` = 5:00:00 PM daily
  - `daily/06-30-15/country/` = 6:30:15 AM daily, country music
  - `daily/20-00-00/` = 8:00:00 PM daily

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

Define the music genres available in your system:

```json
"genres": {
  "country": {
    "name": "country",
    "displayName": "Country"
  },
  "rock": {
    "name": "rock",
    "displayName": "Rock"
  },
  "praise": {
    "name": "praise",
    "displayName": "Praise & Worship"
  }
}
```

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
   Morning Country: 120 tracks
   Morning Rock: 89 tracks
   Morning Praise: 67 tracks
   Standard Tracks: 1,234 tracks
   Junk - Ads: 25 tracks
   Junk - Scripture: 15 tracks
   Junk - Interludes: 30 tracks
   Junk - Bumpers: 20 tracks
   Junk - Ads 2: 18 tracks
   Scheduled Entries: 156 scheduled items
```

## Important Notes

- **Genre subdirectories are only supported in the `daily` scheduled recurrence type**
- **Unknown recurrence types will be ignored** (not processed)
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

### Missing Directories
The validation script will warn about missing directories. Create them as needed or update your configuration to match your actual structure.

## Customization

To customize the system for your needs:

1. **Change directory names**: Update the `path` properties in the configuration
2. **Add new genres**: Add entries to the `genres` section
3. **Add scheduled recurrence types**: Add new entries to `scheduled.recurrenceTypes`
4. **Modify processing behavior**: Adjust values in the `processing` section

The system is designed to be flexible and adapt to your specific radio station needs while maintaining a clean, organized structure.
