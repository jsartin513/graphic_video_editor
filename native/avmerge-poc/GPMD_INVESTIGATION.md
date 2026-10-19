# GPMF / `gpmd` deep investigation (2026-10-18)

Follow-up to initial [`README.md`](README.md) merge spike. Goal: determine whether **AVFoundation** can preserve GoPro **GPMF** (`gpmd` / handler `GoPro MET`) on lossless chapter merge, and what fallback is required for Mac App Store builds.

Test media: 120 s clips under `~/Movies/avfoundation-poc-test/` (unchanged originals). Outputs under `out/`.

---

## 1. Can AVFoundation *see* `gpmd`?

### APIs exercised (`avmerge-poc investigate`)

On `BDLOPENGYMGX015357.MP4`:

| API | Result |
|-----|--------|
| `AVURLAsset.load(.tracks)` | **3 tracks**: video (1), audio (2), timecode (4) |
| `loadTracks(withMediaType: .metadata)` | **0** |
| `loadTracks(withMediaType: .text)` | **0** (on source MP4) |
| `loadTracks(withMediaType: .timecode)` | **1** (track 4) |
| `AVURLAssetPreferPreciseDurationAndTimingKey` | Same track set; duration unchanged (120 s) |
| `AVAssetReader` passthrough on each track | 7204 video / 5628 audio / **5 tmcd** samples; **no gpmd-like subtype** |
| `CMFormatDescription` subtypes | `hvc1`, `aac `, `tmcd` only |

**ffprobe** on the same file shows **four** streams including:

```
Stream #0:2: Data gpmd (GoPro MET)
Stream #0:3: Data tmcd
```

**Pure Swift BMFF index** (`avmerge-poc gpmd-index`) finds the track Apple omits:

```json
{
  "gpmdHandlerName": "GoPro MET",
  "gpmdSampleCount": 120,
  "gpmdTimescale": 1000,
  "gpmdFirstPayloadHex": "44 45 56 43 ... DEVC ... ACCL ..."
}
```

GoPro stores GPMF in a **`meta` handler** track with sample description **`gpmd`** (see [GPMF MP4 structure](https://gopro.github.io/gpmf-parser/)). AVFoundation exposes **`tmcd`** but **does not surface the `meta`/`gpmd` track** as an `AVAssetTrack`.

### Container remux experiment

```bash
ffmpeg -i clip.mp4 -c copy clip-remux.mov
```

- **ffprobe:** `gpmd` **lost**; spurious `text` / `SubtitleHandler` stream appears.
- **AVFoundation:** gains a `.text` track (5 samples) — **not** GPMF (still 0 `.metadata` tracks).
- **`gpmd-index` on remux MOV:** no `gpmd` track.

**Conclusion:** Remuxing to MOV does **not** make GPMF visible to AVFoundation; it can **remove** `gpmd` from the file.

### Prior art

| Source | Finding |
|--------|---------|
| [Stack Overflow: AVAsset tracks missing GoPro tracks](https://stackoverflow.com/questions/75727163/apple-avkit-avasset-tracks-method-does-not-see-all-tracks-in-gopro-mp4-files) | AVFoundation lists 3 tracks; ffmpeg lists 5; answer: **write an MP4 parser** for GoPro-specific tracks. |
| [gopro/gpmf-parser](https://github.com/gopro/gpmf-parser) (Apache-2.0 / MIT) | Reference MP4 reader scans `hdlr` subtype **`meta`** and `stsd` **`gpmd`**. |
| GoPro docs | Telemetry track is **`meta` / `GoPro MET` / `gpmd`**, not a standard video/audio/timecode track. |

Telemetry-focused macOS tools (e.g. exporters using **gpmf-parser** or custom BMFF readers) generally **do not** rely on `AVAsset.tracks` for GPMF.

---

## 2. Can AVFoundation *keep* `gpmd` in merge/export?

**No** — because the track never enters `AVMutableComposition`.

We re-ran passthrough merge on 120 s clips:

| Output | ffprobe streams | `gpmfdemo` (gpmf-parser) |
|--------|-----------------|---------------------------|
| `merged-export.mp4` (AVF) | video + audio | **no GPMF** |
| `merged-export.mov` (AVF) | video + audio + tmcd | **no GPMF** |
| `merged-writer.mp4` (reader/writer) | video + audio | **no GPMF** |

There is **no code path** to add `gpmd` via `insertTimeRange` without an `AVAssetTrack`. `AVAssetWriterInput` for `.metadata` / custom `gpmd` cannot be seeded from a source track Apple does not provide.

**tmcd (related):** present in composition but **stripped from MP4** export; **retained in MOV** export (unchanged from first spike).

---

## 3. What does “correct” merged telemetry look like?

### Per-chapter sources

`gpmfdemo` on each 120 s clip: **valid GPMF** (e.g. ACCL samples, ~1 Hz payload cadence, 120 payloads).

### FFmpeg concat (default `-c copy`)

```bash
ffmpeg -f concat -safe 0 -i list.txt -c copy merged.mp4
```

- **ffprobe:** video + audio + **tmcd** only — **`gpmd` dropped**, same as AVFoundation MP4.
- **`gpmfdemo`:** *“invalid MP4/MOV or it has no GPMF data”*.

### FFmpeg concat with `-map 0 -copy_unknown`

Attempted MP4 and MOV outputs — **failed** (`Could not find tag for codec none in stream #3`). GPMF is not wired for trivial concat mux on this ffmpeg build.

### Reference: existing app merge

`~/Movies/2026-10-18 BDL256GBAA/BDL Open Gym 10:.18.:2026.mp4` (current FFmpeg-based app output):

- **ffprobe:** video + audio + **tmcd** — **no `gpmd`**
- **`gpmfdemo`:** **no GPMF**

So **today’s shipped merge path already drops GPMF**, even in the fat FFmpeg SKU. Restoring telemetry is **new product scope**, not parity regression for merge alone.

### GPMF timeline at chapter boundary (Swift index)

`avmerge-poc gpmd-boundary` on the two clips:

- Clip A: 120 samples @ 1000 Hz tick scale; last sample ends at **120000 ms** (120 s).
- Clip B: starts at 0 s on its local timeline; concat plan shifts by **120 s** for a continuous 240-payload track.

Payload bytes differ at the boundary (expected — different motion/GPS). **Timing model for stitch:** concatenate `stts`/`stsz`/`stco` with second segment offsets shifted by clip A duration.

---

## 4. Fallback: post-AVF BMFF patch (no FFmpeg in app)

### Approach

1. **AVF passthrough merge** → MP4 with video + audio (fast, sandbox-friendly).
2. **Swift BMFF layer** (started in `GpmdMP4.swift`):
   - Parse each source’s `gpmd` track (`stsd`, `stts`, `stsz`, `stco`/`co64`).
   - Concatenate sample tables with time offset (see `gpmd-plan`, `gpmd-boundary`).
   - **Patch output:** add `trak` (meta/gpmd) to `moov`, append payload bytes to `mdat`, fix `chunk offsets` / `mvhd` duration.

3. Optional: duplicate **tmcd** stitch for MP4 (or standardize on MOV for telemetry + timecode).

### Complexity & risk (estimate)

| Item | Effort | Risk |
|------|--------|------|
| GPMF **read** / concat plan | ~1–2 days (POC mostly done) | Low — spec in gpmf-parser docs |
| **Write** patched MP4 (mdat grow + moov update) | ~1–2 weeks | **Medium** — large files (24 GB), offset tables, `co64` vs `stco`, fast-start vs interleaved mdat |
| Validation (gpmf-parser, Quik) | ~2–3 days | Medium |
| MAS / sandbox | In-process patcher on bookmarked URLs | Low |

**~2–3 engineer-weeks** for production-quality GPMF-preserving merge on top of AVF A/V merge, with solid tests on 4K multi-GB files.

### Third-party libraries (license)

| Library | License | MAS note |
|---------|---------|----------|
| [gopro/gpmf-parser](https://github.com/gopro/gpmf-parser) | Apache-2.0 / MIT | Safe; use as **reference** or link C reader for validation |
| [Bento4](https://www.bento4.com/) | **GPL v2** | Generally **avoid** for proprietary MAS app unless you comply with GPL |
| GPAC / `mp4box` | **LGPL** | Dynamic linking + attribution possible; heavier dependency |

**Recommendation:** keep **pure Swift** (or Apache/MIT gpmf-parser) for BMFF + GPMF stitch; do not embed FFmpeg/GPL tools in MAS binary.

---

## 5. Recommendation

| Question | Answer |
|----------|--------|
| Can AVFoundation **see** `gpmd`? | **No.** Only video, audio, and usually `tmcd`. `.metadata` query returns 0 tracks. |
| Can AVFoundation **keep** `gpmd` on merge? | **No.** Cannot compose or passthrough-export a track that is not exposed. |
| Practical path for MAS | **Hybrid:** AVF passthrough for HEVC/AAC + **Swift BMFF post-pass** to stitch `gpmd` (and optionally `tmcd` for MP4). |
| Parity with current app | Current **FFmpeg merge reference already drops GPMF**; telemetry preservation is an **enhancement**, not AVF-only regression. |
| Short-term spike acceptance | Accept **no GPMF** for AVF-only merge v1 **if** product accepts same telemetry loss as today’s FFmpeg merge; plan BMFF phase if Quik/GPS workflows matter. |

---

## Commands used

```bash
cd native/avmerge-poc && swift build -c release
BIN=.build/release/avmerge-poc

$BIN investigate --precise ~/Movies/avfoundation-poc-test/BDLOPENGYMGX015357.MP4
$BIN gpmd-index  ~/Movies/avfoundation-poc-test/BDLOPENGYMGX015357.MP4
$BIN gpmd-plan   clip1.MP4 clip2.MP4
$BIN gpmd-boundary clip1.MP4 clip2.MP4

# Validation (dev machine only — not bundled in app)
/tmp/gpmf-parser/demo/gpmfdemo clip.MP4
/opt/homebrew/bin/ffprobe -show_streams merged.mp4
```
