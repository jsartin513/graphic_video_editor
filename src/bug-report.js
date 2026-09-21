const os = require('os');

const GITHUB_OWNER = 'jsartin513';
const GITHUB_REPO = 'graphic_video_editor';
const MAX_URL_LENGTH = 6000;
const MAX_LOG_LINES = 80;
const MAX_BODY_FOR_URL = 4500;

/**
 * Redact home directory and username from text for privacy.
 * @param {string} text
 * @param {string} homeDir
 * @returns {string}
 */
function redactPaths(text, homeDir) {
  if (!text || typeof text !== 'string') return '';
  let result = text;
  if (homeDir && typeof homeDir === 'string' && homeDir.length > 1) {
    const escaped = homeDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), '~');
  }
  const user = os.userInfo().username;
  if (user && user.length > 0) {
    const userEscaped = user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`/Users/${userEscaped}`, 'g'), '/Users/[user]');
    result = result.replace(new RegExp(userEscaped, 'g'), '[user]');
  }
  return result;
}

/**
 * Build issue title from user input and error context.
 * @param {object} options
 * @returns {string}
 */
function buildIssueTitle(options = {}) {
  const { userDescription, errorInfo } = options;
  const desc = (userDescription || '').trim().split('\n')[0].slice(0, 80);
  if (desc) return `Bug: ${desc}`;
  if (errorInfo?.userMessage) {
    return `Bug: ${String(errorInfo.userMessage).slice(0, 80)}`;
  }
  if (errorInfo?.code) {
    return `Bug: ${errorInfo.code}`;
  }
  return 'Bug report from Video Merger';
}

/**
 * Build markdown issue body.
 * @param {object} systemInfo
 * @param {object} options
 * @returns {string}
 */
function buildIssueBody(systemInfo, options = {}) {
  const { userDescription, errorInfo, logTail } = options;
  const homeDir = os.homedir();
  const sections = [];

  sections.push('## Description');
  sections.push(
    userDescription && userDescription.trim()
      ? redactPaths(userDescription.trim(), homeDir)
      : '_No description provided._'
  );
  sections.push('');
  sections.push('## Steps to reproduce');
  sections.push('_Please add steps if not included above._');
  sections.push('');
  sections.push('## Expected vs actual');
  sections.push('_Please describe expected and actual behavior._');
  sections.push('');

  if (errorInfo && (errorInfo.userMessage || errorInfo.code || errorInfo.technicalDetails)) {
    sections.push('## Error details');
    if (errorInfo.userMessage) {
      sections.push(`**Message:** ${redactPaths(String(errorInfo.userMessage), homeDir)}`);
    }
    if (errorInfo.code) {
      sections.push(`**Code:** ${errorInfo.code}`);
    }
    if (errorInfo.suggestion) {
      sections.push(`**Suggestion:** ${redactPaths(String(errorInfo.suggestion), homeDir)}`);
    }
    if (errorInfo.technicalDetails) {
      sections.push('');
      sections.push('```');
      sections.push(redactPaths(String(errorInfo.technicalDetails), homeDir));
      sections.push('```');
    }
    sections.push('');
  }

  sections.push('## System information');
  sections.push(`- **App version:** ${systemInfo.version}`);
  sections.push(`- **Packaged build:** ${systemInfo.isPackaged ? 'yes' : 'no (dev)'}`);
  sections.push(`- **macOS:** ${systemInfo.osVersion}`);
  sections.push(`- **Arch:** ${systemInfo.arch}`);
  sections.push(`- **Electron:** ${systemInfo.electronVersion}`);
  sections.push(`- **Debug logging:** ${systemInfo.debugMode ? 'on' : 'off'}`);
  sections.push('');

  if (logTail && logTail.trim()) {
    sections.push('## Recent logs');
    sections.push('```');
    sections.push(redactPaths(logTail.trim(), homeDir));
    sections.push('```');
    sections.push('');
  }

  sections.push('---');
  sections.push('_Submitted via Video Merger → Report a bug_');

  return sections.join('\n');
}

/**
 * Truncate body for URL query param while keeping full body separate.
 * @param {string} body
 * @returns {string}
 */
function truncateBodyForUrl(body) {
  if (!body || body.length <= MAX_BODY_FOR_URL) return body;
  return `${body.slice(0, MAX_BODY_FOR_URL)}\n\n… _(truncated in URL; full report copied to clipboard)_`;
}

/**
 * Build GitHub new-issue URL.
 * @param {string} title
 * @param {string} body
 * @returns {string}
 */
function buildGitHubIssueUrl(title, body) {
  const base = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues/new`;
  const params = new URLSearchParams();
  params.set('labels', 'bug');
  params.set('title', title);
  const urlBody = truncateBodyForUrl(body);
  params.set('body', urlBody);
  let url = `${base}?${params.toString()}`;
  if (url.length > MAX_URL_LENGTH) {
    const shorterBody = urlBody.slice(0, Math.max(500, MAX_BODY_FOR_URL - (url.length - MAX_URL_LENGTH) - 50));
    params.set('body', `${shorterBody}\n\n… _(truncated)_`);
    url = `${base}?${params.toString()}`;
  }
  return url;
}

/**
 * Collect system info for bug reports.
 * @param {object} deps - { app, process }
 * @param {boolean} debugMode
 * @returns {object}
 */
function collectSystemInfo(deps, debugMode) {
  const { app, process: proc } = deps;
  let osVersion = os.release();
  if (typeof os.version === 'function') {
    try {
      osVersion = os.version();
    } catch {
      // use release()
    }
  }
  return {
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    arch: proc.arch,
    osVersion,
    electronVersion: proc.versions.electron || 'unknown',
    debugMode: Boolean(debugMode)
  };
}

/**
 * Prepare full bug report payload.
 * @param {object} deps - { app, process, logger }
 * @param {object} input - { userDescription, errorInfo }
 * @returns {Promise<{ title: string, body: string, url: string }>}
 */
async function prepareBugReport(deps, input = {}) {
  const { logger } = deps;
  const debugMode = logger.getDebugMode();
  const systemInfo = collectSystemInfo(deps, debugMode);

  let logTail = '';
  try {
    logTail = await logger.readLogs(null, MAX_LOG_LINES);
  } catch {
    logTail = '';
  }

  const title = buildIssueTitle(input);
  const body = buildIssueBody(systemInfo, {
    userDescription: input.userDescription,
    errorInfo: input.errorInfo,
    logTail
  });
  const url = buildGitHubIssueUrl(title, body);

  return { title, body, url };
}

module.exports = {
  GITHUB_OWNER,
  GITHUB_REPO,
  redactPaths,
  buildIssueTitle,
  buildIssueBody,
  buildGitHubIssueUrl,
  collectSystemInfo,
  prepareBugReport,
  truncateBodyForUrl
};
