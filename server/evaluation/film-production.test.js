import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFilmStore } from '../film-production.js';

function store() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cinematic-agent-'));
  const file = path.join(dir, 'film-projects.json');
  return createFilmStore(file);
}

test('film store links generated media through asset and take records', () => {
  const s = store();
  const project = s.createProject({ title: 'Test Film', ownerUserId: 'user-1' });
  const withScene = s.addScene(project.id, { title: 'Opening' });
  const sceneId = withScene.scenes[0].id;
  const withShot = s.addShot(project.id, { sceneId, description: 'Generated shot' });
  const shotId = withShot.shots[0].id;
  const asset = s.addAsset(project.id, {
    id: 'asset-gen-1',
    name: 'Generated Take',
    filename: 'gen-1.mp4',
    sourceType: 'generated',
    uri: '/output/gen-1.mp4',
    shotId
  });
  const take = s.addTake(project.id, {
    id: 'take-gen-1',
    shotId,
    assetId: asset.id,
    mediaUri: '/output/gen-1.mp4'
  });
  const selected = s.selectTake(project.id, shotId, take.id);
  const shot = selected.shots.find(item => item.id === shotId);
  assert.equal(shot.selectedTakeId, take.id);
  assert.equal(selected.takes.find(item => item.id === take.id).assetId, asset.id);
});

test('film store keeps production settings as editable shot data', () => {
  const s = store();
  const project = s.createProject({ title: 'Edit Test' });
  const scene = s.addScene(project.id, { title: 'Scene 1' });
  const updated = s.addShot(project.id, {
    sceneId: scene.scenes[0].id,
    edit: { trimIn: 1, trimOut: 4, speed: 1.5 },
    effects: { effect: 'film grain', intensity: 70 },
    audioMix: { dialogue: 100, music: 40, sfx: 80, ambience: 60 }
  });
  const shot = updated.shots[0];
  assert.equal(shot.edit.trimIn, 1);
  assert.equal(shot.edit.speed, 1.5);
  assert.equal(shot.effects.effect, 'film grain');
  assert.equal(shot.audioMix.music, 40);
});
