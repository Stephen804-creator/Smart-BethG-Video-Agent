export const MEDIA_FORMATS = {
  audio_story: {
    id: 'audio-story',
    name: 'Audio Story',
    category: 'audio',
    description: 'Voice-led storytelling with dialogue, narration, ambience, music and sound effects. No generated video is required.',
    outputs: ['narration', 'dialogue', 'ambience', 'foley', 'sfx', 'music'],
    visualMode: 'none'
  },
  picture_story: {
    id: 'picture-story',
    name: 'Picture Story',
    category: 'visual-story',
    description: 'Narrated story built from illustrative images, with optional gentle image motion and transitions.',
    outputs: ['narration', 'images', 'captions', 'music', 'sfx'],
    visualMode: 'images'
  },
  motion_comic: {
    id: 'motion-comic',
    name: 'Motion Comic',
    category: 'visual-story',
    description: 'Comic or illustrated frames with camera movement, pans, zooms, transitions, dialogue and sound.',
    outputs: ['images', 'camera-motion', 'dialogue', 'captions', 'sfx', 'music'],
    visualMode: 'animated-images'
  },
  cinematic: {
    id: 'cinematic',
    name: 'Cinematic',
    category: 'film',
    description: 'Shot-based film production with cinematic coverage, generated video, dialogue, sound design, music and editing.',
    outputs: ['video', 'dialogue', 'ambience', 'foley', 'sfx', 'music', 'captions'],
    visualMode: 'video'
  },
  anime: {
    id: 'anime',
    name: 'Anime',
    category: 'animation',
    description: 'Animation-oriented production with character references, stylized backgrounds, motion, dialogue and sound.',
    outputs: ['animated-video', 'character-references', 'dialogue', 'sfx', 'music'],
    visualMode: 'animated-video',
    styleFamily: 'anime'
  },
  documentary: {
    id: 'documentary',
    name: 'Documentary',
    category: 'non-fiction',
    description: 'Narration/interviews combined with photographs, archival material, diagrams, maps, b-roll and generated visuals where appropriate.',
    outputs: ['narration', 'interviews', 'images', 'video', 'graphics', 'music', 'captions'],
    visualMode: 'mixed'
  },
  explainer: {
    id: 'explainer',
    name: 'Explainer',
    category: 'educational',
    description: 'Narration supported by diagrams, images, screen visuals, motion graphics and captions.',
    outputs: ['narration', 'graphics', 'images', 'screen-visuals', 'captions', 'music'],
    visualMode: 'mixed'
  }
};

export function listMediaFormats() {
  return Object.values(MEDIA_FORMATS);
}

export function getMediaFormat(id) {
  return MEDIA_FORMATS[id] || null;
}
