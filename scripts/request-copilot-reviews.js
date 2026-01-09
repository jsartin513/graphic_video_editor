const { getOctokit, getRepoInfo } = require('./github-api.js');

async function requestCopilotReviews() {
  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();
  const prNumbers = [82, 84, 86];
  
  console.log('Requesting Copilot reviews on PRs...\n');
  
  for (const num of prNumbers) {
    try {
      // Add a comment to request review
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: num,
        body: '@github-copilot Please review this PR'
      });
      console.log(`✅ Added review request comment to PR #${num}`);
    } catch (e) {
      console.log(`⚠️  PR #${num}: ${e.message}`);
    }
  }
}

requestCopilotReviews().catch(console.error);

