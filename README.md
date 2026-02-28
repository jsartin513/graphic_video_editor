# Video Editor

A Mac desktop application for selecting and reviewing GoPro video files before merging them.

## Features

- Select multiple video files via file picker dialog
- Select a folder containing video files (recursively scans for videos)
- Drag and drop video files or folders directly into the app
- View selected files with metadata (file size, modification date)
- Remove individual files from the selection list
- **Smart filename preferences** - Remember and suggest filename patterns
- **Date token support** - Use {date}, {year}, {month}, {day} in filenames
- **Auto-complete patterns** - Recent patterns suggested as you type

## Getting Started

### Prerequisites

**For Running the App:**
- macOS 10.13 or later
- **No Node.js needed** - the app is a standalone macOS application
- **No ffmpeg installation needed** - included in fat builds (recommended)

**For Building/Developing:**
- Node.js (v14 or higher) - only needed for development/building
- npm - only needed for development/building

### Installing Prerequisites

Run the installation script to automatically install ffmpeg and Homebrew (if needed):

```bash
./install_prerequisites.sh
```

Or check if prerequisites are installed:

```bash
./check_prerequisites.sh
```

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the application:
```bash
npm start
```

## Supported Video Formats

- MP4
- MOV
- AVI
- MKV
- M4V

## Project Structure

- `main.js` - Electron main process (handles file dialogs and system operations)
- `preload.js` - Secure preload script (exposes safe APIs to renderer)
- `src/` - Core modules
  - `video-grouping.js` - Groups GoPro videos by session ID
  - `preferences.js` - User preferences storage and management
- `renderer/` - UI files
  - `index.html` - Main HTML structure
  - `styles.css` - Application styling
  - `renderer.js` - UI logic and event handlers
  - `mergeWorkflow.js` - Video merging workflow with preferences

## User Preferences

The app remembers your filename patterns and preferences to make renaming files easier. See [FILENAME_PREFERENCES.md](FILENAME_PREFERENCES.md) for details on:
- Using recent pattern suggestions
- Date token support ({date}, {year}, {month}, {day})
- Customizing date formats

## Testing

The project includes comprehensive unit and integration tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

**Test Coverage**: High coverage across multiple unit and integration test suites (see coverage reports for current metrics).

See [TESTING_GUIDE.md](TESTING_GUIDE.md) for detailed testing documentation.

## Development

The application uses Electron with context isolation for security. File operations are handled in the main process, and the renderer communicates with it via IPC.

## Building for Distribution

### Prerequisites

- Node.js (v14 or higher)
- npm
- ffmpeg (only needed if building "lite" version without bundled dependencies)

### Build Options

**Fat Build (with bundled ffmpeg) - Recommended for distribution:**
```bash
npm run build:fat          # Build both architectures
npm run build:fat:arm64    # Apple Silicon only
npm run build:fat:x64      # Intel only
```

**Lite Build (requires system ffmpeg):**
```bash
npm run build:lite         # Build both architectures
npm run build:lite:arm64   # Apple Silicon only
npm run build:lite:x64     # Intel only
```

**Default (bundles by default):**
```bash
npm run build              # Same as build:fat
```

The app will automatically use bundled ffmpeg if included, or fall back to system-installed ffmpeg if not.

### Important: "App is Damaged" Error

If users see "app is damaged" when opening the app, this is macOS Gatekeeper blocking unsigned apps. **Solution**: Right-click the app and select "Open", then click "Open" in the security dialog. See [INSTALLATION_TROUBLESHOOTING.md](INSTALLATION_TROUBLESHOOTING.md) for details.

### Build Steps

1. Install dependencies:
```bash
npm install
```

2. Build the application:
```bash
npm run build
```

This will create a distributable package in the `dist/` directory:
- **DMG file**: For easy installation on macOS (Video Editor-1.0.0.dmg)
- **ZIP file**: Alternative distribution format

### Installing ffmpeg

Users will need ffmpeg installed on their system. On macOS, they can install it via Homebrew:

```bash
brew install ffmpeg
```

### Distribution

The built DMG file can be distributed to users. When they open it, they can drag the app to their Applications folder.

**Note**: The app requires ffmpeg to be installed on the user's system. Make sure to include this requirement in your distribution notes.

