export function normalizeMediaTask(input = {}) {
  const requirements = input.requirements || {};

  return {
    taskId: input.taskId || null,
    domain: input.domain || 'video',
    operation: input.operation || 'text-to-video',
    purpose: input.purpose || 'media-generation',
    prompt: String(input.prompt || '').trim(),
    negativePrompt: String(input.negativePrompt || '').trim(),
    input: input.input || {},
    requirements: {
      duration: Number(requirements.duration || input.duration || 5),
      width: Number(requirements.width || input.width || 1280),
      height: Number(requirements.height || input.height || 720),
      aspectRatio: requirements.aspectRatio || input.aspectRatio || '16:9',
      quality: requirements.quality || 'standard',
      characterConsistency: Boolean(requirements.characterConsistency),
      cameraControl: Boolean(requirements.cameraControl),
      audio: Boolean(requirements.audio)
    },
    constraints: {
      allowPaid: input.constraints?.allowPaid !== false,
      preferLocal: Boolean(input.constraints?.preferLocal),
      maxCost: input.constraints?.maxCost ?? null
    },
    continuity: input.continuity || null,
    metadata: input.metadata || {},
    sound: input.sound || {}
  };
}

export function validateMediaTask(task) {
  if (!task.prompt) throw new Error('A media task requires a prompt.');
  if (task.domain !== 'video') throw new Error('V1 currently executes video tasks only.');
  if (!['text-to-video', 'image-to-video', 'video-to-video'].includes(task.operation)) {
    throw new Error(`Unsupported video operation: ${task.operation}`);
  }
  if (!Number.isFinite(task.requirements.duration) || task.requirements.duration <= 0) {
    throw new Error('Video duration must be greater than zero.');
  }
  return true;
}
