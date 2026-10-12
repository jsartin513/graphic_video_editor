# AVFoundation migration — project plan

## Summary

Deliver a **Mac App Store (MAS)** build of Video Merger that performs merge, split, trim, probe, thumbnail, and combined-session gap workflows using **AVFoundation / VideoToolbox**, without bundling FFmpeg. Maintain the existing **direct-download** product (Developer ID DMG, bundled FFmpeg “fat” build) in parallel until MAS reaches feature parity or an explicit subset is approved.

**Estimates below are rough engineering guesses**, not commitments. Revisit after [PROTOTYPE.md](./PROTOTYPE.md) results.

---

## Goals

1. **MAS-compliant media stack** — no GPL FFmpeg binary in the App Store SKU; use system frameworks.
2. **Functional parity for core workflows** — GoPro session merge (default **copy** / passthrough), split, trim, metadata, thumbnails, batch merge UX, progress and cancel.
3. **Acceptable performance** — passthrough merge **not slower than FFmpeg** on representative 4K GoPro footage; re-encode paths **equal or faster** than software `libx264` where users choose quality modes.
4. **Sandbox-safe file access** — user-selected inputs and outputs via security-scoped bookmarks / standard panels.
5. **Clear dual build pipeline** — CI and release docs distinguish MAS vs direct-download artifacts.

## Non-goals (initial MAS v1 unless reprioritized)

- **MKV / AVI export** on MAS (FFmpeg today supports both; AVFoundation does not natively).
- **Homebrew / `install-prerequisites`** flow on MAS (`main/ipc-misc.js`).
- **Bundled FFmpeg** or `ffmpeg-static` in the MAS app bundle.
- **electron-updater / GitHub auto-update** inside the MAS app (updates via App Store only).
- **Feature parity with every FFmpeg filter** — e.g. exact **EBU R128 loudnorm** may ship as “best effort” or v1.1 (see technical plan).
- **Windows / Linux** AVFoundation ports (macOS-only frameworks).
- **Replacing FFmpeg in direct-download builds** in phase 1 (optional long-term convergence).

---

## Phases, milestones, and exit criteria

### Phase 0 — Prototype (estimated: 1–2 engineer-weeks)

**Work:** Implement [PROTOTYPE.md](./PROTOTYPE.md) (passthrough merge, trim, probe, thumbnail, one VideoToolbox re-encode) callable from Electron on macOS.

| Milestone | Exit criteria |
|-----------|----------------|
| P0.1 Native bridge spike | Electron main process invokes native code; returns success/failure + output path |
| P0.2 Benchmarks on real GoPro 4K | Results table filled; decision rules applied |
| P0.3 Sandbox smoke test | Prototype runs with App Sandbox enabled in a test `.app`; read/write via user-picked paths works |

**Phase exit:** Prototype **go** decision documented in [README.md](./README.md) decision log. **No-go** triggers pivot (see PROTOTYPE decision rules).

---

### Phase 1 — Foundation + core IPC (estimated: 2–4 engineer-weeks)

**Work:**

- Introduce `VideoProcessor` interface and `FfmpegProcessor` / `AvFoundationProcessor` selection by build flavor.
- Port **merge (copy)**, **trim**, **split (copy)**, **get duration/metadata**, **thumbnail** to AVFoundation on MAS flavor.
- MAS **format scope:** MP4 / MOV / M4V only (hide or disable MKV/AVI in MAS UI).
- Progress and cancel wired to `AVAssetExportSession` (or equivalent).
- Remove MAS dependency on `check-ffmpeg` UI paths.

| Milestone | Exit criteria |
|-----------|----------------|
| M1.1 Abstraction landed | IPC handlers delegate to processor; FFmpeg path unchanged for direct-download tests |
| M1.2 MAS entitlements v1 | `build/entitlements.mas.plist` + electron-builder `mas` target produces signed sandboxed `.pkg` / uploadable build |
| M1.3 Core manual QA | Script: 20-file GoPro session merge (copy), split, trim on MAS build; no sandbox violations in Console |

**Phase exit:** TestFlight or internal MAS build merges real SD-card footage end-to-end for **single-session, no gap indicators, copy quality**.

---

### Phase 2 — Re-encode quality + audio (estimated: 2–3 engineer-weeks)

**Work:**

- Map **high / medium / low** to VideoToolbox H.264 (and optionally HEVC) settings.
- **Normalize audio** — implement agreed substitute for `loudnorm=I=-16:TP=-1.5:LRA=11` (see technical plan).
- Re-encode merge and non-copy paths on MAS.

| Milestone | Exit criteria |
|-----------|----------------|
| M2.1 Quality presets | Three presets produce stable output; documented size/quality tradeoffs vs FFmpeg CRF |
| M2.2 Audio normalization v1 | Product-approved behavior (may be “peak normalize” or limited R128) passes listening test on multi-clip merge |

**Phase exit:** MAS build supports same quality **dropdown** as today with documented differences in help text.

---

### Phase 3 — Combined sessions + gap indicators (estimated: 3–5 engineer-weeks)

**Work:** Reimplement `src/gap-merge.js` pipeline on AVFoundation:

- Per-session concat (passthrough or encode).
- Segment normalize (scale/pad/fps/audio layout).
- Gap indicator clips (scale/pad + **text overlay** replacement for FFmpeg `drawtext`).
- Final passthrough concat.

| Milestone | Exit criteria |
|-----------|----------------|
| M3.1 Gap overlay | Indicator clip shows duration text; matches UX of current merge |
| M3.2 Full combined merge | E2E test: 3 sessions + 2 gap inserts → one output; cancel mid-flight cleans temp files |

**Phase exit:** Feature parity with **Combine selected sessions** + **Missing-time indicator** on MAS.

---

### Phase 4 — MAS release hardening (estimated: 2–4 engineer-weeks)

**Work:**

- App Store Connect metadata, review notes, privacy nutrition labels.
- Crash/analytics policy for MAS.
- CI job for MAS build (signing secrets).
- User-facing doc: MAS vs DMG differences (formats, updates).
- Parity test suite (automated where possible on macOS runners).

| Milestone | Exit criteria |
|-----------|----------------|
| M4.1 Review submission | Build accepted without entitlements/media entitlement rejections |
| M4.2 Support runbook | Known limitations (formats, loudnorm) documented in USER_GUIDE or MAS-specific FAQ |

**Phase exit:** Public MAS listing **or** documented blockers with owner sign-off.

---

## Rough total effort (estimate)

| Scope | Estimate |
|-------|----------|
| Prototype only | **1–2 engineer-weeks** |
| MAS v1 (Phases 1–2, no gap merge) | **~4–7 engineer-weeks** cumulative |
| Full parity (Phases 1–4) | **~10–16 engineer-weeks** cumulative |

Depends heavily on native-bridge choice, Swift experience, and App Store review iterations (**not** included as fixed time).

---

## MAS platform work (from codebase + standard Electron MAS requirements)

These items are **required or highly likely** for MAS and are **orthogonal** to AVFoundation but must be scheduled in the same program.

### App Sandbox and entitlements

- Today: `build/entitlements.mac.plist` enables **hardened runtime** JIT allowances for **Developer ID**, explicitly **not** App Sandbox (`build/README.md`).
- MAS needs a separate **`entitlements.mas.plist`**: App Sandbox `true`, typically:
  - `com.apple.security.files.user-selected.read-write` (and/or read-only + separate save panel)
  - **No** `disable-library-validation` / unsigned executable memory unless Apple-approved (Electron MAS templates vary by version—validate against current Electron docs).
- Native video helper (if any) must run **in-process** or as an XPC service with matching sandbox; arbitrary `spawn('ffmpeg')` is incompatible with MAS review for this product.

### File picker and security-scoped bookmarks

- Today: macOS file/folder selection uses **AppleScript** `choose file` / `choose folder` (`main/mac-open-panel.js`) and Electron `dialog` fallback; merge reads/writes **absolute paths** freely.
- Sandbox: after user selection, persist **`security-scoped bookmarks`** for:
  - Input files and folders (SD card paths, recent directories in preferences).
  - Output directory (`merged_videos`, user-chosen destination).
- Re-open bookmark before each read/write; handle **stale bookmark** (moved volume) with clear errors.
- **Native file drops:** `main.js` sets `sandbox: false` so Finder drops retain `File.path`; MAS build likely needs **`sandbox: true`** plus proper drop handling (`webUtils.getPathForFile` / re-prompt)—plan UX testing.

### SD card auto-detection

- `SDCardDetector` and volume listing may need **bookmarked volume access** or treat SD paths as user-initiated only; automatic read of `/Volumes/GoPro` without user action may be **denied** under strict sandbox. Product decision: MAS v1 may **degrade to manual folder pick** with banner copy changes.

### Updater

- Direct-download uses **`electron-updater`** + GitHub `latest-mac.yml` (`AUTO_UPDATE.md`, `main/ipc-updates.js`).
- **MAS builds must not ship electron-updater auto-install**; disable update IPC for MAS flavor; versions track App Store Connect.

### Code signing and notarization

- Developer ID pipeline remains for DMG (`docs/local/CODE_SIGNING_SETUP.md`).
- MAS uses **Apple Distribution** + **Mac App Store** provisioning; separate certificates and `electron-builder` `mas` configuration.

### Licensing / compliance

- Remove GPL FFmpeg from MAS bundle (`LICENSE` note).
- App Privacy Questionnaire: declare media file access on device (no upload unless bug report features send data—review `ipc-bug-report.js` for MAS disclosure).

### Electron packaging

- Expect **separate artifact** in CI (e.g. `build:mas`) without `resources/ffmpeg` / `resources/ffprobe` (`electron-builder.config.js`, `scripts/copy-ffmpeg-binaries.js`).
- App size: MAS build should drop **~45 MB+ per arch** FFmpeg; net size change measured in prototype.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Passthrough merge not faster (only equal) | Low for default UX | Still acceptable for MAS; market on compliance + size, not speed |
| Passthrough **slower** than FFmpeg on 4K | High | Prototype decision rules; investigate disk buffering / export preset |
| Gap `drawtext` / loudnorm hard to match | Medium | Phase 3 slip; ship MAS v1 without combined-session or with simplified overlay/audio |
| Sandbox blocks SD auto-detect | Medium | Manual folder pick; bookmark volumes user opens once |
| Dual maintenance (FFmpeg + AVF) | Medium | Strict `VideoProcessor` boundary; shared IPC tests with mocked backend |
| App Store rejection (entitlements, private APIs) | High | Early sandbox build; review Electron MAS guide for pinned Electron version |
| VideoToolbox quality ≠ CRF | Medium | Preset tuning doc; set user expectations in UI |
| Intel Mac performance | Medium | Prototype on Intel if available; optional lower default preset |

---

## Open questions

1. **Minimum macOS version** for MAS SKU — align with Electron support and HEVC/4K assumptions (currently app docs mention 10.15+).
2. **HEVC passthrough** — allow copy-merge HEVC GoPro clips into MP4 container on MAS without re-encode?
3. **MAS pricing / IAP** — same app as direct-download or separate listing?
4. **Loudnorm v1** — full EBU R128 vs simplified leveling acceptable for MAS launch?
5. **Gap indicator font** — continue Arial path or use system UI font via Core Text only?
6. **Single repo vs submodule** for Swift native code?
7. **CI macOS runners** — Apple Silicon only vs Intel + AS for MAS artifacts?
8. **Restore FUTURE_RELEASE.md** — repo references missing file; consolidate MAS commercial plan there or in this folder.

---

## Success metrics (program level)

- MAS build passes **App Store review** and completes **copy merge** of a 1-hour 4K GoPro session within **≤1.1×** FFmpeg fat-build time (same machine, same files)—**estimate threshold**, validate in prototype.
- **Zero** FFmpeg/FFprobe binaries in MAS `.app` Contents.
- Direct-download **fat** build regression tests green on each release branch.
- Crash-free sessions >99% in TestFlight (once telemetry available).
