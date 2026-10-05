/**
 * Deterministic validation for the canonical filmmaking graph.
 * AI may propose changes, but these rules decide whether the graph is coherent.
 */

export function validateCanonicalFilmGraph(graph) {
  const errors = [];
  const warnings = [];
  const ids = new Set();

  const addIds = (items, label) => {
    for (const item of items || []) {
      if (!item?.id) errors.push({ code: 'MISSING_ID', entity: label });
      else if (ids.has(item.id)) errors.push({ code: 'DUPLICATE_ID', id: item.id, entity: label });
      else ids.add(item.id);
    }
  };

  if (!graph?.project?.id) errors.push({ code: 'MISSING_PROJECT_ID' });
  addIds([graph?.project], 'project');
  addIds([graph?.story], 'story');
  addIds(graph?.characters, 'character');
  addIds(graph?.locations, 'location');
  addIds(graph?.props, 'prop');
  addIds(graph?.sequences, 'sequence');
  addIds(graph?.scenes, 'scene');
  addIds(graph?.shots, 'shot');
  addIds(graph?.events, 'event');
  addIds(graph?.dialogue, 'dialogue');
  addIds(graph?.assets, 'asset');
  addIds(graph?.takes, 'take');
  addIds(graph?.continuity, 'continuity');

  const sceneIds = new Set((graph.scenes || []).map(x => x.id));
  const shotIds = new Set((graph.shots || []).map(x => x.id));
  const characterIds = new Set((graph.characters || []).map(x => x.id));

  for (const shot of graph.shots || []) {
    if (!shot.sceneId || !sceneIds.has(shot.sceneId)) {
      errors.push({ code: 'SHOT_SCENE_MISSING', shotId: shot.id, sceneId: shot.sceneId || null });
    }
    for (const characterId of shot.characterIds || []) {
      if (!characterIds.has(characterId)) warnings.push({ code: 'UNKNOWN_SHOT_CHARACTER', shotId: shot.id, characterId });
    }
    if (shot.duration != null && Number(shot.duration) < 0) errors.push({ code: 'NEGATIVE_SHOT_DURATION', shotId: shot.id });
  }

  for (const event of graph.events || []) {
    if (event.shotId && !shotIds.has(event.shotId)) {
      errors.push({ code: 'EVENT_SHOT_MISSING', eventId: event.id, shotId: event.shotId });
    }
    if (event.sourceEventId && !ids.has(event.sourceEventId)) {
      errors.push({ code: 'EVENT_SOURCE_MISSING', eventId: event.id, sourceEventId: event.sourceEventId });
    }
    if (Number(event.timeValueMs) < 0 || Number(event.offsetMs) < 0 && event.timeMode !== 'EVENT_RELATIVE') {
      errors.push({ code: 'INVALID_EVENT_TIME', eventId: event.id });
    }
  }

  const eventsById = new Map((graph.events || []).map(event => [event.id, event]));
  const resolving = new Set();
  const resolved = new Map();

  const resolve = (event) => {
    if (!event) return null;
    if (resolved.has(event.id)) return resolved.get(event.id);
    if (resolving.has(event.id)) {
      errors.push({ code: 'EVENT_CYCLE', eventId: event.id });
      return null;
    }
    resolving.add(event.id);
    let value;
    if (event.timeMode === 'EVENT_RELATIVE') {
      value = resolve(eventsById.get(event.sourceEventId));
      if (value != null) value += Number(event.offsetMs || 0) + Number(event.timeValueMs || 0);
    } else {
      value = Number(event.timeValueMs || 0);
    }
    resolving.delete(event.id);
    resolved.set(event.id, value);
    return value;
  };

  for (const event of graph.events || []) {
    const time = resolve(event);
    if (time != null && time < 0) errors.push({ code: 'NEGATIVE_RESOLVED_EVENT_TIME', eventId: event.id, time });
  }

  return { valid: errors.length === 0, errors, warnings };
}
