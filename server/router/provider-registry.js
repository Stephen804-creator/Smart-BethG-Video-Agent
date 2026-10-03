export const PROVIDERS = {
  'huggingface-ltx': {
    id: 'huggingface-ltx',
    name: 'Hugging Face • LTX Video',
    type: 'cloud',
    model: 'LTX Video 0.9.8 13B Distilled',
    auth: 'hf-token',
    capabilities: {
      textToVideo: true,
      imageToVideo: true,
      videoToVideo: true,
      continuation: true,
      audio: false
    },
    notes: 'Uses the configured Hugging Face Space and the account ZeroGPU quota.'
  },
  'luma-ray-flash': {
    id: 'luma-ray-flash',
    name: 'Luma • Ray Flash 2',
    type: 'cloud',
    model: 'ray-flash-2',
    auth: 'luma-api-key',
    capabilities: {
      textToVideo: true,
      imageToVideo: true,
      videoToVideo: false,
      continuation: false,
      audio: false
    },
    notes: 'Paid Luma API provider.'
  },
  'luma-ray-2': {
    id: 'luma-ray-2',
    name: 'Luma • Ray 2',
    type: 'cloud',
    model: 'ray-2',
    auth: 'luma-api-key',
    capabilities: {
      textToVideo: true,
      imageToVideo: true,
      videoToVideo: false,
      continuation: false,
      audio: false
    },
    notes: 'Paid Luma API provider.'
  },
  comfyui: {
    id: 'comfyui',
    name: 'ComfyUI • Open Models',
    type: 'local-or-remote',
    model: 'workflow-defined',
    auth: 'endpoint',
    capabilities: {
      textToVideo: false,
      imageToVideo: false,
      videoToVideo: false,
      continuation: false,
      audio: false
    },
    notes: 'Gateway slot for user-controlled workflows such as Wan or HunyuanVideo. Capability becomes available when a real workflow is configured.'
  }
};

export function listProviders(settings) {
  return Object.values(PROVIDERS).map(provider => ({
    ...provider,
    configured:
      provider.auth === 'hf-token'
        ? Boolean(settings?.hfToken || process.env.HF_TOKEN)
        : provider.auth === 'luma-api-key'
          ? Boolean(settings?.lumaApiKey || process.env.LUMAAI_API_KEY)
          : Boolean(settings?.comfyUrl),
  }));
}
