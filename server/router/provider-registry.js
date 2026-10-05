export const PROVIDERS = {
  'huggingface-ltx': {
    id: 'huggingface-ltx',
    name: 'Hugging Face • LTX Video',
    type: 'cloud',
    model: 'LTX Video 0.9.8 13B Distilled',
    auth: 'hf-token',
    pricing: 'free-quota',
    implemented: true,
    capabilities: { textToVideo: true, imageToVideo: true, videoToVideo: true, continuation: true, audio: false },
    policy: { generationOnly: true, trainingOutput: false },
    notes: 'Existing Hugging Face adapter. Output is production/generation data unless its exact terms permit training.'
  },

  'luma-ray-flash': {
    id: 'luma-ray-flash',
    name: 'Luma • Ray Flash 2',
    type: 'cloud',
    model: 'ray-flash-2',
    auth: 'luma-api-key',
    pricing: 'paid',
    implemented: true,
    capabilities: { textToVideo: true, imageToVideo: true, videoToVideo: false, continuation: false, audio: false },
    policy: { generationOnly: true, trainingOutput: false },
    notes: 'Paid Luma API provider. Training eligibility is not assumed.'
  },

  'luma-ray-2': {
    id: 'luma-ray-2',
    name: 'Luma • Ray 2',
    type: 'cloud',
    model: 'ray-2',
    auth: 'luma-api-key',
    pricing: 'paid',
    implemented: true,
    capabilities: { textToVideo: true, imageToVideo: true, videoToVideo: false, continuation: false, audio: false },
    policy: { generationOnly: true, trainingOutput: false },
    notes: 'Paid Luma API provider. Training eligibility is not assumed.'
  },

  'wan2.2-ti2v-5b': {
    id: 'wan2.2-ti2v-5b',
    name: 'Wan 2.2 • TI2V-5B',
    type: 'local',
    model: 'Wan2.2-TI2V-5B',
    auth: 'comfy-endpoint',
    pricing: 'local',
    runtime: 'comfyui',
    modelFamily: 'wan2.2',
    implemented: true,
    capabilities: { textToVideo: true, imageToVideo: true, videoToVideo: false, continuation: false, audio: false },
    policy: { generationOnly: false, trainingOutput: false, requiresLicenseReview: true },
    notes: 'Local/open-model profile routed through the configured ComfyUI workflow. Exact checkpoint license must be recorded before training or redistribution.'
  },

  'ltx-2.5': {
    id: 'ltx-2.5',
    name: 'LTX • 2.5',
    type: 'local',
    model: 'LTX-2.5',
    auth: 'comfy-endpoint',
    pricing: 'local',
    runtime: 'comfyui',
    modelFamily: 'ltx-2.5',
    implemented: true,
    capabilities: { textToVideo: true, imageToVideo: true, videoToVideo: true, continuation: true, audio: true },
    policy: { generationOnly: false, trainingOutput: false, requiresLicenseReview: true },
    notes: 'Local/customization profile. Use the exact LTX-2.x license and permitted derivative-training path.'
  },

  'vace-wan': {
    id: 'vace-wan',
    name: 'VACE • Wan control/editing',
    type: 'local',
    model: 'VACE + Wan',
    auth: 'comfy-endpoint',
    pricing: 'local',
    runtime: 'comfyui',
    modelFamily: 'vace-wan',
    implemented: true,
    capabilities: { textToVideo: false, imageToVideo: true, videoToVideo: true, continuation: true, audio: false },
    policy: { generationOnly: false, trainingOutput: false, requiresLicenseReview: true },
    notes: 'Local control/editing profile. Underlying Wan/VACE model licenses remain applicable.'
  },

  'seedance-2.5': {
    id: 'seedance-2.5',
    name: 'Seedance 2.5',
    type: 'cloud',
    model: 'Seedance 2.5',
    auth: 'seedance-api',
    pricing: 'paid',
    implemented: false,
    capabilities: { textToVideo: true, imageToVideo: true, videoToVideo: true, continuation: true, audio: true },
    policy: { generationOnly: true, trainingOutput: false },
    notes: 'Premium adapter slot. Implement only against the official API/contract; output is generation-only until explicit training permission is verified.'
  },

  'veo-3.1': {
    id: 'veo-3.1',
    name: 'Google • Veo 3.1',
    type: 'cloud',
    model: 'Veo 3.1',
    auth: 'google-video-api',
    pricing: 'paid',
    implemented: false,
    capabilities: { textToVideo: true, imageToVideo: true, videoToVideo: true, continuation: true, audio: true },
    policy: { generationOnly: true, trainingOutput: false },
    notes: 'Premium adapter slot. Keep Google-specific API calls out of film logic and verify the exact current service terms before any training use.'
  },

  comfyui: {
    id: 'comfyui',
    name: 'ComfyUI • Custom Workflow',
    type: 'local-or-remote',
    model: 'workflow-defined',
    auth: 'endpoint',
    pricing: 'user-controlled',
    implemented: true,
    capabilities: { textToVideo: true, imageToVideo: true, videoToVideo: true, continuation: true, audio: false },
    policy: { generationOnly: false, trainingOutput: false, requiresLicenseReview: true },
    notes: 'Generic gateway for user-controlled workflows. The selected workflow/model license must be recorded before using outputs for training.'
  }
};

export function listProviders(settings) {
  const activeProfile = String(settings?.comfyModelProfile || process.env.COMFYUI_MODEL_PROFILE || '').trim().toLowerCase();

  return Object.values(PROVIDERS).map(provider => {
    let configured = false;

    if (provider.auth === 'hf-token') {
      configured = true;
    } else if (provider.auth === 'luma-api-key') {
      configured = Boolean(settings?.lumaApiKey || process.env.LUMAAI_API_KEY);
    } else if (provider.auth === 'endpoint' || provider.auth === 'comfy-endpoint') {
      configured = Boolean(settings?.comfyUrl || process.env.COMFYUI_URL);
      if (provider.runtime === 'comfyui' && provider.id !== 'comfyui') {
        configured = configured && activeProfile === provider.modelFamily;
      }
    } else if (provider.auth === 'seedance-api') {
      configured = Boolean(process.env.SEEDANCE_API_KEY) && provider.implemented;
    } else if (provider.auth === 'google-video-api') {
      configured = Boolean(process.env.GOOGLE_VIDEO_API_KEY || process.env.GEMINI_API_KEY) && provider.implemented;
    }

    return { ...provider, configured };
  });
}
