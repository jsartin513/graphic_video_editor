# Building Video Editor

## Local Building

### Build for Both Architectures

```bash
npm install
npm run build
```

This will create builds for both x64 (Intel) and arm64 (Apple Silicon).

### Build for Specific Architecture

**Apple Silicon (arm64):**
```bash
npm run build:arm64
```

**Intel (x64):**
```bash
npm run build:x64
```

## Building on Different Mac Types

### On Apple Silicon Mac (M1/M2/M3)
- ✅ Can build arm64 natively
- ⚠️ Can build x64 with Rosetta 2 (may be slower)

### On Intel Mac
- ✅ Can build x64 natively
- ⚠️ Cannot build arm64 (would need Apple Silicon Mac or CI)

## Automated Building with GitHub Actions

The repository includes a GitHub Actions workflow that automatically builds both architectures when you:

1. **Push a tag** starting with `v` (e.g., `v1.0.0`)
2. **Manually trigger** the workflow from the Actions tab
3. **Create a pull request** to main/master

### Setting Up GitHub Actions

1. Push your code to GitHub
2. The workflow will automatically run on pushes/PRs
3. For releases, create a tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. The workflow will build both architectures and create a GitHub Release with both DMG files

### Workflow Features

- Builds both x64 and arm64 versions
- Creates DMG and ZIP files for each architecture
- Uploads artifacts for download
- Creates GitHub Releases automatically on tag push
- Artifacts are retained for 30 days

## Distribution Files

After building, you'll find in the `dist/` directory:

- **Apple Silicon**: `Video Editor-1.0.0-arm64.dmg` and `.zip`
- **Intel**: `Video Editor-1.0.0-x64.dmg` and `.zip`

## Manual Distribution

If building locally:

1. **For Apple Silicon users**: Send `Video Editor-1.0.0-arm64.dmg`
2. **For Intel users**: Send `Video Editor-1.0.0-x64.dmg`
3. **For both**: Send both files and let users choose

Users can check their Mac type:
- Apple menu → About This Mac
- Look for "Chip" or "Processor"
- Apple M1/M2/M3 = arm64
- Intel = x64

