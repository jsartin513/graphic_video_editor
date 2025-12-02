# GitHub Repository Setup

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `video-editor` (or your preferred name)
3. Description: "Video Editor for merging GoPro videos"
4. Choose Public or Private
5. **Do NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

## Step 2: Initialize and Push Local Repository

Run these commands in your terminal:

```bash
cd /Users/jessica.sartin/github_development/graphic_video_editor

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Video Editor app with prerequisites installer"

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/video-editor.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

## Alternative: Using SSH

If you prefer SSH:

```bash
git remote add origin git@github.com:YOUR_USERNAME/video-editor.git
git push -u origin main
```

## Step 3: Verify GitHub Actions

After pushing:

1. Go to your repository on GitHub
2. Click the "Actions" tab
3. You should see the workflow file
4. The workflow will run automatically on pushes and PRs

## Step 4: Create a Release (Optional)

To trigger an automatic release build:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This will:
- Build both x64 and arm64 versions
- Create a GitHub Release
- Attach both DMG files to the release

## Troubleshooting

**If you get "remote origin already exists":**
```bash
git remote remove origin
git remote add origin <your-repo-url>
```

**If you need to update the remote URL:**
```bash
git remote set-url origin <new-repo-url>
```

**To check current remote:**
```bash
git remote -v
```

