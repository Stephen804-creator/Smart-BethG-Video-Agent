import { listKnowledgeDomains, listKnowledgeEntries, getKnowledgeEntry, searchKnowledge, getRelatedKnowledge } from './base.js';

export function buildKnowledgeContext(input = {}) {
  const query = [
    input.format,
    input.genre,
    input.workflowStage,
    input.operation,
    input.purpose,
    input.scenePurpose,
    input.framing,
    input.cameraMovement,
    input.lighting,
    ...(input.tags || [])
  ].filter(Boolean).join(' ');

  const primary = searchKnowledge(query, {
    domain: input.domain,
    workflowStage: input.workflowStage,
    limit: Number(input.limit || 8)
  });

  const related = getRelatedKnowledge(primary.map(item => item.id)).slice(0, Number(input.relatedLimit || 8));

  return {
    schema_version: 'knowledge-context-v1',
    query,
    primary,
    related,
    ids: [...new Set([...primary, ...related].map(item => item.id))]
  };
}

export function getKnowledgeCatalog() {
  return {
    schema_version: 'knowledge-catalog-v1',
    domains: listKnowledgeDomains(),
    entries: listKnowledgeEntries()
  };
}

export { getKnowledgeEntry };
