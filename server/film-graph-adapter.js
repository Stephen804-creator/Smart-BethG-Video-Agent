import crypto from 'node:crypto';

const stableId = (prefix, seed) => prefix + '-' + crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0, 24);

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
    id: story.id || stableId('story', project.id),
    projectId: project.id,
    premise: story.premise || project.premise || '',
    theme: story.theme || '',
    tone: story.tone || '',
    acts: json(story.acts, [])
  };
}

function mapCharacter(projectId, character, index) {
  return {
    id: character.id || stableId('character', projectId + ':' + index + ':' + (character.name || '')),
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

function mapScene(projectId, scene, index, locationId = null) {
  return {
    id: scene.id || stableId('scene', projectId + ':' + index + ':' + (scene.slug || scene.title || scene.number || '')),
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
    status: scene.status || 'planned',\n    orderIndex: Number(scene.orderIndex || index + 1)
  };
}

function mapShot(projectId, shot, index) {
  return {
    id: shot.id || stableId('shot', projectId + ':' + index + ':' + (shot.number || shot.sequence || shot.description || '')),
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
    fps: Number(shot.fps || 0) || null,\n    orderIndex: Number(shot.orderIndex || index + 1)
  };
}

export function projectToCanonicalGraph(project) {
  if (!project?.id) throw new Error('A film project requires an id.');

  const characters = (project.characters || []).map((c, i) => mapCharacter(project.id, c, i));
  const locations = (project.world?.locations || []).map((location, i) => ({
    id: location.id || stableId('location', project.id + ':' + i + ':' + (typeof location === 'string' ? location : location.name || '')),
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
  const screenplayId = project.screenplayId || stableId('screenplay', project.id);
  const sequences = (project.sequences || []).map((seq, index) => ({
    id: seq.id || stableId('sequence', project.id + ':' + index + ':' + (seq.title || seq.number || '')),
    projectId: project.id,
    screenplayId,
    number: Number(seq.number || index + 1),
    title: seq.title || '',
    purpose: seq.purpose || '',
    orderIndex: Number(seq.orderIndex || index + 1)
  }));
  const sequenceByNumber = new Map(sequences.map(s => [s.number, s.id]));

  const scenes = (project.scenes || []).map((scene, index) => {
    const mapped = mapScene(
      project.id,
      scene,
      index,
      scene.locationId || locationByName.get(String(scene.location || '').toLowerCase()) || null
    );
    return {
      ...mapped,
      screenplayId,
      sequenceId: scene.sequenceId || (scene.sequence != null ? sequenceByNumber.get(Number(scene.sequence)) : null)
    };
  });

  const sceneIds = new Set(scenes.map(s => s.id));
  const shots = (project.shots || [])
    .filter(shot => !shot.sceneId || sceneIds.has(shot.sceneId))
    .map((shot, i) => ({
      ...mapShot(project.id, shot, i),
      sceneId: shot.sceneId || scenes[i]?.id || null
    }))
    .filter(shot => shot.sceneId);

  const events = (project.events || []).map((event, i) => ({
    ...event,
    id: event.id || stableId('event', project.id + ':' + i + ':' + (event.eventType || '') + ':' + (event.timeValueMs || event.timeMs || 0)),
    projectId: project.id,
    timeMode: event.timeMode || 'SHOT_RELATIVE',
    timeValueMs: Number(event.timeValueMs || event.timeMs || 0),
    durationMs: Number(event.durationMs || 0),
    offsetMs: Number(event.offsetMs || 0),
    status: event.status || 'planned'
  }));

  const eventIds = new Set(events.map(event => event.id));
  const dialogue = (project.dialogue || []).map((d, i) => {
    let eventId = d.eventId || null;
    if (!eventId || !eventIds.has(eventId)) {
      eventId = stableId('dialogue-event', project.id + ':' + i + ':' + (d.text || ''));
      if (!eventIds.has(eventId)) {
        events.push({
          id: eventId,
          projectId: project.id,
          sceneId: d.sceneId || null,
          shotId: d.shotId || null,
          eventType: 'DIALOGUE',
          source: 'derived',
          timeMode: 'SHOT_RELATIVE',
          timeValueMs: Number(d.startMs || 0),
          durationMs: Math.max(0, Number((d.endMs ?? d.startMs ?? 0) - (d.startMs ?? 0))),
          payload: {},
          sourceEventId: null,
          offsetMs: 0,
          status: 'planned'
        });
        eventIds.add(eventId);
      }
    }
    return {
      ...d,
      id: d.id || stableId('dialogue', project.id + ':' + i + ':' + (d.text || '')),
      projectId: project.id,
      eventId,
      text: d.text || '',
      startMs: d.startMs ?? null,
      endMs: d.endMs ?? null
    };
  });

  return {
    project: mapProject(project),
    story: mapStory(project),
    characters,
    locations,
    props: (project.props || project.world?.props || []).map((prop, i) => ({\n      id: prop.id || stableId('prop', project.id + ':' + i + ':' + (prop.name || '')), projectId: project.id, name: prop.name || 'Prop', description: prop.description || '',\n      appearance: json(prop.appearance, {}), ownerCharacterId: prop.ownerCharacterId || null,\n      references: json(prop.references, []), continuityConstraints: json(prop.continuityConstraints, {})\n    })),
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
      id: screenplayId,
      projectId: project.id,
      title: project.title || '',
      version: 1,
      status: 'draft',
      sourceFormat: 'structured',
      sourceText: ''
    },
    sequences,
    scenes,
    shots,
    events: (project.events || []).map((event, i) => ({\n      ...event, id: event.id || stableId('event', project.id + ':' + i + ':' + (event.eventType || '') + ':' + (event.timeValueMs || event.timeMs || 0)), projectId: project.id, timeMode: event.timeMode || 'SHOT_RELATIVE',\n      timeValueMs: Number(event.timeValueMs || event.timeMs || 0), durationMs: Number(event.durationMs || 0), offsetMs: Number(event.offsetMs || 0),\n      status: event.status || 'planned'\n    })),
    dialogue: (project.dialogue || []).map((d, i) => ({\n      ...d, id: d.id || stableId('dialogue', project.id + ':' + i + ':' + (d.text || '')), projectId: project.id, eventId: d.eventId || null, text: d.text || '',\n      startMs: d.startMs ?? null, endMs: d.endMs ?? null\n    })),
    continuity: (project.continuity || []).map(item => ({
      id: item.id || stableId('continuity', project.id + ':' + (item.entityId || item.entity || '')),
      projectId: project.id,
      sceneId: item.sceneId || null,
      shotId: item.shotId || null,
      entityType: item.entityType || 'unknown',
      entityId: item.entityId || item.entity || '',
      state: { value: item.state || '', notes: item.notes || {} },
      sourceEventId: item.sourceEventId || null
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
