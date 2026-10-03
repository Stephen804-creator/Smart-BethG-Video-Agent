import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

export async function sampleVideoFrames(filePath, options = {}) {
  if (!filePath || !fs.existsSync(filePath)) throw new Error('Video file does not exist.');
  const count = Math.max(1, Math.min(12, Number(options.count) || 5));
  const outputRoot = options.outputRoot || path.join(path.dirname(filePath), 'evaluation-frames');
  const evaluationId = options.evaluationId || crypto.randomUUID();
  const outputDir = path.join(outputRoot, evaluationId);
  fs.mkdirSync(outputDir, { recursive: true });

  const probe = await runCommand('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', filePath
  ]);
  const duration = Number(probe.stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Video duration could not be measured.');

  const frames = [];
  for (let i = 0; i < count; i += 1) {
    const timestamp = count === 1 ? duration / 2 : (duration * i) / (count - 1);
    const safeTime = Math.min(Math.max(timestamp, 0), Math.max(duration - 0.001, 0));
    const outputPath = path.join(outputDir, `frame-${String(i + 1).padStart(2, '0')}.jpg`);
    await runCommand('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-ss', safeTime.toFixed(3), '-i', filePath,
      '-frames:v', '1', '-q:v', '2', '-y', outputPath
    ], { timeoutMs: 120000 });
    const stat = fs.statSync(outputPath);
    frames.push({
      index: i,
      timestampSeconds: Number(safeTime.toFixed(3)),
      path: outputPath,
      filename: path.basename(outputPath),
      sizeBytes: stat.size,
      sha256: sha256(outputPath)
    });
  }

  return {
    schemaVersion: 'video-frame-samples-v1',
    evaluationId,
    source: filePath,
    durationSeconds: Number(duration.toFixed(3)),
    count: frames.length,
    frames
  };
}
