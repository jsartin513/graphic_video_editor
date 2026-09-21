const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright');

const REPO_ROOT = path.join(__dirname, '..', '..');
/**
 * @param {{ userDataDir?: string }} [options]
 */
async function launchVideoMerger(options = {}) {
  const userDataDir =
    options.userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'video-merger-e2e-'));

  const electronApp = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
    }
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  return { electronApp, window, userDataDir };
}

/**
 * Dismiss ffmpeg prerequisites modal if it appears (dev machines without bundled ffmpeg).
 * @param {import('playwright').Page} window
 */
async function dismissPrerequisitesIfNeeded(window) {
  // Prerequisites check runs ~500ms after launch; dismiss before waiting on the naming wizard.
  const deadline = Date.now() + 5000;
  const modal = window.locator('#prerequisitesModal');
  const continueBtn = window.getByRole('button', { name: /continue anyway/i });

  while (Date.now() < deadline) {
    if (await modal.isVisible().catch(() => false)) {
      await continueBtn.click();
      await modal.waitFor({ state: 'hidden', timeout: 10_000 });
      await window.waitForTimeout(300);
      return;
    }
    await window.waitForTimeout(150);
  }
}

/**
 * @param {import('playwright').Page} window
 */
async function waitForDefaultsSetupModal(window) {
  await window.locator('#defaultsSetupModal').waitFor({ state: 'visible', timeout: 25_000 });
}

/**
 * @param {string} userDataDir
 */
function readPreferencesFile(userDataDir) {
  const prefsPath = path.join(userDataDir, 'preferences.json');
  if (!fs.existsSync(prefsPath)) {
    throw new Error(`Expected preferences at ${prefsPath}`);
  }
  return JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
}

/**
 * Create minimal GoPro-named clips for merge grouping (content is not a valid video; grouping uses filenames).
 * @returns {string} directory containing fixture files
 */
function createGoProFixtureDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-merger-gopro-fixture-'));
  // Three clips (same session); auto-prepare is skipped when exactly two files are selected.
  for (const name of ['GX010534.MP4', 'GX020534.MP4', 'GX030534.MP4']) {
    fs.writeFileSync(path.join(dir, name), Buffer.alloc(64));
  }
  return dir;
}

/**
 * @param {import('playwright').Page} window
 * @param {string} fixtureDir
 */
async function addFixtureVideos(window, fixtureDir) {
  const result = await window.evaluate(async (dir) => {
    if (typeof window.videoMergerAddFiles !== 'function') {
      throw new Error('videoMergerAddFiles is not available');
    }
    return window.videoMergerAddFiles([dir]);
  }, fixtureDir);
  if (!result?.added?.length) {
    throw new Error(`Failed to add fixture videos from ${fixtureDir}`);
  }
}

module.exports = {
  launchVideoMerger,
  dismissPrerequisitesIfNeeded,
  waitForDefaultsSetupModal,
  readPreferencesFile,
  createGoProFixtureDir,
  addFixtureVideos,
  REPO_ROOT
};
