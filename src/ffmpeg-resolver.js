/**
 * FFmpeg/FFprobe path resolution - finds bundled or system binaries
 */

const path = require('path');
const fsSync = require('fs');
const { spawn, execSync } = require('child_process');
const { app } = require('electron');
const { logger } = require('./logger');
const { bundledBinaryFileName, getPackagedResourcesBasePath } = require('./ffmpeg-binary-utils');

let ffmpegPath = null;
let ffprobePath = null;

function chmodExecutableIfSupported(filePath) {
  if (process.platform === 'win32') {
    return;
  }
  try {
    fsSync.chmodSync(filePath, 0o755);
  } catch (e) {
    logger.warn('chmodExecutableIfSupported failed', { filePath, error: e.message });
  }
}

function getBundledBinaryPath(binaryName) {
  try {
    const fileName = bundledBinaryFileName(binaryName, process.platform);

    if (app.isPackaged) {
      const resourcesPath = getPackagedResourcesBasePath(app);
      const candidateNames = process.platform === 'win32'
        ? [fileName, binaryName]
        : [fileName, `${binaryName}.exe`];

      const searchRoots = [
        path.join(resourcesPath, 'resources'),
        resourcesPath
      ];

      for (const root of searchRoots) {
        for (const name of candidateNames) {
          const binaryPath = path.join(root, name);
          if (fsSync.existsSync(binaryPath)) {
            chmodExecutableIfSupported(binaryPath);
            const stats = fsSync.statSync(binaryPath);
            logger.info('getBundledBinaryPath: Found binary', { binaryName, binaryPath, size: stats.size });
            return binaryPath;
          }
        }
      }

      logger.warn('getBundledBinaryPath: Binary not found in any location', { binaryName, resourcesPath });
      return null;
    }

    try {
      if (binaryName === 'ffmpeg') {
        return require('ffmpeg-static');
      }
      if (binaryName === 'ffprobe') {
        const ffprobeStatic = require('ffprobe-static');
        return ffprobeStatic.path || ffprobeStatic;
      }
    } catch (e) {
      return null;
    }

    return null;
  } catch (error) {
    logger.error('Error getting bundled binary', { binaryName, error: error.message });
    return null;
  }
}

function findSystemExecutablePath(command) {
  const commandWithExt = process.platform === 'win32' && !command.endsWith('.exe')
    ? `${command}.exe`
    : command;

  if (process.platform === 'win32') {
    try {
      const result = execSync(`where ${commandWithExt}`, {
        encoding: 'utf8',
        shell: true,
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      const firstLine = result.split(/\r?\n/).find((line) => line.trim().length > 0);
      if (firstLine && fsSync.existsSync(firstLine.trim())) {
        return firstLine.trim();
      }
    } catch (e) {
      // where failed
    }

    const pathEnv = process.env.PATH || '';
    const segments = pathEnv.split(path.delimiter).filter(Boolean);
    for (const segment of segments) {
      const full = path.join(segment, commandWithExt);
      try {
        fsSync.accessSync(full, fsSync.constants.F_OK);
        return full;
      } catch (err) {
        // continue
      }
    }
    return null;
  }

  const commonPaths = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];

  try {
    const envPath = process.env.PATH || '';
    const fullPath = [envPath, ...commonPaths].filter((p) => p).join(':');
    const result = execSync(`which ${command}`, {
      encoding: 'utf8',
      env: { ...process.env, PATH: fullPath },
      shell: '/bin/bash'
    }).trim();
    if (result && result.length > 0) {
      return result;
    }
  } catch (e) {
    // which failed
  }

  for (const basePath of commonPaths) {
    const fullCommandPath = path.join(basePath, command);
    try {
      fsSync.accessSync(fullCommandPath, fsSync.constants.F_OK);
      return fullCommandPath;
    } catch (e) {
      // continue
    }
  }

  return null;
}

function detectPackageManager() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const winget = spawn('where', ['winget'], { shell: true });
      winget.on('close', (code) => resolve({ brewFound: false, wingetFound: code === 0 }));
      winget.on('error', () => resolve({ brewFound: false, wingetFound: false }));
      return;
    }
    const brewCheck = spawn('which', ['brew'], {
      shell: true,
      env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
    });
    brewCheck.on('close', (code) => resolve({ brewFound: code === 0, wingetFound: false }));
    brewCheck.on('error', () => resolve({ brewFound: false, wingetFound: false }));
  });
}

function spawnWhich(command) {
  if (process.platform === 'win32') {
    return spawn('where', [command.endsWith('.exe') ? command : `${command}.exe`], { shell: true });
  }
  return spawn('which', [command], {
    shell: true,
    env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
  });
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
    let wingetFound = false;
    let ffmpegVersion = null;
    let checksDone = 0;
    let versionCheckDone = false;

    function finishResult() {
      resolve({
        installed: ffmpegFound && ffprobeFound,
        ffmpegFound,
        ffprobeFound,
        brewFound,
        wingetFound,
        ffmpegVersion
      });
    }

    function checkComplete() {
      checksDone++;
      if (checksDone === 3 && versionCheckDone) {
        logger.info('checkFFmpeg: Final result', { ffmpegFound, ffprobeFound, installed: ffmpegFound && ffprobeFound });
        finishResult();
      }
    }

    if (bundledFFmpeg && bundledFFprobe) {
      logger.debug('checkFFmpeg: Testing bundled binaries directly');

      function bundledDone(includePackageManager = true) {
        if (!includePackageManager) {
          logger.info('checkFFmpeg: Final result', { ffmpegFound, ffprobeFound, installed: ffmpegFound && ffprobeFound });
          finishResult();
          return;
        }
        detectPackageManager().then(({ brewFound: brew, wingetFound: winget }) => {
          brewFound = brew;
          wingetFound = winget;
          logger.info('checkFFmpeg: Final result', { ffmpegFound, ffprobeFound, installed: ffmpegFound && ffprobeFound });
          finishResult();
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
          }

          try {
            const testFFprobe = spawn(bundledFFprobe, ['-version']);
            const ffprobeTimer = setTimeout(() => testFFprobe.kill(), 5000);
            testFFprobe.on('close', (probeCode) => {
              clearTimeout(ffprobeTimer);
              ffprobeFound = probeCode === 0;
              bundledDone();
            });
            testFFprobe.on('error', () => {
              clearTimeout(ffprobeTimer);
              ffprobeFound = false;
              bundledDone(false);
            });
          } catch (err) {
            ffprobeFound = false;
            bundledDone(false);
          }
        });
        testFFmpeg.on('error', () => {
          clearTimeout(ffmpegTimer);
          ffmpegFound = false;
          bundledDone(false);
        });
      } catch (err) {
        ffmpegFound = false;
        bundledDone(false);
      }
      return;
    }

    const ffmpegCheck = spawnWhich('ffmpeg');
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

    const ffprobeCheck = spawnWhich('ffprobe');
    ffprobeCheck.on('close', (code) => {
      ffprobeFound = code === 0 || foundFFprobePath !== null;
      checkComplete();
    });
    ffprobeCheck.on('error', () => {
      checkComplete();
    });

    detectPackageManager().then(({ brewFound: brew, wingetFound: winget }) => {
      brewFound = brew;
      wingetFound = winget;
      checkComplete();
    });
  });
}

module.exports = {
  getFFmpegPath,
  getFFprobePath,
  checkFFmpeg
};
