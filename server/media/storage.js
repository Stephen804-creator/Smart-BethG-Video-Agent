import fs from 'fs';
import path from 'path';

function cleanPublicUri(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/output/')) return '/output/' + path.basename(raw.slice('/output/'.length));
  if (raw.startsWith('/assets/')) return '/assets/' + path.basename(raw.slice('/assets/'.length));
  return '';
}

export function canonicalOutputUri(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/output/')) return '/output/' + path.basename(raw.slice('/output/'.length));
  if (raw.startsWith('/')) return '/output/' + path.basename(raw);
  return '/output/' + path.basename(raw);
}

export function resolveMediaPath(value, { root, outputDir, assetDir } = {}) {
  const raw = String(value || '').trim();
  if (!raw || !root || !outputDir || !assetDir) return null;

  const publicUri = cleanPublicUri(raw);
  if (publicUri.startsWith('/output/')) {
    const filename = path.basename(publicUri.slice('/output/'.length));
    const candidate = path.resolve(outputDir, filename);
    const base = path.resolve(outputDir) + path.sep;
    return candidate.startsWith(base) ? candidate : null;
  }

  if (publicUri.startsWith('/assets/')) {
    const filename = path.basename(publicUri.slice('/assets/'.length));
    const candidate = path.resolve(assetDir, filename);
    const base = path.resolve(assetDir) + path.sep;
    return candidate.startsWith(base) ? candidate : null;
  }

  const normalized = raw.replaceAll('\\', '/');
  const outputMarker = normalized.indexOf('/output/');
  if (outputMarker >= 0) return resolveMediaPath(normalized.slice(outputMarker), { root, outputDir, assetDir });

  const assetMarker = normalized.indexOf('/assets/');
  if (assetMarker >= 0) return resolveMediaPath(normalized.slice(assetMarker), { root, outputDir, assetDir });

  const filename = path.basename(normalized);
  const outputCandidate = path.resolve(outputDir, filename);
  const assetCandidate = path.resolve(assetDir, filename);
  const outputBase = path.resolve(outputDir) + path.sep;
  const assetBase = path.resolve(assetDir) + path.sep;

  if (fs.existsSync(outputCandidate) && outputCandidate.startsWith(outputBase)) return outputCandidate;
  if (fs.existsSync(assetCandidate) && assetCandidate.startsWith(assetBase)) return assetCandidate;
  return null;
}

export function mediaUriForPath(filePath, { outputDir, assetDir } = {}) {
  const resolved = path.resolve(filePath);
  const outputBase = path.resolve(outputDir) + path.sep;
  const assetBase = path.resolve(assetDir) + path.sep;
  if (resolved.startsWith(outputBase)) return '/output/' + path.basename(resolved);
  if (resolved.startsWith(assetBase)) return '/media-assets/' + path.basename(resolved);
  return '';
}
