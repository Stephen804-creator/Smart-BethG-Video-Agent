import { searchKnowledge } from '../knowledge/base.js';
import { normalizeSoundPlan } from '../sound/schema.js';

const DEFAULT_EVALUATION = [
  'motion',
  'prompt_adherence',
  'character_consistency',
  'temporal_consistency',
  'visual_quality',
  'audio_quality'
];

function inferShotSequence(prompt = '') {
  const text = prompt.trim();
  if (!text) return [];

  return [
    {
      shot_id: 'shot-001',
      purpose: 'establish',
      description: `Establish the environment and the subject before the main action: ${text}`,
      recommended_framing: 'wide shot',
      camera_movement: 'slow reveal or controlled dolly',
      duration_seconds: 4
    },
    {
      shot_id: 'shot-002',
      purpose: 'action',
      description: `Show the primary action clearly and preserve spatial continuity: ${text}`,
      recommended_framing: 'medium shot',
      camera_movement: 'motivated tracking or static camera',
      duration_seconds: 5
    },
    {
      shot_id: 'shot-003',
      purpose: 'reaction-or-detail',
      description: `Emphasize the most important reaction or visual detail from the action: ${text}`,
      recommended_framing: 'close-up',
      camera_movement: 'subtle push-in',
      duration_seconds: 3
    }
  ];
}

function inferSound(input = {}, shotSequence = []) {
  const explicit = input.sound || {};
  const ambience = explicit.ambience?.length
    ? explicit.ambience
    : [{ purpose: 'continuity', note: 'Maintain location-specific ambience across the scene.' }];

  const foley = explicit.foley?.length
    ? explicit.foley
    : [{ purpose: 'action', note: 'Synchronize physical-action sounds with visible movement.' }];

  const sfx = explicit.sfx || [];
  const music = explicit.music || [];

  return normalizeSoundPlan({
    dialogue: explicit.dialogue || [],
    ambience,
    foley,
    sfx,
    music,
    mix: explicit.mix || {},
    sync: shotSequence.map(shot => ({
      shot_id: shot.shot_id,
      note: 'Keep important sound events synchronized with picture.'
    }))
  });
}

export function buildMediaPlan(input = {}) {
  const prompt = String(input.prompt || '').trim();
  const domain = input.domain || 'video';
  const knowledge = searchKnowledge(prompt, domain === 'video' ? '' : domain).slice(0, 8);
  const shotSequence = input.shotSequence?.length ? input.shotSequence : inferShotSequence(prompt);

  const camera = {
    shot_size: input.framing || 'medium shot',
    movement: input.cameraMovement || 'motivated camera movement',
    lighting: input.lighting || 'natural cinematic',
    composition: input.composition || 'subject and environment clearly readable'
  };

  const sound = inferSound(input, shotSequence);

  return {
    schema_version: 'production-plan-v2',
    plan_id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    director_intent: {
      brief: prompt,
      visual_goal: input.visualGoal || null,
      emotional_goal: input.emotionalGoal || null,
      audience_context: input.audienceContext || null
    },
    scene: {
      description: prompt,
      camera_defaults: camera,
      continuity: input.continuity || null
    },
    shot_list: shotSequence,
    sound_plan: sound,
    knowledge: knowledge.map(item => ({
      id: item.id,
      domain: item.domain,
      title: item.title,
      concepts: item.concepts,
      productionUse: item.productionUse,
      relationships: item.relationships
    })),
    generation_tasks: shotSequence.map(shot => ({
      task_id: `task-${shot.shot_id}`,
      domain: 'video',
      operation: input.operation || 'text-to-video',
      purpose: shot.purpose,
      prompt: shot.description,
      requirements: {
        duration: shot.duration_seconds,
        aspectRatio: input.aspectRatio || '16:9',
        quality: input.quality || 'cinematic',
        characterConsistency: true,
        cameraControl: true,
        audio: false
      }
    })),
    dataset: {
      knowledge_refs: knowledge.map(item => item.id),
      sound_planned: true,
      evaluation_fields: DEFAULT_EVALUATION
    }
  };
}
