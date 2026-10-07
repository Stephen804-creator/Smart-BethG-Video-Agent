import path from 'path';
import { getGenerationFromDatabase } from './database.js';
import { canonicalOutputUri, resolveMediaPath } from './media/storage.js';

export async function findGeneration(id, ownerUserId = null) {
  if (!id || !ownerUserId) return null;
  const record = await getGenerationFromDatabase(id, ownerUserId);
  if (!record) return null;

  const rawOutput = record.output?.asset || record.output?.output || record.output?.uri || record.output || null;
  const output = typeof rawOutput === 'string' ? canonicalOutputUri(rawOutput) : rawOutput;

  return {
    id: record.id,
    output,
    outputPath: typeof output === 'string'
      ? resolveMediaPath(output, {
          root: process.cwd(),
          outputDir: path.resolve(process.cwd(), 'output'),
          assetDir: path.resolve(process.cwd(), 'data/assets')
        })
      : null,
    provider: record.provider,
    model: record.model,
    operation: record.operation
  };
}
