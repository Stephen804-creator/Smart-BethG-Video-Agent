const KNOWLEDGE = [
  {
    id: 'cinematography.shot-types',
    domain: 'cinematography',
    title: 'Shot size and visual purpose',
    definition: 'Shot size controls how much of the subject and environment the audience sees and therefore what information or emotion receives emphasis.',
    purpose: 'Choose framing from the story beat, audience information need and editorial purpose.',
    whenToUse: ['Use a wide or establishing shot when geography matters.', 'Use medium framing for interaction and readable action.', 'Use close or extreme close framing for reaction, detail or emotional emphasis.'],
    whenNotToUse: ['Do not use a tight shot when the audience still needs to understand where the subjects are.'],
    relationships: [['establishing shot','establishes','geography'],['medium shot','covers','interaction'],['close-up','emphasizes','reaction or detail']],
    diagnosticRules: ['If a scene is visually confusing, check whether geography was established before tight coverage.'],
    aiImplications: ['Match framing to the reference image and requested camera behavior.', 'Evaluate whether the generated result actually preserves the intended shot size.'],
    source: 'internal-production-standard',
    version: '2.0',
    confidence: 0.95
  },
  {
    id: 'cinematography.camera-movement',
    domain: 'cinematography',
    title: 'Motivated camera movement',
    definition: 'Camera movement should communicate attention, geography, energy, emotion or subject following rather than exist only as decoration.',
    purpose: 'Give every movement a narrative or visual reason.',
    whenToUse: ['Use tracking for subject following.', 'Use a push-in for growing attention or tension.', 'Use a pan or reveal when information is intentionally introduced.'],
    whenNotToUse: ['Avoid unnecessary movement that competes with the acting or makes continuity harder to maintain.'],
    relationships: [['tracking','follows','subject'],['push-in','emphasizes','attention'],['pan','reveals','space or subject']],
    diagnosticRules: ['If motion feels arbitrary, identify the story beat the movement is supposed to serve.'],
    aiImplications: ['Record requested and observed movement separately because video models may introduce unintended camera motion.'],
    source: 'internal-production-standard',
    version: '2.0',
    confidence: 0.95
  },
  {
    id: 'visual-storytelling.blocking-eyelines',
    domain: 'visual-storytelling',
    title: 'Blocking, eyelines and screen direction',
    definition: 'Blocking defines where subjects move and relate in space; eyelines and screen direction help the audience maintain a stable mental map.',
    purpose: 'Preserve spatial comprehension across coverage and cuts.',
    whenToUse: ['Plan entrances, exits, facing direction and important eyelines before generation or shooting.'],
    whenNotToUse: ['Do not change screen direction casually between adjacent shots when the change is not motivated.'],
    relationships: [['blocking','defines','spatial relationships'],['eyeline','connects','subject and target'],['screen direction','supports','continuity']],
    diagnosticRules: ['Flag reversed movement, mismatched eyelines and unexplained position changes between connected shots.'],
    aiImplications: ['Include spatial anchors and reference frames in generation tasks where continuity matters.'],
    source: 'internal-production-standard',
    version: '2.0',
    confidence: 0.96
  },
  {
    id: 'production.shot-list',
    domain: 'production',
    title: 'Shot lists and coverage',
    definition: 'A shot list converts story and scene intent into deliberate, ordered coverage that can be produced, evaluated and edited.',
    purpose: 'Prevent blind generation or shooting of an entire scene without editorial coverage.',
    whenToUse: ['Create coverage before production.', 'Give each shot a purpose, framing, camera intent and continuity context.'],
    whenNotToUse: ['Do not treat the shot list as immutable when production discoveries require a documented change.'],
    relationships: [['scene','contains','shots'],['coverage','supports','editing choices'],['shot','produces','take or generated asset']],
    diagnosticRules: ['Flag scenes with no establishing/context shot, no action coverage, or no useful reaction/detail where the beat requires it.'],
    aiImplications: ['Each generated clip should map to a shot record and retain prompt, model, workflow and evaluation metadata.'],
    source: 'internal-production-standard',
    version: '2.0',
    confidence: 0.97
  },
  {
    id: 'continuity.entity-state',
    domain: 'continuity',
    title: 'Entity state continuity',
    definition: 'Characters, props and locations have states that change through scenes and must be resolved in production order.',
    purpose: 'Keep wardrobe, injuries, object positions, lighting conditions and other story facts consistent.',
    whenToUse: ['Resolve state before planning a shot that depends on a previous event.'],
    whenNotToUse: ['Do not overwrite history when a change should be represented as a new event.'],
    relationships: [['entity','has','state'],['event','changes','state'],['shot','references','entity state']],
    diagnosticRules: ['Flag a shot when required entity state is missing or conflicts with the previous production event.'],
    aiImplications: ['Pass relevant state and reference assets to generation tasks rather than relying only on the original story prompt.'],
    source: 'internal-production-standard',
    version: '2.0',
    confidence: 0.97
  },
  {
    id: 'ai-video.reference-conditioning',
    domain: 'ai-video',
    title: 'Reference-driven generation',
    definition: 'Reference images, videos and keyframes provide explicit visual anchors for identity, appearance, composition or motion.',
    purpose: 'Improve repeatability and continuity across generated assets.',
    whenToUse: ['Use character references for identity-sensitive shots.', 'Use location references when environment continuity matters.', 'Use previous approved frames when a transition depends on visual state.'],
    whenNotToUse: ['Do not attach irrelevant references merely to increase the number of inputs.'],
    relationships: [['reference','conditions','generation'],['keyframe','anchors','visual state'],['approved asset','becomes','future reference']],
    diagnosticRules: ['If identity or environment changes unexpectedly, compare the task references and workflow settings with the approved source.'],
    aiImplications: ['Persist reference asset IDs, provider/model, workflow version and seed where available.'],
    source: 'internal-production-standard',
    version: '2.0',
    confidence: 0.94
  },
  {
    id: 'ai-video.temporal-consistency',
    domain: 'ai-video',
    title: 'Temporal and identity consistency',
    definition: 'Temporal consistency means visual elements remain stable enough over time for the intended shot, while identity consistency preserves important character or object attributes.',
    purpose: 'Evaluate generated video beyond prompt text alone.',
    whenToUse: ['Evaluate motion, identity, geometry, lighting and unwanted changes after generation.'],
    whenNotToUse: ['Do not mark a clip successful only because the prompt was followed approximately.'],
    relationships: [['reference conditioning','supports','identity consistency'],['seed','supports','reproducibility'],['workflow version','affects','generation behavior']],
    diagnosticRules: ['Check flicker, face changes, wardrobe drift, object deformation and unintended motion.'],
    aiImplications: ['Store requested duration and measured duration separately.', 'Store evaluation results even when a generation is rejected.'],
    source: 'internal-production-standard',
    version: '2.0',
    confidence: 0.96
  },
  {
    id: 'editing.coverage-pacing',
    domain: 'editing',
    title: 'Coverage, pacing and editorial continuity',
    definition: 'Editing selects and orders coverage to control time, attention, information and emotional rhythm.',
    purpose: 'Turn individual takes or generated shots into a coherent sequence.',
    whenToUse: ['Use establishing, action, reaction, inserts and transitions according to editorial need.'],
    whenNotToUse: ['Do not cut only because two clips are available; every cut should preserve or intentionally change meaning.'],
    relationships: [['reaction shot','reveals','response'],['insert','isolates','detail'],['montage','compresses','time or repeated action']],
    diagnosticRules: ['Flag sequences with missing connective coverage or abrupt changes in geography, eyeline or time.'],
    aiImplications: ['Preserve shot order and editorial metadata so generation is not disconnected from the final timeline.'],
    source: 'internal-production-standard',
    version: '2.0',
    confidence: 0.95
  },
  {
    id: 'editing.j-cut-l-cut',
    domain: 'editing',
    title: 'J-cuts and L-cuts',
    definition: 'A J-cut introduces the next shot’s audio before the picture changes; an L-cut lets outgoing audio continue after the picture changes.',
    purpose: 'Create smoother transitions and control pacing through sound.',
    whenToUse: ['Use when dialogue, ambience or narrative sound can bridge scenes or shots.'],
    whenNotToUse: ['Do not force audio overlap when it creates ambiguity or conflicts with story timing.'],
    relationships: [['J-cut','starts audio before','new picture'],['L-cut','continues audio after','picture change']],
    diagnosticRules: ['Flag transitions where dialogue or ambience is abruptly cut without a deliberate reason.'],
    aiImplications: ['Keep audio timing as structured metadata rather than treating generated video as a self-contained final product.'],
    source: 'internal-production-standard',
    version: '2.0',
    confidence: 0.95
  },
  {
    id: 'audio.production-layers',
    domain: 'audio',
    title: 'Production sound layers',
    definition: 'Dialogue, ambience, Foley, sound effects and music serve different narrative and technical roles and should be planned as separate layers.',
    purpose: 'Make sound a first-class production component.',
    whenToUse: ['Plan audio from the scene and shot intent.', 'Preserve room tone and continuity where appropriate.'],
    whenNotToUse: ['Do not let music or effects obscure important dialogue.'],
    relationships: [['ambience','supports','location continuity'],['foley','supports','physical action'],['music','supports','emotion and rhythm']],
    diagnosticRules: ['Flag missing dialogue, missing room tone, unsupported visible actions or excessive music masking.'],
    aiImplications: ['Track audio asset provenance, timing, speaker/sound role and synchronization.'],
    source: 'internal-production-standard',
    version: '2.0',
    confidence: 0.96
  },
  {
    id: 'production.asset-provenance',
    domain: 'media-management',
    title: 'Asset provenance and rights',
    definition: 'Every media asset should retain where it came from, how it was created or imported, its relevant rights, and which project/scene/shot uses it.',
    purpose: 'Make production traceable and protect future dataset use.',
    whenToUse: ['Record provenance at ingestion or generation time.'],
    whenNotToUse: ['Do not put an asset into a future training dataset when its usage rights or provider terms have not been established.'],
    relationships: [['asset','belongs to','project'],['asset','supports','shot'],['license','constrains','dataset use']],
    diagnosticRules: ['Flag assets with unknown source, missing rights status or missing project linkage.'],
    aiImplications: ['Keep provider terms/licensing metadata separate from creative quality evaluation.'],
    source: 'internal-production-standard',
    version: '2.0',
    confidence: 0.98
  },
  {
    id: 'quality.generation-evaluation',
    domain: 'quality-control',
    title: 'Generation evaluation',
    definition: 'A generated asset needs explicit evaluation against task requirements before it becomes an approved production asset.',
    purpose: 'Separate generation success from production acceptance.',
    whenToUse: ['Evaluate prompt adherence, motion, identity, temporal consistency, composition, duration and audio when applicable.'],
    whenNotToUse: ['Do not treat an HTTP success or completed provider job as creative approval.'],
    relationships: [['generation','produces','candidate asset'],['evaluation','judges','candidate asset'],['approval','promotes','asset to production use']],
    diagnosticRules: ['Flag completed outputs with missing evaluation or missing approval status.'],
    aiImplications: ['Persist both positive and failed evaluations for later workflow improvement.'],
    source: 'internal-production-standard',
    version: '2.0',
    confidence: 0.98
  },
  {
    id: 'workflow.plan-before-execute',
    domain: 'production',
    title: 'Plan before execution',
    definition: 'Production systems should separate planning, routing, execution and evaluation so the director can inspect what will happen before resources are consumed.',
    purpose: 'Prevent accidental spending and make automation auditable.',
    whenToUse: ['Build a production graph and execution plan before launching workers.'],
    whenNotToUse: ['Do not silently execute paid work because a provider happens to be configured.'],
    relationships: [['plan','precedes','execution'],['router','selects','worker'],['evaluation','follows','execution']],
    diagnosticRules: ['Flag execution paths that have no plan, no selected worker, or no cost/permission decision.'],
    aiImplications: ['Provider/model selection is infrastructure metadata and should not leak into creative intent.'],
    source: 'internal-production-standard',
    version: '2.0',
    confidence: 0.99
  }
];

function scoreEntry(item, terms) {
  if (!terms.length) return 0;
  const haystack = JSON.stringify(item).toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

export function searchKnowledge(query = '', domain = '', options = {}) {
  const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  const limit = Math.max(1, Number(options.limit || 12));
  return KNOWLEDGE
    .filter(item => !domain || item.domain === domain)
    .map(item => ({ item, score: scoreEntry(item, terms) }))
    .filter(result => result.score > 0 || !terms.length)
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .slice(0, limit)
    .map(result => ({ ...result.item, relevance: result.score }));
}

export function getKnowledgeEntry(id) {
  return KNOWLEDGE.find(item => item.id === id) || null;
}

export function listKnowledgeDomains() {
  return [...new Set(KNOWLEDGE.map(item => item.domain))].sort();
}

export function getKnowledgeForTask(task = {}, options = {}) {
  const query = [
    task.domain,
    task.operation,
    task.purpose,
    task.prompt,
    task.scene_id,
    task.shot_id,
    ...(task.requirements ? Object.values(task.requirements) : [])
  ].filter(Boolean).join(' ');
  return searchKnowledge(query, options.domain || '', { limit: options.limit || 8 });
}

export function validateKnowledgeReferences(ids = []) {
  const requested = Array.isArray(ids) ? ids : [];
  return requested.map(id => ({ id, found: Boolean(getKnowledgeEntry(id)) }));
}

export { KNOWLEDGE };
