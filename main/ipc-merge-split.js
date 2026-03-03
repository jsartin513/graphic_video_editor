/**
 * IPC handlers for merge, split, trim operations
 */

const path = require('path');
const { ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs').promises;

const { getFFmpegPath, getFFprobePath } = require('../src/ffmpeg-resolver');
const { mapError } = require('../src/error-mapper');
const { logger } = require('../src/logger');
const {
  QUALITY_COPY,
  QUALITY_SETTINGS,
  validateQualityOption
} = require('../src/quality-utils');

let currentMergeProcess = null;
let currentMergeTempFile = null;
let currentMergeOutputPath = null;
let currentSplitProcesses = [];
let isCancelled = false;

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * @param {() => import('electron').BrowserWindow|null} getMainWindow
 */
function registerMergeSplitIpcHandlers(getMainWindow) {
  ipcMain.handle('merge-videos', async (event, filePaths, outputPath, qualityOption = 'copy', format = 'mp4', normalizeAudio = false) => {
    return new Promise((resolve, reject) => {
      try {
        validateQualityOption(qualityOption);
      } catch (error) {
        reject(error);
        return;
      }

      isCancelled = false;
      currentMergeOutputPath = outputPath;

      const validFilePaths = filePaths.filter(filePath => {
        const filename = path.basename(filePath);
        return !filename.startsWith('._');
      });

      if (validFilePaths.length === 0) {
        reject(new Error('No valid video files found (all files appear to be macOS metadata files)'));
        return;
      }

      const tempFileList = path.join(path.dirname(outputPath), `filelist_${Date.now()}.txt`);
      currentMergeTempFile = tempFileList;
      const fileListContent = validFilePaths.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');

      fs.writeFile(tempFileList, fileListContent, 'utf8')
        .then(() => {
          const ffmpegCmd = getFFmpegPath();
          logger.debug('merge-videos: Using ffmpeg', { ffmpegCmd });

          const env = { ...process.env };
          if (ffmpegCmd.includes('.app/Contents/Resources')) {
            env.PATH = '/usr/bin:/bin';
          } else {
            env.PATH = process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin';
          }

          const normalizedFormat = (typeof format === 'string' ? format : 'mp4').toLowerCase();
          const formatMuxers = { mp4: 'mp4', mov: 'mov', mkv: 'matroska', avi: 'avi', m4v: 'mp4' };

          const outputExt = path.extname(outputPath).toLowerCase().slice(1);
          if (outputExt !== normalizedFormat) {
            const basePath = outputPath.replace(/\.[^/.]+$/, '');
            outputPath = basePath + '.' + normalizedFormat;
          }

          const ffmpegArgs = ['-f', 'concat', '-safe', '0', '-i', tempFileList];
          if (normalizedFormat !== 'mp4' && formatMuxers[normalizedFormat]) {
            ffmpegArgs.push('-f', formatMuxers[normalizedFormat]);
          }

          if (qualityOption === QUALITY_COPY) {
            if (normalizeAudio) {
              ffmpegArgs.push('-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k');
            } else {
              ffmpegArgs.push('-c', 'copy');
            }
          } else {
            const settings = QUALITY_SETTINGS[qualityOption];
            ffmpegArgs.push('-c:v', 'libx264', '-crf', settings.crf, '-preset', settings.preset);
            if (normalizeAudio) {
              ffmpegArgs.push('-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k');
            } else if (['mp4', 'mov', 'm4v'].includes(normalizedFormat)) {
              ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
            } else {
              ffmpegArgs.push('-c:a', 'libmp3lame', '-b:a', '192k');
            }
          }

          ffmpegArgs.push('-y', outputPath);

          const ffmpeg = spawn(ffmpegCmd, ffmpegArgs, { env });
          currentMergeProcess = ffmpeg;

          let errorOutput = '';
          let totalDuration = null;
          ffmpeg.startTime = Date.now();

          (async () => {
            try {
              const durationPromises = validFilePaths.map(async (filePath) => {
                try {
                  return await new Promise((res) => {
                    const ffprobeCmd = getFFprobePath();
                    const ffprobe = spawn(ffprobeCmd, [
                      '-v', 'error', '-show_entries', 'format=duration',
                      '-of', 'default=noprint_wrappers=1:nokey=1', filePath
                    ], { env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' } });
                    let out = '';
                    ffprobe.stdout.on('data', (d) => { out += d.toString(); });
                    ffprobe.on('close', (code) => res(code === 0 ? (parseFloat(out.trim()) || 0) : 0));
                    ffprobe.on('error', () => res(0));
                  });
                } catch {
                  return 0;
                }
              });
              const durations = await Promise.all(durationPromises);
              totalDuration = durations.reduce((sum, d) => sum + d, 0);
              if (totalDuration > 0) logger.debug('merge-videos: Total duration', { totalDuration });
            } catch (err) {
              logger.debug('merge-videos: Could not calculate total duration');
            }
          })();

          const timeout = setTimeout(() => {
            if (ffmpeg && !ffmpeg.killed) {
              ffmpeg.kill('SIGTERM');
              logger.error('merge-videos: FFmpeg operation timed out');
              reject(new Error('FFmpeg operation timed out. The merge may have failed or is taking too long.'));
            }
          }, 5 * 60 * 1000);

          ffmpeg.stderr.on('data', (data) => {
            const output = data.toString();
            errorOutput += output;
            logger.debug('merge-videos: FFmpeg stderr', { output: output.trim() });

            if (isCancelled) {
              ffmpeg.kill('SIGTERM');
              return;
            }

            const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
            const mainWindow = getMainWindow();
            if (timeMatch && mainWindow) {
              const hours = parseInt(timeMatch[1], 10);
              const minutes = parseInt(timeMatch[2], 10);
              const seconds = parseFloat(timeMatch[3]);
              const currentTime = hours * 3600 + minutes * 60 + seconds;
              let percent = null;
              if (totalDuration !== null && totalDuration > 0) {
                percent = Math.min((currentTime / totalDuration) * 100, 100);
              }
              const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${Math.floor(seconds).toString().padStart(2, '0')}`;
              let eta = null;
              let etaStr = null;
              if (percent && percent > 0 && percent < 100 && totalDuration > 0) {
                const elapsed = (Date.now() - ffmpeg.startTime) / 1000;
                if (elapsed > 0 && currentTime > 0) {
                  const rate = currentTime / elapsed;
                  if (rate > 0) {
                    eta = Math.round((totalDuration - currentTime) / rate);
                    const etaH = Math.floor(eta / 3600);
                    const etaM = Math.floor((eta % 3600) / 60);
                    const etaS = eta % 60;
                    etaStr = etaH > 0 ? `${etaH}:${etaM.toString().padStart(2, '0')}:${etaS.toString().padStart(2, '0')}` : `${etaM}:${etaS.toString().padStart(2, '0')}`;
                  }
                }
              }
              mainWindow.webContents.send('merge-progress', { currentTime, totalDuration: totalDuration || 0, percent, timeStr, eta, etaStr });
            }
          });

          ffmpeg.on('error', (error) => {
            clearTimeout(timeout);
            currentMergeProcess = null;
            currentMergeTempFile = null;
            currentMergeOutputPath = null;
            fs.unlink(tempFileList).catch(() => {});
            logger.error('merge-videos: FFmpeg spawn error', { error: error.message });
            if (error.code === 'ENOENT') {
              const mapped = mapError('ffmpeg not found');
              const err = new Error(mapped.userMessage);
              err.mappedError = mapped;
              reject(err);
            } else {
              const mapped = mapError(error);
              const err = new Error(mapped.userMessage);
              err.mappedError = mapped;
              reject(err);
            }
          });

          ffmpeg.on('close', (code) => {
            clearTimeout(timeout);
            const tempFile = currentMergeTempFile;
            const outputFile = currentMergeOutputPath;
            currentMergeProcess = null;
            currentMergeTempFile = null;
            currentMergeOutputPath = null;

            if (tempFile) fs.unlink(tempFile).catch(() => {});

            if (isCancelled) {
              if (outputFile) fs.unlink(outputFile).catch(() => {});
              reject(new Error('Operation cancelled by user'));
              return;
            }

            if (code === 0) {
              logger.info('merge-videos: Merge completed', { outputPath });
              resolve({ success: true, outputPath });
            } else {
              logger.error('merge-videos: FFmpeg failed', { code, errorOutput });
              const mapped = mapError(`ffmpeg failed: ${errorOutput}`);
              const err = new Error(mapped.userMessage);
              err.mappedError = mapped;
              reject(err);
            }
          });
        })
        .catch(reject);
    });
  });

  ipcMain.handle('cancel-merge', async () => {
    return new Promise((resolve, reject) => {
      try {
        if (currentMergeProcess && !currentMergeProcess.killed) {
          logger.debug('cancel-merge: Cancelling merge');
          isCancelled = true;
          currentMergeProcess.kill('SIGTERM');
          const forceKillTimeout = setTimeout(() => {
            if (currentMergeProcess && !currentMergeProcess.killed) {
              currentMergeProcess.kill('SIGKILL');
            }
          }, 2000);
          currentMergeProcess.once('exit', () => clearTimeout(forceKillTimeout));
          resolve({ success: true, message: 'Merge operation cancelled' });
        } else {
          resolve({ success: false, message: 'No active merge operation to cancel' });
        }
      } catch (error) {
        logger.error('Error cancelling merge', { error: error.message });
        reject(error);
      }
    });
  });

  ipcMain.handle('get-output-directory', async (event, inputPath) => {
    const inputDir = path.dirname(inputPath);
    const outputDir = path.join(inputDir, 'merged_videos');
    try {
      await fs.mkdir(outputDir, { recursive: true });
      return outputDir;
    } catch (error) {
      throw new Error(`Failed to create output directory: ${error.message}`);
    }
  });

  ipcMain.handle('split-video', async (event, videoPath, splits, outputDir) => {
    return new Promise(async (resolve, reject) => {
      try {
        isCancelled = false;
        currentSplitProcesses = [];
        await fs.mkdir(outputDir, { recursive: true });

        const results = [];
        const ffmpegCmd = getFFmpegPath();

        for (let i = 0; i < splits.length; i++) {
          if (isCancelled) {
            logger.debug('split-video: Operation cancelled');
            resolve({ success: false, cancelled: true, results });
            return;
          }

          const split = splits[i];
          const outputPath = path.join(outputDir, split.filename);
          const startTime = formatTime(split.startTime);
          const duration = formatTime(split.duration);

          try {
            await new Promise((splitResolve, splitReject) => {
              const ffmpeg = spawn(ffmpegCmd, [
                '-i', videoPath, '-ss', startTime, '-t', duration,
                '-c', 'copy', '-avoid_negative_ts', 'make_zero', '-y', outputPath
              ], { shell: true, env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' } });

              currentSplitProcesses.push(ffmpeg);
              let errorOutput = '';

              ffmpeg.stderr.on('data', (data) => { errorOutput += data.toString(); });

              ffmpeg.on('error', (error) => {
                const idx = currentSplitProcesses.indexOf(ffmpeg);
                if (idx > -1) currentSplitProcesses.splice(idx, 1);
                splitReject(error.code === 'ENOENT' ? new Error('ffmpeg not found') : error);
              });

              ffmpeg.on('close', (code) => {
                const idx = currentSplitProcesses.indexOf(ffmpeg);
                if (idx > -1) currentSplitProcesses.splice(idx, 1);
                if (isCancelled) {
                  splitReject(new Error('Operation cancelled'));
                  return;
                }
                if (code === 0) {
                  results.push({ success: true, filename: split.filename, outputPath });
                  splitResolve();
                } else {
                  results.push({ success: false, filename: split.filename, error: errorOutput });
                  splitReject(new Error(`ffmpeg failed: ${errorOutput}`));
                }
              });
            });
          } catch (error) {
            logger.error('Error splitting segment', { segmentIndex: i + 1, error: error.message });
            if (!results.find(r => r.filename === split.filename)) {
              results.push({ success: false, filename: split.filename, error: error.message });
            }
          }
        }

        resolve({ success: true, results });
      } catch (error) {
        reject(error);
      }
    });
  });

  ipcMain.handle('cancel-split', async () => {
    return new Promise((resolve) => {
      try {
        if (currentSplitProcesses.length > 0) {
          logger.debug('cancel-split: Cancelling split');
          isCancelled = true;
          const processesToKill = [...currentSplitProcesses];
          processesToKill.forEach(proc => {
            if (proc && !proc.killed) {
              proc.kill('SIGTERM');
              const t = setTimeout(() => {
                if (proc && !proc.killed) proc.kill('SIGKILL');
              }, 2000);
              proc.once('exit', () => clearTimeout(t));
            }
          });
          currentSplitProcesses = [];
          resolve({ success: true, message: 'Split operation cancelled' });
        } else {
          resolve({ success: false, message: 'No active split operation to cancel' });
        }
      } catch (error) {
        logger.error('Error cancelling split', { error: error.message });
        resolve({ success: false, message: error.message });
      }
    });
  });

  ipcMain.handle('trim-video', async (event, options) => {
    return new Promise(async (resolve, reject) => {
      try {
        const { inputPath, outputPath, startTime, endTime } = options;
        if (!inputPath || !outputPath) {
          reject(new Error('Input and output paths are required'));
          return;
        }
        if (startTime < 0 || endTime <= startTime) {
          reject(new Error('Invalid trim times'));
          return;
        }

        const duration = endTime - startTime;
        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        const ffmpegCmd = getFFmpegPath();
        const ffmpeg = spawn(ffmpegCmd, [
          '-y', '-i', inputPath, '-ss', formatTime(startTime), '-t', formatTime(duration),
          '-c', 'copy', '-avoid_negative_ts', 'make_zero', outputPath
        ], { env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' } });

        let errorOutput = '';
        ffmpeg.stderr.on('data', (data) => { errorOutput += data.toString(); });

        ffmpeg.on('error', (error) => {
          reject(error.code === 'ENOENT' ? new Error('ffmpeg not found') : error);
        });

        ffmpeg.on('close', (code) => {
          if (code === 0) {
            logger.debug('trim-video: Trim completed', { outputPath });
            resolve({ success: true, outputPath });
          } else {
            logger.error('trim-video: FFmpeg failed', { code, errorOutput });
            reject(new Error(`ffmpeg failed: ${errorOutput}`));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  });

  ipcMain.handle('select-output-destination', async () => {
    const mainWindow = getMainWindow();
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Output Destination Folder'
    });
    if (result.canceled) return { canceled: true, path: null };
    const selectedPath = result.filePaths[0];
    try {
      await fs.mkdir(selectedPath, { recursive: true });
      return { canceled: false, path: selectedPath };
    } catch (error) {
      throw new Error(`Failed to access output directory: ${error.message}`);
    }
  });
}

module.exports = {
  registerMergeSplitIpcHandlers
};
