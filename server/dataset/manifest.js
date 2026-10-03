import crypto from 'crypto';
import fs from 'fs';

export function createDatasetRecord({ task, result, evaluation = {}, worker = {}, soundPlan = null, knowledgeRefs = [] }) {
  return {
    dataset_id: crypto.randomUUID(),
    schema_version: 'media-dataset-v1',
    created_at: new Date().toISOString(),
    project: task.metadata?.projectId || null,
    scene: task.metadata?.sceneId || null,
    shot: task.metadata?.shotId || null,
    task: {
      domain: task.domain,
      operation: task.operation,
      purpose: task.purpose
    },
    creative_input: {
      prompt: task.prompt,
      negative_prompt: task.negativePrompt,
      requirements: task.requirements,
      continuity: task.continuity
    },
    production: {
      camera: task.metadata?.camera || {},
      lighting: task.metadata?.lighting || null,
      blocking: task.metadata?.blocking || null,
      sound: soundPlan
    },
    knowledge_refs: knowledgeRefs,
    execution: {
      worker_id: worker.id || null,
      runtime: worker.runtime || null,
      provider: worker.provider || null,
      model: task.metadata?.model || null,
      workflow: task.metadata?.workflow || null,
      seed: task.metadata?.seed ?? null,
      generation_id: result?.promptId || result?.generationId || null
    },
    output: {
      asset: result?.output || null,
      mime_type: 'video/mp4'
    },
    evaluation: {
      motion: evaluation.motion ?? null,
      prompt_adherence: evaluation.prompt_adherence ?? null,
      character_consistency: evaluation.character_consistency ?? null,
      temporal_consistency: evaluation.temporal_consistency ?? null,
      visual_quality: evaluation.visual_quality ?? null,
      audio_quality: evaluation.audio_quality ?? null,
      approved: evaluation.approved ?? null,
      notes: evaluation.notes || ''
    },
    licensing: {
      training_eligible: evaluation.trainingEligible ?? null,
      source_terms_verified: false,
      restrictions: []
    }
  };
}

export function appendDatasetRecord(file, record) {
  fs.appendFileSync(file, JSON.stringify(record) + '\n');
}
