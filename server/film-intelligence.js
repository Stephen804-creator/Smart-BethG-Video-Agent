/**
 * Film Intelligence boundary.
 *
 * This module is intentionally deterministic. A future LLM adapter can produce
 * proposals against this context, but it cannot mutate production state directly.
 */

export function buildFilmIntelligenceContext(graph) {
  return {
    project: graph?.project || null,
    story: graph?.story || null,
    filmBible: {
      characters: graph?.characters || [],
      locations: graph?.locations || [],
      props: graph?.props || [],
      styles: graph?.styles || []
    },
    screenplay: graph?.screenplay || null,
    sequences: graph?.sequences || [],
    scenes: graph?.scenes || [],
    shots: graph?.shots || [],
    events: graph?.events || [],
    continuity: graph?.continuity || [],
    approvedTakes: (graph?.takes || []).filter(take => take.approvalState === 'APPROVED')
  };
}

export function createFilmProposal({ type, targetId, changes = {}, reason = '', expectedEffects = [] }) {
  if (!type || !targetId) throw new Error('A film proposal requires a type and targetId.');
  return {
    id: `proposal-${cryptoRandomId()}`,
    type,
    targetId,
    changes,
    reason,
    expectedEffects,
    status: 'PROPOSED',
    requiresApproval: true
  };
}

export function validateFilmProposal(proposal, graph) {
  const knownIds = new Set([
    graph?.project?.id,
    graph?.story?.id,
    ...(graph?.characters || []).map(x => x.id),
    ...(graph?.locations || []).map(x => x.id),
    ...(graph?.props || []).map(x => x.id),
    ...(graph?.scenes || []).map(x => x.id),
    ...(graph?.shots || []).map(x => x.id),
    ...(graph?.events || []).map(x => x.id)
  ].filter(Boolean));

  return {
    valid: Boolean(proposal?.targetId && knownIds.has(proposal.targetId)),
    requiresApproval: proposal?.requiresApproval !== false,
    reasons: proposal?.targetId && knownIds.has(proposal.targetId) ? [] : ['TARGET_NOT_IN_PROJECT']
  };
}

function cryptoRandomId() {
  return Math.random().toString(36).slice(2, 10);
}
