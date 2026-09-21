const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const {
  launchVideoMerger,
  dismissPrerequisitesIfNeeded,
  waitForDefaultsSetupModal,
  readPreferencesFile,
  createGoProFixtureDir,
  addFixtureVideos
} = require('./helpers/app');

test.describe('First-launch defaults setup', () => {
  test('shows naming setup when preferences file does not exist', async () => {
    const { electronApp, window } = await launchVideoMerger();
    try {
      await dismissPrerequisitesIfNeeded(window);
      await waitForDefaultsSetupModal(window);
      await expect(window.getByRole('heading', { name: /set up merged video names/i })).toBeVisible();
      await expect(window.locator('#defaultsSetupPreview')).not.toBeEmpty();
    } finally {
      await electronApp.close();
    }
  });

  test('skip for now writes preferences and does not set lastUsedPattern', async () => {
    const { electronApp, window, userDataDir } = await launchVideoMerger();
    try {
      await dismissPrerequisitesIfNeeded(window);
      await waitForDefaultsSetupModal(window);
      await window.getByRole('button', { name: /skip for now/i }).click();
      await window.locator('#defaultsSetupModal').waitFor({ state: 'hidden' });

      const prefs = readPreferencesFile(userDataDir);
      expect(prefs.defaultsSetupCompleted).toBe(true);
      expect(prefs.lastUsedPattern).toBeNull();
    } finally {
      await electronApp.close();
    }
  });

  test('save defaults persists lastUsedPattern and date format', async () => {
    const { electronApp, window, userDataDir } = await launchVideoMerger();
    try {
      await dismissPrerequisitesIfNeeded(window);
      await waitForDefaultsSetupModal(window);

      await window.locator('#defaultsSetupDateFormatSelect').selectOption('MM-DD-YYYY');
      const templateSelect = window.locator('#defaultsSetupTemplateSelect');
      await templateSelect.selectOption({ index: 1 });

      await window.getByRole('button', { name: /save defaults/i }).click();
      await window.locator('#defaultsSetupModal').waitFor({ state: 'hidden' });

      const prefs = readPreferencesFile(userDataDir);
      expect(prefs.defaultsSetupCompleted).toBe(true);
      expect(prefs.preferredDateFormat).toBe('MM-DD-YYYY');
      expect(prefs.lastUsedPattern).toMatch(/\{date\}/);
      expect(prefs.lastUsedPattern).toMatch(/\{sessionId\}/);
    } finally {
      await electronApp.close();
    }
  });

  test('does not show setup again after preferences file exists', async () => {
    const userDataDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'video-merger-e2e-existing-'));
    fs.writeFileSync(
      path.join(userDataDir, 'preferences.json'),
      JSON.stringify({ defaultsSetupCompleted: true, lastUsedPattern: null }, null, 2)
    );

    const { electronApp, window } = await launchVideoMerger({ userDataDir });
    try {
      await dismissPrerequisitesIfNeeded(window);
      await window.waitForTimeout(2000);
      await expect(window.locator('#defaultsSetupModal')).toBeHidden();
    } finally {
      await electronApp.close();
    }
  });
});

test.describe('Merge preview naming (e2e)', () => {
  test('after skip, merge preview uses generic date pattern instead of PROCESSED####', async () => {
    const fixtureDir = createGoProFixtureDir();
    const { electronApp, window } = await launchVideoMerger();
    try {
      await dismissPrerequisitesIfNeeded(window);
      await waitForDefaultsSetupModal(window);
      await window.getByRole('button', { name: /skip for now/i }).click();
      await window.locator('#defaultsSetupModal').waitFor({ state: 'hidden' });

      await addFixtureVideos(window, fixtureDir);
      await window.locator('#previewScreen').waitFor({ state: 'visible', timeout: 45_000 });

      const filenameInput = window.locator('.filename-input').first();
      await expect(filenameInput).toBeVisible();
      const value = await filenameInput.inputValue();
      expect(value).not.toMatch(/PROCESSED\d{4}/i);
      expect(value).toMatch(/0534/i);
      expect(value).toMatch(/\d{4}-\d{2}-\d{2}/);
    } finally {
      await electronApp.close();
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  test('after saving BDL template, merge preview reflects template pattern', async () => {
    const fixtureDir = createGoProFixtureDir();
    const { electronApp, window } = await launchVideoMerger();
    try {
      await dismissPrerequisitesIfNeeded(window);
      await waitForDefaultsSetupModal(window);

      await templateSelectFirstNamed(window, 'BDL Open Gym');
      await window.getByRole('button', { name: /save defaults/i }).click();
      await window.locator('#defaultsSetupModal').waitFor({ state: 'hidden' });

      await addFixtureVideos(window, fixtureDir);
      await window.locator('#previewScreen').waitFor({ state: 'visible', timeout: 45_000 });

      const value = await window.locator('.filename-input').first().inputValue();
      expect(value).toMatch(/BDL Open Gym/i);
      expect(value).toMatch(/0534/);
      expect(value).not.toMatch(/PROCESSED/i);
    } finally {
      await electronApp.close();
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});

/**
 * @param {import('playwright').Page} window
 * @param {string} label
 */
async function templateSelectFirstNamed(window, label) {
  const options = window.locator('#defaultsSetupTemplateSelect option');
  const count = await options.count();
  for (let i = 0; i < count; i++) {
    const text = await options.nth(i).textContent();
    if (text && text.includes(label)) {
      const value = await options.nth(i).getAttribute('value');
      if (value) {
        await window.locator('#defaultsSetupTemplateSelect').selectOption(value);
        return;
      }
    }
  }
  throw new Error(`Template option not found: ${label}`);
}
