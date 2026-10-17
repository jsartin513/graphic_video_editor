const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const {
  launchVideoMerger,
  readPreferencesFile,
  createRemovableVolumeFixture,
  createLocalClipFixture,
  skipDefaultsSetup,
  addVideosAndOpenMergePreview,
  clickMerge,
  waitForMergeComplete,
  findMp4Files
} = require('./helpers/app');

test.describe('SD card → Movies merge output (e2e)', () => {
  test('removable sources show Movies modal with date and volume default', async () => {
    const { moviesDir, volRoot, clipDir } = createRemovableVolumeFixture();
    const { electronApp, window } = await launchVideoMerger({
      e2e: {
        enabled: true,
        moviesDir,
        removablePrefix: volRoot,
        volumeLabel: 'E2E_GOPRO'
      }
    });
    try {
      await skipDefaultsSetup(window);
      await addVideosAndOpenMergePreview(window, clipDir);
      await clickMerge(window);

      const modal = window.locator('#moviesOutputModal');
      await expect(modal).toBeVisible();
      const input = window.locator('#moviesOutputFolderNameInput');
      const defaultName = await input.inputValue();
      expect(defaultName).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(defaultName).toContain('E2E_GOPRO');
      await window.locator('#moviesOutputCancelBtn').click();
      await expect(modal).toBeHidden();
    } finally {
      await electronApp.close();
      fs.rmSync(moviesDir, { recursive: true, force: true });
      fs.rmSync(volRoot, { recursive: true, force: true });
    }
  });

  test('Create folder & merge writes output under the Movies test path', async () => {
    const { moviesDir, volRoot, clipDir } = createRemovableVolumeFixture();
    const { electronApp, window } = await launchVideoMerger({
      e2e: {
        enabled: true,
        moviesDir,
        removablePrefix: volRoot,
        volumeLabel: 'E2E_GOPRO'
      }
    });
    try {
      await skipDefaultsSetup(window);
      await addVideosAndOpenMergePreview(window, clipDir);
      await clickMerge(window);
      await window.locator('#moviesOutputModal').waitFor({ state: 'visible' });

      const folderName = await window.locator('#moviesOutputFolderNameInput').inputValue();
      await window.locator('#moviesOutputConfirmBtn').click();
      await waitForMergeComplete(window);

      const outputDir = path.join(moviesDir, folderName);
      expect(fs.existsSync(outputDir)).toBe(true);
      const outputs = findMp4Files(outputDir);
      expect(outputs.length).toBeGreaterThan(0);
    } finally {
      await electronApp.close();
      fs.rmSync(moviesDir, { recursive: true, force: true });
      fs.rmSync(volRoot, { recursive: true, force: true });
    }
  });

  test('duplicate folder name gets a -2 suffix', async () => {
    const { moviesDir, volRoot, clipDir } = createRemovableVolumeFixture();
    const existingName = '2026-10-17 E2E_GOPRO';
    fs.mkdirSync(path.join(moviesDir, existingName), { recursive: true });

    const { electronApp, window } = await launchVideoMerger({
      e2e: {
        enabled: true,
        moviesDir,
        removablePrefix: volRoot,
        volumeLabel: 'E2E_GOPRO'
      }
    });
    try {
      await skipDefaultsSetup(window);
      await addVideosAndOpenMergePreview(window, clipDir);
      await clickMerge(window);
      await window.locator('#moviesOutputModal').waitFor({ state: 'visible' });
      await window.locator('#moviesOutputFolderNameInput').fill(existingName);
      await window.locator('#moviesOutputConfirmBtn').click();
      await waitForMergeComplete(window);

      expect(fs.existsSync(path.join(moviesDir, `${existingName}-2`))).toBe(true);
      expect(findMp4Files(path.join(moviesDir, `${existingName}-2`)).length).toBeGreaterThan(0);
    } finally {
      await electronApp.close();
      fs.rmSync(moviesDir, { recursive: true, force: true });
      fs.rmSync(volRoot, { recursive: true, force: true });
    }
  });

  test('Cancel on Movies modal stops the merge', async () => {
    const { moviesDir, volRoot, clipDir } = createRemovableVolumeFixture();
    const { electronApp, window } = await launchVideoMerger({
      e2e: {
        enabled: true,
        moviesDir,
        removablePrefix: volRoot,
        volumeLabel: 'E2E_GOPRO'
      }
    });
    try {
      await skipDefaultsSetup(window);
      await addVideosAndOpenMergePreview(window, clipDir);
      await clickMerge(window);
      await window.locator('#moviesOutputModal').waitFor({ state: 'visible' });
      await window.locator('#moviesOutputCancelBtn').click();

      await expect(window.locator('#moviesOutputModal')).toBeHidden();
      await expect(window.locator('#previewScreen')).toBeVisible();
      await expect(window.locator('#progressScreen')).toBeHidden();
      expect(findMp4Files(moviesDir).length).toBe(0);
    } finally {
      await electronApp.close();
      fs.rmSync(moviesDir, { recursive: true, force: true });
      fs.rmSync(volRoot, { recursive: true, force: true });
    }
  });

  test('Choose another folder uses picker path and skips persisting Movies folder', async () => {
    const { moviesDir, volRoot, clipDir } = createRemovableVolumeFixture();
    const altDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'video-merger-e2e-alt-out-'));

    const { electronApp, window, userDataDir } = await launchVideoMerger({
      e2e: {
        enabled: true,
        moviesDir,
        removablePrefix: volRoot,
        volumeLabel: 'E2E_GOPRO',
        outputPickerDir: altDir
      }
    });
    try {
      await skipDefaultsSetup(window);
      await addVideosAndOpenMergePreview(window, clipDir);
      await clickMerge(window);
      await window.locator('#moviesOutputModal').waitFor({ state: 'visible' });
      await window.locator('#moviesOutputChooseOtherBtn').click();
      await expect(window.locator('#moviesOutputModal')).toBeHidden();
      await waitForMergeComplete(window);

      expect(findMp4Files(altDir).length).toBeGreaterThan(0);
      expect(findMp4Files(moviesDir).length).toBe(0);
      const prefs = readPreferencesFile(userDataDir);
      expect(prefs.lastOutputDestination).toBe(altDir);
    } finally {
      await electronApp.close();
      fs.rmSync(moviesDir, { recursive: true, force: true });
      fs.rmSync(volRoot, { recursive: true, force: true });
      fs.rmSync(altDir, { recursive: true, force: true });
    }
  });

  test('local sources keep merged_videos/ and do not show Movies modal', async () => {
    const { dir } = createLocalClipFixture();
    const { electronApp, window } = await launchVideoMerger();
    try {
      await skipDefaultsSetup(window);
      await addVideosAndOpenMergePreview(window, dir);
      await clickMerge(window);

      await expect(window.locator('#moviesOutputModal')).toBeHidden({ timeout: 4000 });
      await waitForMergeComplete(window);

      const mergedDir = path.join(dir, 'merged_videos');
      expect(fs.existsSync(mergedDir)).toBe(true);
      expect(findMp4Files(mergedDir).length).toBeGreaterThan(0);
    } finally {
      await electronApp.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('after a Movies merge, the next merge prompts again and is not remembered', async () => {
    const { moviesDir, volRoot, clipDir } = createRemovableVolumeFixture();
    const { electronApp, window, userDataDir } = await launchVideoMerger({
      e2e: {
        enabled: true,
        moviesDir,
        removablePrefix: volRoot,
        volumeLabel: 'E2E_GOPRO'
      }
    });
    try {
      await skipDefaultsSetup(window);
      await addVideosAndOpenMergePreview(window, clipDir);
      await clickMerge(window);
      await window.locator('#moviesOutputModal').waitFor({ state: 'visible' });
      await window.locator('#moviesOutputConfirmBtn').click();
      await waitForMergeComplete(window);

      let prefs = readPreferencesFile(userDataDir);
      expect(prefs.lastOutputDestination).toBeNull();

      await window.getByRole('button', { name: /merge more videos/i }).click();
      await addVideosAndOpenMergePreview(window, clipDir);
      await clickMerge(window);
      await expect(window.locator('#moviesOutputModal')).toBeVisible();
      await window.locator('#moviesOutputCancelBtn').click();

      prefs = readPreferencesFile(userDataDir);
      expect(prefs.lastOutputDestination).toBeNull();
    } finally {
      await electronApp.close();
      fs.rmSync(moviesDir, { recursive: true, force: true });
      fs.rmSync(volRoot, { recursive: true, force: true });
    }
  });
});
