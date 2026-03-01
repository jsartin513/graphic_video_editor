#!/usr/bin/env node
/**
 * Get detailed information about a specific PR
 */

const { getOctokit, getRepoInfo } = require('./github-api');

async function getPRDetails(prNumber) {
  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();

  try {
    const [pr, files, reviews] = await Promise.all([
      octokit.rest.pulls.get({ owner, repo, pull_number: prNumber }),
      octokit.rest.pulls.listFiles({ owner, repo, pull_number: prNumber }),
      octokit.rest.pulls.listReviews({ owner, repo, pull_number: prNumber }),
    ]);

    return {
      pr: pr.data,
      files: files.data,
      reviews: reviews.data,
    };
  } catch (error) {
    throw new Error(`Failed to get PR details: ${error.message}`);
  }
}

async function main() {
  const prNumbers = process.argv.slice(2).map(n => parseInt(n));
  
  if (prNumbers.length === 0) {
    console.error('Usage: node get-pr-details.js <pr-number> [pr-number...]');
    process.exit(1);
  }

  for (const prNumber of prNumbers) {
    try {
      const { pr, files, reviews } = await getPRDetails(prNumber);
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`PR #${pr.number}: ${pr.title}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`URL: ${pr.html_url}`);
      console.log(`Author: ${pr.user.login}`);
      console.log(`State: ${pr.state}`);
      console.log(`Base: ${pr.base.ref} ← Head: ${pr.head.ref}`);
      console.log(`Created: ${new Date(pr.created_at).toLocaleString()}`);
      console.log(`Updated: ${new Date(pr.updated_at).toLocaleString()}`);
      
      if (pr.body) {
        console.log(`\nDescription:`);
        console.log(pr.body);
      }

      console.log(`\n📁 Files Changed (${files.length}):`);
      files.forEach(file => {
        const status = file.status === 'added' ? '➕' : 
                      file.status === 'modified' ? '📝' : 
                      file.status === 'removed' ? '➖' : '📄';
        const changes = `+${file.additions} -${file.deletions}`;
        console.log(`  ${status} ${file.filename} (${changes})`);
      });

      if (reviews.length > 0) {
        console.log(`\n👥 Reviews (${reviews.length}):`);
        reviews.forEach(review => {
          const emoji = review.state === 'APPROVED' ? '✅' : 
                       review.state === 'CHANGES_REQUESTED' ? '❌' : 
                       review.state === 'COMMENTED' ? '💬' : '⏳';
          console.log(`  ${emoji} ${review.user.login}: ${review.state}`);
          if (review.body) {
            console.log(`     "${review.body.substring(0, 100)}${review.body.length > 100 ? '...' : ''}"`);
          }
        });
      } else {
        console.log(`\n👥 Reviews: None yet`);
      }

      console.log(`\n📊 Stats:`);
      const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
      const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
      console.log(`  Total additions: +${totalAdditions}`);
      console.log(`  Total deletions: -${totalDeletions}`);
      
    } catch (error) {
      console.error(`\n❌ Error fetching PR #${prNumber}:`, error.message);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { getPRDetails };

