# Releasing Video Merger

One command ships a new version: signed fat DMGs, GitHub Release assets, and update metadata for in-app upgrades.

## Before you release

- Merge your changes to `main` and pull locally.
- Clean working tree (`git status` shows nothing to commit).
- [`.env.local`](docs/local/CODE_SIGNING_SETUP.md) with `CSC_NAME`, `APPLE_TEAM_ID`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`.
- `gh` CLI logged in (`gh auth status`).
- `npm run check-signing` passes.

## Ship a version (recommended)

```bash
npm run official-release -- 1.3.0   # preflight + full release
npm run official-release -- patch     # bug fix
npm run official-release -- minor     # features
```

`official-release` checks branch, clean tree, `gh` auth, and `.env.local`, asks for confirmation, then runs the release pipeline.

Lower-level (no preflight prompt):

```bash
npm run release -- patch    # bug fix  (1.3.0 → 1.3.1)
npm run release -- minor    # features (1.3.0 → 1.4.0)
npm run release -- 1.5.0    # explicit version
```

**Cursor:** ask the agent to use the project skill **release-video-merger** (`.cursor/skills/release-video-merger/SKILL.md`) for step-by-step help.

Optional flags (after the bump argument; work with both commands):

- `--yes` — skip the official-release confirmation prompt.
- `--allow-branch` — allow release when not on `main` (avoid for friend drops).
- `--install` — after the release, install the arm64 build into `/Applications` (this machine only).
- `--no-push` — create the release locally without `git push` (useful for dry runs).
- `--notes path/to/notes.md` — custom GitHub release notes.

After a successful release, copy the friend install blurb from the terminal, or run:

```bash
npm run release:message
```

The script:

1. Runs tests and bumps `package.json` (this is the version `electron-updater` compares).
2. Builds **signed, notarized fat** arm64 and x64 DMGs/zips with update metadata (`PUBLISH_TO_GITHUB=true`, `--publish never`).
3. Merges `latest-mac.yml` for both architectures.
4. Commits the version bump, tags `vX.Y.Z`, creates the GitHub release, and pushes commit + tag.

CI does **not** publish releases (unsigned artifacts). Friend drops come from this local release flow.

## How users upgrade

| Install | First upgrade to a release with update metadata | Later releases |
|--------|--------------------------------------------------|----------------|
| Old DMG without `app-update.yml` (e.g. 1.0.0 friends) | Download the new fat DMG from [Releases](https://github.com/jsartin513/graphic_video_editor/releases/latest) and replace the app in Applications | In-app update (Settings → Check for updates, or startup notification) |
| Release built with `npm run release` | In-app update | In-app update |

Settings shows the installed version and explains manual DMG steps when in-app updates are not available.

## Semver

- **Patch** — bug fixes, no behavior surprises.
- **Minor** — new features, backward compatible.
- **Major** — breaking changes (rare for this app).

## Related docs

- Friend install steps: [DISTRIBUTION_GUIDE.md](DISTRIBUTION_GUIDE.md)
- Signing setup: [docs/local/CODE_SIGNING_SETUP.md](docs/local/CODE_SIGNING_SETUP.md)
- Paid / App Store / CI signing (deferred): [FUTURE_RELEASE.md](FUTURE_RELEASE.md)
