# Implementation Guidance for Copilot

This document consolidates implementation guidance for features requested across multiple PRs. **@copilot Please implement the work described below** in separate PRs or branches as appropriate.

---

## 1. Code Splitting (PR #104 / Issue #56)

**Goal:** Reduce initial load time by deferring heavy modules until needed.

**Current state:** `renderer.js` statically imports `splitVideo.js`, `mergeWorkflow.js`, `prerequisites.js`, `trimVideo.js`, `failedOperations.js` — all loaded upfront.

**Implementation:** Start with `splitVideo.js` and `prerequisites.js` — they are the most self-contained. Defer loading until user clicks "Split Video" or when prerequisites modal is shown.

```javascript
// Split Video: load only when user clicks "Split Video" button
let splitVideo = null;
splitVideoBtn.addEventListener('click', async () => {
  if (!splitVideo) {
    const mod = await import('./splitVideo.js');
    splitVideo = mod.initializeSplitVideo(domElements, state);
  }
  // ... existing logic to show modal
});

// Prerequisites: load when modal is first shown
let prerequisites = null;
// Wire prerequisitesModal show to lazy-load
```

**Note:** `mergeWorkflow.js` has complex dependencies (fileHandling, splitVideo, trimVideo, failedOperations). Consider lazy-loading it only when "Prepare Merge" is clicked; this may require refactoring to avoid circular deps. Start with splitVideo + prerequisites.

---

## 2. Centralized Logging (PR #101 / Issue #54)

**Goal:** Replace scattered `console.log/warn/error` with a configurable logger that supports file persistence and log levels.

**Implementation:**

Create `src/logger.js`:
- Levels: `debug`, `info`, `warn`, `error`
- Default: log to console; when `debugMode` preference is true, also append to `{userData}/logs/video-merger.log`
- Log rotation: max 5MB per file, keep 3 rotated files
- API: `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`, `logger.child(component)` for context

Extend `DEFAULT_PREFERENCES` in `src/preferences.js`:
```javascript
debugMode: false,
logLevel: 'info'
```

Add IPC handler `get-logs` for renderer to fetch recent log content (for troubleshooting UI).

**Files to modify:** Create `src/logger.js`, update `main.js` to use it, add `load-preferences` check for debug mode.

---

## 3. Video Comparison Tool (PR #93 / Issue #50)

**Goal:** Side-by-side video comparison (before/after merge, A/B testing of settings).

**Implementation:**

Create `renderer/videoComparison.js`:
- Module pattern like `splitVideo.js` — `initializeVideoComparison(domElements, state)`
- UI: Modal with two HTML5 `<video>` elements, synchronized playback (shared `currentTime`), layout toggle (side-by-side / stacked)
- IPC: Reuse existing `get-video-metadata`, `generate-thumbnail`, add `load-video-for-preview` if needed (or use file:// in video src with proper path handling)
- Entry point: Add "Compare Videos" button in file list or preview screen; opens modal when 2 files selected
- Phases: (1) Basic split-screen sync playback, (2) Post-merge comparison, (3) Export comparison frame

**Files to create:** `renderer/videoComparison.js`  
**Files to modify:** `renderer/index.html` (modal markup), `renderer/renderer.js` (import and wire button)

---

## 4. Export to Different Formats (PR #81 / Issue #44)

**Goal:** Allow user to choose output format (MP4, MOV, MKV, WebM) instead of hardcoded MP4.

**Current state:** `mergeWorkflow.js` hardcodes `.MP4`; `main.js` merge handler uses `-c copy` or quality-based encoding.

**Implementation:**

1. Add format dropdown in preview screen (before merge): `MP4`, `MOV`, `MKV`, `WebM`
2. Extend `DEFAULT_PREFERENCES`: `preferredOutputFormat: 'mp4'`
3. Add IPC `set-preferred-output-format` and load in merge workflow
4. In `main.js` merge handler: derive output extension from format; for `-c copy`, ensure container supports codecs. For WebM, may need `-c:v libvpx -c:a libopus` (re-encode).
5. Update `mergeWorkflow.js` lines ~167, 169, 221 to use selected format when building `outputPath` and `outputFileName`

**Files to modify:** `main.js`, `renderer/mergeWorkflow.js`, `renderer/index.html`, `src/preferences.js`, `preload.js`

---

## 5. Audio Level Normalization (PR #83 / Issue #45)

**Goal:** Optional loudnorm filter when merging to fix volume jumps between clips.

**Current state:** Merge uses `-c copy` (no re-encode). Audio levels can vary between GoPro clips.

**Implementation:**

1. Add checkbox in preview screen: "Normalize audio levels" (default: off)
2. Extend `DEFAULT_PREFERENCES`: `normalizeAudio: false`
3. In `main.js` merge handler, when `normalizeAudio` is true:
   - Replace `-c copy` with `-c:v copy -c:a aac -af loudnorm=I=-16:TP=-1.5:LRA=11`
   - Progress message: "Merging with audio normalization..."
4. Add IPC `set-normalize-audio` and wire checkbox

**Files to modify:** `main.js`, `renderer/mergeWorkflow.js`, `renderer/index.html`, `src/preferences.js`, `preload.js`

---

## 6. File Size Estimation (PR #63)

**Goal:** Show estimated output size before merge (already partially done — see `getTotalFileSize` and `estimatedOutputSize` in mergeWorkflow).

**Status:** `mergeWorkflow.js` already calls `getTotalFileSize` and displays `estimatedOutputSizeFormatted`. For `-c copy`, input size ≈ output size. If guidance PR intended something more (e.g., per-format estimation for re-encode), add a helper that estimates based on duration × bitrate for re-encode scenarios.

**Action:** Verify UI displays this; if not, ensure `group.estimatedOutputSizeFormatted` is shown in preview list items.

---

## 7. Video Preview / Thumbnails (PR #65 / Issue #43)

**Goal:** Show thumbnails for videos in file list and preview.

**Current state:** `generate-thumbnail` IPC exists; `get-video-metadata` returns duration, etc.

**Implementation:**

1. In `fileHandling.js` / `renderer.js` when building file list items: call `window.electronAPI.generateThumbnail(filePath, 1)` (1 second in) for each file
2. Create `<img>` or `<canvas>` with thumbnail data URL; display next to filename
3. Cache thumbnails in a `Map` keyed by `filePath` to avoid re-fetching on re-render
4. Limit concurrent thumbnail requests (e.g., 4 at a time) to avoid blocking
5. Optionally add thumbnail column in preview list

**Files to modify:** `renderer/fileHandling.js`, `renderer/mergeWorkflow.js` (if preview list shows thumbnails), `renderer/index.html` (structure for thumbnail img)

---

## 8. Export Settings Persistence (PR #74 / Issue #40)

**Status: Already Implemented.** `mergeWorkflow.js` calls `setLastOutputDestination(result.path)` when user selects a folder (line 325) and `setLastOutputDestination(null)` when clicking "Use Default" (line 344). `setPreferredQuality` is called on merge (line 820). No action needed.

---

## Already Implemented (No Action)

- **Real-time FFmpeg progress (#60):** `main.js` lines 660–715 parse `time=HH:MM:SS.mm` from ffmpeg stderr and send `merge-progress` to renderer. ETA is computed. No further work needed.
- **Video metadata / ffprobe:** `get-video-metadata` returns duration, resolution, codec, bitrate. Used where needed.

---

## Clarification Needed (Do Not Implement Yet)

- **Export History (#97):** Three possible meanings — (1) merge operation log, (2) filename pattern export, (3) project state save/load. Product owner must specify which to implement.

---

## Copilot Implementation Request

**@copilot Please implement items 1–7 above** in separate branches or PRs as appropriate. Skip items marked "Already Implemented" and "Clarification Needed."

Recommended order:
1. **Export to Different Formats** (high user value, well-scoped)
2. **Audio Level Normalization** (high user value for GoPro users)
3. **Video Preview / Thumbnails** (improves UX)
4. **Centralized Logging** (foundation for debugging)
5. **Code Splitting** (performance)
6. **Video Comparison Tool** (larger feature)
7. **File Size Estimation** (verify existing behavior)
