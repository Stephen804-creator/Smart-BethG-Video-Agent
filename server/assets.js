import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export function createAssetStore({ rootDir }) {
  const assetDir = path.resolve(rootDir);
  fs.mkdirSync(assetDir, { recursive: true });

  function safeName(originalName = 'asset') {
    const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '');
    return crypto.randomUUID() + (ext || '');
  }

  function saveUploadedFile(file) {
    if (!file?.path) throw new Error('No uploaded media file was received.');
    const filename = safeName(file.originalname);
    const destination = path.join(assetDir, filename);
    fs.renameSync(file.path, destination);
    return {
      id: crypto.randomUUID(),
      name: file.originalname || filename,
      filename,
      mimeType: file.mimetype || 'application/octet-stream',
      size: fs.statSync(destination).size,
      uri: '/assets/' + filename,
      sourceType: 'uploaded',
      createdAt: new Date().toISOString()
    };
  }

  return { saveUploadedFile };
}
