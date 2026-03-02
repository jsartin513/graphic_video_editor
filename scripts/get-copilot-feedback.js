#!/usr/bin/env node
/**
 * Get detailed Copilot feedback from PRs
 */

const { getOctokit, getRepoInfo } = require('./github-api');

const featurePRs = [
  { pr: 57, issue: 33, title: 'Real-Time Progress Indicators' },
  { pr: 58, issue: 34, title: 'Cancel Operations' },
  { pr: 59, issue: 35, title: 'File Size Estimation' },
];

async function getDetailedFeedback() {
  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();

  for (const feature of featurePRs) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`PR #${feature.pr}: ${feature.title}`);
    console.log(`${'='.repeat(80)}`);

    try {
      const [comments, reviews, reviewComments] = await Promise.all([
        octokit.rest.issues.listComments({
          owner,
          repo,
          issue_number: feature.pr,
        }),
        octokit.rest.pulls.listReviews({
          owner,
          repo,
          pull_number: feature.pr,
        }),
        octokit.rest.pulls.listReviewComments({
          owner,
          repo,
          pull_number: feature.pr,
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
        ...reviewComments.data.map(c => ({
          type: 'review-comment',
          user: c.user.login,
          body: c.body,
          created: c.created_at,
          path: c.path,
          line: c.line,
        })),
      ].filter(f => f.user && (f.user.includes('copilot') || f.user.includes('Copilot')));

      if (allFeedback.length === 0) {
        console.log('  ⏳ No Copilot feedback found');
      } else {
        allFeedback.forEach((f, idx) => {
          console.log(`\n  ${idx + 1}. [${f.type.toUpperCase()}] @${f.user}`);
          if (f.state) console.log(`     State: ${f.state}`);
          if (f.path) console.log(`     File: ${f.path}:${f.line}`);
          console.log(`     Date: ${new Date(f.created).toLocaleString()}`);
          console.log(`     Content:\n${'     ' + f.body.split('\n').join('\n     ')}\n`);
        });
      }
    } catch (error) {
      console.error(`  ❌ Error fetching feedback: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

if (require.main === module) {
  getDetailedFeedback().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

