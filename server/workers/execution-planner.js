const VIDEO_OPERATIONS = new Set(['text-to-video', 'image-to-video', 'video-to-video']);

function mapOperation(node) {
  if (node.type !== 'visual-task') return null;
  if (['video-generation', 'cinematic-shot', 'anime-shot'].includes(node.operation)) return 'text-to-video';
  if (VIDEO_OPERATIONS.has(node.operation)) return node.operation;
  return null;
}

export function prepareExecutionPlan(graph = {}) {
  const executable = [];
  const blocked = [];
  for (const node of graph.nodes || []) {
    if (!['visual-task', 'audio-task'].includes(node.type)) continue;
    const operation = mapOperation(node);
    if (operation) executable.push({ job_id: node.id, source_node_id: node.id, domain: 'video', operation, purpose: node.purpose || node.stage, prompt: node.prompt || '', requirements: node.requirements || {}, status: 'ready' });
    else blocked.push({ job_id: node.id, source_node_id: node.id, type: node.type, operation: node.operation || node.purpose || null, status: 'blocked', reason: node.type === 'audio-task' ? 'Audio worker is not installed yet.' : 'No worker is installed for this visual operation yet.' });
  }
  return { schema_version: 'execution-plan-v1', project_id: graph.project_id || null, format: graph.format || null, executable, blocked, summary: { total: executable.length + blocked.length, ready: executable.length, blocked: blocked.length } };
}
