import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import crypto from 'crypto';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(command + ' failed with exit code ' + code + '. ' + (stderr.trim() || ''))));
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

async function probeDuration(inputPath) {
  const result = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', inputPath]);
  const value = Number.parseFloat(result.stdout.trim());
  if (!Number.isFinite(value)) throw new Error('Could not determine source duration.');
  return value;
}

function atempoChain(speed) {
  if (speed === 1) return null;
  let remaining = speed;
  const filters = [];
  while (remaining < 0.5) {
    filters.push('atempo=0.5');
    remaining /= 0.5;
  }
  while (remaining > 2) {
    filters.push('atempo=2');
    remaining /= 2;
  }
  filters.push('atempo=' + remaining.toFixed(6));
  return filters.join(',');
}

export async function renderShot({ inputPath, outputDir, edit = {}, effects = {}, audioMix = {} }) {
  if (!fs.existsSync(inputPath)) throw new Error('The selected source media file is not available.');
  fs.mkdirSync(outputDir, { recursive: true });

  const trimIn = Math.max(0, Number(edit.trimIn || 0));
  const trimOut = Math.max(0, Number(edit.trimOut || 0));
  const speed = clamp(Number(edit.speed || 1), 0.25, 4);
  const volume = clamp(Number(edit.volume == null ? 100 : edit.volume), 0, 200) / 100;
  const effect = String(effects.effect || 'none').toLowerCase();
  const intensity = clamp(Number(effects.intensity == null ? 50 : effects.intensity), 0, 100) / 100;
  const stabilizationRequested = Boolean(effects.stabilization);
  const sourceDuration = await probeDuration(inputPath);
  const effectiveDuration = trimOut > trimIn ? trimOut - trimIn : Math.max(0.01, sourceDuration - trimIn);

  const videoFilters = [];
  if (speed !== 1) videoFilters.push('setpts=PTS/' + speed);
  if (effect === 'black and white') videoFilters.push('hue=s=0');
  if (effect === 'cinematic contrast') videoFilters.push('eq=contrast=' + (1 + intensity * 0.45).toFixed(3) + ':brightness=' + (intensity * 0.04).toFixed(3) + ':saturation=' + (1 + intensity * 0.08).toFixed(3));
  if (effect === 'film grain') videoFilters.push('noise=alls=' + Math.round(4 + intensity * 18) + ':allf=t+u');
  if (effect === 'vignette') videoFilters.push('vignette=PI/' + (1.8 - intensity * 0.7).toFixed(2));
  if (effect === 'motion blur') videoFilters.push('tblend=all_mode=average');

  const transition = String(edit.transition || 'cut').toLowerCase();
  if (transition === 'fade') videoFilters.push('fade=t=in:st=0:d=0.35,fade=t=out:st=' + Math.max(0, effectiveDuration - 0.35).toFixed(3) + ':d=0.35');
  if (transition === 'dip to black') videoFilters.push('fade=t=in:st=0:d=0.35,fade=t=out:st=' + Math.max(0, effectiveDuration - 0.5).toFixed(3) + ':d=0.5:color=black');

  const audioFilters = [];
  const tempo = atempoChain(speed);
  if (tempo) audioFilters.push(tempo);
  if (volume !== 1) audioFilters.push('volume=' + volume.toFixed(3));

  const args = ['-y'];
  if (trimIn > 0) args.push('-ss', String(trimIn));
  args.push('-i', inputPath);
  if (trimOut > 0 && trimOut > trimIn) args.push('-t', String(trimOut - trimIn));
  if (videoFilters.length) args.push('-vf', videoFilters.join(','));
  if (audioFilters.length) args.push('-af', audioFilters.join(','));
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart');

  const filename = 'render-' + Date.now() + '-' + crypto.randomUUID().slice(0, 8) + '.mp4';
  const outputPath = path.join(outputDir, filename);
  args.push(outputPath);
  await run('ffmpeg', args);

  return {
    filename, outputPath, output: '/output/' + filename,
    applied: { trimIn, trimOut, speed, volume, effect, intensity, transition },
    limitations: [
      ...(effects.background && effects.background !== 'original' ? ['Background replacement/removal/blur requires a segmentation or compositing model and was not applied.'] : []),
      ...(effects.overlay ? ['Text/image overlays require a separate overlay asset and were not applied.'] : []),
      ...(stabilizationRequested ? ['Stabilization was requested but no guaranteed stabilization filter is assumed; no stabilization was applied.'] : []),
      ...(['cross dissolve', 'match cut'].includes(transition) ? [transition + ' requires adjacent shots; the single-shot renderer preserved the source cut.'] : []),
      ...(audioMix && Object.keys(audioMix).some(key => Number(audioMix[key]) !== 100) ? ['Dialogue/music/SFX/ambience levels require separate audio stems; only the master shot volume was applied.'] : [])
    ]
  };
}


export async function renderTimeline({ clips = [], outputDir }) {
  if (!Array.isArray(clips) || !clips.length) throw new Error('A timeline requires at least one clip.');
  fs.mkdirSync(outputDir, { recursive: true });
  const rendered = [];
  for (const clip of clips) {
    const item = await renderShot({
      inputPath: clip.inputPath,
      outputDir,
      edit: clip.edit || {},
      effects: clip.effects || {},
      audioMix: clip.audioMix || {}
    });
    rendered.push(item);
  }
  const listFile = path.join(outputDir, 'timeline-' + crypto.randomUUID() + '.txt');
  fs.writeFileSync(listFile, rendered.map(item => "file '" + item.outputPath.replace(/'/g, "'\\''") + "'").join('\n'));
  const filename = 'export-' + Date.now() + '-' + crypto.randomUUID().slice(0, 8) + '.mp4';
  const outputPath = path.join(outputDir, filename);
  try {
    await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', outputPath]);
  } finally {
    try { fs.unlinkSync(listFile); } catch {}
  }
  return {
    filename,
    outputPath,
    output: '/output/' + filename,
    clips: rendered,
    duration: await probeDuration(outputPath)
  };
}
