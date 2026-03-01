#!/usr/bin/env node
/**
 * Script to fetch Copilot feedback/comments from PRs and compare with implementation ideas
 */

const { getOctokit, getRepoInfo } = require('./github-api');

const featurePRs = [
  { pr: 57, issue: 33, title: 'Real-Time Progress Indicators', phase: 'Phase 1' },
  { pr: 58, issue: 34, title: 'Cancel Operations', phase: 'Phase 1' },
  { pr: 59, issue: 35, title: 'File Size Estimation', phase: 'Phase 1' },
  { pr: 61, issue: 36, title: 'Video Thumbnails', phase: 'Phase 2' },
  { pr: 64, issue: 37, title: 'Batch Merge', phase: 'Phase 2' },
  { pr: 66, issue: 38, title: 'Quality Options', phase: 'Phase 3' },
  { pr: 68, issue: 39, title: 'Keyboard Shortcuts', phase: 'Phase 2' },
  { pr: 69, issue: 40, title: 'Settings Persistence', phase: 'Phase 3' },
  { pr: 72, issue: 41, title: 'Metadata Viewing', phase: 'Medium' },
  { pr: 73, issue: 42, title: 'Error Recovery', phase: 'Medium' },
  { pr: 76, issue: 43, title: 'Video Trimming', phase: 'Lower Priority' },
  { pr: 78, issue: 44, title: 'Export Formats', phase: 'Lower Priority' },
  { pr: 79, issue: 45, title: 'Audio Normalization', phase: 'Lower Priority' },
  { pr: 82, issue: 46, title: 'Undo/Redo', phase: 'Lower Priority' },
  { pr: 84, issue: 47, title: 'Drag Reorder', phase: 'Lower Priority' },
  { pr: 86, issue: 48, title: 'Better Errors', phase: 'Quality of Life' },
  { pr: 88, issue: 49, title: 'Recent Projects', phase: 'Quality of Life' },
  { pr: 90, issue: 50, title: 'Video Comparison', phase: 'Quality of Life' },
  { pr: 92, issue: 51, title: 'Auto-Detect SD', phase: 'Quality of Life' },
  { pr: 94, issue: 52, title: 'Export History', phase: 'Quality of Life' },
  { pr: 96, issue: 53, title: 'Performance', phase: 'Technical' },
  { pr: 98, issue: 54, title: 'Better Logging', phase: 'Technical' },
  { pr: 99, issue: 55, title: 'Unit Tests', phase: 'Technical' },
  { pr: 102, issue: 56, title: 'Code Splitting', phase: 'Technical' },
];

async function getPRComments(prNumber) {
  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();

  try {
    const [comments, reviews] = await Promise.all([
      octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
      }),
      octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: prNumber,
      }),
    ]);

    const allFeedback = [
      ...comments.data.map(c => ({
        type: 'comment',
        user: c.user.login,
        body: c.body,
        created: c.created_at,
      })),
      ...reviews.data.map(r => ({
        type: 'review',
        user: r.user.login,
        body: r.body,
        state: r.state,
        created: r.submitted_at,
      })),
    ];

    return allFeedback.filter(f => f.user === 'copilot' || f.user.includes('copilot'));
  } catch (error) {
    return [];
  }
}

async function compareFeedback() {
  console.log('🔍 Fetching Copilot feedback from PRs...\n');
  
  const comparisons = [];

  for (const feature of featurePRs) {
    const feedback = await getPRComments(feature.pr);
    
    comparisons.push({
      feature,
      feedback: feedback.length > 0 ? feedback : null,
    });

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Print comparison
  console.log('='.repeat(80));
  console.log('COPILOT FEEDBACK COMPARISON');
  console.log('='.repeat(80));
  console.log();

  for (const { feature, feedback } of comparisons) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`${feature.phase}: ${feature.title} (PR #${feature.pr}, Issue #${feature.issue})`);
    console.log(`${'─'.repeat(80)}`);

    if (!feedback || feedback.length === 0) {
      console.log('  ⏳ No Copilot feedback yet');
      console.log('  💡 My implementation ideas are in FEATURE_IDEAS.md');
    } else {
      console.log(`  ✅ Copilot has provided ${feedback.length} feedback item(s):\n`);
      feedback.forEach((f, idx) => {
        console.log(`  ${idx + 1}. [${f.type.toUpperCase()}] ${f.user} (${new Date(f.created).toLocaleDateString()})`);
        if (f.state) console.log(`     State: ${f.state}`);
        const preview = f.body.substring(0, 200).replace(/\n/g, ' ');
        console.log(`     ${preview}${f.body.length > 200 ? '...' : ''}\n`);
      });
    }
  }

  const withFeedback = comparisons.filter(c => c.feedback && c.feedback.length > 0);
  const withoutFeedback = comparisons.filter(c => !c.feedback || c.feedback.length === 0);

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total PRs checked: ${comparisons.length}`);
  console.log(`PRs with Copilot feedback: ${withFeedback.length}`);
  console.log(`PRs awaiting feedback: ${withoutFeedback.length}`);
  console.log(`\nPhase 1 PRs (${comparisons.filter(c => c.feature.phase === 'Phase 1').length}): ${comparisons.filter(c => c.feature.phase === 'Phase 1').map(c => `#${c.feature.pr}`).join(', ')}`);
  
  return comparisons;
}

if (require.main === module) {
  compareFeedback().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

module.exports = { compareFeedback, getPRComments };

