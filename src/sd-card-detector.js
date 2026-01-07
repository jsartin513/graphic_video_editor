/**
 * SD Card Detection Module
 * Monitors for GoPro SD card mounts and detects GoPro directory structure
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class SDCardDetector extends EventEmitter {
  constructor(volumesPath = '/Volumes') {
    super();
    this.volumesPath = volumesPath;
    this.watcher = null;
    this.knownVolumes = new Set();
    this.checkInterval = null;
    // List of volume names to exclude (common system volumes)
    this.excludedVolumes = new Set(['Macintosh HD', 'Preboot', 'Recovery', 'VM', 'Update']);
  }

  /**
   * Start monitoring for SD card mounts
   */
  start() {
    // Initial scan of existing volumes
    this.scanVolumes();

    // Set up periodic checking (every 2 seconds)
    // Using polling instead of fs.watch for better reliability on macOS
    this.checkInterval = setInterval(() => {
      this.scanVolumes();
    }, 2000);

    console.log('[SDCardDetector] Started monitoring for SD cards');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    console.log('[SDCardDetector] Stopped monitoring');
  }

  /**
   * Scan the /Volumes directory for new SD cards
   */
  async scanVolumes() {
    try {
      // Check if /Volumes directory exists
      if (!fsSync.existsSync(this.volumesPath)) {
        return;
      }

      const volumes = await fs.readdir(this.volumesPath);
      const currentVolumes = new Set(volumes);

      // Find new volumes (newly mounted)
      for (const volume of volumes) {
        if (!this.knownVolumes.has(volume) && !this.excludedVolumes.has(volume)) {
          const volumePath = path.join(this.volumesPath, volume);
          
          // Check if this is a GoPro SD card
          const isGoPro = await this.isGoProSDCard(volumePath);
          if (isGoPro) {
            console.log(`[SDCardDetector] Detected GoPro SD card: ${volume}`);
            this.emit('sd-card-detected', {
              name: volume,
              path: volumePath,
              dcimPath: path.join(volumePath, 'DCIM')
            });
          }
          
          this.knownVolumes.add(volume);
        }
      }

      // Remove volumes that are no longer mounted
      for (const volume of this.knownVolumes) {
        if (!currentVolumes.has(volume)) {
          console.log(`[SDCardDetector] SD card removed: ${volume}`);
          this.knownVolumes.delete(volume);
          this.emit('sd-card-removed', { name: volume });
        }
      }
    } catch (error) {
      // Silently ignore errors (e.g., permission issues)
      console.error('[SDCardDetector] Error scanning volumes:', error.message);
    }
  }

  /**
   * Check if a volume is a GoPro SD card
   * @param {string} volumePath - Path to the volume
   * @returns {Promise<boolean>}
   */
  async isGoProSDCard(volumePath) {
    try {
      // Check if DCIM directory exists
      const dcimPath = path.join(volumePath, 'DCIM');
      const dcimExists = await this.directoryExists(dcimPath);
      
      if (!dcimExists) {
        return false;
      }

      // Check for typical GoPro subdirectories (e.g., 100GOPRO, 101GOPRO, etc.)
      const dcimContents = await fs.readdir(dcimPath);
      const hasGoProDir = dcimContents.some(dir => 
        /^\d{3}GOPRO$/i.test(dir) || /^\d{3}MEDIA$/i.test(dir)
      );

      if (hasGoProDir) {
        return true;
      }

      // Alternative check: look for GoPro video files directly
      const hasGoProFiles = await this.hasGoProFiles(dcimPath);
      return hasGoProFiles;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a directory contains GoPro video files
   * @param {string} dirPath - Directory path to check
   * @returns {Promise<boolean>}
   */
  async hasGoProFiles(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDirPath = path.join(dirPath, entry.name);
          const subEntries = await fs.readdir(subDirPath);
          
          // Check for GoPro filename patterns
          const hasGoPro = subEntries.some(file => 
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

  /**
   * Check if a directory exists
   * @param {string} dirPath - Directory path
   * @returns {Promise<boolean>}
   */
  async directoryExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all currently mounted GoPro SD cards
   * @returns {Promise<Array>}
   */
  async getGoProSDCards() {
    const goProCards = [];
    
    try {
      if (!fsSync.existsSync(this.volumesPath)) {
        return goProCards;
      }

      const volumes = await fs.readdir(this.volumesPath);
      
      for (const volume of volumes) {
        if (this.excludedVolumes.has(volume)) continue;
        
        const volumePath = path.join(this.volumesPath, volume);
        const isGoPro = await this.isGoProSDCard(volumePath);
        
        if (isGoPro) {
          goProCards.push({
            name: volume,
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
