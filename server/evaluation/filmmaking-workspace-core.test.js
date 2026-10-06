import test from 'node:test';
import assert from 'node:assert/strict';
import { projectToCanonicalGraph, createActionAndDependentAudioEvents, resolveEventTimeMs } from '../film-graph-adapter.js';
import { validateCanonicalFilmGraph } from '../film-graph-validation.js';
import { buildTimelineProjection } from '../film-timeline.js';
import { buildFilmIntelligenceContext, createFilmProposal, validateFilmProposal } from '../film-intelligence.js';

function sampleProject() {
  return {
    id: 'film-1',
    title: 'Test Film',
    logline: 'A test story.',
    genre: 'Drama',
    characters: [{ id: 'char-1', name: 'John', role: 'Lead', description: 'Lead character' }],
    world: { locations: [{ id: 'loc-1', name: 'Warehouse', description: 'Dark warehouse' }] },
    scenes: [{ id: 'scene-1', number: 1, title: 'The Draw', location: 'Warehouse', action: 'John draws a sword.' }],
    shots: [{ id: 'shot-1', sceneId: 'scene-1', number: 1, duration: 8, characters: ['char-1'], framing: 'medium' }],
    continuity: []
  };
}

test('legacy project maps to one canonical graph with stable IDs', () => {
  const graph = projectToCanonicalGraph(sampleProject());
  assert.equal(graph.project.id, 'film-1');
  assert.equal(graph.characters[0].id, 'char-1');
  assert.equal(graph.locations[0].id, 'loc-1');
  assert.equal(graph.scenes[0].locationId, 'loc-1');
  assert.equal(graph.shots[0].sceneId, 'scene-1');
});

test('relative SFX follows its action event', () => {
  const events = createActionAndDependentAudioEvents({
    projectId: 'film-1',
    sceneId: 'scene-1',
    shotId: 'shot-1',
    actionId: 'action-1',
    actionTimeMs: 14200,
    sfxId: 'sfx-1',
    sfxOffsetMs: -20
  });
  const byId = new Map(events.map(event => [event.id, event]));
  assert.equal(resolveEventTimeMs(byId.get('sfx-1'), byId), 14180);
});

test('graph validation detects broken shot relationships and event cycles', () => {
  const graph = projectToCanonicalGraph(sampleProject());
  graph.shots[0].sceneId = 'missing-scene';
  graph.events = [
    { id: 'a', shotId: 'shot-1', timeMode: 'EVENT_RELATIVE', timeValueMs: 0, sourceEventId: 'b', offsetMs: 0 },
    { id: 'b', shotId: 'shot-1', timeMode: 'EVENT_RELATIVE', timeValueMs: 0, sourceEventId: 'a', offsetMs: 0 }
  ];
  const result = validateCanonicalFilmGraph(graph);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.code === 'SHOT_SCENE_MISSING'));
  assert.ok(result.errors.some(error => error.code === 'EVENT_CYCLE'));
});

test('timeline projection places shot-relative events on the shot timeline', () => {
  const graph = projectToCanonicalGraph(sampleProject());
  graph.events = createActionAndDependentAudioEvents({
    projectId: 'film-1',
    sceneId: 'scene-1',
    shotId: 'shot-1',
    actionId: 'action-1',
    actionTimeMs: 4200,
    sfxId: 'sfx-1',
    sfxOffsetMs: -20,
    sfxPayload: { asset: 'sword-draw.wav' }
  });
  const timeline = buildTimelineProjection(graph);
  const sfx = timeline.clips.find(clip => clip.sourceId === 'sfx-1');
  assert.equal(sfx.startMs, 4180);
  assert.equal(timeline.durationMs, 8000);
});

test('Film Intelligence creates approval-gated proposals', () => {
  const graph = projectToCanonicalGraph(sampleProject());
  const context = buildFilmIntelligenceContext(graph);
  assert.equal(context.project.id, 'film-1');
  assert.equal(context.filmBible.characters.length, 1);

  const proposal = createFilmProposal({
    type: 'REWRITE_SCENE',
    targetId: 'scene-1',
    changes: { action: 'John hesitates before drawing.' },
    reason: 'Increase tension.'
  });
  assert.equal(proposal.requiresApproval, true);
  assert.equal(validateFilmProposal(proposal, graph).valid, true);
});
