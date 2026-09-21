---
name: release-video-merger
description: >-
  Official Video Merger (graphic_video_editor) macOS release: preflight on main,
  signed notarized fat arm64+x64 DMGs, GitHub release with latest-mac.yml, friend
  install message. Use when the user asks to release, ship, publish, tag, bump
  version, official release, or upgrade friends to a new Video Merger build.
---

# Video Merger official release

## When to apply

User wants an **official friend-facing release** of the Electron app in this repo (`graphic_video_editor`), not CI-only builds or vidmerge deploys.

## Prerequisites (agent must verify)

1. Changes merged to **`main`** (or user explicitly accepts `--allow-branch`).
2. **Clean git tree** — no uncommitted files.
3. **`.env.local`** at repo root with `CSC_NAME`, `APPLE_TEAM_ID`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` ([docs/local/CODE_SIGNING_SETUP.md](../../../docs/local/CODE_SIGNING_SETUP.md)).
4. **`gh auth status`** succeeds.
5. Read [RELEASE.md](../../../RELEASE.md) for semver and upgrade behavior.

Do **not** run a release from a dirty feature branch unless the user explicitly overrides with `--allow-branch` and understands the risk.

## What to run (preferred)

From repo root:

```bash
npm run official-release -- 1.3.0
# or: patch | minor | major
```

Optional flags (after bump, pass through to `release.sh`):

| Flag | Effect |
|------|--------|
| `--yes` / `-y` | Skip interactive confirmation |
| `--install` | Install arm64 build to `/Applications` on this Mac |
| `--no-push` | Create release locally without `git push` |
| `--notes path.md` | Custom GitHub release notes |
| `--allow-branch` | Not on main (discourage unless user insists) |

Lower-level (no preflight): `npm run release -- patch`

## What the script does

1. Preflight: tools, gh auth, `.env.local`, clean tree, branch/upstream checks.
2. `npm test`, `npm run check-signing`.
3. Bump `package.json` (this is the version **electron-updater** uses).
4. Signed + notarized **fat** arm64 and x64 with `PUBLISH_TO_GITHUB=true` and `--publish never`.
5. Merge `latest-mac.yml` for both architectures.
6. Commit `Release X.Y.Z`, tag `vX.Y.Z`, push commit + tag, then `gh release create` with assets (unless `--no-push`).
8. Print **friend message** via `scripts/print-friend-release-message.sh`.

Re-run friend text anytime: `npm run release:message`

## Version guidance

- **package.json version** must match what users see; do not reuse a misleading GitHub tag (e.g. `v1.2.0` with binary `1.0.0`).
- After the release-process work landed, first aligned drop is often **`1.3.0`** unless `main` already has a higher version.
- Semver: **patch** = fix, **minor** = feature, **major** = breaking.

## How friends upgrade

| Their install | This release | Next releases |
|---------------|--------------|---------------|
| Old DMG without `app-update.yml` (e.g. 1.0.0) | Manual **arm64-fat** or **x64-fat** DMG once | In-app (Settings → Check for updates) |
| Install from `npm run official-release` | In-app | In-app |

Releases URL: https://github.com/jsartin513/graphic_video_editor/releases/latest

## Agent checklist after success

1. Confirm GitHub release has **both** fat DMGs, zips, and **`latest-mac.yml`**.
2. Give user the friend message (script prints it; or `npm run release:message`).
3. Do **not** re-enable the disabled CI `release` job in `.github/workflows/build.yml` unless CI signing exists ([FUTURE_RELEASE.md](../../../FUTURE_RELEASE.md)).

## Troubleshooting

| Problem | Action |
|---------|--------|
| Dirty tree | Commit or stash; release requires clean state |
| Not on main | `git checkout main && git pull` |
| `check-signing` fails | Fix cert / `.env.local` per CODE_SIGNING_SETUP |
| Build fails notarization | Verify Apple app-specific password and team ID |
| Tag already exists | Bump to unused version; never force-push release tags |

## Related files

- [scripts/official-release.sh](../../../scripts/official-release.sh) — preflight wrapper
- [scripts/release.sh](../../../scripts/release.sh) — build + GitHub release
- [DISTRIBUTION_GUIDE.md](../../../DISTRIBUTION_GUIDE.md) — which DMG per chip
