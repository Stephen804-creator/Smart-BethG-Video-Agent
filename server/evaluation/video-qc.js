import { spawn } from 'child_process';
import fs from 'fs';

function runCommand(command, args, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(reject, new Error(command + ' timed out after ' + timeoutMs + 'ms.'));
    }, timeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', error => finish(reject, error));
    child.on('close', code => {
      if (code === 0) return finish(resolve, { stdout, stderr });
      finish(reject, new Error(command + ' exited with code ' + code + ': ' + stderr.slice(-2000)));
    });
  });
}

function parseFps(value) {
  if (!value || !String(value).includes('/')) return Number(value) || null;
  const [a, b] = String(value).split('/').map(Number);
  return b ? a / b : null;
}

async function probeMedia(filePath) {
  const result = await runCommand('ffprobe', [
    '-v', 'error',
    '-show_streams',
    '-show_format',
    '-of', 'json',
    filePath
  ]);
  return JSON.parse(result.stdout || '{}');
}

async function decodeCheck(filePath) {
  try {
    await runCommand('ffmpeg', [
      '-v', 'error',
      '-i', filePath,
      '-map', '0:v:0',
      '-f', 'null',
      '-'
    ], { timeoutMs: 180000 });
    return { ok: true, errors: [] };
  } catch (error) {
    return { ok: false, errors: [error.message] };
  }
}

async function temporalCheck(filePath) {
  try {
    const result = await runCommand('ffmpeg', [
      '-hide_banner',
      '-i', filePath,
      '-vf', 'freezedetect=n=-60dB:d=1',
      '-an',
      '-f', 'null',
      '-'
    ], { timeoutMs: 180000 });
    const text = result.stderr || '';
    const starts = [...text.matchAll(/freeze_start:\s*([0-9.]+)/g)].map(m => Number(m[1]));
    const ends = [...text.matchAll(/freeze_end:\s*([0-9.]+)/g)].map(m => Number(m[1]));
    let longest = 0;
    for (let i = 0; i < Math.min(starts.length, ends.length); i += 1) {
      longest = Math.max(longest, ends[i] - starts[i]);
    }
    return {
      evaluated: true,
      freezeEvents: starts.length,
      longestFreezeSeconds: Number(longest.toFixed(3))
    };
  } catch (error) {
    return { evaluated: false, error: error.message };
  }
}

export async function evaluateVideoFile(filePath, options = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Video file does not exist.');
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error('Video path is not a file.');

  const probe = await probeMedia(filePath);
  const streams = Array.isArray(probe.streams) ? probe.streams : [];
  const video = streams.find(stream => stream.codec_type === 'video');
  const audio = streams.find(stream => stream.codec_type === 'audio');
  const duration = Number(probe.format?.duration || video?.duration || 0);
  const fps = parseFps(video?.avg_frame_rate || video?.r_frame_rate);
  const width = Number(video?.width || 0);
  const height = Number(video?.height || 0);
  const frameCount = Number(video?.nb_frames || 0) || null;
  const requestedDuration = Number(options.requestedDuration || 0) || null;
  const durationDelta = requestedDuration && duration
    ? Math.abs(duration - requestedDuration) / requestedDuration
    : null;

  const technical = {
    fileExists: true,
    fileSizeBytes: stat.size,
    playable: true,
    codec: video?.codec_name || null,
    container: probe.format?.format_name || null,
    width,
    height,
    fps: fps ? Number(fps.toFixed(3)) : null,
    frameCount,
    durationSeconds: Number(duration.toFixed(3)),
    hasAudio: Boolean(audio),
    audioCodec: audio?.codec_name || null,
    durationDeltaRatio: durationDelta === null ? null : Number(durationDelta.toFixed(3))
  };

  const findings = [];
  const add = (severity, code, message, evidence = {}) => findings.push({ severity, code, message, evidence });

  if (!video) add('FAIL', 'NO_VIDEO_STREAM', 'The file does not contain a video stream.');
  if (stat.size === 0) add('FAIL', 'EMPTY_FILE', 'The generated file is empty.');
  if (!duration || duration <= 0) add('FAIL', 'INVALID_DURATION', 'The video has no measurable duration.');
  if (!width || !height) add('FAIL', 'INVALID_DIMENSIONS', 'Video dimensions could not be measured.');
  if (!fps || fps <= 0) add('FAIL', 'INVALID_FPS', 'Video frame rate could not be measured.');
  if (requestedDuration && durationDelta !== null && durationDelta > 0.2) {
    add('REVIEW', 'DURATION_DEVIATION', 'Actual duration differs from the requested duration by more than 20%.', {
      requestedDuration,
      actualDuration: duration,
      deviationRatio: durationDelta
    });
  }

  const decode = await decodeCheck(filePath);
  if (!decode.ok) add('FAIL', 'DECODE_ERRORS', 'FFmpeg reported decoding errors.', { errors: decode.errors });

  const temporal = await temporalCheck(filePath);
  if (temporal.evaluated && temporal.longestFreezeSeconds >= 1.5) {
    add('REVIEW', 'LONG_FREEZE', 'A prolonged near-static interval was detected.', temporal);
  }

  const failures = findings.filter(item => item.severity === 'FAIL');
  const reviews = findings.filter(item => item.severity === 'REVIEW');
  const decision = failures.length ? 'FAIL' : reviews.length ? 'REVIEW' : 'PASS';

  return {
    schemaVersion: 'video-qc-v1',
    evaluator: 'cinematic-agent-technical-qc',
    evaluatedAt: new Date().toISOString(),
    decision,
    technical,
    temporal,
    dimensions: {
      technical_integrity: failures.length ? 0 : 1,
      imaging_quality: null,
      motion_smoothness: temporal.evaluated ? null : null,
      temporal_flickering: null,
      subject_consistency: null,
      background_consistency: null,
      prompt_adherence: null,
      cinematic_intent: null,
      continuity: null,
      audio_quality: audio ? null : null
    },
    findings,
    limitations: [
      'Semantic vision evaluation is not yet connected.',
      'Prompt adherence is not inferred without a vision/semantic evaluator.',
      'Character/reference consistency is not inferred without reference-aware vision evaluation.',
      'Audio quality is only detected as stream presence at this stage.'
    ]
  };
}
