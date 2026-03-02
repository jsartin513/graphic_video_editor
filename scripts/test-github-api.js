#!/usr/bin/env node
/**
 * Test script for GitHub API integration
 */

const {
  getRepositoryInfo,
  getPullRequests,
  getIssues,
  getGitHubToken,
  getRepoInfo,
} = require('./github-api');

async function runTests() {
  console.log('🧪 Testing GitHub API Integration\n');
  console.log('='.repeat(50));
  
  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Token validation
  console.log('\n1. Testing token validation...');
  try {
    const token = getGitHubToken();
    if (token && token !== 'your_github_token_here') {
      console.log('   ✅ Token found');
      testsPassed++;
    } else {
      throw new Error('Token not set or invalid');
    }
  } catch (error) {
    console.log(`   ❌ ${error.message}`);
    testsFailed++;
  }

  // Test 2: Repository detection
  console.log('\n2. Testing repository detection...');
  try {
    const repoInfo = getRepoInfo();
    console.log(`   ✅ Repository: ${repoInfo.owner}/${repoInfo.repo}`);
    testsPassed++;
  } catch (error) {
    console.log(`   ❌ ${error.message}`);
    testsFailed++;
  }

  // Test 3: Get repository info
  console.log('\n3. Testing getRepositoryInfo()...');
  try {
    const result = await getRepositoryInfo();
    if (result.success) {
      console.log(`   ✅ Repository: ${result.data.full_name}`);
      console.log(`   ✅ Description: ${result.data.description || '(none)'}`);
      console.log(`   ✅ Default branch: ${result.data.default_branch}`);
      testsPassed++;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.log(`   ❌ ${error.message}`);
    testsFailed++;
  }

  // Test 4: List pull requests (non-destructive)
  console.log('\n4. Testing getPullRequests()...');
  try {
    const result = await getPullRequests({ state: 'open', per_page: 5 });
    if (result.success) {
      console.log(`   ✅ Found ${result.pulls.length} open pull requests`);
      if (result.pulls.length > 0) {
        console.log(`   ✅ Sample PR: #${result.pulls[0].number} - ${result.pulls[0].title}`);
      }
      testsPassed++;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.log(`   ❌ ${error.message}`);
    testsFailed++;
  }

  // Test 5: List issues (non-destructive)
  console.log('\n5. Testing getIssues()...');
  try {
    const result = await getIssues({ state: 'open', per_page: 5 });
    if (result.success) {
      console.log(`   ✅ Found ${result.issues.length} open issues`);
      if (result.issues.length > 0) {
        console.log(`   ✅ Sample issue: #${result.issues[0].number} - ${result.issues[0].title}`);
      }
      testsPassed++;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.log(`   ❌ ${error.message}`);
    testsFailed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Test Summary:');
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed! GitHub API integration is working.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check your configuration.');
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


