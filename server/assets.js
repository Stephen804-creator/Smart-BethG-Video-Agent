import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function probeMedia(filePath) {
  return new Promise(resolve => {
    const probe = spawn('ffprobe', [
      '-protocol_whitelist', 'file,pipe,crypto,data',
      '-v', 'error',
      '-show_entries', 'format=duration:stream=index,codec_name,codec_type,width,height,r_frame_rate',
      '-of', 'json',
      filePath
    ]);
    let output = '';
    probe.stdout.on('data', chunk => { output += chunk.toString(); });
    probe.on('error', () => resolve({ available: false }));
    probe.on('close', code => {
      if (code !== 0) return resolve({ available: false });
      try {
        const data = JSON.parse(output);
        const streams = Array.isArray(data.streams) ? data.streams : [];
        const video = streams.find(s => s.codec_type === 'video');
        const audio = streams.some(s => s.codec_type === 'audio');
        let fps = null;
        if (video?.r_frame_rate && video.r_frame_rate.includes('/')) {
          const [n, d] = video.r_frame_rate.split('/').map(Number);
          if (d) fps = Number((n / d).toFixed(3));
        }
        resolve({
          available: true,
          duration: Number.isFinite(Number(data.format?.duration)) ? Number(Number(data.format.duration).toFixed(3)) : null,
          width: Number.isFinite(Number(video?.width)) ? Number(video.width) : null,
          height: Number.isFinite(Number(video?.height)) ? Number(video.height) : null,
          fps,
          codec: video?.codec_name || '',
          hasAudio: audio
        });
      } catch {
        resolve({ available: false });
      }
    });
  });
}

export function createAssetStore({ rootDir }) {
  const assetDir = path.resolve(rootDir);
  fs.mkdirSync(assetDir, { recursive: true });

  function safeName(originalName = 'asset') {
    const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '');
    return crypto.randomUUID() + (ext || '');
  }

  async function saveUploadedFile(file) {
    if (!file?.path) throw new Error('No uploaded media file was received.');
    const filename = safeName(file.originalname);
    const destination = path.join(assetDir, filename);
    fs.renameSync(file.path, destination);
    try {
      const metadata = await probeMedia(destination);
      if (!metadata.available || !metadata.width || !metadata.height || !metadata.duration || metadata.duration <= 0) throw new Error('Uploaded file is not a valid video.');
      const sha256 = await hashFile(destination);
      return {
      id: crypto.randomUUID(),
      name: file.originalname || filename,
      filename,
      mimeType: file.mimetype || 'application/octet-stream',
      size: fs.statSync(destination).size,
      uri: '/media-assets/' + filename,
      sourceType: 'uploaded',
      sha256,
      ...metadata,
      createdAt: new Date().toISOString()
      };
    } catch (error) {
      try { fs.unlinkSync(destination); } catch {}
      throw error;
    }
  }

  return { saveUploadedFile, probeMedia };
}
