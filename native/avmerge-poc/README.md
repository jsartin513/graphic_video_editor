# avmerge-poc — AVFoundation lossless merge spike

Standalone Swift CLI for the Video Merger **Mac App Store** direction. Implements passthrough merge via `AVMutableComposition` + `AVAssetExportSession` (`AVAssetExportPresetPassthrough`), optional `AVAssetReader`/`AVAssetWriter` passthrough, and post-merge trim via export `timeRange`.

**Not wired into Electron.** See draft planning PR [#166](https://github.com/jsartin513/graphic_video_editor/pull/166) and `docs/avfoundation/` (on that branch).

## Build

Requires Xcode / Swift 5.9+ on macOS 13+.

```bash
cd native/avmerge-poc
swift build -c release
# binary: .build/release/avmerge-poc
```

## Run (test clips)

Test inputs (read-only): `~/Movies/avfoundation-poc-test/BDLOPENGYMGX015357.MP4` + `BDLOPENGYMGX025357.MP4` (120 s each, last/first segments of two GoPro chapters).

Write outputs only under:

```bash
OUT=~/Movies/avfoundation-poc-test/out
BIN="$(pwd)/.build/release/avmerge-poc"

# Passthrough merge → MP4 (default engine)
$BIN merge --engine export --output "$OUT/merged-export.mp4" \
  ~/Movies/avfoundation-poc-test/BDLOPENGYMGX015357.MP4 \
  ~/Movies/avfoundation-poc-test/BDLOPENGYMGX025357.MP4

# Same merge → QuickTime MOV (preserves tmcd; MP4 export does not)
$BIN merge --engine export --output "$OUT/merged-export.mov" \
  ~/Movies/avfoundation-poc-test/BDLOPENGYMGX015357.MP4 \
  ~/Movies/avfoundation-poc-test/BDLOPENGYMGX025357.MP4

# Reader/writer passthrough (video + audio only; tmcd rejected by writer)
$BIN merge --engine writer --output "$OUT/merged-writer.mp4" \
  ~/Movies/avfoundation-poc-test/BDLOPENGYMGX015357.MP4 \
  ~/Movies/avfoundation-poc-test/BDLOPENGYMGX025357.MP4

# Merge + trim [30 s, 210 s) on the composed timeline
$BIN merge --engine export --trim-start 30 --trim-end 210 \
  --output "$OUT/merged-export-trim.mp4" \
  ~/Movies/avfoundation-poc-test/BDLOPENGYMGX015357.MP4 \
  ~/Movies/avfoundation-poc-test/BDLOPENGYMGX025357.MP4

# Inspect tracks AVFoundation exposes
$BIN probe ~/Movies/avfoundation-poc-test/BDLOPENGYMGX015357.MP4
```

### FFmpeg baselines (verification only)

```bash
FF=/opt/homebrew/bin/ffmpeg
FP=/opt/homebrew/bin/ffprobe
LIST="$OUT/concat-list.txt"
printf "file '%s'\nfile '%s'\n" \
  "$HOME/Movies/avfoundation-poc-test/BDLOPENGYMGX015357.MP4" \
  "$HOME/Movies/avfoundation-poc-test/BDLOPENGYMGX025357.MP4" > "$LIST"
$FF -hide_banner -loglevel error -y -f concat -safe 0 -i "$LIST" -c copy "$OUT/merged-ffmpeg.mp4"
$FP -hide_banner -show_streams "$OUT/merged-ffmpeg.mp4"
```

## Test environment

| Item | Value |
|------|--------|
| Machine | Apple M5 Pro |
| macOS | 26.6.2 (25G83) |
| Date | 2026-10-18 |
| Verification | `/opt/homebrew/bin/ffprobe`, `/opt/homebrew/bin/ffmpeg` |

---

## Findings (2026-10-18)

### 1. Playback, duration, chapter boundary

| Output | `format.duration` | Video / audio streams |
|--------|-------------------|------------------------|
| **AVF export MP4** (`merged-export.mp4`) | **240.004 s** | HEVC hvc1 + AAC |
| **FFmpeg concat copy** (`merged-ffmpeg.mp4`) | 240.257 s | HEVC + AAC + tmcd |
| **Expected** (120 s + 120.12 s clips) | ~240.12 s | — |

- Full-chapter merge (17 GB + 6.6 GB → 24 GB): **AVF duration 1692.875 s**, identical to sum of inputs (1217.216 + 475.659 s) and to the existing FFmpeg app merge `BDL Open Gym 10:.18.:2026.mp4` (**1692.875 s**).
- **Boundary:** `ffprobe` video packet PTS around the join is continuous (e.g. …119.970 → 120.003 → 120.037 s) with ~16.7 ms frame spacing; no timestamp hole at 120 s.
- **Manual playback:** not automated in this spike; export status `completed` and monotonic PTS are the evidence used here.

**Trim:** `--trim-start 30 --trim-end 210` → **180.000 s** duration (passthrough on the composed timeline).

### 2. GPMF (`gpmd`) and timecode (`tmcd`)

> **Deep dive (2026-10-18 follow-up):** [`GPMD_INVESTIGATION.md`](GPMD_INVESTIGATION.md) — AVFoundation cannot see or merge `gpmd`; hybrid Swift BMFF stitch documented; current FFmpeg app merge also drops GPMF.

**Source clip (ffprobe)** — four streams:

```
Stream #0:0: Video hevc hvc1
Stream #0:1: Audio aac
Stream #0:2: Data gpmd (GoPro MET)
Stream #0:3: Data tmcd
```

**Source clip (`avmerge-poc probe` / AVFoundation)** — three tracks only:

```json
{"mediaType":"vide","formatDescriptions":["video/hvc1 3840x2160"]}
{"mediaType":"soun","formatDescriptions":["audio/aac 48000Hz 2ch"]}
{"mediaType":"tmcd","formatDescriptions":["timecode/tmcd"]}
```

`gpmd` is **not exposed as an `AVAssetTrack`** on GoPro MP4/MOV (including full 17 GB `GX015357`), so `AVMutableComposition` **cannot** include GPMF telemetry today.

| Merge path | Container | Video | Audio | gpmd | tmcd |
|------------|-----------|-------|-------|------|------|
| FFmpeg `-c copy` | MP4 | ✓ | ✓ | ✓ (stream 2) | ✓ (stream 3) |
| AVF export passthrough | **MP4** | ✓ | ✓ | ✗ (never in composition) | ✗ **dropped at export** |
| AVF export passthrough | **MOV** | ✓ | ✓ | ✗ | ✓ (stream 2, tmcd) |
| AVF composition | — | in comp | in comp | — | in comp (tmcd) |
| AVAssetWriter passthrough | MP4 | ✓ | ✓ | ✗ | ✗ (`canAdd` false for tmcd; writer uses 2 tracks) |

**Keeping tmcd in MP4:** composition includes tmcd, but `AVAssetExportPresetPassthrough` to `.mp4` strips it. **MOV export retains tmcd** without extra code. Writer passthrough does not accept `tmcd` inputs on MP4.

**Keeping gpmd:** would require **sub-AVFoundation** work (ISO BMFF track copying / `AVAssetWriter` with manual `gpmd` format descriptions if Apple exposes the track—which it currently does not on read). **Not feasible** with composition + export session alone for GoPro GPMF.

### 3. Wall-clock speed (median of 3 runs, 120 s clips, ~3.3 GB out)

| Method | Median wall time |
|--------|------------------|
| **AVF export passthrough** | **0.62 s** |
| **FFmpeg concat `-c copy`** | **0.50 s** |

Both are I/O-bound and similar; FFmpeg was ~20% faster on this machine for the short clip test.

**Full chapters (single run):**

| Method | Wall time | Notes |
|--------|-----------|--------|
| AVF export → 24 GB MP4 | **10.86 s** | Completed |
| FFmpeg concat | 6.07 s (failed) | Disk full while writing ~24 GB output during spike |

Re-run FFmpeg full merge when ~25 GB free space is available for an apples-to-apples full-size baseline.

### 4. Mac App Store sandbox notes

- **Compatible:** Passthrough merge/trim uses only **user-selected input URLs** and a user-chosen output path — maps to security-scoped bookmarks / NSOpenPanel / NSSavePanel in a sandboxed app.
- **No FFmpeg binary** required for this path (helps MAS review and size).
- **Entitlements:** Standard App Sandbox + user-selected read/write; no special entitlement for VideoToolbox passthrough re-mux.
- **Caveats:**
  - Output location must be writable within the sandbox grant (bookmark or save panel).
  - Helper CLI (if used like this POC) must run **in-process** or as an XPC service with the same scoped URLs — launching an unsandboxed helper would not inherit bookmarks.
  - Features that need **gpmd** or **tmcd-in-MP4** may require MOV export or a non-AVF mux path (likely out of scope for pure AVFoundation MAS v1).

---

## ffprobe stream comparison (120 s clips)

**Input `BDLOPENGYMGX015357.MP4` (excerpt):**

```
Stream #0:0: Video: hevc (hvc1), 3840x2160, 120.000000 s
Stream #0:1: Audio: aac, 120.000000 s
Stream #0:2: Data: gpmd
Stream #0:3: Data: tmcd
```

**`merged-export.mp4` (AVF passthrough):**

```
Stream #0:0: Video: hevc (hvc1), duration=240.004000
Stream #0:1: Audio: aac, duration=240.000000
(format duration=240.004000, size=3597280158)
```

**`merged-export.mov` (AVF passthrough):**

```
Stream #0:0: Video: hevc (hvc1), duration=240.004000
Stream #0:1: Audio: aac, duration=240.000000
Stream #0:2: Data: tmcd, duration=240.004000
```

**`merged-ffmpeg.mp4` (FFmpeg concat copy):**

```
Stream #0:0: Video: hevc (hvc1), duration=240.251000
Stream #0:1: Audio: aac, duration=240.248000
Stream #0:2: Data: tmcd, duration=240.257000
(format duration=240.257000, size=3597407996)
```

**`merged-writer.mp4` (AVF reader/writer, 2 tracks written):**

```
Stream #0:0: Video: hevc (hvc1), duration=240.003333
Stream #0:1: Audio: aac, duration=240.000000
```

---

## Commands reference

```
avmerge-poc merge [--output PATH] [--engine export|writer] [--trim-start SEC] [--trim-end SEC] INPUT ...
avmerge-poc probe INPUT
```

JSON summary (including `tracksInComposition`, `wallClockSeconds`, export status) is printed to stdout on merge.
