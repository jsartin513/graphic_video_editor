# GitHub Actions CI audit

This repository has a single workflow: [`.github/workflows/build.yml`](workflows/build.yml).

## Workflow summary

| Workflow | File | Purpose |
|----------|------|---------|
| Build Video Editor | `build.yml` | Unit tests, Playwright E2E, optional macOS DMG/ZIP packaging |

There is no separate lint job: the project has no ESLint (or similar) npm script. Quality gates are Jest unit tests and Playwright E2E.

## Triggers (after optimization)

| Event | Unit + E2E (ubuntu) | macOS packaging (4 jobs) |
|-------|---------------------|---------------------------|
| PR (non-draft, non-docs-only) | Yes | Only if **packaging-only** paths change (see below) |
| PR (draft) | Skipped | Skipped |
| PR (docs-only) | Skipped (paths-ignore) | Skipped |
| Push to `main` / `master` (non-docs) | Yes | No |
| Push of `v*` tag | **No** (not a workflow trigger) | **No** |
| Local release commit (`Release X.Y.Z [skip ci]`) | **No** (`[skip ci]` on push) | **No** |
| `workflow_dispatch` | Yes | Yes (optional via input) |

macOS jobs use `CSC_IDENTITY_AUTO_DISCOVERY=false` (unsigned). Signed/notarized friend releases remain local per [RELEASE.md](../RELEASE.md).

### Paths that enable macOS packaging on pull requests

The `packaging-gate` job uses [dorny/paths-filter](https://github.com/dorny/paths-filter) with **only** these paths (app source under `src/`, `main/`, `renderer/`, etc. does **not** trigger macOS builds):

- `build/**` (includes `build/entitlements.mac.plist`)
- `electron-builder.config.js`
- `package.json`
- `package-lock.json`
- `.github/workflows/**`

`workflow_dispatch` (with mac packaging enabled) and non-draft PRs that touch the paths above still run all four macOS jobs. Version tags from local release are pushed for GitHub Releases and auto-update metadata only — they do not start this workflow.

## Runners and rough per-run cost

GitHub bills **private** repos in minutes; **macOS minutes count 10×** toward the free tier.

Estimates below use typical wall-clock times from this repo (Jest ~2 min, E2E ~6 min on Linux, each macOS package job ~18–25 min). Actual times vary with cache hits and queueing.

### Before (prior `build.yml` on every PR/push to main)

| Job | Runner | When it ran | Wall time (est.) | Billed minutes (est.) |
|-----|--------|-------------|------------------|------------------------|
| `test` | ubuntu-latest | Every PR/push | ~3 min | **3** |
| `build-x64-fat` | macos-14 | Every PR/push | ~22 min | **220** (22×10) |
| `build-x64-lite` | macos-14 | Every PR/push | ~18 min | **180** |
| `build-arm64-fat` | macos-14 | Every PR/push | ~22 min | **220** |
| `build-arm64-lite` | macos-14 | Every PR/push | ~18 min | **180** |
| **Typical PR total** | | | ~22 min (parallel) | **~803 billed minutes** |

### After (this PR)

| Job | Runner | Typical PR (app code, ready for review) | Billed minutes (est.) |
|-----|--------|-------------------------------------------|------------------------|
| `packaging-gate` | ubuntu-latest | ~30 s | **1** |
| `test` | ubuntu-latest | ~3 min | **3** |
| `e2e` | ubuntu-latest | ~8 min | **8** |
| macOS jobs (×4) | macos-14 | **Skipped** unless packaging paths / tag / dispatch | **0** |
| **Typical PR total** | | ~10 min | **~12 billed minutes** |

| Scenario | Billed minutes (est.) |
|----------|------------------------|
| PR touching only `*.md` / `docs/` | **0** (workflow not triggered) |
| Draft PR | **0** |
| PR changing only app code (`src/`, `renderer/`, `main.js`, …) | **~12** (Linux CI only) |
| PR changing packaging paths (`package.json`, `build/`, workflow, …) | **~12 + ~800** ≈ **812** (intentional) |
| Local `npm run release` (commit + tag push) | **0** |
| `workflow_dispatch` (mac packaging on) | **~12 + ~800** ≈ **812** |
| Push to `main` (no tag) | **~12** |

**Typical app-only PR: ~803 → ~12 billed minutes (~98% reduction).** Packaging-path or release PRs still pay for macOS jobs when needed.

## Concurrency and caches

- **Concurrency**: one run per branch/PR; newer commits cancel in-progress runs.
- **npm**: `actions/setup-node` with `cache: npm`.
- **Electron / electron-builder**: `actions/cache` on Linux (`~/.cache/electron`) and macOS (`~/Library/Caches/electron`, `~/Library/Caches/electron-builder`).

## Local equivalents

See [README.md](../README.md#continuous-integration-local) — run the same checks on your machine without spending Actions minutes.
