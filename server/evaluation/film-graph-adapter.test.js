import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projectToCanonicalGraph,
  createActionAndDependentAudioEvents,
  resolveEventTimeMs
} from '../film-graph-adapter.js';

test('legacy film project maps to canonical stable project, scene and shot identities', () => {
  const graph = projectToCanonicalGraph({
    id: 'film-1',
    title: 'Test Film',
    ownerUserId: 'user-1',
    logline: 'A test.',
    genre: 'drama',
    premise: 'Premise',
    story: { theme: 'Trust', tone: 'Tense', premise: 'Premise', acts: [] },
    characters: [{ id: 'char-1', name: 'John', role: 'lead' }],
    world: { locations: [{ id: 'loc-1', name: 'Warehouse' }] },
    scenes: [{ id: 'scene-1', number: 1, title: 'Warehouse', location: 'Warehouse', action: 'John enters.' }],
    shots: [{ id: 'shot-1', sceneId: 'scene-1', number: 1, framing: 'medium', movement: 'static', duration: 4 }],
    takes: [],
    assets: [],
    continuity: []
  });

  assert.equal(graph.project.id, 'film-1');
  assert.equal(graph.characters[0].id, 'char-1');
  assert.equal(graph.locations[0].id, 'loc-1');
  assert.equal(graph.scenes[0].id, 'scene-1');
  assert.equal(graph.scenes[0].locationId, 'loc-1');
  assert.equal(graph.shots[0].id, 'shot-1');
  assert.equal(graph.shots[0].sceneId, 'scene-1');
});

test('event dependency keeps SFX synchronized with its source action', () => {
  const events = createActionAndDependentAudioEvents({
    projectId: 'film-1',
    sceneId: 'scene-1',
    shotId: 'shot-1',
    actionId: 'event-draw',
    actionTimeMs: 14200,
    sfxId: 'event-sfx',
    sfxOffsetMs: -20
  });

  const byId = new Map(events.map(event => [event.id, event]));
  assert.equal(resolveEventTimeMs(byId.get('event-draw'), byId), 14200);
  assert.equal(resolveEventTimeMs(byId.get('event-sfx'), byId), 14180);
});

test('relative event timing follows a moved source event', () => {
  const events = createActionAndDependentAudioEvents({
    projectId: 'film-1',
    sceneId: 'scene-1',
    shotId: 'shot-1',
    actionId: 'event-draw',
    actionTimeMs: 5000,
    sfxId: 'event-sfx',
    sfxOffsetMs: -20
  });

  events[0].timeValueMs = 7000;
  const byId = new Map(events.map(event => [event.id, event]));
  assert.equal(resolveEventTimeMs(byId.get('event-sfx'), byId), 6980);
});


test('legacy records without IDs receive migration-stable IDs and valid dialogue events', () => {
  const project = {
    id: 'film-stable',
    title: 'Stable Film',
    story: { premise: 'A premise.' },
    characters: [{ name: 'John' }],
    world: { locations: ['Warehouse'] },
    scenes: [{ number: 1, title: 'Warehouse', location: 'Warehouse' }],
    shots: [{ number: 1, sceneId: null, description: 'John enters.' }],
    dialogue: [{ text: 'Hello', startMs: 1000, endMs: 1500 }]
  };

  const first = projectToCanonicalGraph(project);
  const second = projectToCanonicalGraph(project);

  assert.equal(first.story.id, second.story.id);
  assert.equal(first.characters[0].id, second.characters[0].id);
  assert.equal(first.locations[0].id, second.locations[0].id);
  assert.equal(first.scenes[0].id, second.scenes[0].id);
  assert.equal(first.shots[0].id, second.shots[0].id);
  assert.equal(first.dialogue[0].id, second.dialogue[0].id);
  assert.equal(first.dialogue[0].eventId, second.dialogue[0].eventId);
  assert.equal(first.dialogue[0].eventId, first.events.find(e => e.id === first.dialogue[0].eventId)?.id);
  assert.equal(first.sequences[0], undefined);
});
