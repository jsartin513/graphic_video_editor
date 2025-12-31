#!/usr/bin/env node
/**
 * GitHub API Client
 * Provides functions for interacting with GitHub API
 */

const { Octokit } = require('@octokit/rest');

// Load environment variables
require('dotenv').config();

// Get GitHub token from environment
function getGitHubToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token || token === 'your_github_token_here') {
    throw new Error(
      'GITHUB_TOKEN not set. Please set it in .env file or environment variable.\n' +
      'Get a token from: https://github.com/settings/tokens\n' +
      'Required scopes: repo, workflow'
    );
  }
  return token;
}

// Get repository info from environment or git config
function getRepoInfo() {
  // Try environment variable first
  if (process.env.GITHUB_REPO) {
    const repoEnv = process.env.GITHUB_REPO;
    const parts = repoEnv.split('/');
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      return { owner: parts[0].trim(), repo: parts[1].trim() };
    }
    // If GITHUB_REPO is set but malformed, fall through to git remote detection
  }

  // Try to get from git remote
  try {
    const { execSync } = require('child_process');
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
    
    // Handle both HTTPS and SSH URLs
    let match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch (e) {
    // Git not available or no remote
  }

  throw new Error(
    'Could not determine repository. Set GITHUB_REPO environment variable (e.g., owner/repo)'
  );
}

// Initialize Octokit client
function getOctokit() {
  const token = getGitHubToken();
  return new Octokit({
    auth: token,
    baseUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
  });
}

// Create a pull request
async function createPullRequest(title, body, headBranch, baseBranch = 'main') {
  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();

  try {
    const response = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body,
      head: headBranch,
      base: baseBranch,
    });

    return {
      success: true,
      number: response.data.number,
      url: response.data.html_url,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response?.data,
    };
  }
}

// Get pull requests
async function getPullRequests(options = {}) {
  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();

  const params = {
    owner,
    repo,
    state: options.state || 'open',
    per_page: options.per_page || 30,
  };

  if (options.labels) {
    params.labels = Array.isArray(options.labels) ? options.labels.join(',') : options.labels;
  }

  try {
    const response = await octokit.rest.pulls.list(params);
    return {
      success: true,
      pulls: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response?.data,
    };
  }
}

// Get issues
async function getIssues(options = {}) {
  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();

  const params = {
    owner,
    repo,
    state: options.state || 'open',
    per_page: options.per_page || 30,
  };

  if (options.labels) {
    params.labels = Array.isArray(options.labels) ? options.labels.join(',') : options.labels;
  }

  if (options.assignee) {
    params.assignee = options.assignee;
  }

  try {
    const response = await octokit.rest.issues.listForRepo(params);
    return {
      success: true,
      issues: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response?.data,
    };
  }
}

// Assign issue
async function assignIssue(issueNumber, assignees) {
  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();

  const assigneesArray = Array.isArray(assignees) ? assignees : [assignees];

  try {
    const response = await octokit.rest.issues.addAssignees({
      owner,
      repo,
      issue_number: issueNumber,
      assignees: assigneesArray,
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response?.data,
    };
  }
}

// Comment on issue/PR
async function commentOnIssue(issueNumber, body) {
  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();

  try {
    const response = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response?.data,
    };
  }
}

// Read file content from repository
async function readFileContent(filePath, branch = 'main') {
  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();

  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    });

    // Decode base64 content
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');

    return {
      success: true,
      content,
      encoding: response.data.encoding,
      size: response.data.size,
      sha: response.data.sha,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response?.data,
    };
  }
}

// Get repository information
async function getRepositoryInfo() {
  const octokit = getOctokit();
  const repoInfo = getRepoInfo();

  try {
    const response = await octokit.rest.repos.get({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response?.data,
    };
  }
}

// Export functions
module.exports = {
  createPullRequest,
  getPullRequests,
  getIssues,
  assignIssue,
  commentOnIssue,
  readFileContent,
  getRepositoryInfo,
  getOctokit,
  getGitHubToken,
  getRepoInfo, // Internal helper, exported for testing
};

