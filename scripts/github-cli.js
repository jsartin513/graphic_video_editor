#!/usr/bin/env node
/**
 * GitHub CLI - Command-line interface for GitHub operations
 */

const {
  createPullRequest,
  getPullRequests,
  getIssues,
  assignIssue,
  commentOnIssue,
  readFileContent,
  getRepositoryInfo,
} = require('./github-api');

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

async function main() {
  try {
    switch (command) {
      case 'pr':
      case 'pull-request':
        await handlePullRequest(args.slice(1));
        break;

      case 'issue':
        await handleIssue(args.slice(1));
        break;

      case 'read-file':
        await handleReadFile(args.slice(1));
        break;

      case 'repo':
        await handleRepo(args.slice(1));
        break;

      default:
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

async function handlePullRequest(subArgs) {
  const subCommand = subArgs[0];

  switch (subCommand) {
    case 'create':
      const titleIndex = subArgs.indexOf('--title');
      const bodyIndex = subArgs.indexOf('--body');
      const headIndex = subArgs.indexOf('--head');
      const baseIndex = subArgs.indexOf('--base');

      if (titleIndex === -1 || headIndex === -1) {
        console.error('Error: --title and --head are required');
        console.error('Usage: github-cli.js pr create --title "Title" --body "Body" --head branch --base main');
        process.exit(1);
      }

      if (titleIndex + 1 >= subArgs.length || !subArgs[titleIndex + 1]) {
        console.error('Error: --title requires a value');
        console.error('Usage: github-cli.js pr create --title "Title" --body "Body" --head branch --base main');
        process.exit(1);
      }

      if (headIndex + 1 >= subArgs.length || !subArgs[headIndex + 1]) {
        console.error('Error: --head requires a value');
        console.error('Usage: github-cli.js pr create --title "Title" --body "Body" --head branch --base main');
        process.exit(1);
      }

      const title = subArgs[titleIndex + 1];
      const body = bodyIndex !== -1 && bodyIndex + 1 < subArgs.length ? subArgs[bodyIndex + 1] : '';
      const head = subArgs[headIndex + 1];
      const base = baseIndex !== -1 && baseIndex + 1 < subArgs.length ? subArgs[baseIndex + 1] : 'main';

      const result = await createPullRequest(title, body, head, base);
      if (result.success) {
        console.log(`✅ Pull request created: ${result.url}`);
        console.log(`   PR #${result.number}: ${title}`);
      } else {
        console.error('❌ Failed to create pull request:', result.error);
        if (result.details) {
          console.error('Details:', JSON.stringify(result.details, null, 2));
        }
        process.exit(1);
      }
      break;

    case 'list':
      const stateIndex = subArgs.indexOf('--state');
      const labelsIndex = subArgs.indexOf('--labels');

      const options = {};
      if (stateIndex !== -1) {
        if (stateIndex + 1 >= subArgs.length) {
          console.error('Error: --state requires a value');
          console.error('Usage: github-cli.js pr list [--state open|closed|all] [--labels label1,label2]');
          process.exit(1);
        }
        options.state = subArgs[stateIndex + 1];
      }
      if (labelsIndex !== -1) {
        if (labelsIndex + 1 >= subArgs.length) {
          console.error('Error: --labels requires a value');
          console.error('Usage: github-cli.js pr list [--state open|closed|all] [--labels label1,label2]');
          process.exit(1);
        }
        options.labels = subArgs[labelsIndex + 1].split(',');
      }

      const prs = await getPullRequests(options);
      if (prs.success) {
        console.log(`\n📋 Pull Requests (${prs.pulls.length}):\n`);
        prs.pulls.forEach(pr => {
          console.log(`  #${pr.number}: ${pr.title}`);
          console.log(`    ${pr.html_url}`);
          console.log(`    State: ${pr.state} | Head: ${pr.head.ref} → Base: ${pr.base.ref}`);
          console.log('');
        });
      } else {
        console.error('❌ Failed to get pull requests:', prs.error);
        process.exit(1);
      }
      break;

    default:
      console.error('Unknown PR command. Use: create, list');
      process.exit(1);
  }
}

async function handleIssue(subArgs) {
  const subCommand = subArgs[0];

  switch (subCommand) {
    case 'list':
      const stateIndex = subArgs.indexOf('--state');
      const labelsIndex = subArgs.indexOf('--labels');
      const assigneeIndex = subArgs.indexOf('--assignee');

      const options = {};
      if (stateIndex !== -1) {
        if (stateIndex + 1 >= subArgs.length) {
          console.error('Error: --state requires a value');
          console.error('Usage: github-cli.js issue list [--state open|closed|all] [--labels label1,label2] [--assignee username]');
          process.exit(1);
        }
        options.state = subArgs[stateIndex + 1];
      }
      if (labelsIndex !== -1) {
        if (labelsIndex + 1 >= subArgs.length || typeof subArgs[labelsIndex + 1] !== 'string') {
          console.error('Error: --labels requires a value');
          console.error('Usage: github-cli.js issue list [--state open|closed|all] [--labels label1,label2] [--assignee username]');
          process.exit(1);
        }
        options.labels = subArgs[labelsIndex + 1].split(',');
      }
      if (assigneeIndex !== -1) {
        if (assigneeIndex + 1 >= subArgs.length) {
          console.error('Error: --assignee requires a value');
          console.error('Usage: github-cli.js issue list [--state open|closed|all] [--labels label1,label2] [--assignee username]');
          process.exit(1);
        }
        options.assignee = subArgs[assigneeIndex + 1];
      }

      const issues = await getIssues(options);
      if (issues.success) {
        console.log(`\n📋 Issues (${issues.issues.length}):\n`);
        issues.issues.forEach(issue => {
          console.log(`  #${issue.number}: ${issue.title}`);
          console.log(`    ${issue.html_url}`);
          console.log(`    State: ${issue.state}`);
          if (issue.assignees && issue.assignees.length > 0) {
            console.log(`    Assignees: ${issue.assignees.map(a => a.login).join(', ')}`);
          }
          if (issue.labels && issue.labels.length > 0) {
            console.log(`    Labels: ${issue.labels.map(l => l.name).join(', ')}`);
          }
          console.log('');
        });
      } else {
        console.error('❌ Failed to get issues:', issues.error);
        process.exit(1);
      }
      break;

    case 'assign':
      const issueNum = parseInt(subArgs[1]);
      const assignees = subArgs.slice(2);

      if (isNaN(issueNum) || issueNum <= 0 || assignees.length === 0) {
        console.error('Usage: github-cli.js issue assign <number> <assignee1> [assignee2...]');
        process.exit(1);
      }

      const assignResult = await assignIssue(issueNum, assignees);
      if (assignResult.success) {
        console.log(`✅ Assigned issue #${issueNum} to: ${assignees.join(', ')}`);
      } else {
        console.error('❌ Failed to assign issue:', assignResult.error);
        process.exit(1);
      }
      break;

    case 'comment':
      const commentIssueNum = parseInt(subArgs[1]);
      const commentBody = subArgs.slice(2).join(' ');

      if (isNaN(commentIssueNum) || commentIssueNum <= 0 || !commentBody) {
        console.error('Usage: github-cli.js issue comment <number> "comment text"');
        process.exit(1);
      }

      const commentResult = await commentOnIssue(commentIssueNum, commentBody);
      if (commentResult.success) {
        console.log(`✅ Commented on issue #${commentIssueNum}`);
      } else {
        console.error('❌ Failed to comment:', commentResult.error);
        process.exit(1);
      }
      break;

    default:
      console.error('Unknown issue command. Use: list, assign, comment');
      process.exit(1);
  }
}

async function handleReadFile(subArgs) {
  const filePath = subArgs[0];
  const branchIndex = subArgs.indexOf('--branch');
  
  let branch = 'main';
  if (branchIndex !== -1 && branchIndex + 1 < subArgs.length && subArgs[branchIndex + 1]) {
    branch = subArgs[branchIndex + 1];
  }

  if (!filePath) {
    console.error('Usage: github-cli.js read-file <path> [--branch branch]');
    process.exit(1);
  }

  const result = await readFileContent(filePath, branch);
  if (result.success) {
    console.log(result.content);
  } else {
    console.error('❌ Failed to read file:', result.error);
    process.exit(1);
  }
}

async function handleRepo(subArgs) {
  const subCommand = subArgs[0] || 'info';

  if (subCommand === 'info') {
    const result = await getRepositoryInfo();
    if (result.success) {
      console.log('\n📦 Repository Information:\n');
      console.log(`  Name: ${result.data.name}`);
      console.log(`  Full Name: ${result.data.full_name}`);
      console.log(`  Description: ${result.data.description || '(none)'}`);
      console.log(`  URL: ${result.data.html_url}`);
      console.log(`  Default Branch: ${result.data.default_branch}`);
      console.log(`  Stars: ${result.data.stargazers_count}`);
      console.log(`  Forks: ${result.data.forks_count}`);
      console.log(`  Open Issues: ${result.data.open_issues_count}`);
      console.log('');
    } else {
      console.error('❌ Failed to get repository info:', result.error);
      process.exit(1);
    }
  } else {
    console.error('Unknown repo command. Use: info');
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
GitHub CLI - Command-line interface for GitHub operations

Usage:
  node scripts/github-cli.js <command> [options]

Commands:
  pr create              Create a pull request
    --title "Title"      PR title (required)
    --body "Body"        PR body/description
    --head branch        Source branch (required)
    --base branch        Target branch (default: main)

  pr list                List pull requests
    --state open|closed|all  Filter by state (default: open)
    --labels "label1,label2" Filter by labels

  issue list             List issues
    --state open|closed|all  Filter by state (default: open)
    --labels "label1,label2" Filter by labels
    --assignee username      Filter by assignee

  issue assign <number> <assignee1> [assignee2...]
                        Assign issue to user(s)

  issue comment <number> "comment text"
                        Add comment to issue/PR

  read-file <path>      Read file from repository
    --branch branch     Branch name (default: main)

  repo info             Show repository information

Examples:
  node scripts/github-cli.js pr create --title "Fix bug" --head feature-branch --base main
  node scripts/github-cli.js issue list --state open
  node scripts/github-cli.js issue assign 123 jsartin513
  node scripts/github-cli.js read-file README.md --branch main
  node scripts/github-cli.js repo info

Environment Variables:
  GITHUB_TOKEN          GitHub Personal Access Token (required)
  GITHUB_REPO           Repository in format owner/repo (optional, auto-detected from git)
  GITHUB_API_URL        GitHub API URL (optional, default: https://api.github.com)
`);
}

if (require.main === module) {
  main();
}

