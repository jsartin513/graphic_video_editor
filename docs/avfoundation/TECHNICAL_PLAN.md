# AVFoundation migration — technical plan

## Context

Video Merger today shells out to **FFmpeg/FFprobe** from the Electron main process:

| Module | Operations |
|--------|------------|
| `main/ipc-merge-split.js` | Merge (concat demuxer), split, trim; ffprobe for merge progress durations |
| `main/ipc-video.js` | Duration, JSON metadata, thumbnails |
| `src/gap-merge.js` | Combined-session prep: probe, concat, normalize, gap indicator render |
| `src/ffmpeg-resolver.js` | Binary resolution; not used for processing logic |

Quality and formats: `src/quality-utils.js`; UI formats in `renderer/index.html` (`mp4`, `mov`, `mkv`, `avi`, `m4v`).

This document defines the **target architecture** for the MAS build and maps each operation to AVFoundation.

---

## VideoProcessor interface (behind IPC)

IPC handlers remain the renderer contract (`preload.js` APIs unchanged where possible). Main process routes to a **`VideoProcessor`** implementation selected at build or runtime:

```text
renderer → ipcMain handlers → VideoProcessor → FFmpeg | AVFoundation
```

### Suggested TypeScript/JSDoc shape (implementation detail)

```javascript
/**
 * @typedef {Object} MergeOptions
 * @property {string[]} inputPaths
 * @property {string} outputPath
 * @property {'copy'|'high'|'medium'|'low'} quality
 * @property {'mp4'|'mov'|'m4v'} format  // MAS subset
 * @property {boolean} normalizeAudio
 * @property {object} [segmentPlan]      // gap merge
 * @property {AbortSignal} [signal]
 * @property {(p: ProgressEvent) => void} [onProgress]
 */

/** @typedef {Object} VideoProcessor */
// merge(options) → { outputPath }
// split({ videoPath, splits[], outputDir, signal, onProgress })
// trim({ inputPath, outputPath, startTime, endTime, signal })
// probeDuration(path) → number
// probeMetadata(path) → MetadataDTO  // same shape as today’s get-video-metadata
// thumbnail({ path, timestampSec, maxWidth }) → Buffer | base64 path
// gapPrep(segmentPlan, ...) → { finalPaths, tempFiles, gapLog, segmentsPreparedForCopy }
// optional: checkAvailable() → { ok, message }  // FFmpeg-only today
```

### IPC mapping

| IPC channel | Processor method |
|-------------|------------------|
| `merge-videos` | `merge` (+ internal `gapPrep` when `segmentPlan` set) |
| `split-video` | `split` |
| `trim-video` | `trim` |
| `get-video-duration` | `probeDuration` |
| `get-video-metadata` | `probeMetadata` |
| `generate-thumbnail` | `thumbnail` |
| `check-ffmpeg` | `checkAvailable` (MAS: always `{ ok: true }` or removed) |

**Progress:** map native export progress to existing `merge-progress` events (`currentTime`, `percent`, `eta`—ETA may be recomputed from export fraction × total duration).

**Cancel:** `AbortSignal` → `exportSession.cancelExport()` and kill gap-prep tasks.

**Stall watchdog:** port `createStallWatchdog` to fire if `onProgress` silent for `MERGE_STALL_TIMEOUT_MS` (5 minutes).

### Build-time selection

- **Direct download:** `FfmpegProcessor` (current logic moved verbatim).
- **MAS:** `AvFoundationProcessor` (native).
- Factory in e.g. `src/video-processor/index.js`:

```javascript
module.exports.createVideoProcessor = () =>
  process.env.VIDEO_BACKEND === 'avfoundation' || app.mas
    ? require('./avfoundation-processor')
    : require('./ffmpeg-processor');
```

Exact detection (`app.mas` vs env flag) TBD with electron-builder MAS config.

---

## Native layer architecture options

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. N-API / node-addon-api (Swift/Obj-C++)** | Single `.node` in `app.asar` or unpacked | Lowest latency; shared memory for progress; one process | Build matrix (Electron ABI); Swift + Node glue complexity |
| **B. Signed helper CLI** | `VideoMergerAVHelper` in `Contents/MacOS` or `Resources` | Swift-only helper; easier unit tests in Xcode | Second executable sandbox rules; IPC overhead (JSON + stdout) |
| **C. XPC service** | Helper in `Contents/XPCServices` | Clean isolation; Apple pattern | Highest boilerplate; harder Electron integration |

### Recommendation: **A (N-API addon) with optional B for prototyping**

- **Prototype ([PROTOTYPE.md](./PROTOTYPE.md)):** start with **B (helper CLI)** for speed—Swift `VideoMergerAVHelper merge --json ...` called via `child_process` **only during prototype** on non-sandbox dev builds.
- **Production MAS:** converge to **A (N-API)** so the app does not rely on spawning unsandboxed helpers; progress callbacks via N-API thread-safe function.
- **Reject C** unless App Review or crash isolation forces it (cost/benefit poor for this app size).

Helper remains useful as Xcode test target sharing core `AVFoundation` code linked into the `.node`.

---

## Per-operation AVFoundation mapping

### Merge — copy (default)

**FFmpeg today:**

```text
-f concat -safe 0 -i list.txt -c copy [-f muxer] -y out
```

**AVFoundation:**

1. `AVMutableComposition` + `AVMutableCompositionTrack` for video/audio.
2. For each input `AVURLAsset`, `insertTimeRange(_:of:at:)` sequential on timeline.
3. `AVAssetExportSession(asset:presetName:)` with **`AVAssetExportPresetPassthrough`** when codecs/containers compatible.
4. Output `fileType`: `.mp4` / `.mov` / `.m4v` via `exportSession.outputFileType`.

**Speed:** expect **I/O-bound, ~parity** with FFmpeg copy.

**Failure modes:** mismatched codec params (same as concat demuxer copy)—surface user-readable error; gap path pre-normalizes.

**Audio normalize + copy video (FFmpeg `-c:v copy -af loudnorm`):**

- Export video passthrough **not possible** in one pass if audio must be filtered.
- **Approach:** composition with video passthrough track + **audio mix down** through `AVAudioMix` / offline export with audio processing, or two-step export (estimate: **Phase 2**).

---

### Merge — re-encode (high / medium / low)

**FFmpeg today:** `libx264` + `-crf` + `-preset`; AAC 192k (or lame for mkv).

**AVFoundation:**

- `AVAssetExportSession` with **`AVAssetExportPresetHighestQuality`** for simple path, **or**
- `AVAssetReader` + `AVAssetWriter` + **`AVVideoComposition`** + VideoToolbox compression properties:
  - `AVVideoCodecTypeH264` (baseline/main/high auto)
  - `kVTCompressionPropertyKey_AverageBitRate` or `Quality` tuned per preset
- Audio: `AVAssetWriterInput` AAC, 48 kHz stereo, ~192 kbps (`AVEncoderBitRateKey`).

**Speed:** VideoToolbox hardware → typically **faster than libx264** on Apple Silicon; Intel varies.

---

### Split / trim — copy

**FFmpeg today:**

```text
-i input -ss T -t D -c copy -avoid_negative_ts make_zero -y out
```

**AVFoundation:**

- `CMTimeRange(start:duration:)` from seconds.
- `exportSession.timeRange = range`.
- Preset **Passthrough** (split) or export segment to new file (trim).
- **Keyframe behavior:** cuts align to nearest keyframe with passthrough—**same class of issue** as FFmpeg `-c copy`; document in USER_GUIDE.

**Split loop:** FFmpeg runs sequential spawns; AVF can reuse one export session factory—optional parallelization **not** v1 unless measured win.

---

### Probe duration

**FFmpeg:** `ffprobe -show_entries format=duration`.

**AVFoundation:** `AVURLAsset.load(.duration)` (async) or `CMTimeGetSeconds(asset.duration)`.

Return seconds float; `0` on failure to match forgiving IPC behavior.

---

### Probe metadata

**FFmpeg:** JSON format + streams.

**AVFoundation:**

| Field | Source |
|-------|--------|
| duration | `asset.duration` |
| creationTime | `AVMetadataItem` common key creation date, or format description extension |
| size | file URL resource values |
| bitrate | estimate from file size / duration or track estimates |
| video codec | `formatDescriptions` → FourCC / codec type |
| width/height | `naturalSize` |
| fps | `nominalFrameRate` |
| audio codec / rate / channels | audio track format descriptions |

Map to **existing** `get-video-metadata` object so renderer unchanged.

---

### Thumbnail

**FFmpeg:** `-ss`, `-vframes 1`, `-vf scale=320:-1`, JPEG.

**AVFoundation:** `AVAssetImageGenerator`:

- `appliesPreferredTrackTransform = true`
- `maximumSize = CGSize(width: 320, height: 8000)` (preserve aspect)
- `copyCGImage(at:actualTime:)` at `CMTime(seconds: timestamp)`
- Encode JPEG via `CGImageDestination` or NSBitmap—quality ~ `-q:v 2` tunable.

**Speed:** usually **faster** (no subprocess).

---

### gapPrep (`resolveCombinedMergePaths`)

Pipeline parity with `src/gap-merge.js`:

| Step | FFmpeg | AVFoundation |
|------|--------|--------------|
| Reference specs | ffprobe `width,height,r_frame_rate` | First asset video track |
| Session concat | concat demuxer | `AVMutableComposition` sequential insert |
| Normalize segment | filter_complex scale/pad/loudnorm/amix/anullsrc | `AVVideoComposition` render size + transform; silent audio track insertion; audio mix for normalize (**Phase 3**) |
| Gap indicator | scale/pad/drawtext + x264 | Image/video asset + **Core Animation text layer** (`AVVideoCompositionCoreAnimationTool`) or pre-rendered text in AppKit |
| Final merge | concat copy | composition passthrough export |

**Hard parts:** drawtext equivalent, loudnorm, ensuring **uniform** fps/timebase before passthrough final.

---

## Format scope (MAS)

| Format | Direct download | MAS v1 |
|--------|-----------------|--------|
| MP4 | yes | yes |
| MOV | yes | yes |
| M4V | yes | yes |
| MKV | yes | **no** (hide UI + validate IPC) |
| AVI | yes | **no** |

**Input:** still **accept** `.mkv` / `.avi` **if user selected** and AVFoundation can read (often transcode-on-merge or reject with clear error—product choice). GoPro path is **MP4/MOV**.

---

## Loudnorm replacement (EBU R128)

FFmpeg filter: `loudnorm=I=-16:TP=-1.5:LRA=11`.

AVFoundation has **no direct equivalent**. Options (pick in Phase 2):

1. **AVAudioConverter + custom loudness meter** — analyze integrated loudness (ITU-R BS.1770 via vDSP / third-party), apply gain + limiter; closest to EBU.
2. **`AVAudioEngine` offline render** with AU dynamics processors — faster to ship, less standard-compliant.
3. **Defer** “Normalize audio” checkbox on MAS until (1) ships; show disabled with tooltip.

**Recommendation:** implement (2) for MAS v1 if product accepts “consistent levels”; pursue (1) for parity label “EBU R128”.

---

## drawtext replacement (gap indicators)

FFmpeg uses `drawtext` with `/System/Library/Fonts/Supplemental/Arial.ttf`.

**AVFoundation approach:**

- Build `CALayer` tree with `CATextLayer` (text from `buildGapOverlayText`).
- `AVVideoCompositionCoreAnimationTool(postProcessingAsVideoLayer:in:)` over indicator still/video frame.
- Export gap clip to short H.264/AAC MP4 matching session **width/height/fps**.

Fallback: **pre-render PNG** with AppKit `NSString.draw` once, composite as overlay (simpler than animation tool).

---

## Quality preset → VideoToolbox mapping

FFmpeg (`src/quality-utils.js`):

| Preset | CRF | x264 preset |
|--------|-----|-------------|
| high | 18 | slow |
| medium | 23 | medium |
| low | 28 | fast |

**Proposed VideoToolbox mapping (tune in prototype Phase 2):**

| App preset | H.264 approach | Notes |
|------------|----------------|-------|
| copy | Passthrough export | No VideoToolbox |
| high | Quality ~0.75–0.85, avg bitrate cap **~1.5×** measured source bitrate, max keyframe interval 2s | Target visually similar to CRF 18 on GoPro H.264 |
| medium | Quality ~0.55–0.65, cap ~1.0× source | Default re-encode |
| low | Quality ~0.35–0.45, cap ~0.6× source | Smaller files |

Store mapping in `src/quality-utils.js` (shared constants) with `masVideoToolboxSettings` export used only by native bridge.

**HEVC:** optional for `high` on Apple Silicon if size win—gate behind preference later.

Document that **CRF numbers are not shown** for MAS encode—UI strings already describe CRF; add MAS footnote “uses hardware encoding”.

---

## Progress and cancel

| Concern | FFmpeg | AVFoundation |
|---------|--------|--------------|
| Progress | Parse stderr `time=` | KVO `exportSession.progress` (0–1) × total duration |
| Cancel | `SIGTERM` / `kill` | `cancelExport()` |
| Temp files | filelist + gap temps | Same JS temp file discipline in processor wrapper |

Emit `merge-progress` at ≥4 Hz throttle to avoid flooding renderer.

---

## Sandbox and signing

- Native code linked against SDK frameworks only (no `@rpath` to FFmpeg).
- MAS entitlements file separate from Developer ID (`build/entitlements.mas.plist`—to create).
- **Security-scoped bookmarks:** native module may need bookmark **data** passed from JS (Node Buffer) if Swift performs I/O— or JS resolves scoped URLs and passes file paths after `startAccessingSecurityScopedResource()`.
- Do **not** spawn `/usr/bin/ffmpeg` in MAS build.

---

## Testing strategy

### Unit tests (Jest, main process)

- Mock `VideoProcessor`; IPC tests unchanged structure (`__tests__/ipc-merge-split.test.js`, `ipc-video.test.js`).
- Factory returns mock based on env in tests.

### Native tests (Xcode)

- Swift tests for composition length, timeRange trim, passthrough export of test fixture clips (committed small MP4s in `test-videos/`).

### Parity tests (macOS only, manual or CI)

Compare **FFmpeg fat build** vs **MAS dev build** on same machine:

| Case | Metrics |
|------|---------|
| Copy merge 20× 4K GoPro chapters | Duration wall clock, output file size ±0.5%, playback in QuickTime |
| Trim mid-file | Start playback immediate vs keyframe offset ≤2s |
| Thumbnail @ 1s | SSIM or visual snapshot diff (allow JPEG variance) |
| Re-encode medium | PSNR/SSIM vs FFmpeg reference **or** blind review score |

Automate where possible: `scripts/avf-parity-test.sh` invoking both backends with JSON manifest (future work).

### E2E (Playwright)

- Keep current flows on **FFmpeg** CI.
- Add labeled job `e2e-mas` on macOS hardware when MAS artifact exists (may be manual initially).

### Regression

- Direct-download CI must run full Jest + e2e on every PR touching `VideoProcessor` or IPC.

---

## File layout (proposed)

```text
native/
  VideoMergerAV/          # Swift package or Xcode project
    CompositionBuilder.swift
    ExportSession.swift
    ThumbnailGenerator.swift
    GapRenderer.swift
  binding/                # node-addon-api
    avfoundation_addon.mm
src/video-processor/
  index.js
  ffmpeg-processor.js     # moved from ipc-*.js / gap-merge.js
  avfoundation-processor.js
docs/avfoundation/        # this plan
build/
  entitlements.mac.plist  # existing Developer ID
  entitlements.mas.plist  # new
```

---

## Migration order (implementation)

1. Extract `FfmpegProcessor` without behavior change.
2. Prototype helper → N-API addon with merge/trim/probe/thumbnail/one encode.
3. Wire MAS build flag; hide MKV/AVI.
4. gapPrep native port.
5. Loudnorm substitute + quality tuning.
