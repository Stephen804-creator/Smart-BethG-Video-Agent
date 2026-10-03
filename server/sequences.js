import fs from 'fs';

export function readSequences(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8').trim();
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeSequences(file, sequences) {
  fs.writeFileSync(file, JSON.stringify(sequences, null, 2));
}

export function createSequence(file, title = 'Untitled Sequence') {
  const sequences = readSequences(file);
  const sequence = {
    id: `seq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim() || 'Untitled Sequence',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    shots: []
  };
  sequences.push(sequence);
  writeSequences(file, sequences);
  return sequence;
}

export function addShotToSequence(file, sequenceId, generationId) {
  const sequences = readSequences(file);
  const sequence = sequences.find(item => item.id === sequenceId);
  if (!sequence) return null;
  if (!sequence.shots.includes(generationId)) sequence.shots.push(generationId);
  sequence.updatedAt = new Date().toISOString();
  writeSequences(file, sequences);
  return sequence;
}
