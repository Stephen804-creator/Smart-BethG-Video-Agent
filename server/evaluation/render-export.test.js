import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderShot, renderTimeline } from '../render/ffmpeg.js';

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

function ffprobe(input, entries) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', entries, '-of', 'default=noprint_wrappers=1:nokey=1', input], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test('renderShot produces playable generated-media output', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cinematic-render-'));
  const source = path.join(root, 'source.mp4');
  ffmpeg([
    '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=24',
    '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000',
    '-t', '1.2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', source
  ]);

  const rendered = await renderShot({
    inputPath: source,
    outputDir: path.join(root, 'renders'),
    edit: { trimIn: 0.1, trimOut: 1.0, speed: 1 },
    effects: { effect: 'cinematic contrast', intensity: 30 }
  });

  assert.ok(fs.existsSync(rendered.outputPath));
  assert.ok(Number(ffprobe(rendered.outputPath, 'format=duration')) > 0);
  assert.equal(ffprobe(rendered.outputPath, 'stream=codec_name').split('\n')[0], 'h264');
});

test('renderTimeline exports heterogeneous generated media into one playable file', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cinematic-timeline-'));
  const sourceA = path.join(root, 'a.mp4');
  const sourceB = path.join(root, 'b.mp4');

  ffmpeg([
    '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=24',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100',
    '-t', '1.0', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '44100', '-ac', '1', '-shortest', sourceA
  ]);
  ffmpeg([
    '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30',
    '-t', '1.0', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', sourceB
  ]);

  const exported = await renderTimeline({
    clips: [{ inputPath: sourceA }, { inputPath: sourceB }],
    outputDir: path.join(root, 'export')
  });

  assert.ok(fs.existsSync(exported.outputPath));
  const duration = Number(ffprobe(exported.outputPath, 'format=duration'));
  assert.ok(duration >= 1.5 && duration <= 2.5, `unexpected duration: ${duration}`);
  const dimensions = ffprobe(exported.outputPath, 'stream=width,height').split('\n').filter(Boolean);
  assert.deepEqual(dimensions.slice(0, 2), ['1280', '720']);
  assert.match(ffprobe(exported.outputPath, 'stream=codec_name'), /h264/);
});
