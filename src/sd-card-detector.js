/**
 * SD Card Detection Module
 * Monitors for GoPro SD card mounts and detects GoPro directory structure
 */

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');
const { listRemovableVolumesForPlatform, listMacVolumes } = require('./volume-enumeration');

class SDCardDetector extends EventEmitter {
  constructor(volumesPath = '/Volumes') {
    super();
    this.volumesPath = volumesPath;
    this.knownVolumes = new Set();
    this.knownGoProVolumes = new Set();
    this.checkInterval = null;
    this.isScanning = false;
    this.excludedVolumes = new Set(['Macintosh HD', 'Preboot', 'Recovery', 'VM', 'Update']);
  }

  start() {
    this.scanVolumes();

    this.checkInterval = setInterval(() => {
      if (!this.isScanning) {
        this.scanVolumes();
      }
    }, 2000);

    console.log('[SDCardDetector] Started monitoring for SD cards');
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('[SDCardDetector] Stopped monitoring');
  }

  async listVolumeEntries() {
    if (process.platform === 'win32') {
      return listRemovableVolumesForPlatform();
    }
    return listMacVolumes(this.volumesPath);
  }

  async scanVolumes() {
    if (this.isScanning) {
      return;
    }
    this.isScanning = true;
    try {
      const volumeEntries = await this.listVolumeEntries();
      const currentVolumes = new Set(volumeEntries.map((entry) => entry.name));

      for (const { name, path: volumePath } of volumeEntries) {
        if (!this.knownVolumes.has(name) && !this.excludedVolumes.has(name)) {
          const isGoPro = await this.isGoProSDCard(volumePath);
          if (isGoPro) {
            console.log(`[SDCardDetector] Detected GoPro SD card: ${name}`);
            this.knownGoProVolumes.add(name);
            this.emit('sd-card-detected', {
              name,
              path: volumePath,
              dcimPath: path.join(volumePath, 'DCIM')
            });
          }

          this.knownVolumes.add(name);
        }
      }

      for (const volume of this.knownVolumes) {
        if (!currentVolumes.has(volume)) {
          this.knownVolumes.delete(volume);
          if (this.knownGoProVolumes.has(volume)) {
            console.log(`[SDCardDetector] GoPro SD card removed: ${volume}`);
            this.knownGoProVolumes.delete(volume);
            this.emit('sd-card-removed', { name: volume });
          }
        }
      }
    } catch (error) {
      console.error('[SDCardDetector] Error scanning volumes:', error.message);
    } finally {
      this.isScanning = false;
    }
  }

  async isGoProSDCard(volumePath) {
    try {
      const dcimPath = path.join(volumePath, 'DCIM');
      const dcimExists = await this.directoryExists(dcimPath);

      if (!dcimExists) {
        return false;
      }

      const dcimContents = await fs.readdir(dcimPath);
      const hasGoProDir = dcimContents.some((dir) =>
        /^\d{3}GOPRO$/i.test(dir) || /^\d{3}MEDIA$/i.test(dir)
      );

      if (hasGoProDir) {
        return true;
      }

      return await this.hasGoProFiles(dcimPath);
    } catch (error) {
      return false;
    }
  }

  async hasGoProFiles(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDirPath = path.join(dirPath, entry.name);
          const subEntries = await fs.readdir(subDirPath);

          const hasGoPro = subEntries.some((file) =>
            /^(GX|GP|GOPR)\d+\.MP4$/i.test(file)
          );

          if (hasGoPro) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  async directoryExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  async getGoProSDCards() {
    const goProCards = [];

    try {
      const volumeEntries = await this.listVolumeEntries();

      for (const { name, path: volumePath } of volumeEntries) {
        if (this.excludedVolumes.has(name)) continue;

        const isGoPro = await this.isGoProSDCard(volumePath);

        if (isGoPro) {
          goProCards.push({
            name,
            path: volumePath,
            dcimPath: path.join(volumePath, 'DCIM')
          });
        }
      }
    } catch (error) {
      console.error('[SDCardDetector] Error getting GoPro SD cards:', error.message);
    }

    return goProCards;
  }
}

module.exports = { SDCardDetector };
