# AVFoundation prototype specification

Narrow spike to answer **integration, sandbox, speed, and correctness** questions before committing to full `VideoProcessor` port and MAS entitlements work. **Must run on physical Macs** (Cloud/Linux CI cannot execute AVFoundation).

Parent docs: [README.md](./README.md), [TECHNICAL_PLAN.md](./TECHNICAL_PLAN.md), [PROJECT_PLAN.md](./PROJECT_PLAN.md).

---

## Objectives

1. Prove Electron main process can drive AVFoundation for the **most common** operations.
2. Measure **copy merge** vs bundled FFmpeg on **real GoPro 4K** footage (not toy test clips).
3. Measure **one VideoToolbox re-encode** vs FFmpeg `libx264` medium preset.
4. Validate **trim (passthrough)** keyframe behavior is acceptable.
5. Estimate **app size delta** without FFmpeg binaries.
6. Confirm **App Sandbox** feasibility with user-selected paths (bookmarks or scoped access).

---

## Scope (in)

| # | Capability | AVFoundation building blocks |
|---|------------|------------------------------|
| 1 | **Passthrough merge** of N sequential MP4/MOV clips (same session) | `AVMutableComposition` + `AVAssetExportPresetPassthrough` |
| 2 | **Trim** single clip `[start, end)` passthrough | `AVAssetExportSession.timeRange` + passthrough |
| 3 | **Probe** duration + width/height/fps/codec | `AVURLAsset` + track format descriptions |
| 4 | **Thumbnail** at 1 s, max width 320 px JPEG | `AVAssetImageGenerator` |
| 5 | **Re-encode merge** (medium quality) of same N clips | VideoToolbox H.264 via export session or reader/writer |

## Scope (out)

- Gap indicators, `drawtext`, combined-session normalize pipeline
- Loudnorm / audio normalization
- Split (multiple outputs)—defer to Phase 1 if merge/trim succeed
- MKV/AVI
- N-API production addon—helper CLI acceptable for prototype
- App Store submission

---

## Deliverables

1. **`native/prototype/`** (or separate branch) Swift CLI: `video-merger-av-prototype` with subcommands:
   - `merge-passthrough --inputs json/array --output path`
   - `merge-encode-medium --inputs ... --output ...`
   - `trim --input --start SEC --end SEC --output`
   - `probe --input` → JSON stdout
   - `thumbnail --input --time SEC --output.jpg`
2. **Thin Electron harness** OR shell script in `scripts/run-avf-prototype.sh` that invokes the CLI from Node (same as future IPC will).
3. **Completed results table** (below) checked into `docs/avfoundation/PROTOTYPE_RESULTS.md` (create when runs finish—may start empty template in PR follow-up).
4. **One-page sandbox note:** steps used to enable sandbox on a test `.app`, bookmark API used, failures observed.

---

## Test media

| Set | Description | Minimum |
|-----|-------------|---------|
| **A — GoPro 4K session** | 10–20 chapter files `GX01####.MP4` … same session, H.264 + AAC, from Hero 9/10/11 or similar | **Required** |
| **B — Long merge** | Subset totaling **≥30 min** wall playback | Recommended |
| **C — Intel machine** | Same test A on Intel Mac if available | Optional but strongly preferred |

Record: device model, macOS version, storage type (internal SSD vs SD reader), source app version (FFmpeg fat build git tag).

---

## Benchmark protocol

Run each scenario **3 times**; report **median** wall time. Quit other heavy apps; note if **Low Power Mode** on.

### Baseline (FFmpeg)

Use current **fat** Video Merger bundled binary or:

```bash
ffmpeg -f concat -safe 0 -i filelist.txt -c copy -y out_copy.mp4
ffmpeg -f concat -safe 0 -i filelist.txt -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 192k -y out_encode.mp4
```

Trim baseline:

```bash
ffmpeg -y -i clip.mp4 -ss START -t DUR -c copy -avoid_negative_ts make_zero out_trim.mp4
```

### Candidate (AVFoundation)

Invoke prototype CLI with equivalent operations.

### Correctness checks

| Check | Method | Pass threshold |
|-------|--------|----------------|
| Output duration | `ffprobe -show_entries format=duration` on both outputs | **±0.5 s** vs sum of inputs (copy merge) |
| File size (copy) | byte size compare | **±2%** of FFmpeg copy output |
| Playback | QuickTime Player full playthrough | No A/V stall or freeze |
| Trim start | First frame inspec / `ffprobe -read_intervals` | Start within **≤2 s** of requested (keyframe slack—document actual) |
| Thumbnail | Visual compare | Same scene content; JPEG size within **±30%** |
| Re-encode quality | **VMAF** or **SSIM** vs FFmpeg reference (medium) OR 2 blind reviewers | SSIM **≥ 0.92** (estimate threshold) **or** “indistinguishable” majority |

### Performance metrics

| Metric | How measured |
|--------|----------------|
| Wall time | `/usr/bin/time` or Swift `ContinuousClock` |
| CPU | Activity Monitor sample peak **estimate** |
| App bundle size | `du -sh` MAS prototype `.app` vs fat DMG `.app` without FFmpeg resources |

---

## Results table (template)

Fill median values after runs on Mac hardware.

| Scenario | Machine (AS/Intel) | FFmpeg median (s) | AVF median (s) | Ratio AVF/FFmpeg | Pass? (Y/N) |
|----------|-------------------|-------------------|----------------|------------------|-------------|
| Copy merge set A (N files) | | | | | |
| Copy merge set B (≥30 min) | | | | | |
| Encode merge set A (medium) | | | | | |
| Trim 60 s from mid-clip | | | | | |
| Probe × 20 files | | | | | |
| Thumbnail × 20 files | | | | | |
| Bundle size (MB) | | — | — | Δ MB | |

**Sandbox sub-test**

| Step | Result |
|------|--------|
| User picks input folder via open panel | |
| Merge to user-picked output without sandbox violation | |
| Re-launch app; access via bookmark (if implemented) | |

---

## Questions the prototype must answer

| # | Question | Measurable criterion |
|---|----------|----------------------|
| Q1 | Is passthrough merge **fast enough**? | Median wall time **≤ 1.10×** FFmpeg copy on set A; **≤ 1.15×** on set B (estimate gates) |
| Q2 | Is VideoToolbox encode **competitive**? | Median encode merge **≤ 1.0×** FFmpeg libx264 medium on set A (AS); **≤ 1.25×** on Intel if tested |
| Q3 | Is copy output **correct**? | Duration + size + playback checks pass |
| Q4 | Is trim behavior **acceptable**? | Keyframe slack documented; no user-facing bug vs current FFmpeg trim |
| Q5 | Is probe/thumbnail **fast enough** for UI? | 20-file probe **≤ 0.75×** FFmpeg total; 20 thumbnails **≤ 0.75×** FFmpeg (estimate) |
| Q6 | Integration **feasible**? | Node invokes CLI/addon; errors propagate as JSON; no hang on cancel (manual cancel test on encode) |
| Q7 | Sandbox **feasible**? | Merge completes with App Sandbox enabled and user-selected paths |
| Q8 | Size win **meaningful**? | FFmpeg binaries absent → **≥ 35 MB** smaller `.app` (estimate; measure actual) |
| Q9 | Quality at matched bitrate acceptable? | SSIM ≥ 0.92 or blind test pass for encode scenario |

---

## Decision rules

Apply after results table is complete. Record outcome in [README.md](./README.md) decision log.

### Proceed (full TECHNICAL_PLAN)

**All of:**

- Q3 pass
- Q6 pass
- Q7 pass **or** documented bookmark plan with ≤5 engineer-days follow-up (estimate)
- Q1 pass **OR** owner accepts “MAS not faster but compliant” in writing
- Q2 pass **OR** re-encode is rare in analytics / product disables re-encode on MAS v1

### Change plan (constrained MAS)

**Any of:**

- Q1 fail (AVF slower) but Q3/Q6/Q7 pass → Ship MAS **copy-only** first; defer re-encode (Phase 2 slip).
- Q7 fail with high fix cost → MAS v1 **manual folder pick only**; defer SD auto-detect bookmarks.
- Q9 fail → Tune VideoToolbox mapping; if still fail after 1 week (estimate), MAS v1 **copy-only** without quality presets.

### Pivot (alternative stack)

**Any of:**

- Q3 fail (correctness) and not fixable in **2 engineer-weeks** (estimate)
- Q6 fail (unstable Electron integration) after N-API attempt
- Q7 fail with Apple rejection risk **High** and no mitigation

**Pivot options (pick one):**

1. **LGPL FFmpeg** dynamically linked helper (legal review required; may still fail review if deemed download of GPL code).
2. **MAS subset** — photo library only / no merge (unlikely product fit).
3. **Defer MAS**; stay Developer ID + fat FFmpeg only.

### Abandon AVFoundation for MAS

**Any of:**

- Q3 fail + Q1 fail + Q6 fail together
- Prototype proves passthrough **> 1.5×** FFmpeg on set A with no remediation
- Legal/compliance blocks VideoToolbox export for this use case (unexpected)

**Default fallback:** continue direct-download; revisit MAS when Electron sandbox story or policy changes.

---

## Suggested timeline (estimate)

| Week | Activity |
|------|----------|
| 1 | Swift CLI: merge passthrough, probe, thumbnail; Node harness |
| 2 | Trim + encode medium; FFmpeg baseline scripts; fill results on AS Mac |
| 3 | Sandbox experiment; Intel rerun if hardware available; decision meeting |

---

## Reporting

When complete, open a PR adding **`docs/avfoundation/PROTOTYPE_RESULTS.md`** with filled tables, raw logs in `docs/avfoundation/prototype-logs/` (gitignored if large), and update README decision log with **Proceed / Change / Pivot / Abandon**.
