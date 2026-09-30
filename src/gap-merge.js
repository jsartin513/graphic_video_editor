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

let activePrepProcess = null;

function killActiveGapPrepProcess() {
  if (activePrepProcess && !activePrepProcess.killed) {
    activePrepProcess.kill('SIGTERM');
  }
}

function runProcess(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env });
    activePrepProcess = child;
    let stderr = '';
    const clearActive = () => {
      if (activePrepProcess === child) activePrepProcess = null;
    };
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (error) => {
      clearActive();
      reject(error);
    });
    child.on('close', (code) => {
      clearActive();
      if (code === 0) resolve({ stderr });
      else reject(new Error(stderr || `${cmd} exited with code ${code}`));
    });
  });
}

function encodingSettings(qualityOption) {
  if (qualityOption === QUALITY_COPY || !QUALITY_SETTINGS[qualityOption]) {
    return { crf: '23', preset: 'fast' };
  }
  return QUALITY_SETTINGS[qualityOption];
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
    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-vf', vf,
    '-r', String(Math.round(fps) || 30),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '192k',
    '-shortest',
    '-y', outputPath
  ];

  try {
    await runProcess(ffmpegCmd, args, env);
  } catch (error) {
    const fallbackArgs = [
      '-i', indicatorPath,
      '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
      '-r', String(Math.round(fps) || 30),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '192k',
      '-shortest',
      '-y', outputPath
    ];
    await runProcess(ffmpegCmd, fallbackArgs, env);
  }
}

async function unlinkTempFiles(paths) {
  for (const filePath of paths || []) {
    if (filePath) {
      await fs.unlink(filePath).catch(() => {});
    }
  }
}

async function normalizeSegmentForConcat(inputPath, outputPath, specs, normalizeAudio, qualityOption) {
  const ffmpegCmd = getFFmpegPath();
  const env = buildFfmpegEnv(ffmpegCmd);
  const { crf, preset } = encodingSettings(qualityOption);
  const vf = [
    `scale=${specs.width}:${specs.height}:force_original_aspect_ratio=decrease`,
    `pad=${specs.width}:${specs.height}:(ow-iw)/2:(oh-ih)/2`
  ].join(',');
  const audioFilter = normalizeAudio
    ? 'loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,aformat=channel_layouts=stereo'
    : 'aresample=48000,aformat=channel_layouts=stereo';
  const args = [
    '-i', inputPath,
    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-filter_complex', `[0:v]${vf}[v];[0:a]${audioFilter}[a0];[1:a]asetpts=PTS-STARTPTS[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0[a]`,
    '-map', '[v]',
    '-map', '[a]',
    '-r', String(Math.round(specs.fps) || 30),
    '-c:v', 'libx264', '-preset', preset, '-crf', crf,
    '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '192k',
    '-shortest',
    '-y', outputPath
  ];
  try {
    await runProcess(ffmpegCmd, args, env);
  } catch {
    const fallbackArgs = [
      '-i', inputPath,
      '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-vf', vf,
      '-r', String(Math.round(specs.fps) || 30),
      '-c:v', 'libx264', '-preset', preset, '-crf', crf,
      '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '192k',
      '-shortest',
      '-y', outputPath
    ];
    await runProcess(ffmpegCmd, fallbackArgs, env);
  }
}

/**
 * @param {{ sessions: Array<{ sessionId: string, files: string[] }>, gaps: Array<{ afterSessionIndex: number, indicatorPath: string, gapSeconds: number|null, gapKnown: boolean, fromSessionId: string, toSessionId: string }> }} segmentPlan
 */
async function resolveCombinedMergePaths(segmentPlan, outputDir, qualityOption, normalizedFormat, normalizeAudio, shouldAbort) {
  const sessions = segmentPlan?.sessions || [];
  if (!sessions.length) {
    throw new Error('No sessions to merge.');
  }

  const referenceFile = sessions[0].files?.[0];
  if (!referenceFile) {
    throw new Error('Session has no video files.');
  }

  const tempFiles = [];
  const assertNotCancelled = () => {
    if (shouldAbort?.()) {
      throw new Error('Operation cancelled by user');
    }
  };

  try {
    const env = buildFfmpegEnv(getFFmpegPath());
    const specs = await probeVideoStreamSpecs(referenceFile, env);
    const sessionPaths = [];

    for (let i = 0; i < sessions.length; i++) {
      assertNotCancelled();
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

    const willInsertGaps = [...gapsByIndex.values()].some((gap) => gap?.indicatorPath);
    let segmentsForFinal = sessionPaths;
    if (willInsertGaps) {
      const normalizedPaths = [];
      for (let i = 0; i < sessionPaths.length; i++) {
        assertNotCancelled();
        const normTemp = path.join(outputDir, `session_norm_${Date.now()}_${i}.mp4`);
        await normalizeSegmentForConcat(sessionPaths[i], normTemp, specs, normalizeAudio, qualityOption);
        tempFiles.push(normTemp);
        normalizedPaths.push(normTemp);
      }
      segmentsForFinal = normalizedPaths;
    }

    const finalPaths = [];
    const gapLog = [];

    for (let i = 0; i < segmentsForFinal.length; i++) {
      assertNotCancelled();
      finalPaths.push(segmentsForFinal[i]);
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

    return {
      finalPaths,
      tempFiles,
      gapLog,
      segmentsPreparedForCopy: willInsertGaps
    };
  } catch (error) {
    await unlinkTempFiles(tempFiles);
    throw error;
  }
}

module.exports = {
  buildGapOverlayText,
  escapeDrawtext,
  resolveCombinedMergePaths,
  renderGapIndicatorClip,
  concatVideoFiles,
  killActiveGapPrepProcess
};
