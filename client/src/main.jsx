import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL || '/api';

function App() {
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState('huggingface-ltx');
  const [duration, setDuration] = useState(2);
  const [ratio, setRatio] = useState('16:9');
  const [framing, setFraming] = useState('medium shot');
  const [cameraMovement, setCameraMovement] = useState('slow push-in');
  const [lighting, setLighting] = useState('natural cinematic');
  const [status, setStatus] = useState('Ready');
  const [result, setResult] = useState(null);
  const [settings, setSettings] = useState({ hfSpace: 'Lightricks/ltx-video-distilled', hfToken: '', hasHFToken: false, lumaApiKey: '', hasLumaApiKey: false, lumaModel: 'ray-flash-2' });
  const [showSettings, setShowSettings] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [referenceGenerationId, setReferenceGenerationId] = useState(null);
  const [sequences, setSequences] = useState([]);
  const [sequenceId, setSequenceId] = useState('');
  const [newSequenceTitle, setNewSequenceTitle] = useState('');
  const [mediaFormats, setMediaFormats] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState('cinematic');
  const [genre, setGenre] = useState('action');
  const [formatPlan, setFormatPlan] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [filmMode, setFilmMode] = useState(false);
  const [filmIdea, setFilmIdea] = useState('');
  const [filmAssist, setFilmAssist] = useState(null);
  const [assisting, setAssisting] = useState(false);
  const [filmProjects, setFilmProjects] = useState([]);
  const [filmProjectId, setFilmProjectId] = useState('');
  const [filmProject, setFilmProject] = useState(null);
  const [shotDraft, setShotDraft] = useState({ framing: 'medium shot', angle: 'eye level', movement: 'static', lens: '35mm', lighting: 'natural cinematic', audio: 'production sound', description: '' });
  const [takeDraft, setTakeDraft] = useState({ camera: '', lens: '35mm', fps: 24, shutter: '1/48', iso: '400', whiteBalance: '5600K', location: '', mediaUri: '', notes: '' });
  const [filmTab, setFilmTab] = useState('shots');
  const [filmReview, setFilmReview] = useState(null);
  const [assetUploadShotId, setAssetUploadShotId] = useState('');
  const [uploadingAsset, setUploadingAsset] = useState(false);

  async function loadSequences() {
    try {
      const r = await fetch(API + '/sequences');
      const data = await r.json();
      setSequences(data.sequences || []);
      if (!sequenceId && data.sequences?.[0]) setSequenceId(data.sequences[0].id);
    } catch {}
  }

  useEffect(() => {
    fetch(API + '/settings').then(r => r.json()).then(setSettings).catch(() => {});
    loadSequences();
    fetch(API + '/media-formats').then(r => r.json()).then(data => setMediaFormats(data.formats || [])).catch(() => {});
  }, []);

  useEffect(() => { if (filmMode) loadFilmProjects(); }, [filmMode]);

  async function createSequence() {
    const r = await fetch(API + '/sequences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newSequenceTitle || 'Untitled Sequence' }) });
    const data = await r.json();
    if (data.sequence) {
      setSequences(prev => [data.sequence, ...prev]);
      setSequenceId(data.sequence.id);
      setNewSequenceTitle('');
      setStatus('New sequence created');
    }
  }

  async function addResultToSequence() {
    const generationId = result?.generation?.id;
    if (!generationId || !sequenceId) return;
    const r = await fetch(API + '/sequences/' + sequenceId + '/shots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generationId }) });
    const data = await r.json();
    if (data.sequence) {
      setSequences(prev => prev.map(item => item.id === data.sequence.id ? data.sequence : item));
      setStatus('Shot added to sequence');
    }
  }

  async function generate() {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setStatus(provider === 'huggingface-ltx' ? 'Sending to LTX…' : provider.startsWith('luma') ? 'Sending to Luma…' : 'Sending to provider…');
    setResult(null);
    try {
      const r = await fetch(API + '/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, prompt, duration, ratio, framing, cameraMovement, lighting, referenceGenerationId })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error + (data.detail ? ` — ${data.detail}` : ''));
      setResult(data);
      setStatus('Completed');
    } catch (e) {
      setStatus(e.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function buildFormatPlan() {
    if (!prompt.trim() || planning) return;
    setPlanning(true);
    setStatus('Building production plan…');
    try {
      const r = await fetch(API + '/media/format-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: selectedFormat,
          genre,
          prompt,
          title: newSequenceTitle || 'Untitled Project',
          aspectRatio: ratio,
          quality: 'cinematic'
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Could not build production plan.');
      setFormatPlan(data);
      setStatus('Production plan ready');
    } catch (e) {
      setStatus(e.message || 'Planning failed');
    } finally {
      setPlanning(false);
    }
  }

  async function askFilmAssistant() {
    if (!filmIdea.trim() || assisting) return;
    setAssisting(true);
    setStatus('Director assistant is planning the film…');
    try {
      const r = await fetch(API + '/film/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story: filmIdea, title: newSequenceTitle || 'Untitled Film', genre, aspectRatio: ratio })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Film assistant failed.');
      setFilmAssist(data);
      setFormatPlan(data.production_plan);
      setStatus('Film production plan ready');
    } catch (e) {
      setStatus(e.message || 'Assistant failed');
    } finally {
      setAssisting(false);
    }
  }

  async function loadFilmProjects() {
    const r = await fetch(API + '/film/projects');
    const data = await r.json();
    setFilmProjects(data.projects || []);
  }

  async function createFilmProject() {
    const r = await fetch(API + '/film/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newSequenceTitle || 'Untitled Film', genre, logline: filmIdea })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Could not create film project.');
    setFilmProject(data.project);
    setFilmProjectId(data.project.id);
    setFilmProjects(prev => [data.project, ...prev]);
    setStatus('Film project created');
  }

  async function loadFilmProject(id) {
    if (!id) return;
    const r = await fetch(API + '/film/projects/' + id);
    const data = await r.json();
    if (r.ok) { setFilmProject(data.project); setFilmProjectId(id); }
  }

  async function addFilmScene() {
    if (!filmProjectId) return;
    const r = await fetch(API + '/film/projects/' + filmProjectId + '/scenes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Scene', description: filmIdea || 'Scene description' })
    });
    const data = await r.json();
    if (r.ok) setFilmProject(data.project);
  }

  async function addFilmShot() {
    if (!filmProjectId) return;
    const r = await fetch(API + '/film/projects/' + filmProjectId + '/shots', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shotDraft)
    });
    const data = await r.json();
    if (r.ok) {
      setFilmProject(data.project);
      setShotDraft({ ...shotDraft, description: '' });
      setStatus('Shot added to shot list');
    }
  }

  async function addFilmTake(shotId) {
    if (!filmProjectId || !shotId) return;
    const r = await fetch(API + '/film/projects/' + filmProjectId + '/takes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...takeDraft, shotId })
    });
    const data = await r.json();
    if (r.ok) {
      const fresh = await fetch(API + '/film/projects/' + filmProjectId);
      const project = await fresh.json();
      setFilmProject(project.project);
      setStatus('Take ' + data.take.takeNumber + ' logged');
    }
  }

  async function uploadFilmAsset(file, shotId = assetUploadShotId) {
    if (!filmProjectId || !file) return;
    setUploadingAsset(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (shotId) form.append('shotId', shotId);
      const r = await fetch(API + '/film/projects/' + filmProjectId + '/assets/upload', { method: 'POST', body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Could not upload media.');
      const fresh = await fetch(API + '/film/projects/' + filmProjectId);
      const project = await fresh.json();
      setFilmProject(project.project);
      setStatus('Media imported and inspected');
    } catch (error) {
      setStatus(error.message || 'Media upload failed');
    } finally {
      setUploadingAsset(false);
    }
  }

  async function attachAssetToTake(assetId, takeId) {
    if (!filmProjectId || !assetId || !takeId) return;
    const r = await fetch(API + '/film/projects/' + filmProjectId + '/assets/' + assetId + '/attach-take', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ takeId })
    });
    const data = await r.json();
    if (r.ok) setFilmProject(data.project);
  }

  async function reviewFilmProject() {
    if (!filmProjectId) return;
    const r = await fetch(API + '/film/projects/' + filmProjectId + '/assistant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    const data = await r.json();
    if (r.ok) { setFilmReview(data); setFilmTab('assistant'); setStatus('Production review ready'); }
  }

  async function selectFilmTake(shotId, takeId) {
    const r = await fetch(API + '/film/projects/' + filmProjectId + '/shots/' + shotId + '/select-take', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ takeId })
    });
    const data = await r.json();
    if (r.ok) setFilmProject(data.project);
  }

  async function saveSettings() {
    await fetch(API + '/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
    setShowSettings(false);
    setStatus('Settings saved');
  }

  const activeSequence = sequences.find(item => item.id === sequenceId);
  const filmShots = filmProject?.shots || [];
  const filmTakes = filmProject?.takes || [];
  const selectedFilmShot = filmShots[0] || null;
  const isLuma = provider.startsWith('luma');

  return <div className="app">
    <header>
      <div><div className="eyebrow">AI FILMMAKING</div><h1>Cinematic Agent</h1><p>Multiple engines. One director workspace.</p></div>
      <div className="header-actions"><button className={filmMode ? 'camera-button active' : 'camera-button'} onClick={() => setFilmMode(!filmMode)} title="Normal film production mode"><span>🎥</span><b>Film Production</b></button><button className="ghost" onClick={() => setShowSettings(!showSettings)}>Settings</button></div>
    </header>

    {showSettings && <section className="panel settings">
      <h2>Provider connections</h2>
      <label>Hugging Face Space<input value={settings.hfSpace} onChange={e => setSettings({ ...settings, hfSpace: e.target.value })}/></label>
      <label>Hugging Face token<input type="password" value={settings.hfToken} onChange={e => setSettings({ ...settings, hfToken: e.target.value })} placeholder={settings.hasHFToken ? 'Token already saved' : 'hf_…'}/></label>
      <label>Luma API key<input type="password" value={settings.lumaApiKey} onChange={e => setSettings({ ...settings, lumaApiKey: e.target.value })} placeholder={settings.hasLumaApiKey ? 'Key already saved' : 'luma_…'}/></label>
      <label>Luma model<select value={settings.lumaModel || 'ray-flash-2'} onChange={e => setSettings({ ...settings, lumaModel: e.target.value })}><option value="ray-flash-2">Ray Flash 2</option><option value="ray-2">Ray 2</option></select></label>
      <div className="row"><button onClick={saveSettings}>Save</button><span className="hint">Credentials stay on the backend settings file and are never returned to the browser.</span></div>
    </section>}

    <section className="panel sequence-panel">
      <div className="section-head">
        <div><h2>Film sequence</h2><span className="hint">Build the movie as ordered shots instead of isolated generations.</span></div>
        <span className="tag">{activeSequence ? `${activeSequence.shots.length} shots` : 'No sequence'}</span>
      </div>
      <div className="row sequence-row">
        <select value={sequenceId} onChange={e => setSequenceId(e.target.value)}>
          {!sequences.length && <option value="">Create a sequence first</option>}
          {sequences.map(item => <option key={item.id} value={item.id}>{item.title} · {item.shots.length} shots</option>)}
        </select>
        <input value={newSequenceTitle} onChange={e => setNewSequenceTitle(e.target.value)} placeholder="New sequence title"/>
        <button onClick={createSequence}>New sequence</button>
      </div>
      {activeSequence && <div className="sequence-track">{activeSequence.shots.length ? activeSequence.shots.map((shot, index) => <span key={shot}>Shot {index + 1}</span>) : <span className="hint">No shots yet. Generate the first shot below.</span>}</div>}
    </section>

    {filmMode && <section className="panel film-assistant">
      <div className="section-head">
        <div><h2>🎥 Director Assistant</h2><span className="hint">Use normal filmmaking language. The agent turns your idea into scenes, shots, continuity and production tasks.</span></div>
        <span className="tag">FILM MODE</span>
      </div>
      <label>What are you making?
        <textarea value={filmIdea} onChange={e => setFilmIdea(e.target.value)} rows="5" placeholder="Example: A detective arrives at an abandoned railway station at night. He hears a child's voice, follows it into the control room and discovers that the station is still receiving a train that disappeared twenty years ago."/>
      </label>
      <div className="film-actions"><button onClick={askFilmAssistant} disabled={assisting || !filmIdea.trim()}>{assisting ? 'Planning the film…' : 'Ask the AI director assistant'} →</button><span className="hint">It plans first. Nothing is generated or paid for automatically.</span></div>
      {filmAssist && <div className="assistant-result">
        <strong>{filmAssist.story_plan?.project?.title || 'Film plan'}</strong>
        <span>{filmAssist.story_plan?.scenes?.length || 0} scenes · {filmAssist.production_plan?.story?.beats?.length || 0} story beats · {filmAssist.production_plan?.tasks?.visual?.length || 0} visual tasks</span>
        <p>{filmAssist.assistant?.message}</p>
        <div className="checklist">{filmAssist.director_checklist?.map((item, i) => <span key={i}>✓ {item}</span>)}</div>
      </div>}
    </section>

    {filmMode && <section className="panel film-workspace">
      <div className="section-head">
        <div><h2>🎬 Normal Film Production Workspace</h2><span className="hint">Plan the film, record real camera takes, track continuity, then bring approved media into the edit.</span></div>
        <span className="tag">PRODUCTION</span>
      </div>
      <div className="film-project-bar">
        <select value={filmProjectId} onChange={e => { setFilmProjectId(e.target.value); loadFilmProject(e.target.value); }}>
          <option value="">Select a film project</option>
          {filmProjects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <button onClick={createFilmProject}>New film project</button>
      </div>
      {!filmProject ? <div className="workspace-empty"><strong>Start a real production project</strong><span>Create a project to get scenes, a shot list, take logging and continuity tracking.</span></div> :
      <div className="workspace-body">
        <div className="workspace-tabs">
          <button className={filmTab === 'shots' ? 'active' : ''} onClick={() => setFilmTab('shots')}>Shot List</button>
          <button className={filmTab === 'takes' ? 'active' : ''} onClick={() => setFilmTab('takes')}>Camera / Takes</button>
          <button className={filmTab === 'continuity' ? 'active' : ''} onClick={() => setFilmTab('continuity')}>Continuity</button>
          <button className={filmTab === 'assets' ? 'active' : ''} onClick={() => setFilmTab('assets')}>Media Assets</button>
          <button className={filmTab === 'assistant' ? 'active' : ''} onClick={() => setFilmTab('assistant')}>AI Help</button>
        </div>

        {filmTab === 'shots' && <div className="workspace-grid">
          <div>
            <div className="subhead"><strong>Scenes</strong><button onClick={addFilmScene}>+ Scene</button></div>
            <div className="scene-list">{(filmProject.scenes || []).map(s => <div className="scene-card" key={s.id}><b>Scene {s.number}</b><span>{s.title}</span><small>{s.description}</small></div>)}{!filmProject.scenes?.length && <span className="hint">No scenes yet.</span>}</div>
          </div>
          <div>
            <div className="subhead"><strong>Shot list</strong><span className="hint">{filmShots.length} shots</span></div>
            <div className="shot-form">
              <div className="grid3">
                <label>Framing<select value={shotDraft.framing} onChange={e => setShotDraft({...shotDraft,framing:e.target.value})}><option>wide shot</option><option>full shot</option><option>medium shot</option><option>close-up</option><option>extreme close-up</option></select></label>
                <label>Angle<select value={shotDraft.angle} onChange={e => setShotDraft({...shotDraft,angle:e.target.value})}><option>eye level</option><option>low angle</option><option>high angle</option><option>over the shoulder</option><option>POV</option></select></label>
                <label>Lens<input value={shotDraft.lens} onChange={e => setShotDraft({...shotDraft,lens:e.target.value})}/></label>
              </div>
              <div className="grid3">
                <label>Movement<select value={shotDraft.movement} onChange={e => setShotDraft({...shotDraft,movement:e.target.value})}><option>static</option><option>pan</option><option>tilt</option><option>push-in</option><option>tracking</option><option>handheld</option></select></label>
                <label>Lighting<input value={shotDraft.lighting} onChange={e => setShotDraft({...shotDraft,lighting:e.target.value})}/></label>
                <label>Audio<input value={shotDraft.audio} onChange={e => setShotDraft({...shotDraft,audio:e.target.value})}/></label>
              </div>
              <label>Shot description<textarea rows="3" value={shotDraft.description} onChange={e => setShotDraft({...shotDraft,description:e.target.value})} placeholder="What must happen in this shot? Include blocking, action and important visual details."/></label>
              <button onClick={addFilmShot}>Add shot to production</button>
            </div>
            <div className="shot-list">{filmShots.map(s => <div className="shot-row" key={s.id}><div><b>Shot {s.number}</b><span>{s.framing} · {s.angle} · {s.lens || 'lens TBD'} · {s.movement}</span><small>{s.description || 'No description yet.'}</small></div><button onClick={() => { setFilmTab('takes'); setStatus('Log takes for Shot ' + s.number); }}>Log takes</button></div>)}</div>
          </div>
        </div>}

        {filmTab === 'takes' && <div className="workspace-grid">
          <div>
            <div className="subhead"><strong>Camera take log</strong><span className="hint">Metadata first; media can be linked when available.</span></div>
            <div className="shot-list">{filmShots.map(s => <div className="shot-row" key={s.id}><div><b>Shot {s.number}</b><span>{s.framing} · {s.movement}</span><small>{filmTakes.filter(t => t.shotId === s.id).length} takes · {s.selectedTakeId ? 'selected take recorded' : 'no selected take'}</small></div><button onClick={() => setTakeDraft({...takeDraft, shotId:s.id})}>Log take</button></div>)}</div>
          </div>
          <div className="take-form">
            <strong>New take</strong><span className="hint">Select a shot above, then record the take on your camera and enter its details.</span>
            <label>Camera<input value={takeDraft.camera} onChange={e => setTakeDraft({...takeDraft,camera:e.target.value})} placeholder="Camera body"/></label>
            <div className="grid3"><label>Lens<input value={takeDraft.lens} onChange={e => setTakeDraft({...takeDraft,lens:e.target.value})}/></label><label>FPS<input type="number" value={takeDraft.fps} onChange={e => setTakeDraft({...takeDraft,fps:Number(e.target.value)})}/></label><label>Shutter<input value={takeDraft.shutter} onChange={e => setTakeDraft({...takeDraft,shutter:e.target.value})}/></label></div>
            <div className="grid3"><label>ISO<input value={takeDraft.iso} onChange={e => setTakeDraft({...takeDraft,iso:e.target.value})}/></label><label>White balance<input value={takeDraft.whiteBalance} onChange={e => setTakeDraft({...takeDraft,whiteBalance:e.target.value})}/></label><label>Location<input value={takeDraft.location} onChange={e => setTakeDraft({...takeDraft,location:e.target.value})}/></label></div>
            <label>Media path / URL<input value={takeDraft.mediaUri} onChange={e => setTakeDraft({...takeDraft,mediaUri:e.target.value})} placeholder="Optional file or imported-media reference"/></label>
            <label>Notes<textarea rows="3" value={takeDraft.notes} onChange={e => setTakeDraft({...takeDraft,notes:e.target.value})}/></label>
            <button disabled={!takeDraft.shotId} onClick={() => addFilmTake(takeDraft.shotId)}>Save take</button>
          </div>
          <div className="take-history">{filmTakes.map(t => <div className="take-card" key={t.id}><b>Take {t.takeNumber}</b><span>{t.camera || 'Camera TBD'} · {t.fps}fps · ISO {t.iso || '—'} · {t.shutter || '—'}</span><small>{t.mediaUri || 'No media linked yet.'}</small><button onClick={() => selectFilmTake(t.shotId,t.id)}>{t.selected ? '✓ Selected take' : 'Select as best take'}</button></div>)}</div>
        </div>}

        {filmTab === 'continuity' && <div className="continuity-board"><strong>Continuity board</strong><span className="hint">This workspace will connect to the existing world-entity system so characters, props, wardrobe and screen direction stay consistent.</span><div className="continuity-grid"><div>Characters<br/><small>Appearance · wardrobe · state</small></div><div>Props<br/><small>Position · condition · ownership</small></div><div>Screen direction<br/><small>Entry/exit · eyelines · geography</small></div><div>Lighting<br/><small>Time · direction · practical sources</small></div></div></div>}

        {filmTab === 'assets' && <div className="asset-workspace">
          <div className="subhead"><strong>Production media</strong><span className="hint">{filmProject.assets?.length || 0} assets</span></div>
          <div className="asset-import">
            <label>Attach upload to shot
              <select value={assetUploadShotId} onChange={e => setAssetUploadShotId(e.target.value)}>
                <option value="">No shot / project asset</option>
                {filmShots.map(s => <option key={s.id} value={s.id}>Shot {s.number} · {s.framing}</option>)}
              </select>
            </label>
            <label className="file-input">Choose video/image/audio
              <input type="file" accept="video/*,image/*,audio/*" disabled={uploadingAsset} onChange={e => { const file=e.target.files?.[0]; if(file) uploadFilmAsset(file); e.target.value=''; }}/>
            </label>
            <span className="hint">{uploadingAsset ? 'Uploading, hashing and inspecting media…' : 'Files are stored as project assets. If ffprobe is available, technical metadata is recorded automatically.'}</span>
          </div>
          <div className="asset-grid">
            {(filmProject.assets || []).map(asset => {
              const isVideo = String(asset.mimeType || '').startsWith('video/');
              const isImage = String(asset.mimeType || '').startsWith('image/');
              return <div className="asset-card" key={asset.id}>
                <div className="asset-preview">
                  {isVideo ? <video src={asset.uri} controls preload="metadata"/> : isImage ? <img src={asset.uri} alt={asset.name}/> : <span>MEDIA</span>}
                </div>
                <strong>{asset.name}</strong>
                <small>{asset.size ? Math.round(asset.size / 1024 / 1024 * 10) / 10 + ' MB' : 'size unknown'} · {asset.mimeType || 'unknown type'}</small>
                <small>{asset.duration != null ? asset.duration + 's' : 'duration —'} · {asset.width && asset.height ? asset.width + '×' + asset.height : 'dimensions —'} · {asset.fps ? asset.fps + ' fps' : 'fps —'}</small>
                <small>{asset.codec ? 'codec ' + asset.codec : 'codec —'} · audio {asset.hasAudio == null ? '—' : asset.hasAudio ? 'yes' : 'no'}</small>
                <small className="asset-hash">{asset.sha256 ? 'SHA-256 ' + asset.sha256.slice(0, 16) + '…' : 'No checksum'}</small>
                <div className="asset-actions">
                  {filmTakes.filter(t => !t.assetId).slice(0, 6).map(t => <button key={t.id} onClick={() => attachAssetToTake(asset.id, t.id)}>Attach to Take {t.takeNumber}</button>)}
                </div>
              </div>;
            })}
            {!filmProject.assets?.length && <span className="hint">No media imported yet.</span>}
          </div>
        </div>}

        {filmTab === 'assistant' && <div className="assistant-workspace"><strong>AI production assistant</strong><p>The assistant reviews the actual project state before recommending the next production step.</p><button onClick={reviewFilmProject}>Analyze this production</button>{filmReview && <div className="review-result"><b>{filmReview.summary.shots} shots · {filmReview.summary.takes} takes</b>{filmReview.recommendations.map((item,i)=><span key={i}>• {item}</span>)}<strong>Next: {filmReview.next_action}</strong></div>}<div className="checklist"><span>✓ Check establishing, action and reaction coverage.</span><span>✓ Track characters, props, wardrobe and screen direction.</span><span>✓ Compare camera, lens, FPS, shutter and ISO across takes.</span><span>✓ Mix real camera footage with AI-generated shots when needed.</span></div></div>}
      </div>}
    </section>

    <section className="panel format-panel">
      <div className="section-head">
        <div><h2>Choose your production format</h2><span className="hint">Format decides how the story is produced. Genre stays separate.</span></div>
        <span className="tag">{selectedFormat}</span>
      </div>
      <div className="format-grid">
        {mediaFormats.map(format => {
          const icons = { 'audio-story': '🎧', 'picture-story': '🖼️', 'motion-comic': '💥', cinematic: '🎬', anime: '🌸', documentary: '📽️', explainer: '📊' };
          return <button type="button" key={format.id} className={selectedFormat === format.id ? 'format-card active' : 'format-card'} onClick={() => setSelectedFormat(format.id)}>
            <span className="format-icon">{icons[format.id] || '🎞️'}</span>
            <strong>{format.name}</strong>
            <small>{format.description}</small>
          </button>;
        })}
      </div>
      <div className="format-controls">
        <label>Genre
          <select value={genre} onChange={e => setGenre(e.target.value)}>
            <option>action</option><option>adventure</option><option>comedy</option><option>drama</option><option>fantasy</option><option>horror</option><option>mystery</option><option>romance</option><option>science fiction</option><option>thriller</option><option>historical</option><option>educational</option>
          </select>
        </label>
        <button onClick={buildFormatPlan} disabled={planning || !prompt.trim()}>{planning ? 'Planning…' : 'Build production plan'} →</button>
      </div>
      {formatPlan && <div className="plan-summary">
        <strong>{formatPlan.project.format_name} · {formatPlan.project.genre}</strong>
        <span>{formatPlan.production_model.stages.length} stages · {formatPlan.story.beats.length} beats · {formatPlan.tasks.visual.length} visual tasks · {formatPlan.tasks.audio.length} audio tasks</span>
        <small>Provider-neutral: the plan describes production requirements first; the media router selects actual workers later.</small>
      </div>}
    </section>

    <main>
      <section className="panel composer">
        <div className="section-head"><h2>Generate a shot</h2><span className="status"><i className={generating ? 'busy' : ''}/> {status}</span></div>
        <label>Scene description<textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows="7" placeholder="Describe the shot you want to generate…"/></label>
        <div className="grid3">
          <label>Provider<select value={provider} onChange={e => setProvider(e.target.value)}>
            <option value="huggingface-ltx">Hugging Face • LTX Video</option>
            <option value="luma-ray-flash">Luma • Ray Flash 2</option>
            <option value="luma-ray-2">Luma • Ray 2</option>
            <option value="comfyui">ComfyUI • Wan/Hunyuan/LTX (next)</option>
          </select></label>
          <label>Duration<select value={duration} onChange={e => setDuration(Number(e.target.value))}><option value="2">2 seconds</option><option value="4">4 seconds</option><option value="6">6 seconds</option><option value="8">8 seconds</option></select></label>
          <label>Aspect ratio<select value={ratio} onChange={e => setRatio(e.target.value)}><option>16:9</option><option>9:16</option><option>1:1</option><option>4:3</option><option>3:4</option><option>21:9</option></select></label>
        </div>
        {isLuma && <div className="hint provider-note">Luma generation runs independently from the Hugging Face ZeroGPU quota. Luma currently supports Ray 2 and Ray Flash 2 through its API.</div>}
        <div className="section-head"><h2>Shot controls</h2><span className="hint">These guide the camera without changing your scene.</span></div>
        <div className="grid3">
          <label>Framing<select value={framing} onChange={e => setFraming(e.target.value)}><option>wide shot</option><option>full body</option><option>medium shot</option><option>close-up</option><option>extreme close-up</option></select></label>
          <label>Camera movement<select value={cameraMovement} onChange={e => setCameraMovement(e.target.value)}><option>static camera</option><option>slow push-in</option><option>slow pull-back</option><option>slow pan</option><option>slow tracking shot</option></select></label>
          <label>Lighting<select value={lighting} onChange={e => setLighting(e.target.value)}><option>natural cinematic</option><option>soft daylight</option><option>dramatic low light</option><option>night neon</option><option>warm sunset</option></select></label>
        </div>
        {referenceGenerationId && <div className="hint">Continuity reference selected. LTX uses the previous video as a visual reference; other providers currently use continuity prompting until their native reference workflow is wired.</div>}
        <button className="generate" disabled={generating} onClick={generate}>{generating ? 'Generating…' : 'Generate cinematic shot'} <span>→</span></button>
      </section>

      <section className="panel preview">
        <div className="section-head"><h2>Result</h2>{result && <span className="tag">{result.provider}</span>}</div>
        {!result ? <div className="empty"><div className="play">▶</div><strong>Your generated shot will appear here</strong><span>Choose LTX or Luma as the active generation engine.</span></div> : <div className="result">
          <div className="resultbox">{result.videoUrl ? <video src={result.videoUrl} controls playsInline/> : <div><strong>{result.message || 'No video returned'}</strong><small>{result.detail || ''}</small></div>}</div>
          {result.generation && <div className="meta"><span>{result.generation.model}</span><span>{result.generation.mode}</span>{result.generation.duration != null && <span>{result.generation.duration}s</span>}{result.generation.width && <span>{result.generation.width}×{result.generation.height}</span>}</div>}
          <div className="actions">
            {result.videoUrl && <a href={result.videoUrl} download className="button">Download</a>}
            <button disabled={!sequenceId} onClick={addResultToSequence}>Add to sequence</button>
            <button onClick={() => { if (result?.generation?.id) { setReferenceGenerationId(result.generation.id); setPrompt(prompt + ' Continue the same scene while preserving the character, clothing, location and visual identity. Change only what this new shot description requests.'); setStatus('Visual continuity reference selected'); } }}>Use as next shot</button>
          </div>
        </div>}
      </section>
    </main>
    <footer>V1 • LTX + Luma adapters • Visual continuity • Persistent shot sequences</footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
