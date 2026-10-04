import test from 'node:test';
import assert from 'node:assert/strict';
import { secretsMatch } from '../security.js';
import { assertSafeComfyUrl } from '../security/outbound.js';

test('secret comparison requires exact non-empty values', () => {
  assert.equal(secretsMatch('abc', 'abc'), true);
  assert.equal(secretsMatch('abc', 'abd'), false);
  assert.equal(secretsMatch('', ''), false);
});

test('ComfyUI blocks loopback and private addresses', async () => {
  await assert.rejects(() => assertSafeComfyUrl('http://127.0.0.1:8188'));
  await assert.rejects(() => assertSafeComfyUrl('http://192.168.1.10:8188'));
  await assert.rejects(() => assertSafeComfyUrl('http://169.254.169.254/latest/meta-data'));
});

test('ComfyUI rejects embedded credentials', async () => {
  await assert.rejects(() => assertSafeComfyUrl('https://user:pass@example.com'));
});
