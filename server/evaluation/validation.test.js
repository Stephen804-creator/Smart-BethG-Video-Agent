import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGenerateInput, validateMediaGenerateInput, validateProductionGraphInput } from '../validation.js';

test('generate input rejects empty prompts and invalid providers', () => {
  assert.throws(() => validateGenerateInput({ prompt: '' }), /scene description/);
  assert.throws(() => validateGenerateInput({ prompt: 'x', provider: 'fake' }), /Unknown provider/);
});

test('generate input normalizes valid duration and ratio', () => {
  const value = validateGenerateInput({ prompt: 'A train arrives', duration: '4', ratio: '21:9' });
  assert.equal(value.duration, 4);
  assert.equal(value.ratio, '21:9');
});

test('media input rejects unsupported operations', () => {
  assert.throws(() => validateMediaGenerateInput({ prompt: 'x', operation: 'audio-only' }), /Unsupported video operation/);
});

test('production graph requires bounded node objects', () => {
  assert.throws(() => validateProductionGraphInput({ productionGraph: {} }), /nodes/);
  assert.equal(validateProductionGraphInput({ productionGraph: { nodes: [{ id: 'shot-1' }] } }).nodes.length, 1);
});
