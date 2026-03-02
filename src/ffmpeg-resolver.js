/**
 * FFmpeg/FFprobe path resolution - finds bundled or system binaries
 */

const path = require('path');
const fsSync = require('fs');
const { spawn, execSync } = require('child_process');
const { app } = require('electron');
const { logger } = require('./logger');

let ffmpegPath = null;
let ffprobePath = null;

function getBundledBinaryPath(binaryName) {
  try {
    if (app.isPackaged) {
      let resourcesPath = process.resourcesPath;

      if (!resourcesPath) {
        try {
          resourcesPath = app.getPath('resources');
        } catch (e) {
          try {
            const exePath = app.getPath('exe');
            resourcesPath = path.join(path.dirname(exePath), '..', 'Resources');
          } catch (exeError) {
            logger.error('getBundledBinaryPath: Error getting resources path', {
              resourcesPathError: e.message,
              exePathError: exeError.message
            });
            resourcesPath = path.join(__dirname, '..');
          }
        }
      }

      const binaryPath = path.join(resourcesPath, 'resources', binaryName);

      logger.debug('getBundledBinaryPath: Looking for binary', {
        binaryName,
        binaryPath,
        resourcesPath,
        processResourcesPath: process.resourcesPath || 'undefined'
      });

      if (fsSync.existsSync(binaryPath)) {
        try {
          fsSync.chmodSync(binaryPath, 0o755);
          const stats = fsSync.statSync(binaryPath);
          logger.info('getBundledBinaryPath: Found binary', { binaryName, binaryPath, size: stats.size });
          return binaryPath;
        } catch (e) {
          logger.warn('getBundledBinaryPath: Failed to set executable permissions', { binaryPath, error: e.message });
          return binaryPath;
        }
      } else {
        logger.debug('getBundledBinaryPath: Binary not found at expected path', {
          binaryName,
          binaryPath,
          resourcesDirExists: fsSync.existsSync(resourcesPath)
        });

        if (fsSync.existsSync(resourcesPath)) {
          const contents = fsSync.readdirSync(resourcesPath);
          logger.debug('getBundledBinaryPath: Resources directory contents', { contents });
          const resourcesSubdir = path.join(resourcesPath, 'resources');
          if (fsSync.existsSync(resourcesSubdir)) {
            const subdirContents = fsSync.readdirSync(resourcesSubdir);
            logger.debug('getBundledBinaryPath: Resources subdirectory contents', { subdirContents });
          }
        }

        const altPaths = [
          path.join(resourcesPath, binaryName),
          process.resourcesPath ? path.join(process.resourcesPath, 'resources', binaryName) : null
        ];
        try {
          altPaths.push(path.join(app.getPath('resources'), 'resources', binaryName));
        } catch (e) {
          // app.getPath('resources') not available, skip
        }
        const validAltPaths = altPaths.filter(p => p !== null);

        for (const altPath of validAltPaths) {
          if (fsSync.existsSync(altPath)) {
            logger.info('getBundledBinaryPath: Found binary at alternative location', { binaryName, altPath });
            try {
              fsSync.chmodSync(altPath, 0o755);
            } catch (e) {
              logger.warn('getBundledBinaryPath: Failed to chmod alternative path', { altPath, error: e.message });
            }
            return altPath;
          }
        }
        logger.warn('getBundledBinaryPath: Binary not found in any location', { binaryName });
        return null;
      }
    } else {
      try {
        if (binaryName === 'ffmpeg') {
          return require('ffmpeg-static');
        } else if (binaryName === 'ffprobe') {
          const ffprobeStatic = require('ffprobe-static');
          return ffprobeStatic.path || ffprobeStatic;
        }
      } catch (e) {
        return null;
      }
    }

    return null;
  } catch (error) {
    logger.error('Error getting bundled binary', { binaryName, error: error.message });
    return null;
  }
}

function findSystemExecutablePath(command) {
  try {
    const commonPaths = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];

    try {
      const envPath = process.env.PATH || '';
      const fullPath = [envPath, ...commonPaths].filter(p => p).join(':');
      const result = execSync(`which ${command}`, {
        encoding: 'utf8',
        env: { ...process.env, PATH: fullPath },
        shell: '/bin/bash'
      }).trim();
      if (result && result.length > 0) {
        return result;
      }
    } catch (e) {
      // which failed, try direct paths
    }

    for (const basePath of commonPaths) {
      const fullCommandPath = path.join(basePath, command);
      try {
        fsSync.accessSync(fullCommandPath, fsSync.constants.F_OK);
        return fullCommandPath;
      } catch (e) {
        // File doesn't exist, continue
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

function getFFmpegPath() {
  if (ffmpegPath) return ffmpegPath;

  const bundled = getBundledBinaryPath('ffmpeg');
  if (bundled) {
    ffmpegPath = bundled;
    return ffmpegPath;
  }

  ffmpegPath = findSystemExecutablePath('ffmpeg') || 'ffmpeg';
  return ffmpegPath;
}

function getFFprobePath() {
  if (ffprobePath) return ffprobePath;

  const bundled = getBundledBinaryPath('ffprobe');
  if (bundled) {
    ffprobePath = bundled;
    return ffprobePath;
  }

  ffprobePath = findSystemExecutablePath('ffprobe') || 'ffprobe';
  return ffprobePath;
}

async function checkFFmpeg() {
  return new Promise((resolve) => {
    const bundledFFmpeg = getBundledBinaryPath('ffmpeg');
    const bundledFFprobe = getBundledBinaryPath('ffprobe');

    logger.debug('checkFFmpeg: Bundled binaries', { bundledFFmpeg, bundledFFprobe });

    const foundFFmpegPath = bundledFFmpeg || findSystemExecutablePath('ffmpeg');
    const foundFFprobePath = bundledFFprobe || findSystemExecutablePath('ffprobe');

    logger.debug('checkFFmpeg: Found binaries', { foundFFmpegPath, foundFFprobePath });

    ffmpegPath = foundFFmpegPath;
    ffprobePath = foundFFprobePath;

    let ffmpegFound = false;
    let ffprobeFound = false;
    let brewFound = false;
    let ffmpegVersion = null;
    let checksDone = 0;
    let versionCheckDone = false;

    function checkComplete() {
      checksDone++;
      if (checksDone === 3 && versionCheckDone) {
        logger.info('checkFFmpeg: Final result', { ffmpegFound, ffprobeFound, installed: ffmpegFound && ffprobeFound });
        resolve({
          installed: ffmpegFound && ffprobeFound,
          ffmpegFound,
          ffprobeFound,
          brewFound,
          ffmpegVersion
        });
      }
    }

    if (bundledFFmpeg && bundledFFprobe) {
      logger.debug('checkFFmpeg: Testing bundled binaries directly');

      function bundledDone() {
        logger.info('checkFFmpeg: Final result', { ffmpegFound, ffprobeFound, installed: ffmpegFound && ffprobeFound });
        resolve({
          installed: ffmpegFound && ffprobeFound,
          ffmpegFound,
          ffprobeFound,
          brewFound,
          ffmpegVersion
        });
      }

      try {
        const testFFmpeg = spawn(bundledFFmpeg, ['-version']);
        const ffmpegTimer = setTimeout(() => testFFmpeg.kill(), 5000);
        let ffmpegOutput = '';
        testFFmpeg.stdout.on('data', (data) => {
          ffmpegOutput += data.toString();
        });
        testFFmpeg.on('close', (code) => {
          clearTimeout(ffmpegTimer);
          ffmpegFound = code === 0;
          if (ffmpegFound) {
            const match = ffmpegOutput.match(/ffmpeg version (\S+)/);
            if (match) {
              ffmpegVersion = match[1];
            }
          } else {
            logger.debug('checkFFmpeg: Bundled ffmpeg test failed', { code });
          }

          try {
            const testFFprobe = spawn(bundledFFprobe, ['-version']);
            const ffprobeTimer = setTimeout(() => testFFprobe.kill(), 5000);
            testFFprobe.on('close', (code) => {
              clearTimeout(ffprobeTimer);
              ffprobeFound = code === 0;
              if (!ffprobeFound) {
                logger.debug('checkFFmpeg: Bundled ffprobe test failed', { code });
              }

              const brewCheck = spawn('which', ['brew'], {
                shell: true,
                env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
              });
              brewCheck.on('close', (code) => {
                brewFound = code === 0;
                bundledDone();
              });
              brewCheck.on('error', () => {
                bundledDone();
              });
            });
            testFFprobe.on('error', (err) => {
              clearTimeout(ffprobeTimer);
              logger.error('checkFFmpeg: Error testing bundled ffprobe', { error: err.message });
              ffprobeFound = false;
              bundledDone();
            });
          } catch (err) {
            logger.error('checkFFmpeg: Error spawning bundled ffprobe test', { error: err.message });
            ffprobeFound = false;
            bundledDone();
          }
        });
        testFFmpeg.on('error', (err) => {
          clearTimeout(ffmpegTimer);
          logger.error('checkFFmpeg: Error testing bundled ffmpeg', { error: err.message });
          ffmpegFound = false;
          bundledDone();
        });
      } catch (err) {
        logger.error('checkFFmpeg: Error spawning bundled ffmpeg test', { error: err.message });
        ffmpegFound = false;
        bundledDone();
      }
      return;
    }

    const ffmpegCheck = spawn('which', ['ffmpeg'], {
      shell: true,
      env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
    });
    ffmpegCheck.on('close', (code) => {
      ffmpegFound = code === 0 || foundFFmpegPath !== null;
      if (ffmpegFound && foundFFmpegPath) {
        const versionCheck = spawn(foundFFmpegPath, ['-version']);
        let output = '';
        versionCheck.stdout.on('data', (data) => {
          output += data.toString();
        });
        versionCheck.on('close', () => {
          const match = output.match(/ffmpeg version (\S+)/);
          if (match) {
            ffmpegVersion = match[1];
          }
          versionCheckDone = true;
          checkComplete();
        });
        versionCheck.on('error', () => {
          versionCheckDone = true;
          checkComplete();
        });
      } else {
        versionCheckDone = true;
        checkComplete();
      }
    });
    ffmpegCheck.on('error', () => {
      versionCheckDone = true;
      checkComplete();
    });

    const ffprobeCheck = spawn('which', ['ffprobe'], {
      shell: true,
      env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
    });
    ffprobeCheck.on('close', (code) => {
      ffprobeFound = code === 0 || foundFFprobePath !== null;
      checkComplete();
    });
    ffprobeCheck.on('error', () => {
      checkComplete();
    });

    const brewCheck = spawn('which', ['brew'], {
      shell: true,
      env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
    });
    brewCheck.on('close', (code) => {
      brewFound = code === 0;
      checkComplete();
    });
    brewCheck.on('error', () => {
      checkComplete();
    });
  });
}

module.exports = {
  getFFmpegPath,
  getFFprobePath,
  checkFFmpeg
};
