const { getOctokit, getRepoInfo } = require('./github-api.js');

async function checkCopilotFeedback() {
  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();
  
  console.log('Checking for Copilot PRs and reviews...\n');
  
  // Check for Copilot PRs
  const { data: allPRs } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: 'open',
    sort: 'updated',
    direction: 'desc',
    per_page: 50
  });
  
  const copilotPRs = allPRs.filter(pr => 
    pr.head.ref.includes('copilot') || 
    pr.user.login === 'github-actions[bot]' ||
    pr.user.login.toLowerCase().includes('copilot')
  );
  
  console.log(`Found ${copilotPRs.length} Copilot PRs:\n`);
  copilotPRs.slice(0, 15).forEach(pr => {
    console.log(`  PR #${pr.number}: ${pr.title.substring(0, 70)}`);
  });
  
  // Check reviews on our PRs
  console.log('\nChecking reviews on our PRs (82, 84, 86):\n');
  const ourPRs = [82, 84, 86];
  
  for (const num of ourPRs) {
    try {
      const { data: reviews } = await octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: num
      });
      
      const copilotReviews = reviews.filter(r => 
        r.user.login === 'github-copilot' || 
        r.user.login === 'github-actions[bot]'
      );
      
      if (copilotReviews.length > 0) {
        console.log(`✅ PR #${num} has ${copilotReviews.length} Copilot review(s)`);
        copilotReviews.forEach(r => {
          console.log(`   State: ${r.state}, Submitted: ${r.submitted_at}`);
          if (r.body) {
            console.log(`   Review: ${r.body.substring(0, 150)}...`);
          }
        });
      } else {
        console.log(`⏳ PR #${num}: No Copilot reviews yet`);
      }
      
      // Check comments
      const { data: comments } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: num
      });
      
      const copilotComments = comments.filter(c => 
        c.user.login === 'github-copilot' || 
        c.user.login === 'github-actions[bot]'
      );
      
      if (copilotComments.length > 0) {
        console.log(`   Has ${copilotComments.length} Copilot comment(s)`);
      }
    } catch (e) {
      console.log(`❌ Error checking PR #${num}: ${e.message}`);
    }
  }
  
  // Find Copilot PRs related to our PRs
  console.log('\nLooking for Copilot PRs related to our features:\n');
  const relatedTerms = ['undo', 'redo', 'drag', 'reorder', 'error', 'message'];
  
  copilotPRs.forEach(pr => {
    const titleLower = pr.title.toLowerCase();
    const bodyLower = pr.body?.toLowerCase() || '';
    const matches = relatedTerms.filter(term => 
      titleLower.includes(term) || bodyLower.includes(term)
    );
    
    if (matches.length > 0) {
      console.log(`  PR #${pr.number}: ${pr.title}`);
      console.log(`    Matches: ${matches.join(', ')}`);
      console.log(`    Base: ${pr.base.ref}, Head: ${pr.head.ref}`);
    }
  });
}

checkCopilotFeedback().catch(console.error);

