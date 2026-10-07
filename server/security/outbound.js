import dns from 'node:dns/promises';
import net from 'node:net';
import https from 'node:https';

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
  const addresses = net.isIP(url.hostname) ? [url.hostname] : (await dns.lookup(url.hostname, { all: true })).map(item => item.address);
  const address = addresses[0];
  if (!address || isPrivateIp(address)) throw new Error('External media host resolved to a blocked address.');
  return new Promise((resolve, reject) => {
    let settled = false;
    let total = 0;
    const chunks = [];
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve(value);
    };
    const abort = () => request.destroy(signal?.reason || new Error('External media download cancelled.'));
    const request = https.request(url, {
      method: 'GET',
      lookup: (_hostname, _options, callback) => callback(null, address, net.isIP(address)),
      headers: { 'Accept': 'video/*,application/octet-stream' },
      timeout: timeoutMs
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400) {
        response.resume();
        return finish(new Error('External media redirects are not allowed.'));
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        return finish(new Error('External media download failed (' + response.statusCode + ').'));
      }
      const declared = Number(response.headers['content-length'] || 0);
      if (declared > maxBytes) {
        response.resume();
        return finish(new Error('External media exceeds the download size limit.'));
      }
      response.on('data', chunk => {
        total += chunk.length;
        if (total > maxBytes) {
          response.destroy(new Error('External media exceeds the download size limit.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => finish(null, Buffer.concat(chunks, total)));
      response.on('error', finish);
    });
    const timer = setTimeout(() => request.destroy(new Error('External media download timed out.')), timeoutMs);
    request.on('timeout', () => request.destroy(new Error('External media download timed out.')));
    request.on('error', finish);
    signal?.addEventListener('abort', abort, { once: true });
    request.end();
  });
}
