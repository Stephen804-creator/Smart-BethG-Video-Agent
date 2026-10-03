function clean(value) {
  return String(value || '').trim();
}

function id(prefix, index) {
  return `${prefix}-${String(index + 1).padStart(3, '0')}`;
}

function extractNamedEntities(text, projectId = 'project') {
  const characters = new Set();
  const locations = new Set();
  const props = new Set();

  for (const match of text.matchAll(/(?:character|protagonist|hero|heroine|detective|captain|doctor|king|queen|agent)\s*[:=-]\s*([A-Z][\w-]*(?:\s+[A-Z][\w-]*)*)/g)) {
    characters.add(match[1].trim());
  }

  for (const match of text.matchAll(/(?:location|place|setting|at|inside|near)\s*[:=-]\s*([^,.\n]+)/gi)) {
    locations.add(match[1].trim());
  }

  for (const match of text.matchAll(/(?:prop|object|weapon|device|artifact)\s*[:=-]\s*([^,.\n]+)/gi)) {
    props.add(match[1].trim());
  }

  const entityState = [
    ...characters.map((character, index) => ({
      id: `${projectId}-character-${index + 1}`,
      type: 'character',
      name: character.name,
      state: character.state || {},
      continuity: character.continuity || {}
    })),
    ...locations.map((name, index) => ({
      id: `${projectId}-location-${index + 1}`,
      type: 'location',
      name,
      state: {},
      continuity: {}
    })),
    ...props.map((name, index) => ({
      id: `${projectId}-prop-${index + 1}`,
      type: 'prop',
      name,
      state: {},
      continuity: {}
    }))
  ];

  return {
    characters: [...characters],
    locations: [...locations],
    props: [...props]
  };
}

function splitIntoBeats(text) {
  const sentences = clean(text).split(/(?<=[.!?])\s+|\n+/).map(clean).filter(Boolean);
  if (sentences.length) return sentences;

  const clauses = clean(text).split(/[,;]+/).map(clean).filter(Boolean);
  return clauses.length ? clauses : [clean(text)];
}

function inferContinuity(previous, current) {
  if (!previous) return {
    spatial_anchor: 'Establish geography before cutting.',
    screen_direction: 'Preserve readable screen direction.',
    character_state: 'Track appearance, wardrobe and physical state.',
    prop_state: 'Track important object positions and conditions.',
    lighting: 'Keep lighting direction and time-of-day consistent unless intentionally changed.'
  };

  return {
    spatial_anchor: `Continue from ${previous.scene_id}; preserve established geography.`,
    screen_direction: 'Match movement direction and eyelines across the cut.',
    character_state: 'Carry forward wardrobe, injuries, pose and emotional state.',
    prop_state: 'Carry forward important props and their last known state.',
    lighting: 'Preserve established lighting unless the story explicitly changes it.'
  };
}

export function buildStoryPlan(input = {}) {
  const title = clean(input.title) || 'Untitled Project';
  const story = clean(input.story || input.prompt);
  if (!story) throw new Error('A story or project brief is required.');

  const suppliedCharacters = Array.isArray(input.characters) ? input.characters : [];
  const suppliedLocations = Array.isArray(input.locations) ? input.locations : [];
  const suppliedProps = Array.isArray(input.props) ? input.props : [];
  const projectId = input.projectId || `project-${Date.now()}`;
  const inferred = extractNamedEntities(story, projectId);

  const characters = [...new Map(
    [...suppliedCharacters.map(x => typeof x === 'string' ? { name: x } : x), ...inferred.characters.map(name => ({ name }))].map(x => [x.name, x])
  ).values()];

  const locations = [...new Set([...suppliedLocations, ...inferred.locations])];
  const props = [...new Set([...suppliedProps, ...inferred.props])];

  const beats = Array.isArray(input.beats) && input.beats.length
    ? input.beats.map(clean).filter(Boolean)
    : splitIntoBeats(story);

  const scenes = beats.map((beat, index) => {
    const previous = index ? scenes[index - 1] : null;
    const sceneId = id('scene', index);
    return {
      scene_id: sceneId,
      sequence: index + 1,
      story_beat: beat,
      purpose: index === 0 ? 'orientation' : index === beats.length - 1 ? 'resolution-or-cliffhanger' : 'development',
      location: locations[index] || locations[0] || null,
      characters: characters.map(c => c.name),
      continuity: inferContinuity(previous, { scene_id: sceneId }),
      shot_plan: [
        {
          shot_id: `${sceneId}-shot-001`,
          purpose: 'establish',
          framing: 'wide shot',
          camera: 'controlled reveal',
          description: `Establish the scene geography and the story beat: ${beat}`
        },
        {
          shot_id: `${sceneId}-shot-002`,
          purpose: 'action-or-dialogue',
          framing: 'medium shot',
          camera: 'motivated movement',
          description: `Show the primary action or interaction: ${beat}`
        },
        {
          shot_id: `${sceneId}-shot-003`,
          purpose: 'reaction-or-detail',
          framing: 'close-up',
          camera: 'subtle push-in',
          description: `Reveal the important reaction or detail: ${beat}`
        }
      ]
    };
  });

  return {
    schema_version: 'story-plan-v1',
    project: {
      id: projectId,
      title,
      logline: clean(input.logline) || story.slice(0, 280),
      genre: clean(input.genre) || null,
      format: clean(input.format) || 'feature',
      target_duration_minutes: Number(input.targetDurationMinutes || 90)
    },
    story: {
      premise: story,
      beats
    },
    entity_state: [
      ...characters.map((character, index) => ({ id: `${projectId}-character-${index + 1}`, type: 'character', name: character.name, state: character.state || {}, continuity: character.continuity || {} })),
      ...locations.map((name, index) => ({ id: `${projectId}-location-${index + 1}`, type: 'location', name, state: {}, continuity: {} })),
      ...props.map((name, index) => ({ id: `${projectId}-prop-${index + 1}`, type: 'prop', name, state: {}, continuity: {} }))
    ],
    world_bible: {
      characters,
      locations: locations.map(name => ({ name, continuity_notes: '' })),
      props: props.map(name => ({ name, continuity_notes: '' }))
    },
    scenes,
    production: {
      total_scenes: scenes.length,
      total_shots: scenes.reduce((n, scene) => n + scene.shot_plan.length, 0),
      continuity_tracking: ['character_state', 'prop_state', 'spatial_anchor', 'screen_direction', 'lighting']
    },
    dataset: {
      schema_version: 'story-dataset-v1',
      project_id: projectId,
      entities: {
        characters: characters.map(c => c.name),
        locations,
        props
      }
    }
  };
}
