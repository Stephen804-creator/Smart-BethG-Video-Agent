/**
 * Auto Director orchestration plan.
 *
 * Planning is deterministic and durable: execution is delegated to the existing
 * job/provider system. The director never directly calls a model.
 */

export const DIRECTOR_STAGES = Object.freeze([
  'ANALYZE_PROJECT',
  'CHECK_FILM_BIBLE',
  'PLAN_SCREENPLAY',
  'PLAN_SCENES',
  'PLAN_SHOTS',
  'PLAN_EVENTS',
  'PLAN_CONTINUITY',
  'PLAN_MEDIA',
  'PLAN_AUDIO',
  'ASSEMBLE_TIMELINE',
  'RUN_QC',
  'REQUEST_APPROVAL'
]);

export function createAutoDirectorPlan(graph, { stages = DIRECTOR_STAGES } = {}) {
  const requested = new Set(stages);
  return DIRECTOR_STAGES.filter(stage => requested.has(stage)).map((stage, index) => ({
    id: `director-step-${index + 1}`,
    stage,
    projectId: graph?.project?.id || null,
    status: 'QUEUED',
    dependencies: index === 0 ? [] : [`director-step-${index}`],
    inputRefs: {
      scenes: (graph?.scenes || []).map(x => x.id),
      shots: (graph?.shots || []).map(x => x.id),
      events: (graph?.events || []).map(x => x.id)
    }
  }));
}

export function validateAutoDirectorPlan(plan) {
  const ids = new Set();
  const errors = [];
  for (const step of plan || []) {
    if (ids.has(step.id)) errors.push({ code: 'DUPLICATE_STEP', id: step.id });
    ids.add(step.id);
    for (const dependency of step.dependencies || []) {
      if (!ids.has(dependency)) errors.push({ code: 'INVALID_DEPENDENCY', step: step.id, dependency });
    }
  }
  return { valid: errors.length === 0, errors };
}
