import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseProvider } from '../router/scorer.js';

const local = {
  id: 'wan2.2-ti2v-5b',
  type: 'local',
  pricing: 'local',
  implemented: true,
  configured: true,
  capabilities: { textToVideo: true, imageToVideo: true, videoToVideo: false, continuation: false },
  policy: { trainingOutput: false }
};

const premium = {
  id: 'seedance-2.5',
  type: 'cloud',
  pricing: 'paid',
  implemented: true,
  configured: true,
  capabilities: { textToVideo: true, imageToVideo: true, videoToVideo: true, continuation: true },
  policy: { trainingOutput: false }
};

test('router prefers configured local model for production when local is preferred', () => {
  const result = chooseProvider([premium, local], {
    task: 'text-to-video',
    allowPaid: true,
    preferLocal: true,
    purpose: 'production'
  });
  assert.equal(result.selected.id, 'wan2.2-ti2v-5b');
});

test('router rejects providers that are not implemented', () => {
  const result = chooseProvider([{ ...premium, implemented: false }], {
    task: 'text-to-video',
    allowPaid: true,
    purpose: 'production'
  });
  assert.equal(result.selected, null);
});

test('training-data requests reject generation-only providers', () => {
  const result = chooseProvider([local, premium], {
    task: 'text-to-video',
    allowPaid: true,
    purpose: 'training-data'
  });
  assert.equal(result.selected, null);
});
