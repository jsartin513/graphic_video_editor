# Architecture Overview

This document describes the high-level architecture of the Video Editor application.

## Application Model

The app is an Electron desktop application with:
- **Main process** – Node.js, handles system APIs, file I/O, FFmpeg
- **Renderer process** – Chromium, UI and user interaction
- **Preload script** – Bridges main and renderer via IPC (context-isolation safe)

## IPC Architecture

IPC handlers are organized into modules under `main/`:

| Module | Channels | Purpose |
|--------|----------|---------|
| `ipc-file.js` | select-files, select-folder, get-file-metadata, process-dropped-paths, open-recent-directory | File selection, metadata, drag-and-drop |
| `ipc-preferences.js` | load-preferences, save-preferences, save-filename-pattern, set-date-format, etc. | Preferences, patterns, date tokens, updates |
| `ipc-video.js` | analyze-videos, get-video-duration, get-video-metadata, generate-thumbnail, get-total-file-size | Video analysis and metadata |
| `ipc-merge-split.js` | merge-videos, cancel-merge, split-video, cancel-split, trim-video, get-output-directory, select-output-destination | Video merge, split, trim operations |
| `ipc-misc.js` | open-folder, open-external, check-ffmpeg, get-test-videos-path, install-prerequisites | System utilities |
| `ipc-updates.js` | check-for-updates, download-update | Auto-update |
| `ipc-logger.js` | get-logs, get-log-files, clear-logs, export-logs, get-debug-mode, set-debug-mode | Log viewer and debug mode |
| `ipc-sd-card.js` | get-gopro-sd-cards, open-sd-card-directory, load-sd-card-files, set-auto-detect-sd-cards, etc. | SD card detection and failed operations |

## Core Modules (`src/`)

| Module | Purpose |
|--------|---------|
| `preferences.js` | Load/save preferences, recent directories, filename patterns |
| `video-grouping.js` | Group videos by session ID for merge workflow |
| `video-scanner.js` | Recursively scan directories for video files |
| `ffmpeg-resolver.js` | Resolve FFmpeg/FFprobe paths (bundled or system) |
| `quality-utils.js` | Quality presets and validation for merge |
| `error-mapper.js` | Map technical errors to user-friendly messages |
| `renderer-utils.js` | Pure formatting helpers (duration, paths, bitrate, etc.) |
| `undo-redo-manager.js` | Undo/redo history for file list |

## Data Flow

1. **Renderer** calls `window.electronAPI.someMethod(...)` (defined in preload)
2. **Preload** forwards to main via `ipcRenderer.invoke('some-channel', ...)`
3. **Main** handler (registered by an `ipc-*.js` module) runs and returns a result
4. **Renderer** receives the promise result and updates the UI

## Testing

- **Unit tests** (`__tests__/*.test.js`) – Test `src/` modules and IPC handlers with mocks
- **Jest** – Node environment; `__mocks__/electron.js` for IPC/dialog
- **Coverage** – Targets `src/**/*.js` (70% threshold)

## Security

- Context isolation is enabled; renderer has no direct Node access
- Only preload-exposed APIs are available to the renderer
- `open-external` restricts URLs to `http:` and `https:`
