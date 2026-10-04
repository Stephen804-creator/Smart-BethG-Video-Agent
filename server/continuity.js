import { getGenerationFromDatabase } from './database.js';

export async function findGeneration(id) {
  if (!id) return null;
  const record = await getGenerationFromDatabase(id);
  if (!record) return null;
  return {
    id: record.id,
    output: record.output?.asset || record.output?.output || record.output || null,
    provider: record.provider,
    model: record.model,
    operation: record.operation
  };
}
