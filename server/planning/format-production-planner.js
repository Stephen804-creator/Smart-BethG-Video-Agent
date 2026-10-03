import { getMediaFormat } from '../media/formats.js';
import { buildStoryPlan } from './story-planner.js';
import { buildProductionGraph } from './production-graph.js';

const FORMAT_PIPELINES = {
  'audio-story': {
    visual: { mode: 'none', tasks: [] },
    stages: ['story', 'voice', 'sound-design', 'mix'],
    requiredAssets: ['script', 'voice-profile'],
    taskTemplates: [
      ['voice', 'narration', 'Create narrator voice takes aligned to story beats.'],
      ['voice', 'dialogue', 'Create character dialogue takes and speaker timing.'],
      ['sound-design', 'ambience', 'Create location ambience and room tone.'],
      ['sound-design', 'foley', 'Create physical-action Foley synchronized to beats.'],
      ['sound-design', 'sfx', 'Create story-specific sound effects.'],
      ['sound-design', 'music', 'Create or select music cues for emotional beats.'],
      ['mix', 'mix', 'Assemble dialogue, ambience, Foley, SFX and music into a final audio timeline.']
    ]
  },
  'picture-story': {
    visual: { mode: 'images', tasks: ['image-generation', 'optional-image-motion'] },
    stages: ['story', 'visual-planning', 'image-generation', 'narration', 'sound-design', 'assembly'],
    requiredAssets: ['script', 'visual-references', 'story-images'],
    taskTemplates: [
      ['image-generation', 'visual-frame', 'Create one illustrative key image for each story beat or visual change.'],
      ['image-generation', 'image-motion', 'Optionally add a controlled pan, zoom or parallax move to selected images.'],
      ['narration', 'narration', 'Create narration timed to the visual sequence.'],
      ['assembly', 'captions', 'Create captions synchronized to narration or dialogue.'],
      ['sound-design', 'sound-design', 'Add ambience, Foley, SFX and music where they support the story.'],
      ['assembly', 'assembly', 'Assemble images, motion, narration, captions and sound into the final video.']
    ]
  },
  'motion-comic': {
    visual: { mode: 'animated-images', tasks: ['panel-generation', 'camera-motion'] },
    stages: ['story', 'character-design', 'panel-layout', 'panel-generation', 'motion', 'dialogue', 'sound-design', 'assembly'],
    requiredAssets: ['script', 'character-references', 'panel-references', 'background-assets'],
    taskTemplates: [
      ['character-design', 'character-sheet', 'Create consistent character sheets, expressions and pose references.'],
      ['panel-generation', 'panel', 'Create comic panels that cover the required story beats.'],
      ['motion', 'camera-motion', 'Animate panels with controlled pans, zooms, pushes and transitions.'],
      ['voice', 'dialogue', 'Create character dialogue and place dialogue balloons or subtitle timing.'],
      ['sound-design', 'sfx', 'Create impact and action sound effects synchronized to panel motion.'],
      ['sound-design', 'music', 'Create or select music cues.'],
      ['assembly', 'assembly', 'Assemble panels, motion, dialogue, captions and sound into the final video.']
    ]
  },
  'cinematic': {
    visual: { mode: 'video', tasks: ['shot-generation', 'coverage', 'continuity-check'] },
    stages: ['story', 'world-bible', 'character-bible', 'shot-design', 'reference-generation', 'video-generation', 'voice', 'sound-design', 'editing', 'quality-control'],
    requiredAssets: ['script', 'world-bible', 'character-bible', 'location-references', 'shot-list', 'continuity-state'],
    taskTemplates: [
      ['world-bible', 'world-bible', 'Define locations, rules, props and visual logic that must remain consistent.'],
      ['character-bible', 'character-bible', 'Define character appearance, wardrobe, identity and continuity anchors.'],
      ['shot-design', 'shot-design', 'Convert scenes into deliberate coverage with framing, lens intent, movement and blocking.'],
      ['reference-generation', 'reference-generation', 'Create reference images for characters, locations and important props.'],
      ['video-generation', 'video-generation', 'Generate individual shots using provider-neutral video tasks.'],
      ['voice', 'voice', 'Create dialogue and narration aligned to the edit.'],
      ['sound-design', 'sound-design', 'Build ambience, Foley, SFX and music around picture.'],
      ['editing', 'editing', 'Assemble shots using continuity, pacing and editorial intent.'],
      ['quality-control', 'quality-control', 'Evaluate motion, prompt adherence, identity, temporal consistency and audio.']
    ]
  },
  'anime': {
    visual: { mode: 'animated-video', tasks: ['character-animation', 'background-animation', 'camera-animation'] },
    stages: ['story', 'character-design', 'key-poses', 'background-design', 'layout', 'animation', 'voice', 'sound-design', 'editing', 'quality-control'],
    requiredAssets: ['script', 'character-sheets', 'expression-sheets', 'pose-references', 'background-designs', 'style-guide'],
    taskTemplates: [
      ['character-design', 'character-sheet', 'Create reusable character sheets with front, side, expression and wardrobe references.'],
      ['key-poses', 'key-poses', 'Define key poses and acting beats before animation.'],
      ['background-design', 'background', 'Create reusable backgrounds and environment references.'],
      ['layout', 'layout', 'Plan character placement, camera framing and screen direction.'],
      ['animation', 'animation', 'Animate character actions and environmental motion while preserving identity.'],
      ['voice', 'voice', 'Create dialogue and performance timing for each character.'],
      ['sound-design', 'sound-design', 'Create ambience, Foley, SFX and music appropriate to the sequence.'],
      ['editing', 'editing', 'Assemble animated shots and synchronize performance with sound.'],
      ['quality-control', 'quality-control', 'Check character consistency, motion, timing, style and continuity.']
    ]
  },
  'documentary': {
    visual: { mode: 'mixed', tasks: ['asset-selection', 'b-roll', 'graphics'] },
    stages: ['research', 'story', 'interview', 'archive', 'visual-assembly', 'narration', 'graphics', 'sound-design', 'editing', 'fact-check'],
    requiredAssets: ['research-notes', 'source-material', 'interview-assets', 'archival-assets', 'b-roll', 'graphics'],
    taskTemplates: [
      ['research', 'research', 'Organize claims, source material and evidence before visual production.'],
      ['interview', 'interview', 'Prepare interview segments, speakers and timing.'],
      ['archive', 'archive', 'Collect photographs, documents, maps or archival footage with provenance metadata.'],
      ['visual-assembly', 'b-roll', 'Plan real or generated supporting visuals for each narration beat.'],
      ['graphics', 'graphics', 'Create maps, charts, diagrams and explanatory graphics where useful.'],
      ['narration', 'narration', 'Create narration aligned to the evidence and edit structure.'],
      ['sound-design', 'sound-design', 'Add ambience, SFX and music without obscuring speech.'],
      ['editing', 'editing', 'Assemble interviews, archive, b-roll, graphics and narration.'],
      ['fact-check', 'fact-check', 'Track factual claims and their supporting sources before release.']
    ]
  },
  'explainer': {
    visual: { mode: 'mixed', tasks: ['diagram-generation', 'screen-visuals', 'motion-graphics'] },
    stages: ['problem-definition', 'script', 'visual-plan', 'graphics', 'screen-visuals', 'narration', 'captions', 'sound-design', 'assembly'],
    requiredAssets: ['script', 'visual-outline', 'diagrams', 'screen-visuals', 'brand-or-style-guide'],
    taskTemplates: [
      ['visual-plan', 'visual-plan', 'Map every narration beat to the visual that should explain it.'],
      ['graphics', 'diagram', 'Create diagrams, charts or visual metaphors for concepts that need explanation.'],
      ['screen-visuals', 'screen-visual', 'Capture or create interface/product visuals when the explanation requires them.'],
      ['visual-plan', 'motion-graphics', 'Animate key labels, diagrams and transitions without distracting from the explanation.'],
      ['narration', 'narration', 'Create clear narration with timing matched to visual explanation.'],
      ['captions', 'captions', 'Create synchronized captions for accessibility and silent viewing.'],
      ['sound-design', 'sound-design', 'Add restrained music, ambience and SFX.'],
      ['assembly', 'assembly', 'Assemble narration, visuals, graphics, captions and sound into the final video.']
    ]
  }
};

function normalizeGenre(input) {
  const value = String(input || '').trim();
  return value || 'unspecified';
}

function makeTaskId(stage, index) {
  return `format-task-${index + 1}-${stage}`;
}

function buildBeatPlan(input, storyPlan) {
  if (Array.isArray(input.beats) && input.beats.length) {
    return input.beats.map((beat, index) => ({
      beat_id: beat.id || `beat-${String(index + 1).padStart(3, '0')}`,
      description: String(beat.description || beat.text || '').trim(),
      scene_id: beat.sceneId || null,
      importance: beat.importance || 'normal'
    })).filter(beat => beat.description);
  }

  return (storyPlan?.scenes || []).flatMap(scene =>
    (scene.beats || []).map((beat, index) => ({
      beat_id: beat.id || `${scene.scene_id}-beat-${index + 1}`,
      description: beat.description || beat.text || '',
      scene_id: scene.scene_id,
      importance: beat.importance || 'normal'
    }))
  );
}

function makeVisualTask(formatId, beat, index, input) {
  if (formatId === 'audio-story') return null;

  const map = {
    'picture-story': {
      operation: 'image-generation',
      purpose: 'story-illustration',
      prompt: `Illustrate this story beat as a clear, visually descriptive frame: ${beat.description}`
    },
    'motion-comic': {
      operation: 'image-generation',
      purpose: 'comic-panel',
      prompt: `Create a consistent comic panel for this story beat: ${beat.description}`
    },
    'cinematic': {
      operation: 'video-generation',
      purpose: 'cinematic-shot',
      prompt: `Design a cinematic shot that communicates this story beat: ${beat.description}`
    },
    'anime': {
      operation: 'animation-generation',
      purpose: 'anime-shot',
      prompt: `Design an anime sequence that communicates this story beat while preserving established character and style references: ${beat.description}`
    },
    'documentary': {
      operation: 'mixed-visual',
      purpose: 'documentary-visual',
      prompt: `Plan documentary visuals that support this factual beat without inventing evidence: ${beat.description}`
    },
    'explainer': {
      operation: 'mixed-visual',
      purpose: 'explanatory-visual',
      prompt: `Plan the clearest visual explanation for this narration beat: ${beat.description}`
    }
  };

  const template = map[formatId];
  if (!template) return null;

  return {
    task_id: `visual-${String(index + 1).padStart(3, '0')}`,
    beat_id: beat.beat_id,
    domain: 'media',
    operation: template.operation,
    purpose: template.purpose,
    prompt: template.prompt,
    requirements: {
      aspectRatio: input.aspectRatio || '16:9',
      quality: input.quality || 'standard',
      characterConsistency: ['cinematic', 'anime', 'motion-comic'].includes(formatId),
      cameraControl: ['cinematic', 'anime', 'motion-comic', 'picture-story'].includes(formatId),
      audio: false
    }
  };
}

function makeAudioTasks(formatId, beats) {
  const tasks = [];

  const add = (purpose, description, domain = 'audio') => tasks.push({
    task_id: `audio-${tasks.length + 1}`,
    beat_ids: beats.map(beat => beat.beat_id),
    domain,
    operation: 'audio-planning',
    purpose,
    prompt: description
  });

  if (formatId === 'audio-story') {
    add('narration', 'Create narrator performance and timing for the complete story.');
    add('dialogue', 'Create character dialogue performances with speaker identity and timing.');
  } else if (['picture-story', 'motion-comic', 'cinematic', 'anime', 'documentary', 'explainer'].includes(formatId)) {
    add('voice', 'Create narration and/or dialogue aligned to the visual timeline.');
  }

  add('ambience', 'Create location and scene ambience that maintains continuity.');
  add('foley', 'Create synchronized physical-action Foley where visible actions need sound.');
  add('sfx', 'Create story-specific sound effects for important events.');
  add('music', 'Create or select music cues that support the intended emotional rhythm.');
  add('mix', 'Mix dialogue, ambience, Foley, SFX and music into a coherent final soundtrack.');

  return tasks;
}

function buildDatasetSchema(format, beats, visualTasks, audioTasks) {
  return {
    schema_version: 'format-dataset-v1',
    format: format.id,
    records: {
      story: ['project_id', 'genre', 'format', 'title', 'logline'],
      beats: ['beat_id', 'scene_id', 'description', 'importance'],
      visual_assets: visualTasks.length ? ['beat_id', 'asset_type', 'prompt', 'reference_assets', 'model', 'provider', 'workflow', 'seed', 'asset_uri'] : [],
      audio_assets: audioTasks.length ? ['beat_id', 'asset_type', 'voice_or_sound_id', 'timing', 'asset_uri'] : [],
      continuity: ['entity_id', 'scene_id', 'shot_id', 'state_before', 'changes', 'state_after'],
      evaluations: ['asset_id', 'quality', 'prompt_adherence', 'consistency', 'timing', 'approved', 'notes']
    },
    beat_count: beats.length,
    visual_task_count: visualTasks.length,
    audio_task_count: audioTasks.length
  };
}

export function buildFormatProductionPlan(input = {}) {
  const formatId = String(input.format || input.formatId || '').trim();
  const format = getMediaFormat(formatId);
  if (!format) throw new Error('A valid media format is required.');

  const genre = normalizeGenre(input.genre);
  const storyPlan = input.storyPlan || buildStoryPlan({
    title: input.title,
    logline: input.logline,
    story: input.story || input.prompt || '',
    characters: input.characters || [],
    locations: input.locations || [],
    props: input.props || []
  });

  const beats = buildBeatPlan(input, storyPlan);
  if (!beats.length) throw new Error('The production plan needs at least one story beat.');

  const pipeline = FORMAT_PIPELINES[format.id];
  if (!pipeline) throw new Error(`No production pipeline is registered for "${format.id}".`);

  const visualTasks = beats.map((beat, index) => makeVisualTask(format.id, beat, index, input)).filter(Boolean);
  const audioTasks = makeAudioTasks(format.id, beats);

  const stageTasks = pipeline.taskTemplates.map(([stage, purpose, description], index) => ({
    task_id: makeTaskId(stage, index),
    stage,
    domain: purpose === 'voice' || ['narration', 'dialogue', 'ambience', 'foley', 'sfx', 'music', 'mix'].includes(purpose) ? 'audio' : 'production',
    operation: purpose,
    purpose,
    prompt: description,
    status: 'planned'
  }));

  const productionGraph = buildProductionGraph({
    format: format.id,
    storyPlan,
    pipelineTasks: stageTasks,
    visualTasks,
    audioTasks
  });

  return {
    schema_version: 'format-production-plan-v1',
    plan_id: `format-plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    project: {
      title: input.title || storyPlan.title || 'Untitled Project',
      genre,
      format: format.id,
      format_name: format.name,
      visual_mode: format.visualMode,
      style_family: input.styleFamily || format.styleFamily || null
    },
    creative_intent: {
      logline: input.logline || storyPlan.logline || null,
      audience: input.audience || null,
      tone: input.tone || null,
      emotional_goal: input.emotionalGoal || null
    },
    production_model: {
      stages: pipeline.stages,
      required_assets: pipeline.requiredAssets,
      outputs: format.outputs,
      visual_tasks: pipeline.visual.tasks,
      beat_count: beats.length
    },
    story: {
      beats,
      story_plan: storyPlan
    },
    tasks: {
      pipeline: stageTasks,
      visual: visualTasks,
      audio: audioTasks
    },
    production_graph: productionGraph,
    continuity: {
      required: ['cinematic', 'anime', 'motion-comic'].includes(format.id),
      entities: storyPlan.world_bible || { characters: [], locations: [], props: [] },
      rule: 'Every generated asset should reference the relevant story, scene, beat and continuity state when applicable.'
    },
    routing: {
      provider_neutral: true,
      note: 'Production tasks describe capabilities and requirements. A provider/model is selected later by the media router.'
    },
    dataset: buildDatasetSchema(format, beats, visualTasks, audioTasks)
  };
}
