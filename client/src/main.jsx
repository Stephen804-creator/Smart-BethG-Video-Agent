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

  async function saveSettings() {
    await fetch(API + '/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
    setShowSettings(false);
    setStatus('Settings saved');
  }

  const activeSequence = sequences.find(item => item.id === sequenceId);
  const isLuma = provider.startsWith('luma');

  return <div className="app">
    <header>
      <div><div className="eyebrow">AI FILMMAKING</div><h1>Cinematic Agent</h1><p>Multiple engines. One director workspace.</p></div>
      <button className="ghost" onClick={() => setShowSettings(!showSettings)}>Settings</button>
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
