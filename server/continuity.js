import fs from 'fs';

export function findGeneration(generationsFile, id) {
  if (!id) return null;
  try {
    const lines = fs.readFileSync(generationsFile, 'utf8').trim().split('\n').filter(Boolean);
    return lines.map(line => JSON.parse(line)).find(record => record.id === id) || null;
  } catch {
    return null;
  }
}
