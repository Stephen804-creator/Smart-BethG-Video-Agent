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
      (a === 192 && b === 168) || a === 0;
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') ||
      normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb');
  }
  return true;
}

export async function assertSafeComfyUrl(rawUrl) {
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

  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('Production ComfyUI endpoints must use HTTPS.');
  }

  return url.toString().replace(/\/$/, '');
}
