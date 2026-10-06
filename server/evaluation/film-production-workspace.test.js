import test from 'node:test';
import assert from 'node:assert/strict';
import { projectToCanonicalGraph } from '../film-graph-adapter.js';
import { createAutoDirectorPlan, validateAutoDirectorPlan, DIRECTOR_STAGES } from '../auto-director.js';
import { APPROVAL_STATES } from '../film-production-governance.js';

test('Auto Director creates a dependency-ordered plan', () => {
  const graph = projectToCanonicalGraph({
    id: 'film-2',
    title: 'Director Test',
    scenes: [{ id: 'scene-2', number: 1, title: 'Opening' }],
    shots: [{ id: 'shot-2', sceneId: 'scene-2', number: 1, duration: 4 }]
  });
  const plan = createAutoDirectorPlan(graph);
  assert.equal(plan.length, DIRECTOR_STAGES.length);
  assert.deepEqual(plan[0].dependencies, []);
  assert.deepEqual(plan[1].dependencies, ['director-step-1']);
  assert.equal(validateAutoDirectorPlan(plan).valid, true);
});

test('Auto Director rejects a missing dependency', () => {
  const result = validateAutoDirectorPlan([{ id: 'step-2', dependencies: ['step-1'] }]);
  assert.equal(result.valid, false);
});

test('approval lifecycle contains explicit production states', () => {
  assert.ok(APPROVAL_STATES.includes('APPROVED'));
  assert.ok(APPROVAL_STATES.includes('SUPERSEDED'));
});
