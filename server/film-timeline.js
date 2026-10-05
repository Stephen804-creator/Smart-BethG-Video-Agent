/**
 * Timeline projection from the canonical production graph.
 * This does not render media; it deterministically places linked clips/events.
 */

export function buildTimelineProjection(graph, { fps = 24 } = {}) {
  const events = graph?.events || [];
  const shots = graph?.shots || [];
  const eventsById = new Map(events.map(event => [event.id, event]));

  const resolveEvent = (event, seen = new Set()) => {
    if (!event || seen.has(event.id)) return null;
    if (event.timeMode !== 'EVENT_RELATIVE') return Number(event.timeValueMs || 0);
    seen.add(event.id);
    const source = resolveEvent(eventsById.get(event.sourceEventId), seen);
    return source == null ? null : source + Number(event.offsetMs || 0) + Number(event.timeValueMs || 0);
  };

  const clips = [];
  let cursor = 0;

  for (const shot of [...shots].sort((a, b) => Number(a.orderIndex || a.number || 0) - Number(b.orderIndex || b.number || 0))) {
    const durationMs = Math.max(0, Math.round(Number(shot.duration || 0) * 1000));
    clips.push({
      id: `clip-${shot.id}`,
      sourceType: 'shot',
      sourceId: shot.id,
      trackId: 'video-main',
      startMs: cursor,
      durationMs,
      inMs: 0,
      outMs: durationMs,
      eventIds: events.filter(event => event.shotId === shot.id).map(event => event.id)
    });

    for (const event of events.filter(item => item.shotId === shot.id)) {
      const time = resolveEvent(event);
      if (time == null) continue;
      clips.push({
        id: `event-${event.id}`,
        sourceType: event.eventType.toLowerCase(),
        sourceId: event.id,
        trackId: event.eventType === 'DIALOGUE' ? 'dialogue' : event.eventType === 'MUSIC' ? 'music' : event.eventType === 'SFX' ? 'sfx' : 'events',
        startMs: cursor + time,
        durationMs: Math.max(0, Number(event.durationMs || 0)),
        inMs: 0,
        outMs: Math.max(0, Number(event.durationMs || 0)),
        eventIds: [event.id]
      });
    }

    cursor += durationMs;
  }

  return { fps: Number(fps) || 24, durationMs: cursor, clips };
}
