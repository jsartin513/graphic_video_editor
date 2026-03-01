#!/usr/bin/env node
/**
 * Script to create PRs for feature issues and request Copilot review
 */

const { getOctokit, getRepoInfo, createPullRequest } = require('./github-api');

// Map of issue numbers to feature details
const featurePRs = [
  { issue: 33, branch: 'feature/real-time-progress', title: 'Add Real-Time Progress Indicators for Video Merging' },
  { issue: 34, branch: 'feature/cancel-operations', title: 'Add Cancel Operations Mid-Way' },
  { issue: 35, branch: 'feature/file-size-estimation', title: 'Add File Size Estimation Before Merge' },
  { issue: 36, branch: 'feature/video-thumbnails', title: 'Add Video Preview/Thumbnails' },
  { issue: 37, branch: 'feature/batch-merge', title: 'Add Batch Merge Multiple Groups' },
  { issue: 38, branch: 'feature/quality-options', title: 'Add Video Quality/Compression Options' },
  { issue: 39, branch: 'feature/keyboard-shortcuts', title: 'Add Keyboard Shortcuts' },
  { issue: 40, branch: 'feature/settings-persistence', title: 'Add Export Settings Persistence' },
  { issue: 41, branch: 'feature/metadata-viewing', title: 'Add Video Metadata Viewing' },
  { issue: 42, branch: 'feature/error-recovery', title: 'Add Error Recovery/Resume' },
  { issue: 43, branch: 'feature/video-trimming', title: 'Add Video Trimming' },
  { issue: 44, branch: 'feature/export-formats', title: 'Add Export to Different Formats' },
  { issue: 45, branch: 'feature/audio-normalization', title: 'Add Audio Level Normalization' },
  { issue: 46, branch: 'feature/undo-redo', title: 'Add Undo/Redo' },
  { issue: 47, branch: 'feature/drag-reorder', title: 'Add Drag-to-Reorder Files' },
  { issue: 48, branch: 'feature/better-errors', title: 'Improve Error Messages' },
  { issue: 49, branch: 'feature/recent-projects', title: 'Add Recent Projects/Files' },
  { issue: 50, branch: 'feature/video-comparison', title: 'Add Video Comparison Tool' },
  { issue: 51, branch: 'feature/auto-detect-sd', title: 'Add Auto-Detect SD Cards' },
  { issue: 52, branch: 'feature/export-history', title: 'Add Export History' },
  { issue: 53, branch: 'feature/performance-optimizations', title: 'Performance Optimizations' },
  { issue: 54, branch: 'feature/better-logging', title: 'Add Better Logging' },
  { issue: 55, branch: 'feature/unit-tests', title: 'Improve Unit Test Coverage' },
  { issue: 56, branch: 'feature/code-splitting', title: 'Add Code Splitting' },
];

const prBodyTemplate = (issueNum) => `## Overview

This PR implements the feature described in #${issueNum}.

## Implementation Plan

This is a work-in-progress PR. The implementation will include:

1. [ ] Review the issue requirements
2. [ ] Design the solution
3. [ ] Implement the feature
4. [ ] Add tests
5. [ ] Update documentation

## Status

🔨 **In Progress** - Ready for implementation

## Related

- Closes #${issueNum}

---

**Note**: This PR was created automatically. Implementation work is needed.

@copilot Please review this PR and provide guidance on implementation approach.
`;

async function createPRs() {
  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();

  console.log(`Creating ${featurePRs.length} PRs...\n`);

  const createdPRs = [];

  for (const feature of featurePRs) {
    try {
      // Create a branch from main
      const { data: mainBranch } = await octokit.rest.repos.getBranch({
        owner,
        repo,
        branch: 'main'
      });

      // Create the feature branch
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${feature.branch}`,
        sha: mainBranch.commit.sha
      });

      // Create a placeholder file to establish the branch
      const { data: mainContent } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: 'README.md',
        ref: 'main'
      });

      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: `.feature-tracking/${feature.issue}-${feature.branch.replace('feature/', '')}.md`,
        message: `Add tracking file for #${feature.issue}`,
        content: Buffer.from(`# Feature Implementation Tracking\n\nIssue: #${feature.issue}\nBranch: ${feature.branch}\n\nStatus: Planning\n`).toString('base64'),
        branch: feature.branch,
        sha: null
      });

      // Create the PR
      const result = await createPullRequest(
        feature.title,
        prBodyTemplate(feature.issue),
        feature.branch,
        'main'
      );

      if (result.success) {
        console.log(`✅ Created PR #${result.number}: ${feature.title}`);
        
        // Request Copilot review
        try {
          await octokit.rest.pulls.requestReviewers({
            owner,
            repo,
            pull_number: result.number,
            reviewers: ['copilot']
          });
          console.log(`   👥 Requested review from @copilot`);
        } catch (reviewError) {
          // Copilot might not be available as a reviewer, that's ok
          console.log(`   ⚠️  Could not request Copilot review (might not be available)`);
        }

        // Add comment requesting review
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: result.number,
          body: `@copilot Please review this PR and provide guidance on the implementation approach for #${feature.issue}.`
        });

        createdPRs.push(result);
      } else {
        console.error(`❌ Failed to create PR for ${feature.title}:`, result.error);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ Failed to create PR for ${feature.title}:`, error.message);
      if (error.response?.data) {
        console.error('Details:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }

  console.log(`\n✅ Created ${createdPRs.length}/${featurePRs.length} PRs`);
  return createdPRs;
}

if (require.main === module) {
  createPRs().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

module.exports = { createPRs };

