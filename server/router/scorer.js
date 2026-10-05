import { trainingEligible } from './provider-contract.js';

function supportsTask(candidate, task) {
  const c = candidate.capabilities || {};
  if (task === 'text-to-video') return c.textToVideo;
  if (task === 'image-to-video') return c.imageToVideo;
  if (task === 'video-to-video') return c.videoToVideo;
  return false;
}

export function scoreProvider(candidate, request = {}) {
  const c = candidate.capabilities || {};
  let score = 0;

  if (!candidate.configured || candidate.implemented === false) return -Infinity;
  if (candidate.health && candidate.health.ok === false) return -Infinity;
  if (request.allowPaid === false && candidate.pricing === 'paid') return -Infinity;
  if (!supportsTask(candidate, request.task || 'text-to-video')) return -Infinity;
  if (!trainingEligible(candidate, request)) return -Infinity;

  if (request.task === 'text-to-video') score += 40;
  if (request.task === 'image-to-video') score += 45;
  if (request.task === 'video-to-video') score += 50;
  if (request.continuation && c.continuation) score += 25;

  if (request.preferLocal && (candidate.type === 'local' || candidate.type === 'local-or-remote')) score += 20;
  if (request.preferFree && candidate.pricing === 'free-quota') score += 20;
  if (request.preferLocal && candidate.pricing === 'local') score += 10;

  if (request.providerId && candidate.id === request.providerId) score += 1000;

  return score;
}

export function chooseProvider(candidates, request = {}) {
  const ranked = candidates
    .map(candidate => ({ candidate, score: scoreProvider(candidate, request) }))
    .filter(item => Number.isFinite(item.score) && item.score >= 0)
    .sort((a, b) => b.score - a.score);

  return {
    selected: ranked[0]?.candidate || null,
    ranked
  };
}
