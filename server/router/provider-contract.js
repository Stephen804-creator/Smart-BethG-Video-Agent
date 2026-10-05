export const VIDEO_PROVIDER_CONTRACT = Object.freeze([
  'getCapabilities', 'validateRequest', 'submit', 'getStatus',
  'cancel', 'fetchOutput', 'normalizeResult'
]);

export function isVideoProvider(value) {
  return value && typeof value === 'object' && VIDEO_PROVIDER_CONTRACT.every(method => typeof value[method] === 'function');
}

export function assertVideoProvider(value, providerId = 'unknown') {
  if (!isVideoProvider(value)) throw new TypeError('Video provider "' + providerId + '" does not implement the normalized provider contract.');
  return value;
}

export function buildProviderRequest(input = {}) {
  const requirements = input.requirements || {};
  return {
    operation: input.operation || 'text-to-video',
    prompt: String(input.prompt || ''),
    purpose: input.purpose || 'production',
    duration: Number(input.duration || requirements.duration || 2),
    aspectRatio: input.aspectRatio || input.ratio || requirements.aspectRatio || '16:9',
    width: Number(input.width || requirements.width || 0) || null,
    height: Number(input.height || requirements.height || 0) || null,
    references: Array.isArray(input.references) ? input.references : [],
    referenceGenerationId: input.referenceGenerationId || null,
    metadata: input.metadata || {}
  };
}

export function trainingEligible(candidate, request = {}) {
  if (request.purpose !== 'training-data') return true;
  return candidate?.policy?.trainingOutput === true;
}
