import crypto from 'node:crypto';

const uuid = (prefix) => prefix + '-' + crypto.randomUUID();

function json(value, fallback) {
  return value == null ? fallback : value;
}

function mapProject(project) {
  return {
    id: project.id,
    ownerUserId: project.ownerUserId || null,
    title: project.title || 'Untitled Film',
    logline: project.logline || '',
    genre: project.genre || '',
    format: project.format || 'cinematic',
    status: project.status || 'draft'
  };
}

function mapStory(project) {
  const story = project.story || {};
  return {
    id: story.id || uuid('story'),
    projectId: project.id,
    premise: story.premise || project.premise || '',
    theme: story.theme || '',
    tone: story.tone || '',
    acts: json(story.acts, [])
  };
}

function mapCharacter(projectId, character) {
  return {
    id: character.id || uuid('character'),
    projectId,
    name: character.name || 'Unnamed Character',
    role: character.role || '',
    description: character.description || '',
    appearance: json(character.appearance, {}),
    wardrobe: json(character.wardrobe, {}),
    personality: json(character.personality, {}),
    relationships: json(character.relationships, []),
    voiceIdentity: json(character.voiceIdentity, {}),
    references: json(character.references, []),
    continuityConstraints: json(character.continuityConstraints, {})
  };
}

function mapScene(projectId, scene, locationId = null) {
  return {
    id: scene.id || uuid('scene'),
    projectId,
    screenplayId: null,
    sequenceId: null,
    number: Number(scene.number || scene.sequence || 1),
    slug: scene.slug || scene.title || '',
    locationId,
    timeOfDay: scene.timeOfDay || '',
    objective: scene.objective || scene.dramaticBeat || '',
    action: scene.action || scene.description || '',
    dialogue: scene.dialogue || '',
    emotionalState: { mood: scene.mood || '' },
    visualDirection: { blocking: scene.blocking || '', weather: scene.weather || '' },
    audioDirection: { audio: scene.audio || '' },
    status: scene.status || 'planned'
  };
}

function mapShot(projectId, shot) {
  return {
    id: shot.id || uuid('shot'),
    projectId,
    sceneId: shot.sceneId || null,
    number: Number(shot.number || shot.sequence || 1),
    purpose: shot.purpose || '',
    description: shot.description || '',
    action: shot.action || '',
    characterIds: json(shot.characterIds, shot.characters || []),
    propIds: json(shot.propIds, shot.props || []),
    framing: shot.framing || shot.shotType || '',
    angle: shot.angle || '',
    cameraId: shot.cameraId || '',
    lens: shot.lens || '',
    movement: shot.movement || '',
    cameraPosition: json(shot.cameraPosition, {}),
    blocking: json(shot.blocking, {}),
    lighting: json(shot.lighting, {}),
    visualStyle: json(shot.visualStyle, {}),
    duration: Number(shot.duration || 0) || null,
    fps: Number(shot.fps || 0) || null
  };
}

export function projectToCanonicalGraph(project) {
  if (!project?.id) throw new Error('A film project requires an id.');

  const characters = (project.characters || []).map(c => mapCharacter(project.id, c));
  const locations = (project.world?.locations || []).map(location => ({
    id: location.id || uuid('location'),
    projectId: project.id,
    name: typeof location === 'string' ? location : (location.name || 'Location'),
    description: typeof location === 'string' ? '' : (location.description || ''),
    environment: typeof location === 'string' ? {} : json(location.environment, {}),
    timeVariants: typeof location === 'string' ? {} : json(location.timeVariants, {}),
    lighting: typeof location === 'string' ? {} : json(location.lighting, {}),
    references: typeof location === 'string' ? [] : json(location.references, []),
    continuityConstraints: typeof location === 'string' ? {} : json(location.continuityConstraints, {})
  }));

  const locationByName = new Map(locations.map(l => [l.name.toLowerCase(), l.id]));
  const scenes = (project.scenes || []).map(scene => mapScene(
    project.id,
    scene,
    scene.locationId || locationByName.get(String(scene.location || '').toLowerCase()) || null
  ));

  const sceneIds = new Set(scenes.map(s => s.id));
  const shots = (project.shots || [])
    .filter(shot => !shot.sceneId || sceneIds.has(shot.sceneId))
    .map(shot => mapShot(project.id, shot));

  return {
    project: mapProject(project),
    story: mapStory(project),
    characters,
    locations,
    props: [],
    styles: [{
      projectId: project.id,
      visual: {},
      cinematography: {},
      color: {},
      lighting: {},
      framing: {},
      motion: {},
      audio: {},
      music: {}
    }],
    screenplay: {
      id: project.screenplayId || uuid('screenplay'),
      projectId: project.id,
      title: project.title || '',
      version: 1,
      status: 'draft',
      sourceFormat: 'structured',
      sourceText: ''
    },
    sequences: [],
    scenes,
    shots,
    events: [],
    dialogue: [],
    continuity: (project.continuity || []).map(item => ({
      id: item.id || uuid('continuity'),
      projectId: project.id,
      sceneId: item.sceneId || null,
      shotId: item.shotId || null,
      entityType: item.entityType || 'unknown',
      entityId: item.entityId || item.entity || '',
      state: { value: item.state || '', notes: item.notes || {} },
      sourceEventId: null
    })),
    assets: (project.assets || []).map(asset => ({
      ...asset,
      projectId: project.id,
      assetType: asset.assetType || asset.sourceType || 'media'
    })),
    takes: (project.takes || []).map(take => ({
      ...take,
      projectId: project.id,
      shotId: take.shotId || null,
      assetId: take.assetId || null,
      takeNumber: Number(take.takeNumber || 1),
      sourceType: take.sourceType || 'camera'
    }))
  };
}

export function createActionAndDependentAudioEvents({ projectId, sceneId, shotId, actionId, actionTimeMs, actionDurationMs = 0, sfxId, sfxOffsetMs = 0, payload = {}, sfxPayload = {} }) {
  if (!projectId || !shotId || !actionId || !sfxId) throw new Error('projectId, shotId, actionId and sfxId are required.');

  return [
    {
      id: actionId,
      projectId,
      sceneId: sceneId || null,
      shotId,
      eventType: 'ACTION',
      source: 'manual',
      timeMode: 'SHOT_RELATIVE',
      timeValueMs: Math.max(0, Number(actionTimeMs) || 0),
      durationMs: Math.max(0, Number(actionDurationMs) || 0),
      payload,
      sourceEventId: null,
      offsetMs: 0,
      status: 'planned'
    },
    {
      id: sfxId,
      projectId,
      sceneId: sceneId || null,
      shotId,
      eventType: 'SFX',
      source: 'derived',
      timeMode: 'EVENT_RELATIVE',
      timeValueMs: 0,
      durationMs: 0,
      payload: sfxPayload,
      sourceEventId: actionId,
      offsetMs: Number(sfxOffsetMs) || 0,
      status: 'planned'
    }
  ];
}

export function resolveEventTimeMs(event, eventsById) {
  if (!event) return null;
  if (event.timeMode === 'PROJECT_ABSOLUTE') return Number(event.timeValueMs) || 0;
  if (event.timeMode === 'SHOT_RELATIVE') return Number(event.timeValueMs) || 0;
  const source = eventsById.get(event.sourceEventId);
  if (!source) return null;
  const sourceTime = resolveEventTimeMs(source, eventsById);
  return sourceTime == null ? null : sourceTime + (Number(event.offsetMs) || 0) + (Number(event.timeValueMs) || 0);
}
