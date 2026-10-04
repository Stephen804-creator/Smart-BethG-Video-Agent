const BASE_URL = 'https://api.lumalabs.ai/dream-machine/v1';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function lumaHeaders(apiKey) {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`
  };
}

async function lumaRequest(apiKey, url, options = {}) {
  const timeoutMs = options.timeoutMs || 30_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...lumaHeaders(apiKey), ...(options.headers || {}) }
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`Luma request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text };
  }
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || `Luma API error (${response.status})`);
  }
  return data;
}

export async function generateWithLuma({ apiKey, prompt, ratio, model = 'ray-flash-2' }) {
  if (!apiKey) throw new Error('Luma API key is not configured. Add it in Settings.');

  const payload = {
    generation_type: 'video',
    prompt,
    model,
    aspect_ratio: ratio || '16:9',
    loop: false
  };

  const created = await lumaRequest(
    apiKey,
    `${BASE_URL}/generations/video`,
    { method: 'POST', body: JSON.stringify(payload) }
  );

  if (!created?.id) throw new Error('Luma accepted the request but returned no generation ID.');

  const deadline = Date.now() + 12 * 60 * 1000;
  let generation = created;

  while (Date.now() < deadline) {
    await sleep(4000);
    generation = await lumaRequest(
      apiKey,
      `${BASE_URL}/generations/${created.id}`,
      { method: 'GET' }
    );

    if (generation.state === 'completed') {
      const videoUrl = generation.assets?.video;
      if (!videoUrl) throw new Error('Luma completed the generation but returned no video asset.');
      return { generation, videoUrl };
    }

    if (generation.state === 'failed') {
      throw new Error(generation.failure_reason || 'Luma video generation failed.');
    }
  }

  throw new Error('Luma generation is still processing after 12 minutes. Check the Luma generation history.');
}
