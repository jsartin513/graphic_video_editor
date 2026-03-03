/**
 * IPC handlers for video analysis, metadata, thumbnails, and file size
 */

const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { ipcMain } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs').promises;

const { getFFmpegPath, getFFprobePath } = require('../src/ffmpeg-resolver');
const { formatFileSize } = require('../src/main-utils');
const { analyzeAndGroupVideos } = require('../src/video-grouping');
const { logger } = require('../src/logger');

function registerVideoIpcHandlers() {
  ipcMain.handle('analyze-videos', async (event, filePaths) => {
    if (!Array.isArray(filePaths)) return [];
    return analyzeAndGroupVideos(filePaths);
  });

  ipcMain.handle('get-video-duration', async (event, filePath) => {
    return new Promise((resolve, reject) => {
      const ffprobeCmd = getFFprobePath();
      const ffprobe = spawn(ffprobeCmd, [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath
      ], {
        env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' }
      });

      let output = '';
      let errorOutput = '';

      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffprobe.on('error', (error) => {
        if (error.code === 'ENOENT') {
          logger.error('ffprobe not found. Please install ffmpeg.');
          resolve(0);
        } else {
          reject(error);
        }
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          const duration = parseFloat(output.trim());
          resolve(isNaN(duration) ? 0 : duration);
        } else {
          logger.error('ffprobe failed', { filePath, errorOutput });
          resolve(0);
        }
      });
    });
  });

  ipcMain.handle('get-video-metadata', async (event, videoPath) => {
    if (!videoPath || typeof videoPath !== 'string') {
      throw new Error('Invalid video path');
    }

    return new Promise((resolve, reject) => {
      const ffprobeCmd = getFFprobePath();
      const env = { ...process.env };
      if (ffprobeCmd.includes('.app/Contents/Resources')) {
        env.PATH = '/usr/bin:/bin';
      } else {
        env.PATH = process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin';
      }

      const ffprobe = spawn(ffprobeCmd, [
        '-v', 'error',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath
      ], { env });

      let output = '';
      let errorOutput = '';

      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffprobe.on('error', (error) => {
        if (error.code === 'ENOENT') {
          reject(new Error('ffprobe not found'));
        } else {
          reject(error);
        }
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const metadata = JSON.parse(output);
            const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
            const audioStream = metadata.streams?.find(s => s.codec_type === 'audio');
            const format = metadata.format || {};

            const parseFPS = (framerateStr) => {
              if (!framerateStr || typeof framerateStr !== 'string') return 0;
              const parts = framerateStr.split('/');
              if (parts.length === 2) {
                const numerator = parseFloat(parts[0]);
                const denominator = parseFloat(parts[1]);
                if (denominator !== 0 && !isNaN(numerator) && !isNaN(denominator)) {
                  return numerator / denominator;
                }
                return 0;
              }
              return parseFloat(framerateStr) || 0;
            };

            const result = {
              duration: parseFloat(format.duration) || 0,
              size: parseInt(format.size) || 0,
              bitrate: parseInt(format.bit_rate) || 0,
              video: videoStream ? {
                codec: videoStream.codec_name || 'unknown',
                codecLongName: videoStream.codec_long_name || 'unknown',
                width: videoStream.width || 0,
                height: videoStream.height || 0,
                fps: parseFPS(videoStream.r_frame_rate),
                bitrate: parseInt(videoStream.bit_rate) || 0,
                pixelFormat: videoStream.pix_fmt || 'unknown'
              } : null,
              audio: audioStream ? {
                codec: audioStream.codec_name || 'unknown',
                codecLongName: audioStream.codec_long_name || 'unknown',
                sampleRate: parseInt(audioStream.sample_rate) || 0,
                channels: audioStream.channels || 0,
                bitrate: parseInt(audioStream.bit_rate) || 0
              } : null,
              container: format.format_name || 'unknown'
            };

            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse ffprobe output: ${error.message}`));
          }
        } else {
          reject(new Error(`ffprobe exited with code ${code}: ${errorOutput}`));
        }
      });
    });
  });

  ipcMain.handle('generate-thumbnail', async (event, videoPath, timestamp = 1) => {
    if (!videoPath || typeof videoPath !== 'string') {
      throw new Error('Invalid video path');
    }

    try {
      const cacheDir = path.join(os.tmpdir(), 'video-merger-thumbnails');
      await fs.mkdir(cacheDir, { recursive: true });

      const stats = await fs.stat(videoPath);
      const cacheKey = crypto
        .createHash('md5')
        .update(`${videoPath}-${stats.size}-${stats.mtime.getTime()}-${timestamp}`)
        .digest('hex');

      const thumbnailPath = path.join(cacheDir, `${cacheKey}.jpg`);

      try {
        await fs.access(thumbnailPath);
        const imageData = await fs.readFile(thumbnailPath);
        return `data:image/jpeg;base64,${imageData.toString('base64')}`;
      } catch {
        // Thumbnail doesn't exist, generate it
      }

      const ffmpegCmd = getFFmpegPath();
      const env = { ...process.env };
      if (ffmpegCmd.includes('.app/Contents/Resources')) {
        env.PATH = '/usr/bin:/bin';
      } else {
        env.PATH = process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin';
      }

      return new Promise((resolve, reject) => {
        const ffmpeg = spawn(ffmpegCmd, [
          '-ss', timestamp.toString(),
          '-i', videoPath,
          '-vframes', '1',
          '-vf', 'scale=320:-1',
          '-q:v', '2',
          '-f', 'image2',
          '-y',
          thumbnailPath
        ], { env });

        let errorOutput = '';

        ffmpeg.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        ffmpeg.on('error', (error) => {
          if (error.code === 'ENOENT') {
            reject(new Error('ffmpeg not found'));
          } else {
            reject(error);
          }
        });

        ffmpeg.on('close', async (code) => {
          if (code === 0) {
            try {
              const imageData = await fs.readFile(thumbnailPath);
              const dataUrl = `data:image/jpeg;base64,${imageData.toString('base64')}`;
              resolve(dataUrl);
            } catch (error) {
              reject(new Error(`Failed to read generated thumbnail: ${error.message}`));
            }
          } else {
            reject(new Error(`ffmpeg exited with code ${code}: ${errorOutput}`));
          }
        });
      });
    } catch (error) {
      logger.error('Error generating thumbnail', { videoPath, error: error.message });
      throw error;
    }
  });

  ipcMain.handle('get-total-file-size', async (event, filePaths) => {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      return { totalBytes: 0, totalSizeFormatted: '0 Bytes' };
    }

    let totalBytes = 0;
    const errors = [];

    for (const filePath of filePaths) {
      try {
        const stats = await fs.stat(filePath);
        totalBytes += stats.size;
      } catch (error) {
        logger.error('Error getting file size', { filePath, error: error.message });
        errors.push(filePath);
      }
    }

    if (errors.length > 0 && errors.length === filePaths.length) {
      throw new Error(`Could not get file sizes for any of the ${filePaths.length} files`);
    }

    return {
      totalBytes,
      totalSizeFormatted: formatFileSize(totalBytes)
    };
  });
}

module.exports = {
  registerVideoIpcHandlers
};
