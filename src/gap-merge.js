/**
 * Build segment lists and render gap indicator clips for combined session merges.
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const { getFFmpegPath, getFFprobePath } = require('./ffmpeg-resolver');
const { formatGapDurationHuman } = require('./session-gaps');
const { QUALITY_COPY, QUALITY_SETTINGS } = require('./quality-utils');

function escapeDrawtext(text) {
  return String(text)
    .replace(/\\/g, '\\\\\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "'\\\\\\''")
    .replace(/%/g, '\\%');
}

/**
 * @param {{ gapKnown: boolean, gapSeconds: number|null }} gap
 */
function buildGapOverlayText(gap) {
  if (gap.gapKnown && gap.gapSeconds != null && Number.isFinite(gap.gapSeconds)) {
    return `${formatGapDurationHuman(gap.gapSeconds)} missing`;
  }
  return 'Recording gap (time unknown)';
}

function buildFfmpegEnv(ffmpegCmd) {
  const env = { ...process.env };
  if (ffmpegCmd.includes('.app/Contents/Resources')) {
    env.PATH = '/usr/bin:/bin';
  } else {
    env.PATH = process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin';
  }
  return env;
}

function runProcess(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stderr });
      else reject(new Error(stderr || `${cmd} exited with code ${code}`));
    });
  });
}

async function probeVideoStreamSpecs(filePath, env) {
  const ffprobeCmd = getFFprobePath();
  return new Promise((resolve, reject) => {
    const ffprobe = spawn(ffprobeCmd, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,r_frame_rate',
      '-of', 'json',
      filePath
    ], { env });

    let output = '';
    ffprobe.stdout.on('data', (d) => { output += d.toString(); });
    ffprobe.on('error', reject);
    ffprobe.on('close', (code) => {
      if (code !== 0) {
        resolve({ width: 1920, height: 1080, fps: 30 });
        return;
      }
      try {
        const parsed = JSON.parse(output);
        const stream = parsed.streams?.[0] || {};
        const width = stream.width || 1920;
        const height = stream.height || 1080;
        let fps = 30;
        if (typeof stream.r_frame_rate === 'string' && stream.r_frame_rate.includes('/')) {
          const [n, d] = stream.r_frame_rate.split('/').map(Number);
          if (d) fps = n / d;
        }
        resolve({ width, height, fps: fps || 30 });
      } catch {
        resolve({ width: 1920, height: 1080, fps: 30 });
      }
    });
  });
}

/**
 * @param {string} filePath
 * @param {string} tempOutputPath
 * @param {string} qualityOption
 * @param {string} normalizedFormat
 * @param {boolean} normalizeAudio
 */
async function concatVideoFiles(filePaths, tempOutputPath, qualityOption, normalizedFormat, normalizeAudio) {
  const ffmpegCmd = getFFmpegPath();
  const env = buildFfmpegEnv(ffmpegCmd);
  const listPath = `${tempOutputPath}.list.txt`;
  const fileListContent = filePaths.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
  await fs.writeFile(listPath, fileListContent, 'utf8');

  const ffmpegArgs = ['-f', 'concat', '-safe', '0', '-i', listPath];
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
    } else {
      ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
    }
  }
  ffmpegArgs.push('-y', tempOutputPath);

  try {
    await runProcess(ffmpegCmd, ffmpegArgs, env);
  } finally {
    await fs.unlink(listPath).catch(() => {});
  }
}

/**
 * @param {object} params
 */
async function renderGapIndicatorClip({
  indicatorPath,
  outputPath,
  width,
  height,
  fps,
  overlayText
}) {
  const ffmpegCmd = getFFmpegPath();
  const env = buildFfmpegEnv(ffmpegCmd);
  const text = escapeDrawtext(overlayText);
  const fontfile = '/System/Library/Fonts/Supplemental/Arial.ttf';
  const vf = [
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
    `drawtext=fontfile=${fontfile}:text='${text}':fontsize=42:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h*0.82`
  ].join(',');

  const args = [
    '-i', indicatorPath,
    '-vf', vf,
    '-r', String(Math.round(fps) || 30),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k',
    '-y', outputPath
  ];

  try {
    await runProcess(ffmpegCmd, args, env);
  } catch (error) {
    const fallbackArgs = [
      '-i', indicatorPath,
      '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
      '-r', String(Math.round(fps) || 30),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      '-y', outputPath
    ];
    await runProcess(ffmpegCmd, fallbackArgs, env);
  }
}

/**
 * @param {{ sessions: Array<{ sessionId: string, files: string[] }>, gaps: Array<{ afterSessionIndex: number, indicatorPath: string, gapSeconds: number|null, gapKnown: boolean, fromSessionId: string, toSessionId: string }> }} segmentPlan
 */
async function resolveCombinedMergePaths(segmentPlan, outputDir, qualityOption, normalizedFormat, normalizeAudio) {
  const sessions = segmentPlan?.sessions || [];
  if (!sessions.length) {
    throw new Error('No sessions to merge.');
  }

  const referenceFile = sessions[0].files?.[0];
  if (!referenceFile) {
    throw new Error('Session has no video files.');
  }

  const env = buildFfmpegEnv(getFFmpegPath());
  const specs = await probeVideoStreamSpecs(referenceFile, env);
  const tempFiles = [];
  const sessionPaths = [];

  for (let i = 0; i < sessions.length; i++) {
    const files = (sessions[i].files || []).filter((f) => f && !path.basename(f).startsWith('._'));
    if (files.length === 0) continue;
    if (files.length === 1) {
      sessionPaths.push(files[0]);
    } else {
      const tempSession = path.join(outputDir, `session_part_${Date.now()}_${i}.mp4`);
      await concatVideoFiles(files, tempSession, qualityOption, normalizedFormat, normalizeAudio);
      tempFiles.push(tempSession);
      sessionPaths.push(tempSession);
    }
  }

  const gapsByIndex = new Map();
  for (const gap of segmentPlan.gaps || []) {
    if (typeof gap.afterSessionIndex === 'number') {
      gapsByIndex.set(gap.afterSessionIndex, gap);
    }
  }

  const finalPaths = [];
  const gapLog = [];

  for (let i = 0; i < sessionPaths.length; i++) {
    finalPaths.push(sessionPaths[i]);
    const gap = gapsByIndex.get(i);
    if (!gap || !gap.indicatorPath) continue;

    const overlayText = buildGapOverlayText(gap);
    const gapTemp = path.join(outputDir, `gap_indicator_${Date.now()}_${i}.mp4`);
    await renderGapIndicatorClip({
      indicatorPath: gap.indicatorPath,
      outputPath: gapTemp,
      width: specs.width,
      height: specs.height,
      fps: specs.fps,
      overlayText
    });
    tempFiles.push(gapTemp);
    finalPaths.push(gapTemp);
    gapLog.push({
      fromSessionId: gap.fromSessionId,
      toSessionId: gap.toSessionId,
      gapSeconds: gap.gapKnown ? gap.gapSeconds : null,
      gapKnown: !!gap.gapKnown
    });
  }

  return { finalPaths, tempFiles, gapLog };
}

module.exports = {
  buildGapOverlayText,
  escapeDrawtext,
  resolveCombinedMergePaths,
  renderGapIndicatorClip,
  concatVideoFiles
};
