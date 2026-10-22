/**
 * SD Card Detection Module
 * Monitors removable volumes for action-camera DCIM layouts (GoPro, DJI, Insta360, etc.)
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { cameraVendorLabel } = require('./camera-filenames');

class SDCardDetector extends EventEmitter {
  constructor(volumesPath = '/Volumes') {
    super();
    this.volumesPath = volumesPath;
    this.knownVolumes = new Set();
    /** @type {Map<string, string>} volume name -> camera vendor id */
    this.knownCameraVolumes = new Map();
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

  async scanVolumes() {
    if (this.isScanning) {
      return;
    }
    this.isScanning = true;
    try {
      if (!fsSync.existsSync(this.volumesPath)) {
        return;
      }

      const volumes = await fs.readdir(this.volumesPath);
      const currentVolumes = new Set(volumes);

      for (const volume of volumes) {
        if (!this.knownVolumes.has(volume) && !this.excludedVolumes.has(volume)) {
          const volumePath = path.join(this.volumesPath, volume);

          const cameraType = await this.detectCameraType(volumePath);
          if (cameraType) {
            console.log(`[SDCardDetector] Detected ${cameraVendorLabel(cameraType)} SD card: ${volume}`);
            this.knownCameraVolumes.set(volume, cameraType);
            this.emit('sd-card-detected', {
              name: volume,
              path: volumePath,
              dcimPath: path.join(volumePath, 'DCIM'),
              cameraType,
              cameraLabel: cameraVendorLabel(cameraType)
            });
          }

          this.knownVolumes.add(volume);
        }
      }

      for (const volume of this.knownVolumes) {
        if (!currentVolumes.has(volume)) {
          this.knownVolumes.delete(volume);
          if (this.knownCameraVolumes.has(volume)) {
            const cameraType = this.knownCameraVolumes.get(volume);
            console.log(`[SDCardDetector] ${cameraVendorLabel(cameraType)} SD card removed: ${volume}`);
            this.knownCameraVolumes.delete(volume);
            this.emit('sd-card-removed', { name: volume, cameraType });
          }
        }
      }
    } catch (error) {
      console.error('[SDCardDetector] Error scanning volumes:', error.message);
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * @param {string} volumePath
   * @returns {Promise<string|null>} camera vendor id or null
   */
  async detectCameraType(volumePath) {
    if (await this.isGoProSDCard(volumePath)) return 'gopro';
    if (await this.isDjiSDCard(volumePath)) return 'dji';
    if (await this.isInsta360SDCard(volumePath)) return 'insta360';
    return null;
  }

  /** @deprecated Use detectCameraType — kept for tests */
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

      return this.hasMatchingFiles(dcimPath, /^(GX|GP|GOPR)\d+\.MP4$/i);
    } catch (error) {
      return false;
    }
  }

  async isDjiSDCard(volumePath) {
    try {
      const dcimPath = path.join(volumePath, 'DCIM');
      if (!(await this.directoryExists(dcimPath))) return false;

      const dcimContents = await fs.readdir(dcimPath);
      const hasDjiFolder = dcimContents.some((dir) => /^DJI_\d+$/i.test(dir));
      if (hasDjiFolder) return true;

      return this.hasMatchingFiles(dcimPath, /^DJI_.*\.(MP4|MOV)$/i);
    } catch {
      return false;
    }
  }

  async isInsta360SDCard(volumePath) {
    try {
      const dcimPath = path.join(volumePath, 'DCIM');
      if (!(await this.directoryExists(dcimPath))) return false;

      const dcimContents = await fs.readdir(dcimPath);
      const hasCameraFolder = dcimContents.some((dir) => /^Camera\d+$/i.test(dir));
      if (hasCameraFolder) return true;

      const hasFileInfoList = dcimContents.some((f) => f.toLowerCase() === 'fileinfo_list.list');
      if (hasFileInfoList) return true;

      return this.hasMatchingFiles(
        dcimPath,
        /^(?:PRO_)?VID_\d{8}_\d{6}_\d{2}_\d{3}\.(insv|mp4)$/i
      );
    } catch {
      return false;
    }
  }

  /**
   * @param {string} dirPath
   * @param {RegExp} pattern
   */
  async hasMatchingFiles(dirPath, pattern) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDirPath = path.join(dirPath, entry.name);
          const subEntries = await fs.readdir(subDirPath);
          const hasMatch = subEntries.some((file) => pattern.test(file));
          if (hasMatch) {
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

  /**
   * Get all currently mounted camera SD cards
   * @returns {Promise<Array>}
   */
  async getGoProSDCards() {
    return this.getCameraSDCards();
  }

  async getCameraSDCards() {
    const cards = [];

    try {
      if (!fsSync.existsSync(this.volumesPath)) {
        return cards;
      }

      const volumes = await fs.readdir(this.volumesPath);

      for (const volume of volumes) {
        if (this.excludedVolumes.has(volume)) continue;

        const volumePath = path.join(this.volumesPath, volume);
        const cameraType = await this.detectCameraType(volumePath);

        if (cameraType) {
          cards.push({
            name: volume,
            path: volumePath,
            dcimPath: path.join(volumePath, 'DCIM'),
            cameraType,
            cameraLabel: cameraVendorLabel(cameraType)
          });
        }
      }
    } catch (error) {
      console.error('[SDCardDetector] Error getting camera SD cards:', error.message);
    }

    return cards;
  }
}

module.exports = { SDCardDetector };
