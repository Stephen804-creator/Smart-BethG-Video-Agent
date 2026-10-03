import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { sampleVideoFrames } from './frame-sampler.js';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(command + ' exited with ' + code)));
  });
}

test('samples representative frames with evidence metadata', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cinematic-frame-test-'));
  const video = path.join(root, 'sample.mp4');
  const frames = path.join(root, 'frames');

  await run('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=24',
    '-t', '2', '-pix_fmt', 'yuv420p', video
  ]);

  const result = await sampleVideoFrames(video, { count: 3, outputRoot: frames, evaluationId: 'test-eval' });
  assert.equal(result.count, 3);
  assert.equal(result.frames.length, 3);
  assert.ok(result.frames.every(frame => frame.sizeBytes > 0));
  assert.ok(result.frames.every(frame => /^[a-f0-9]{64}$/.test(frame.sha256)));
  assert.deepEqual(result.frames.map(frame => frame.filename), ['frame-01.jpg', 'frame-02.jpg', 'frame-03.jpg']);
  assert.ok(result.frames.every(frame => fs.existsSync(frame.path)));
  assert.deepEqual(result.frames.map(frame => frame.timestampSeconds), [0.333, 1, 1.667]);
});
