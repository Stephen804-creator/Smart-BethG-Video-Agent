function normalizeBaseUrl(url) {
  return String(url || 'http://127.0.0.1:8188').replace(/\/$/, '');
}

export async function getComfyHealth(baseUrl) {
  const url = normalizeBaseUrl(baseUrl);
  try {
    const response = await fetch(`${url}/system_stats`, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return { ok: false, url, detail: `HTTP ${response.status}` };
    const data = await response.json();
    return {
      ok: true,
      url,
      system: data.system || null,
      devices: Array.isArray(data.devices) ? data.devices : []
    };
  } catch (error) {
    return { ok: false, url, detail: error?.message || 'ComfyUI is unreachable.' };
  }
}

export async function queueComfyWorkflow(baseUrl, workflow, clientId = 'cinematic-agent') {
  const url = normalizeBaseUrl(baseUrl);
  const response = await fetch(`${url}/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: clientId })
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text }; }
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.detail || `ComfyUI queue failed (${response.status})`);
  }
  return data;
}

export async function getComfyHistory(baseUrl, promptId) {
  const url = normalizeBaseUrl(baseUrl);
  const response = await fetch(`${url}/history/${encodeURIComponent(promptId)}`, {
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error(`ComfyUI history request failed (${response.status})`);
  return response.json();
}
