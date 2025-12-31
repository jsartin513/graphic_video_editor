# GitHub Automation Setup

This guide explains how to set up GitHub API integration for automated pull requests, issue management, and repository access.

## Quick Start

1. **Create GitHub Personal Access Token**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"
   - Name: "Video Merger Automation"
   - Scopes: `repo`, `workflow`
   - Generate and copy the token

2. **Set up local authentication**
   ```bash
   ./scripts/setup-github-auth.sh
   ```
   Or manually create `.env` file:
   ```bash
   cp .env.example .env
   # Edit .env and add your token
   ```

3. **Test the setup**
   ```bash
   node scripts/test-github-api.js
   ```

## Creating a GitHub Personal Access Token

### Step-by-Step Instructions

1. **Navigate to GitHub Settings**
   - Go to https://github.com/settings/tokens
   - Or: GitHub → Your Profile → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **Generate New Token**
   - Click "Generate new token" → "Generate new token (classic)"
   - Give it a descriptive name: `Video Merger Automation`

3. **Select Scopes**
   - ✅ **repo** - Full control of private repositories
     - Includes: Read/write access to code, pull requests, issues
   - ✅ **workflow** - Update GitHub Action workflows
     - Needed for: Updating workflow files via API

4. **Generate and Copy**
   - Click "Generate token"
   - **Important**: Copy the token immediately (you won't see it again!)
   - Store it securely

5. **Token Expiration**
   - Choose expiration (30 days, 60 days, 90 days, or no expiration)
   - For automation, consider longer expiration or no expiration

## Local Setup

### Option 1: Using Setup Script (Recommended)

```bash
./scripts/setup-github-auth.sh
```

This script will:
- Create `.env` file from `.env.example`
- Prompt for your GitHub token
- Optionally set repository name
- Validate the setup

### Option 2: Manual Setup

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file:**
   ```bash
   GITHUB_TOKEN=your_actual_token_here
   GITHUB_REPO=jsartin513/graphic_video_editor  # Optional, auto-detected from git
   ```

3. **Verify `.env` is in `.gitignore`** (should already be there)

## GitHub Secrets Setup (for CI/CD)

To use GitHub API in GitHub Actions workflows:

1. **Go to Repository Settings**
   - Navigate to: `https://github.com/USERNAME/REPO/settings/secrets/actions`

2. **Add New Secret**
   - Click "New repository secret"
   - Name: `GITHUB_TOKEN` (or `GH_TOKEN`)
   - Value: Your Personal Access Token
   - Click "Add secret"

3. **Use in Workflows**
   ```yaml
   env:
     GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
   ```

**Note:** GitHub Actions already provides `GITHUB_TOKEN` automatically, but it has limited permissions. For full automation, use a Personal Access Token.

## Usage Examples

### Create a Pull Request

```bash
# Using CLI
node scripts/github-cli.js pr create \
    --title "Fix bug" \
    --body "This fixes the issue" \
    --head feature-branch \
    --base main

# Using shell wrapper
./scripts/create-pr.sh "Fix bug" feature-branch main "Description"
```

### List Pull Requests

```bash
# List open PRs
node scripts/github-cli.js pr list

# List closed PRs
node scripts/github-cli.js pr list --state closed

# List PRs with specific labels
node scripts/github-cli.js pr list --labels "bug,urgent"
```

### List Issues

```bash
# List open issues
node scripts/github-cli.js issue list

# List closed issues
node scripts/github-cli.js issue list --state closed

# List issues assigned to a user
node scripts/github-cli.js issue list --assignee jsartin513

# List issues with labels
node scripts/github-cli.js issue list --labels "enhancement"
```

### Assign Issues

```bash
# Assign issue to yourself
node scripts/github-cli.js issue assign 123 jsartin513

# Using shell wrapper
./scripts/assign-issue.sh 123 jsartin513

# Assign to multiple people
node scripts/github-cli.js issue assign 123 jsartin513 collaborator
```

### Comment on Issues/PRs

```bash
node scripts/github-cli.js issue comment 123 "This is a comment"
```

### Read Repository Files

```bash
# Read file from main branch
node scripts/github-cli.js read-file README.md

# Read file from specific branch
node scripts/github-cli.js read-file package.json --branch feature-branch
```

### Get Repository Information

```bash
node scripts/github-cli.js repo info
```

## Using in Node.js Scripts

You can import and use the API functions directly:

```javascript
const {
  createPullRequest,
  getIssues,
  assignIssue,
  commentOnIssue,
} = require('./scripts/github-api');

// Create a PR
const result = await createPullRequest(
  'My PR Title',
  'PR description',
  'feature-branch',
  'main'
);

if (result.success) {
  console.log(`PR created: ${result.url}`);
}

// Get issues
const issues = await getIssues({ state: 'open' });
if (issues.success) {
  issues.issues.forEach(issue => {
    console.log(`#${issue.number}: ${issue.title}`);
  });
}
```

## Security Best Practices

1. **Never commit tokens**
   - `.env` is in `.gitignore` - never commit it
   - Never hardcode tokens in scripts
   - Use environment variables or GitHub Secrets

2. **Token permissions**
   - Use minimum required scopes
   - Regularly review and rotate tokens
   - Revoke unused tokens

3. **Token storage**
   - Local: Use `.env` file (gitignored)
   - CI/CD: Use GitHub Secrets
   - Never log or print tokens

4. **Token rotation**
   - Rotate tokens periodically
   - Update `.env` and GitHub Secrets when rotating

## Troubleshooting

### "GITHUB_TOKEN not set" Error

**Solution:**
- Check that `.env` file exists
- Verify `GITHUB_TOKEN` is set in `.env`
- Run `./scripts/setup-github-auth.sh` to set up

### "Could not determine repository" Error

**Solution:**
- Set `GITHUB_REPO=owner/repo` in `.env`
- Or ensure git remote is configured: `git remote -v`

### "Bad credentials" Error

**Solution:**
- Verify token is correct
- Check token hasn't expired
- Ensure token has required scopes (`repo`, `workflow`)

### "Resource not accessible" Error

**Solution:**
- Check token has `repo` scope
- Verify repository name is correct
- Ensure you have access to the repository

## API Reference

### Functions Available

- `createPullRequest(title, body, headBranch, baseBranch)` - Create PR
- `getPullRequests(options)` - List PRs
- `getIssues(options)` - List issues
- `assignIssue(issueNumber, assignees)` - Assign issue
- `commentOnIssue(issueNumber, body)` - Add comment
- `readFileContent(filePath, branch)` - Read file
- `getRepositoryInfo()` - Get repo metadata

See `scripts/github-api.js` for full function signatures and options.

## Integration with GitHub Actions

You can use these scripts in GitHub Actions workflows:

```yaml
- name: Comment on PR
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    node scripts/github-cli.js issue comment ${{ github.event.pull_request.number }} "Build completed!"
```

## Next Steps

- Test the API: `node scripts/test-github-api.js`
- Try creating a test PR
- Explore the CLI: `node scripts/github-cli.js` (shows usage)

