import fs from 'fs';

function id(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function normalizeSequence(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function createFilmStore(filePath) {
  const read = () => {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return data && data.projects ? data : { projects: {} };
    } catch {
      return { projects: {} };
    }
  };

  const write = data => {
    fs.mkdirSync(filePath.split('/').slice(0, -1).join('/'), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  };

  const view = p => ({
    ...p,
    scenes: [...(p.scenes || [])].sort((a, b) => (a.sequence || 0) - (b.sequence || 0)),
    shots: [...(p.shots || [])].sort((a, b) => {
      const sceneA = p.scenes?.find(s => s.id === a.sceneId)?.sequence || 0;
      const sceneB = p.scenes?.find(s => s.id === b.sceneId)?.sequence || 0;
      return sceneA - sceneB || (a.sequence || 0) - (b.sequence || 0);
    }),
    takes: p.takes || [],
    assets: p.assets || [],
    continuity: p.continuity || []
  });

  const touch = p => { p.updatedAt = new Date().toISOString(); };

  function normalizeScenes(p) {
    p.scenes = (p.scenes || []).sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    p.scenes.forEach((scene, index) => {
      scene.sequence = index + 1;
      scene.number = index + 1;
    });
  }

  function normalizeShotsForScene(p, sceneId) {
    const shots = (p.shots || []).filter(s => s.sceneId === sceneId).sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    shots.forEach((shot, index) => {
      shot.sequence = index + 1;
      shot.number = index + 1;
    });
  }

  function normalizeAllShots(p) {
    for (const scene of p.scenes || []) normalizeShotsForScene(p, scene.id);
    const orphaned = (p.shots || []).filter(s => !(p.scenes || []).some(scene => scene.id === s.sceneId));
    orphaned.forEach((shot, index) => {
      shot.sequence = index + 1;
      shot.number = index + 1;
    });
  }

  return {
    listProjects() {
      return Object.values(read().projects).map(view).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    getProject(projectId) {
      const d = read();
      return d.projects[projectId] ? view(d.projects[projectId]) : null;
    },

    createProject(input = {}) {
      const d = read();
      const now = new Date().toISOString();
      const project = {
        id: input.id || id('film'),
        title: String(input.title || 'Untitled Film').trim(),
        genre: String(input.genre || 'drama').trim(),
        logline: String(input.logline || '').trim(),
        premise: String(input.premise || '').trim(),
        story: { theme: '', tone: '', premise: String(input.premise || '').trim(), acts: [] },
        characters: [],
        world: { setting: '', rules: [], locations: [], factions: [], terminology: [] },
        format: 'cinematic',
        createdAt: now,
        updatedAt: now,
        scenes: [],
        shots: [],
        takes: [],
        assets: [],
        continuity: []
      };
      d.projects[project.id] = project;
      write(d);
      return view(project);
    },

    updateProject(projectId, input = {}) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      if (input.title !== undefined) p.title = String(input.title).trim();
      if (input.genre !== undefined) p.genre = String(input.genre).trim();
      if (input.logline !== undefined) p.logline = String(input.logline).trim();
      if (input.premise !== undefined) { p.premise = String(input.premise).trim(); p.story = { ...(p.story || {}), premise: p.premise }; }
      touch(p);
      write(d);
      return view(p);
    },

    addScene(projectId, input = {}) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      p.scenes = p.scenes || [];
      const nextNumber = p.scenes.length + 1;
      const scene = {
        id: input.id || id('scene'),
        sequence: normalizeSequence(input.sequence, nextNumber),
        number: nextNumber,
        title: String(input.title || ('Scene ' + nextNumber)).trim(),
        location: String(input.location || '').trim(),
        timeOfDay: String(input.timeOfDay || '').trim(),
        description: String(input.description || '').trim(),
        dramaticBeat: String(input.dramaticBeat || '').trim(),
        characters: Array.isArray(input.characters) ? input.characters : [],
        blocking: String(input.blocking || '').trim(),
        action: String(input.action || '').trim(),
        dialogue: String(input.dialogue || '').trim(),
        mood: String(input.mood || '').trim(),
        weather: String(input.weather || '').trim(),
        props: Array.isArray(input.props) ? input.props : [],
        status: String(input.status || 'planned')
      };
      p.scenes.push(scene);
      normalizeScenes(p);
      touch(p);
      write(d);
      return view(p);
    },

    updateScene(projectId, sceneId, input = {}) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      const scene = (p.scenes || []).find(x => x.id === sceneId);
      if (!scene) return null;
      for (const field of ['title', 'location', 'timeOfDay', 'description', 'dramaticBeat', 'blocking', 'action', 'dialogue', 'mood', 'weather', 'status']) {
        if (input[field] !== undefined) scene[field] = String(input[field] ?? '').trim();
      }
      if (Array.isArray(input.characters)) scene.characters = input.characters;
      if (Array.isArray(input.props)) scene.props = input.props;
      if (input.sequence !== undefined) scene.sequence = normalizeSequence(input.sequence, scene.sequence);
      normalizeScenes(p);
      touch(p);
      write(d);
      return view(p);
    },

    addShot(projectId, input = {}) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      p.shots = p.shots || [];
      p.scenes = p.scenes || [];
      const sceneId = input.sceneId || p.scenes[0]?.id || null;
      const sceneShots = p.shots.filter(x => x.sceneId === sceneId);
      const nextNumber = sceneShots.length + 1;
      const shot = {
        id: input.id || id('shot'),
        sequence: normalizeSequence(input.sequence, nextNumber),
        number: nextNumber,
        sceneId,
        shotType: String(input.shotType || 'coverage'),
        framing: String(input.framing || 'medium shot'),
        angle: String(input.angle || 'eye level'),
        lens: String(input.lens || ''),
        movement: String(input.movement || 'static'),
        lighting: String(input.lighting || ''),
        audio: String(input.audio || 'production sound'),
        duration: Number(input.duration || 0) || 0,
        description: String(input.description || ''),
        notes: String(input.notes || ''),
        status: String(input.status || 'planned'),
        edit: input.edit && typeof input.edit === 'object' ? input.edit : { trimIn: 0, trimOut: 0, speed: 1, transition: 'cut', volume: 100 },
        effects: input.effects && typeof input.effects === 'object' ? input.effects : { effect: 'none', intensity: 50, background: 'original', overlay: '', stabilization: false },
        audioMix: input.audioMix && typeof input.audioMix === 'object' ? input.audioMix : { dialogue: 100, music: 70, sfx: 100, ambience: 80 },
        selectedTakeId: null
      };
      p.shots.push(shot);
      normalizeShotsForScene(p, sceneId);
      touch(p);
      write(d);
      return view(p);
    },

    updateShot(projectId, shotId, input = {}) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      const shot = (p.shots || []).find(x => x.id === shotId);
      if (!shot) return null;
      const oldSceneId = shot.sceneId;
      for (const field of ['sceneId', 'shotType', 'framing', 'angle', 'lens', 'movement', 'lighting', 'audio', 'description', 'notes', 'status']) {
        if (input[field] !== undefined) shot[field] = field === 'sceneId' ? (input[field] || null) : String(input[field] ?? '');
      }
      if (input.duration !== undefined) shot.duration = Number(input.duration || 0) || 0;
      if (input.edit !== undefined && input.edit && typeof input.edit === 'object') shot.edit = { ...(shot.edit || {}), ...input.edit };
      if (input.effects !== undefined && input.effects && typeof input.effects === 'object') shot.effects = { ...(shot.effects || {}), ...input.effects };
      if (input.audioMix !== undefined && input.audioMix && typeof input.audioMix === 'object') shot.audioMix = { ...(shot.audioMix || {}), ...input.audioMix };
      if (input.sequence !== undefined) shot.sequence = normalizeSequence(input.sequence, shot.sequence);
      normalizeShotsForScene(p, oldSceneId);
      if (shot.sceneId !== oldSceneId) {
        shot.sequence = normalizeSequence(input.sequence, (p.shots || []).filter(x => x.sceneId === shot.sceneId && x.id !== shot.id).length + 1);
      }
      normalizeShotsForScene(p, shot.sceneId);
      touch(p);
      write(d);
      return view(p);
    },

    reorderScene(projectId, sceneId, sequence) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      const scene = (p.scenes || []).find(x => x.id === sceneId);
      if (!scene) return null;
      scene.sequence = normalizeSequence(sequence, scene.sequence);
      normalizeScenes(p);
      touch(p);
      write(d);
      return view(p);
    },

    reorderShot(projectId, shotId, sequence) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      const shot = (p.shots || []).find(x => x.id === shotId);
      if (!shot) return null;
      shot.sequence = normalizeSequence(sequence, shot.sequence);
      normalizeShotsForScene(p, shot.sceneId);
      touch(p);
      write(d);
      return view(p);
    },

    addTake(projectId, input = {}) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      p.takes = p.takes || [];
      const t = {
        id: input.id || id('take'),
        shotId: input.shotId || null,
        assetId: input.assetId || null,
        takeNumber: p.takes.filter(x => x.shotId === input.shotId).length + 1,
        camera: String(input.camera || ''),
        lens: String(input.lens || ''),
        fps: Number(input.fps || 24) || 24,
        shutter: String(input.shutter || ''),
        iso: String(input.iso || ''),
        whiteBalance: String(input.whiteBalance || ''),
        location: String(input.location || ''),
        recordedAt: input.recordedAt || new Date().toISOString(),
        mediaUri: String(input.mediaUri || ''),
        notes: String(input.notes || ''),
        selected: false
      };
      p.takes.push(t);
      touch(p);
      write(d);
      return t;
    },

    selectTake(projectId, shotId, takeId) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      const shot = (p.shots || []).find(s => s.id === shotId);
      const take = (p.takes || []).find(t => t.id === takeId && t.shotId === shotId);
      if (!shot || !take) return null;
      shot.selectedTakeId = takeId;
      for (const t of p.takes || []) {
        if (t.shotId === shotId) t.selected = t.id === takeId;
      }
      touch(p);
      write(d);
      return view(p);
    },

    addAsset(projectId, input = {}) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      p.assets = p.assets || [];
      const asset = {
        id: input.id || id('asset'),
        name: String(input.name || 'Untitled asset'),
        filename: String(input.filename || ''),
        sourceType: String(input.sourceType || 'camera'),
        uri: String(input.uri || ''),
        sceneId: input.sceneId || null,
        shotId: input.shotId || null,
        mimeType: String(input.mimeType || ''),
        size: Number(input.size || 0) || 0,
        duration: input.duration == null ? null : Number(input.duration),
        width: input.width == null ? null : Number(input.width),
        height: input.height == null ? null : Number(input.height),
        fps: input.fps == null ? null : Number(input.fps),
        codec: String(input.codec || ''),
        hasAudio: input.hasAudio == null ? null : Boolean(input.hasAudio),
        sha256: String(input.sha256 || ''),
        notes: String(input.notes || ''),
        createdAt: input.createdAt || new Date().toISOString()
      };
      p.assets.push(asset);
      touch(p);
      write(d);
      return asset;
    },

    updateAsset(projectId, assetId, input = {}) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      const asset = (p.assets || []).find(x => x.id === assetId);
      if (!asset) return null;
      for (const field of ['name', 'sceneId', 'shotId', 'notes']) {
        if (input[field] !== undefined) asset[field] = field === 'name' || field === 'notes' ? String(input[field] ?? '') : (input[field] || null);
      }
      touch(p);
      write(d);
      return asset;
    },

    attachAssetToShot(projectId, assetId, shotId) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      const asset = (p.assets || []).find(x => x.id === assetId);
      const shot = (p.shots || []).find(x => x.id === shotId);
      if (!asset || !shot) return null;
      asset.shotId = shotId;
      asset.sceneId = shot.sceneId || null;
      touch(p);
      write(d);
      return view(p);
    },

    attachAssetToTake(projectId, assetId, takeId) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      const asset = (p.assets || []).find(x => x.id === assetId);
      const take = (p.takes || []).find(x => x.id === takeId);
      if (!asset || !take) return null;
      take.assetId = assetId;
      asset.shotId = take.shotId || asset.shotId || null;
      const shot = (p.shots || []).find(x => x.id === take.shotId);
      asset.sceneId = shot?.sceneId || asset.sceneId || null;
      touch(p);
      write(d);
      return view(p);
    },

    updateStory(projectId, input = {}) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      p.story = { theme: '', tone: '', premise: p.premise || '', acts: [], ...(p.story || {}), ...input };
      if (input.premise !== undefined) p.premise = String(input.premise || '').trim();
      touch(p); write(d); return view(p);
    },

    addCharacter(projectId, input = {}) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      p.characters = p.characters || [];
      const character = {
        id: input.id || id('character'),
        name: String(input.name || 'Unnamed Character').trim(),
        role: String(input.role || '').trim(),
        description: String(input.description || '').trim(),
        appearance: String(input.appearance || '').trim(),
        personality: String(input.personality || '').trim(),
        relationships: Array.isArray(input.relationships) ? input.relationships : [],
        state: input.state || {},
        references: Array.isArray(input.references) ? input.references : []
      };
      p.characters.push(character); touch(p); write(d); return view(p);
    },

    updateCharacter(projectId, characterId, input = {}) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      const character = (p.characters || []).find(x => x.id === characterId);
      if (!character) return null;
      for (const field of ['name','role','description','appearance','personality']) {
        if (input[field] !== undefined) character[field] = String(input[field] || '').trim();
      }
      if (Array.isArray(input.relationships)) character.relationships = input.relationships;
      if (input.state && typeof input.state === 'object') character.state = { ...(character.state || {}), ...input.state };
      touch(p); write(d); return view(p);
    },

    updateWorld(projectId, input = {}) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      p.world = { setting: '', rules: [], locations: [], factions: [], terminology: [], ...(p.world || {}), ...input };
      touch(p); write(d); return view(p);
    },

    addContinuityEvent(projectId, input = {}) {
      const d = read(), p = d.projects[projectId];
      if (!p) return null;
      p.continuity = p.continuity || [];
      const event = {
        id: input.id || id('continuity'),
        sceneId: input.sceneId || null,
        shotId: input.shotId || null,
        entity: String(input.entity || ''),
        state: String(input.state || ''),
        notes: String(input.notes || ''),
        createdAt: input.createdAt || new Date().toISOString()
      };
      p.continuity.push(event);
      touch(p);
      write(d);
      return event;
    }
  };
}
