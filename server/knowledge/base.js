const KNOWLEDGE = [
  {
    id: 'cinematography.shot-types',
    domain: 'cinematography',
    title: 'Shot size and visual purpose',
    concepts: ['wide shot', 'medium shot', 'close-up', 'extreme close-up', 'establishing shot'],
    relationships: [
      ['establishing shot', 'establishes', 'location and spatial context'],
      ['close-up', 'emphasizes', 'facial reaction or detail'],
      ['wide shot', 'shows', 'environment and blocking']
    ],
    productionUse: 'Use shot size according to the story beat, subject relationship and information the audience needs.'
  },
  {
    id: 'cinematography.camera-movement',
    domain: 'cinematography',
    title: 'Camera movement',
    concepts: ['pan', 'tilt', 'dolly', 'tracking', 'push-in', 'pull-out', 'handheld'],
    relationships: [
      ['push-in', 'can-emphasize', 'attention, realization or tension'],
      ['tracking', 'can-follow', 'a moving subject'],
      ['pan', 'reveals', 'space or a new subject']
    ],
    productionUse: 'Camera movement should have a narrative or visual purpose rather than being added only for spectacle.'
  },
  {
    id: 'editing.j-cut-l-cut',
    domain: 'editing',
    title: 'J-cuts and L-cuts',
    concepts: ['J-cut', 'L-cut', 'audio transition', 'dialogue continuity'],
    relationships: [
      ['J-cut', 'starts-audio-before', 'the next picture'],
      ['L-cut', 'continues-audio-after', 'the picture changes']
    ],
    productionUse: 'Use audio overlap to create smoother scene transitions and control pacing.'
  },
  {
    id: 'audio.production-layers',
    domain: 'audio',
    title: 'Production sound layers',
    concepts: ['dialogue', 'ambience', 'foley', 'sound effects', 'music', 'mixing', 'mastering'],
    relationships: [
      ['ambience', 'supports', 'location and continuity'],
      ['foley', 'supports', 'physical actions'],
      ['music', 'supports', 'emotion and rhythm']
    ],
    productionUse: 'Plan audio alongside visuals; sound is part of the shot design, not an afterthought.'
  },
  {
    id: 'ai-video.temporal-consistency',
    domain: 'ai-video',
    title: 'Temporal and identity consistency',
    concepts: ['temporal consistency', 'character consistency', 'reference conditioning', 'seed', 'keyframe'],
    relationships: [
      ['reference conditioning', 'helps-preserve', 'visual identity'],
      ['temporal consistency', 'reduces', 'flicker and unstable motion']
    ],
    productionUse: 'Record references, seeds, workflow versions and evaluations so successful generations can be reproduced or improved.'
  }
];

export function searchKnowledge(query = '', domain = '') {
  const terms = String(query).toLowerCase().split(/\\s+/).filter(Boolean);
  return KNOWLEDGE
    .filter(item => !domain || item.domain === domain)
    .map(item => {
      const haystack = JSON.stringify(item).toLowerCase();
      const score = terms.reduce((n, term) => n + (haystack.includes(term) ? 1 : 0), 0);
      return { item, score };
    })
    .filter(result => result.score > 0 || !terms.length)
    .sort((a, b) => b.score - a.score)
    .map(result => result.item);
}

export function getKnowledgeEntry(id) {
  return KNOWLEDGE.find(item => item.id === id) || null;
}

export function listKnowledgeDomains() {
  return [...new Set(KNOWLEDGE.map(item => item.domain))];
}

export { KNOWLEDGE };
