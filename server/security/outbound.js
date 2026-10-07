import dns from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  'host.docker.internal'
]);

function isPrivateIp(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const [a,b] = address.split('.').map(Number);
    return a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a === 0;
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') ||
      normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb');
  }
  return true;
}

export async function assertSafeExternalUrl(rawUrl, { requireHttps = false } = {}) {
  const value = String(rawUrl || '').trim();
  if (!value) throw new Error('ComfyUI URL is not configured.');

  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('ComfyUI URL must use HTTP or HTTPS.');
  if (url.username || url.password) throw new Error('ComfyUI URL must not contain embedded credentials.');

  const hostname = url.hostname.toLowerCase().replace(/^[|]$/g, '');
  if (BLOCKED_HOSTNAMES.has(hostname)) throw new Error('ComfyUI URL points to a blocked internal hostname.');

  const addresses = net.isIP(hostname) ? [hostname] : (await dns.lookup(hostname, { all: true })).map(item => item.address);
  if (!addresses.length || addresses.some(isPrivateIp)) {
    throw new Error('ComfyUI URL resolves to a private or internal network address and is blocked.');
  }

  if ((requireHttps || process.env.NODE_ENV === 'production') && url.protocol !== 'https:') throw new Error('External media endpoints must use HTTPS in production.');
  return url;
}

export async function assertSafeComfyUrl(rawUrl) {
  const url = await assertSafeExternalUrl(rawUrl);
  return url.toString().replace(/\/$/, '');
}

export async function fetchSafeExternalMedia(rawUrl, { signal, maxBytes = 100 * 1024 * 1024, timeoutMs = 120_000 } = {}) {
  const url = await assertSafeExternalUrl(rawUrl, { requireHttps: true });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('External media download timed out.')), timeoutMs);
  const onAbort = () => controller.abort(signal?.reason || new Error('External media download cancelled.'));
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await fetch(url, { redirect: 'manual', signal: controller.signal });
    if (response.status >= 300 && response.status < 400) throw new Error('External media redirects are not allowed.');
    if (!response.ok) throw new Error('External media download failed (' + response.status + ').');
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > maxBytes) throw new Error('External media exceeds the download size limit.');
    if (!response.body) throw new Error('External media response has no body.');
    const reader = response.body.getReader();
    const chunks = []; let total = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxBytes) { try { await reader.cancel(); } catch {} throw new Error('External media exceeds the download size limit.'); }
      chunks.push(Buffer.from(part.value));
    }
    return Buffer.concat(chunks, total);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
