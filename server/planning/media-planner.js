import { searchKnowledge } from '../knowledge/base.js';
import { normalizeSoundPlan } from '../sound/schema.js';

export function buildMediaPlan(input = {}) {
  const prompt = String(input.prompt || '').trim();
  const domain = input.domain || 'video';
  const knowledge = searchKnowledge(prompt, domain === 'video' ? '' : domain).slice(0, 5);

  const sound = normalizeSoundPlan({
    ambience: input.sound?.ambience || [
      { purpose: 'continuity', note: 'Capture or design location ambience appropriate to the scene.' }
    ],
    foley: input.sound?.foley || [],
    sfx: input.sound?.sfx || [],
    music: input.sound?.music || [],
    dialogue: input.sound?.dialogue || []
  });

  const camera = {
    shot_size: input.framing || 'medium shot',
    movement: input.cameraMovement || 'motivated camera movement',
    lighting: input.lighting || 'natural cinematic',
    composition: input.composition || 'subject and environment clearly readable'
  };

  const shot = {
    description: prompt,
    camera,
    sound,
    continuity: input.continuity || null
  };

  return {
    schema_version: 'media-plan-v1',
    plan_id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    task: { domain, operation: input.operation || 'text-to-video' },
    shot,
    knowledge: knowledge.map(item => ({
      id: item.id,
      domain: item.domain,
      title: item.title,
      productionUse: item.productionUse,
      relationships: item.relationships
    })),
    dataset: {
      knowledge_refs: knowledge.map(item => item.id),
      sound_planned: true,
      evaluation_fields: ['motion', 'prompt_adherence', 'character_consistency', 'temporal_consistency', 'visual_quality', 'audio_quality']
    }
  };
}
