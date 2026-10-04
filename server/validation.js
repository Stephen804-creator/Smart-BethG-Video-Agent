const ALLOWED_OPERATIONS = new Set(['text-to-video','image-to-video','video-to-video']);
const ALLOWED_RATIOS = new Set(['16:9','9:16','1:1','4:3','3:4','21:9','9:21']);
const ALLOWED_PROVIDERS = new Set(['auto','huggingface-ltx','luma-ray-flash','luma-ray-2','comfyui']);

function cleanString(value, field, max = 10000) {
  const text = String(value ?? '').trim();
  if (text.length > max) throw new Error(field + ' is too long (maximum ' + max + ' characters).');
  return text;
}

export function validateGenerateInput(input = {}) {
  const prompt = cleanString(input.prompt, 'prompt', 12000);
  if (!prompt) throw new Error('A scene description is required.');
  const provider = String(input.provider || 'auto');
  if (!ALLOWED_PROVIDERS.has(provider)) throw new Error('Unknown provider.');
  const duration = Number(input.duration ?? 2);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 60) throw new Error('duration must be between 0.1 and 60 seconds.');
  const ratio = String(input.ratio || '16:9');
  if (!ALLOWED_RATIOS.has(ratio)) throw new Error('Unsupported aspect ratio.');
  return { ...input, prompt, provider, duration, ratio };
}

export function validateMediaGenerateInput(input = {}) {
  const prompt = cleanString(input.prompt, 'prompt', 12000);
  if (!prompt) throw new Error('A media task requires a prompt.');
  const operation = String(input.operation || 'text-to-video');
  if (!ALLOWED_OPERATIONS.has(operation)) throw new Error('Unsupported video operation.');
  return { ...input, prompt, operation };
}

export function validateProductionGraphInput(input = {}) {
  const graph = input.productionGraph || input.production_graph || input;
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) throw new Error('productionGraph must be an object.');
  if (!Array.isArray(graph.nodes)) throw new Error('productionGraph.nodes must be an array.');
  if (graph.nodes.length > 500) throw new Error('productionGraph contains too many nodes.');
  for (const node of graph.nodes) {
    if (!node || typeof node !== 'object') throw new Error('Every production graph node must be an object.');
    if (!node.id) throw new Error('Every production graph node requires an id.');
  }
  return graph;
}

export { ALLOWED_OPERATIONS, ALLOWED_RATIOS, ALLOWED_PROVIDERS };
