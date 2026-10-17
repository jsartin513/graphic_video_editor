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

  const env = {
    ...process.env,
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
  };
  const e2e = options.e2e || {};
  if (e2e.enabled) {
    env.VIDEO_MERGER_E2E = '1';
    if (e2e.moviesDir) env.VIDEO_MERGER_E2E_MOVIES_DIR = e2e.moviesDir;
    if (e2e.removablePrefix) env.VIDEO_MERGER_E2E_REMOVABLE_PREFIX = e2e.removablePrefix;
    if (e2e.volumeLabel) env.VIDEO_MERGER_E2E_VOLUME_LABEL = e2e.volumeLabel;
    if (e2e.outputPickerDir) env.VIDEO_MERGER_E2E_OUTPUT_PICKER_DIR = e2e.outputPickerDir;
  }

  const electronApp = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: REPO_ROOT,
    env
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

const TEST_VIDEO_NAMES = ['GX010001.MP4', 'GX020001.MP4', 'GX030001.MP4'];

function copyBundledTestVideosTo(targetDir) {
  const srcDir = path.join(REPO_ROOT, 'test-videos');
  fs.mkdirSync(targetDir, { recursive: true });
  for (const name of TEST_VIDEO_NAMES) {
    fs.copyFileSync(path.join(srcDir, name), path.join(targetDir, name));
  }
}

function createRemovableVolumeFixture() {
  const moviesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-merger-e2e-movies-'));
  const volRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'video-merger-e2e-vol-'));
  const clipDir = path.join(volRoot, 'DCIM', '100GOPRO');
  fs.mkdirSync(clipDir, { recursive: true });
  copyBundledTestVideosTo(clipDir);
  return { moviesDir, volRoot, clipDir };
}

function createLocalClipFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-merger-e2e-local-'));
  copyBundledTestVideosTo(dir);
  return { dir };
}

/**
 * @param {import('playwright').Page} window
 */
async function skipDefaultsSetup(window) {
  await dismissPrerequisitesIfNeeded(window);
  await waitForDefaultsSetupModal(window);
  await window.getByRole('button', { name: /skip for now/i }).click();
  await window.locator('#defaultsSetupModal').waitFor({ state: 'hidden' });
}

/**
 * @param {import('playwright').Page} window
 */
async function waitForMergePreview(window) {
  await window.locator('#previewScreen').waitFor({ state: 'visible', timeout: 45_000 });
}

/**
 * @param {import('playwright').Page} window
 */
async function clickMerge(window) {
  const mergeBtn = window.locator('#mergeBtn');
  await mergeBtn.click();
}

/**
 * @param {import('playwright').Page} window
 */
async function waitForMergeComplete(window, timeoutMs = 120_000) {
  await window.locator('#progressScreen').waitFor({ state: 'visible', timeout: 15_000 });
  await window.locator('.completion-summary').waitFor({ state: 'visible', timeout: timeoutMs });
}

/**
 * @param {string} root
 * @returns {string[]}
 */
function findMp4Files(root) {
  if (!fs.existsSync(root)) return [];
  /** @type {string[]} */
  const results = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMp4Files(full));
    } else if (/\.mp4$/i.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * @param {import('playwright').Page} window
 * @param {string} fixtureDir
 */
async function addVideosAndOpenMergePreview(window, fixtureDir) {
  await addFixtureVideos(window, fixtureDir);
  await waitForMergePreview(window);
}

module.exports = {
  launchVideoMerger,
  dismissPrerequisitesIfNeeded,
  waitForDefaultsSetupModal,
  readPreferencesFile,
  createGoProFixtureDir,
  addFixtureVideos,
  copyBundledTestVideosTo,
  createRemovableVolumeFixture,
  createLocalClipFixture,
  skipDefaultsSetup,
  waitForMergePreview,
  clickMerge,
  waitForMergeComplete,
  findMp4Files,
  addVideosAndOpenMergePreview,
  REPO_ROOT
};
