export function buildProductionGraph(input = {}) {
  const storyPlan = input.storyPlan || {};
  const projectId = storyPlan.project?.id || 'project';
  return { schema_version: 'production-graph-v1', project_id: projectId, format: input.format || null, nodes: [], edges: [], summary: { nodes: 0, edges: 0, executable_tasks: 0 } };
}
