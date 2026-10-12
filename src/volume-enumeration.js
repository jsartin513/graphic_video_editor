/**
 * Cross-platform volume / drive enumeration for SD card detection and file browser.
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

async function listMacVolumes(volumesPath = '/Volumes') {
  try {
    if (!fsSync.existsSync(volumesPath)) {
      return [];
    }
    const names = await fs.readdir(volumesPath);
    return names
      .filter((name) => name && !name.startsWith('.'))
      .map((name) => ({ name, path: path.join(volumesPath, name) }));
  } catch (error) {
    return [];
  }
}

async function listWindowsRemovableVolumes() {
  if (process.platform !== 'win32') {
    return [];
  }

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        "Get-Volume | Where-Object { $_.DriveType -eq 'Removable' -and $_.DriveLetter } | ForEach-Object { $_.DriveLetter + ':' }"
      ],
      { encoding: 'utf8', timeout: 15000, windowsHide: true }
    );
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^[A-Z]:$/i.test(line))
      .map((drive) => ({
        name: drive.replace(':', ''),
        path: `${drive}\\`
      }));
  } catch (error) {
    const volumes = [];
    for (let code = 65; code <= 90; code += 1) {
      const letter = String.fromCharCode(code);
      const root = `${letter}:\\`;
      try {
        fsSync.accessSync(root, fsSync.constants.F_OK);
        volumes.push({ name: letter, path: root });
      } catch (e) {
        // not mounted
      }
    }
    return volumes;
  }
}

async function listWindowsDriveLetters() {
  if (process.platform !== 'win32') {
    return [];
  }

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        "Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Root } | ForEach-Object { $_.Root }"
      ],
      { encoding: 'utf8', timeout: 15000, windowsHide: true }
    );
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^[A-Z]:\\$/i.test(line))
      .map((root) => ({
        name: root.replace(/:\\$/, ''),
        path: root
      }));
  } catch (error) {
    const volumes = [];
    for (let code = 65; code <= 90; code += 1) {
      const letter = String.fromCharCode(code);
      const root = `${letter}:\\`;
      try {
        fsSync.accessSync(root, fsSync.constants.F_OK);
        volumes.push({ name: letter, path: root });
      } catch (e) {
        // skip
      }
    }
    return volumes;
  }
}

async function listVolumesForPlatform() {
  if (process.platform === 'win32') {
    return listWindowsDriveLetters();
  }
  return listMacVolumes('/Volumes');
}

async function listRemovableVolumesForPlatform() {
  if (process.platform === 'win32') {
    return listWindowsRemovableVolumes();
  }
  return listMacVolumes('/Volumes');
}

module.exports = {
  listMacVolumes,
  listWindowsRemovableVolumes,
  listWindowsDriveLetters,
  listVolumesForPlatform,
  listRemovableVolumesForPlatform
};
