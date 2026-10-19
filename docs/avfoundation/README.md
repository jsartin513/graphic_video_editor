# AVFoundation migration (Mac App Store)

Planning documents for moving **Video Merger’s MAS build** from bundled FFmpeg/FFprobe to **AVFoundation** (and VideoToolbox where re-encoding is required). The **direct-download (Developer ID / fat DMG) build continues to use FFmpeg** unless product strategy changes later.

## Documents

| Document | Purpose |
|----------|---------|
| [PROJECT_PLAN.md](./PROJECT_PLAN.md) | Goals, phases, milestones, MAS platform work (sandbox, entitlements, updates), risks, open questions |
| [TECHNICAL_PLAN.md](./TECHNICAL_PLAN.md) | `VideoProcessor` abstraction, native integration options, per-operation mapping, formats, testing |
| [PROTOTYPE.md](./PROTOTYPE.md) | Narrow prototype scope, benchmark protocol, decision rules (go / pivot / abort) |

## Current status

| Item | Status |
|------|--------|
| Decision to plan MAS on AVFoundation | **Accepted** (owner, Oct 2026) |
| FFmpeg inventory / speed analysis | **Done** (Cloud Agent investigation; see commit history on this PR) |
| Prototype native module | **Not started** |
| `VideoProcessor` abstraction in main process | **Not started** |
| MAS entitlements / sandbox profile | **Not started** (current `build/entitlements.mac.plist` is Developer ID hardened runtime, **not** App Sandbox) |
| App Store Connect / MAS electron-builder target | **Not started** |

## Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-10-10 | Inventory FFmpeg usage before committing to AVFoundation | Needed exact args, copy vs encode paths, gap-merge complexity |
| 2026-10-10 | **Dual-SKU strategy:** MAS → AVFoundation; direct download → keep bundled FFmpeg | Preserves fastest default path for existing users; avoids GPL/LGPL bundling issues on MAS; limits scope of first native rewrite |
| 2026-10-10 | MAS export formats scoped to **MP4 / MOV / M4V** initially | AVFoundation has no first-class MKV/AVI export; matches primary GoPro workflow |
| 2026-10-10 | Run **[PROTOTYPE.md](./PROTOTYPE.md)** before full gap-merge / loudnorm port | De-risks integration, sandbox, and speed assumptions on real 4K GoPro footage |
| _TBD_ | Native integration pattern (N-API vs helper vs XPC) | Pending prototype + team Swift/Obj-C comfort (recommendation in [TECHNICAL_PLAN.md](./TECHNICAL_PLAN.md)) |
| _TBD_ | Loudnorm parity vs simplified audio leveling on MAS | EBU R128 has no AVFoundation one-liner; product call after prototype |

## How to pick this up

1. **Read in order:** this README → [PROJECT_PLAN.md](./PROJECT_PLAN.md) (scope) → [TECHNICAL_PLAN.md](./TECHNICAL_PLAN.md) (design) → [PROTOTYPE.md](./PROTOTYPE.md) (first executable milestone).
2. **Environment:** macOS with Xcode, Apple Silicon **and** Intel hardware if possible, real GoPro 4K chapter clips (same session ID), and a current **fat** build for FFmpeg baselines.
3. **Execute the prototype** exactly as specified in [PROTOTYPE.md](./PROTOTYPE.md); fill in the results table and apply the **decision rules** at the bottom of that doc.
4. **If prototype passes:** create `build/entitlements.mas.plist` (App Sandbox), add MAS target to electron-builder, introduce `VideoProcessor` + `AvFoundationProcessor` behind existing IPC (see technical plan).
5. **If prototype fails criteria:** follow decision rules (e.g. LGPL FFmpeg helper, reduced MAS feature set, or defer MAS)—update the decision log in this README.
6. **Code touchpoints today (FFmpeg):** `main/ipc-merge-split.js`, `main/ipc-video.js`, `src/gap-merge.js`, `src/ffmpeg-resolver.js`, `main/ipc-misc.js` (`check-ffmpeg` / Homebrew install—**not** for MAS).
7. **Do not block direct-download releases** on this work; land MAS behind a separate build flavor (`BUNDLE_FFMPEG` / new `VIDEO_BACKEND=avfoundation` style flag—exact name TBD in implementation).

## Related repo docs

- [ARCHITECTURE.md](../../ARCHITECTURE.md) — IPC map
- [build/README.md](../../build/README.md) — current Developer ID entitlements (not sandbox)
- [DISTRIBUTION_GUIDE.md](../../DISTRIBUTION_GUIDE.md) — friend DMG distribution
- [AUTO_UPDATE.md](../../AUTO_UPDATE.md) — `electron-updater` (GitHub); **not valid for MAS**
- [LICENSE](../../LICENSE) — GPL FFmpeg bundling note for paid/closed builds
