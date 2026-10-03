export function scoreProvider(candidate, request = {}) {
  const c = candidate.capabilities || {};
  let score = 0;

  if (!candidate.configured) return -Infinity;

  if (request.task === 'text-to-video' && c.textToVideo) score += 40;
  if (request.task === 'image-to-video' && c.imageToVideo) score += 45;
  if (request.task === 'video-to-video' && c.videoToVideo) score += 50;
  if (request.continuation && c.continuation) score += 25;

  if (request.preferLocal && candidate.type === 'local-or-remote') score += 20;
  if (request.preferFree && candidate.id === 'huggingface-ltx') score += 20;
  if (request.allowPaid === false && candidate.type === 'cloud' && candidate.id !== 'huggingface-ltx') score -= 100;

  return score;
}

export function chooseProvider(candidates, request = {}) {
  const ranked = candidates
    .map(candidate => ({ candidate, score: scoreProvider(candidate, request) }))
    .filter(item => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score);

  return {
    selected: ranked[0]?.candidate || null,
    ranked
  };
}
