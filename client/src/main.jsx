import React, { useEffect, useState } from 'react';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { Icon } from './icons.jsx';

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
  const [showSettings, setShowSettings] = useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showGenerationControls, setShowGenerationControls] = useState(false);
  const [providers, setProviders] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [referenceGenerationId, setReferenceGenerationId] = useState(null);
  const [mediaFormats, setMediaFormats] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState('cinematic');
  const [genre, setGenre] = useState('action');
  const [formatPlan, setFormatPlan] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [showShotControls, setShowShotControls] = useState(false);
  const [filmMode, setFilmMode] = useState(false);
  const [filmIdea, setFilmIdea] = useState('');
  const [filmAssist, setFilmAssist] = useState(null);
  const [assisting, setAssisting] = useState(false);
  const [filmProjects, setFilmProjects] = useState([]);
  const [filmProjectId, setFilmProjectId] = useState('');
  const [filmProject, setFilmProject] = useState(null);
  const [shotDraft, setShotDraft] = useState({ sceneId: '', framing: 'medium shot', angle: 'eye level', movement: 'static', lens: '35mm', lighting: 'natural cinematic', audio: 'production sound', description: '' });
  const [takeDraft, setTakeDraft] = useState({ camera: '', lens: '35mm', fps: 24, shutter: '1/48', iso: '400', whiteBalance: '5600K', location: '', mediaUri: '', notes: '' });
  const [filmTab, setFilmTab] = useState('shots');
  const [filmReview, setFilmReview] = useState(null);
  const [continuityReport, setContinuityReport] = useState(null);
  const [assetUploadShotId, setAssetUploadShotId] = useState('');
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [storyDraft, setStoryDraft] = useState({ premise: '', theme: '', tone: '', setting: '', rules: '', locations: '', factions: '', terminology: '' });
  const [characterDraft, setCharacterDraft] = useState({ name: '', role: '', appearance: '', personality: '', description: '' });
  const [selectedSceneId, setSelectedSceneId] = useState('');
  const [sceneDraft, setSceneDraft] = useState({ title: '', location: '', timeOfDay: '', dramaticBeat: '', characters: '', blocking: '', action: '', dialogue: '', mood: '', weather: '', props: '', description: '' });
  const [productionTool, setProductionTool] = useState('');
  const [editDraft, setEditDraft] = useState({ shotId: '', trimIn: 0, trimOut: 0, speed: 1, transition: 'cut', volume: 100 });
  const [effectDraft, setEffectDraft] = useState({ effect: 'none', intensity: 50, background: 'original', overlay: '', stabilization: false });
  const [audioDraft, setAudioDraft] = useState({ dialogue: 100, music: 70, sfx: 100, ambience: 80 });
  const [workspaceTool, setWorkspaceTool] = useState('');
  const [route, setRoute] = useState(window.location.pathname || '/generator');
  const [density, setDensity] = useState(localStorage.getItem('cinematic-density') || 'comfortable');
  const [notice, setNotice] = useState(null);
  const [progress, setProgress] = useState(0);
  const [selectedLayer, setSelectedLayer] = useState('base');
  const [activeJobId, setActiveJobId] = useState(null);
  const [retryJobId, setRetryJobId] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authMode, setAuthMode] = useState('login');

  const routes = {
    '/': 'generator',
    '/generator': 'generator',
    '/projects': 'projects',
    '/story': 'story',
    '/shots': 'shots',
    '/takes': 'takes',
    '/continuity': 'continuity',
    '/assets': 'assets',
    '/assistant': 'assistant',
    '/settings': 'settings'
  };

  function navigate(path) {
    const target = routes[path] ? path : '/generator';
    window.history.pushState({}, '', target);
    setRoute(target);
    const view = routes[target];
    if (view === 'generator') { setFilmMode(false); setShowWorkspaceMenu(false); }
    else if (view === 'settings') { setFilmMode(false); setShowWorkspaceMenu(false); setShowSettings(true); }
    else {
      setShowSettings(false);
      setShowWorkspaceMenu(true);
      setFilmMode(true);
      const tab = { story: 'story', shots: 'shots', takes: 'takes', continuity: 'continuity', assets: 'assets', assistant: 'assistant' }[view];
      if (tab) setFilmTab(tab);
      if (view === 'projects') setFilmTab('shots');
    }
  }

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      setRoute(routes[path] ? path : '/generator');
    };
    window.addEventListener('popstate', onPopState);
    navigate(window.location.pathname || '/generator');
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    localStorage.setItem('cinematic-density', density);
  }, [density]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3600);
    return () => clearTimeout(timer);
  }, [notice]);

  function notify(message, type = 'info') {
    setNotice({ message, type });
  }

  async function apiFetch(path, options = {}) {
    const response = await fetch(API + path, { credentials: 'include', ...options });
    if (response.status === 401) {
      setAuthenticated(false);
      throw new Error('Authentication required.');
    }
    return response;
  }

  async function login() {
    setLoginError('');
    try {
      const response = await fetch(API + '/auth/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: loginEmail, password: loginPassword }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed.');
      setAuthenticated(true);
      setLoginPassword('');
    } catch (error) {
      setLoginError(error.message || 'Login failed.');
    }
  }

  async function register() {
    setLoginError('');
    try {
      const response = await fetch(API + '/auth/register', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: loginEmail, password: loginPassword, displayName: loginEmail.split('@')[0] }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed.');
      setAuthenticated(true); setLoginPassword(''); setLoginEmail('');
    } catch (error) { setLoginError(error.message || 'Registration failed.'); }
  }

  async function logout() {
    await fetch(API + '/auth/logout', { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
  }

  useEffect(() => {
    fetch(API + '/auth/status', { credentials: 'include' }).then(r => r.json()).then(data => { setAuthenticated(Boolean(data.authenticated)); setAuthReady(true); }).catch(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    apiFetch('/providers?task=text-to-video&allowPaid=true').then(r => r.json()).then(data => setProviders(data.providers || [])).catch(() => {});
    loadFilmProjects();
    apiFetch('/media-formats').then(r => r.json()).then(data => setMediaFormats(data.formats || [])).catch(() => {});
  }, [authenticated]);

  useEffect(() => { if (filmMode) loadFilmProjects(); }, [filmMode]);

  async function exportFilm() {
    if (!filmProjectId) return;
    try {
      setStatus('Rendering film export…');
      const r = await apiFetch('/film/projects/' + filmProjectId + '/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Could not export film.');
      setStatus('Film export ready');
      notify('Film export rendered successfully', 'success');
      if (data.export?.output) window.open(data.export.output, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setStatus(e.message || 'Film export failed');
      notify(e.message || 'Film export failed', 'error');
    }
  }

  async function cancelGeneration() {
    if (!activeJobId) return;
    try {
      const r = await apiFetch('/jobs/' + activeJobId + '/cancel', { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Could not cancel generation.');
      setStatus('Generation cancelled');
      notify('Generation cancelled');
    } catch (e) {
      notify(e.message || 'Could not cancel generation', 'error');
    }
  }

  async function retryGeneration() {
    if (!retryJobId || generating) return;
    try {
      setGenerating(true);
      setStatus('Retrying generation…');
      const r = await apiFetch('/jobs/' + retryJobId + '/retry', { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Could not retry generation.');
      setActiveJobId(data.job.id);
      setRetryJobId(null);
      notify('Generation retry queued');
      for (;;) {
        await new Promise(resolve => setTimeout(resolve, 2500));
        const poll = await apiFetch('/jobs/' + data.job.id);
        const state = await poll.json();
        if (!poll.ok) throw new Error(state.error || 'Could not read retry job.');
        if (state.job?.status === 'completed') { setResult(state.job.result); setStatus('Completed'); notify('Retry completed', 'success'); break; }
        if (state.job?.status === 'failed') { setRetryJobId(data.job.id); throw new Error(state.job.error || 'Retry failed.'); }
        if (state.job?.status === 'cancelled') { setStatus('Retry cancelled'); break; }
        setStatus(state.job?.status === 'running' ? 'Generating…' : 'Queued…');
      }
    } catch (e) {
      setStatus(e.message || 'Retry failed');
      notify(e.message || 'Retry failed', 'error');
    } finally {
      setGenerating(false);
      setActiveJobId(null);
    }
  }

  async function importResultToProject() {
    const generationId = result?.generation?.id;
    if (!generationId || !filmProjectId) {
      notify('Select a film project before adding this generation.', 'error');
      return;
    }
    try {
      const r = await apiFetch('/film/projects/' + filmProjectId + '/import-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationId })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Could not add generation to project.');
      setFilmProject(data.project);
      setFilmProjects(prev => prev.map(p => p.id === data.project.id ? data.project : p));
      notify('Generation added as a project take', 'success');
      setStatus('Generation added to film project');
    } catch (e) {
      notify(e.message || 'Could not add generation to project', 'error');
    }
  }

  async function generate() {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setProgress(8);
    notify('Generation queued');
    setStatus(provider === 'huggingface-ltx' ? 'Queued for LTX…' : provider.startsWith('luma') ? 'Queued for Luma…' : 'Queued for provider…');
    setResult(null);
    try {
      const r = await apiFetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, prompt, duration, ratio, framing, cameraMovement, lighting, referenceGenerationId, projectId: filmProjectId || null, shotId: editDraft?.shotId || selectedShotId || null })
      });
      const queued = await r.json();
      if (!r.ok) throw new Error(queued.error || 'Could not queue generation.');
      const jobId = queued.job?.id;
      if (!jobId) throw new Error('The server did not return a job ID.');
      setActiveJobId(jobId);
      setRetryJobId(null);

      for (;;) {
        await new Promise(resolve => setTimeout(resolve, 2500));
        const poll = await apiFetch('/jobs/' + jobId);
        const data = await poll.json();
        if (!poll.ok) throw new Error(data.error || 'Could not read generation job.');
        if (data.job?.status === 'cancelled') { setStatus('Generation cancelled'); notify('Generation cancelled'); break; }
        if (data.job?.status === 'completed') {
          setResult(data.job.result);
          setStatus('Completed');
          setProgress(100);
          notify('Shot generated successfully', 'success');
          break;
        }
        if (data.job?.status === 'failed') { setRetryJobId(jobId); throw new Error(data.job.error || 'Generation failed.'); }
        if (data.job?.status === 'running') { setStatus('Generating…'); setProgress(55); }
        else { setStatus('Queued…'); setProgress(25); }
      }
    } catch (e) {
      setStatus(e.message || 'Generation failed');
      setProgress(0);
      notify(e.message || 'Generation failed', 'error');
    } finally {
      setGenerating(false);
      setActiveJobId(null);
      setTimeout(() => setProgress(0), 900);
    }
  }

  async function buildFormatPlan() {
    if (!prompt.trim() || planning) return;
    setPlanning(true);
    setStatus('Building production plan…');
    try {
      const r = await apiFetch( '/media/format-plan', {
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
      const r = await apiFetch( '/film/assist', {
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
    try {
      const r = await apiFetch('/film/projects');
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Could not load film projects.');
      setFilmProjects(data.projects || []);
    } catch (e) {
      setStatus(e.message || 'Could not load film projects');
      notify(e.message || 'Could not load film projects', 'error');
    }
  }

  async function createFilmProject() {
    const r = await apiFetch( '/film/projects', {
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
    const r = await apiFetch( '/film/projects/' + id);
    const data = await r.json();
    if (r.ok) {
      setFilmProject(data.project);
      setFilmProjectId(id);
      syncStoryDraft(data.project);
      const firstScene = data.project?.scenes?.[0];
      setSelectedSceneId(prev => prev && data.project.scenes.some(s => s.id === prev) ? prev : (firstScene?.id || ''));
      syncSceneDraft(firstScene);
    }
  }

  function syncStoryDraft(project) {
    const story = project?.story || {};
    const world = project?.world || {};
    setStoryDraft({
      premise: project?.premise || story.premise || '',
      theme: story.theme || '',
      tone: story.tone || '',
      setting: world.setting || '',
      rules: Array.isArray(world.rules) ? world.rules.join('\n') : '',
      locations: Array.isArray(world.locations) ? world.locations.join('\n') : '',
      factions: Array.isArray(world.factions) ? world.factions.join('\n') : '',
      terminology: Array.isArray(world.terminology) ? world.terminology.join('\n') : ''
    });
  }

  function syncSceneDraft(scene) {
    if (!scene) {
      setSceneDraft({ title: '', location: '', timeOfDay: '', dramaticBeat: '', characters: '', blocking: '', action: '', dialogue: '', mood: '', weather: '', props: '', description: '' });
      return;
    }
    setSceneDraft({
      title: scene.title || '', location: scene.location || '', timeOfDay: scene.timeOfDay || '',
      dramaticBeat: scene.dramaticBeat || '', characters: Array.isArray(scene.characters) ? scene.characters.join(', ') : '',
      blocking: scene.blocking || '', action: scene.action || '', dialogue: scene.dialogue || '', mood: scene.mood || '',
      weather: scene.weather || '', props: Array.isArray(scene.props) ? scene.props.join(', ') : '', description: scene.description || ''
    });
  }

  async function saveScene() {
    if (!filmProjectId || !selectedSceneId) return;
    const payload = {
      ...sceneDraft,
      characters: sceneDraft.characters.split(',').map(x => x.trim()).filter(Boolean),
      props: sceneDraft.props.split(',').map(x => x.trim()).filter(Boolean)
    };
    const r = await apiFetch( '/film/projects/' + filmProjectId + '/scenes/' + selectedSceneId, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok) { setStatus(data.error || 'Could not save scene.'); return; }
    setFilmProject(data.project);
    setStatus('Scene plan saved');
  }

  async function saveStoryWorld() {
    if (!filmProjectId) return;
    try {
      const story = { premise: storyDraft.premise, theme: storyDraft.theme, tone: storyDraft.tone };
      const world = {
        setting: storyDraft.setting,
        rules: storyDraft.rules.split('\n').map(x => x.trim()).filter(Boolean),
        locations: storyDraft.locations.split('\n').map(x => x.trim()).filter(Boolean),
        factions: storyDraft.factions.split('\n').map(x => x.trim()).filter(Boolean),
        terminology: storyDraft.terminology.split('\n').map(x => x.trim()).filter(Boolean)
      };
      let r = await apiFetch( '/film/projects/' + filmProjectId + '/story', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(story) });
      if (!r.ok) throw new Error('Could not save story.');
      r = await apiFetch( '/film/projects/' + filmProjectId + '/world', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(world) });
      if (!r.ok) throw new Error('Could not save world.');
      const fresh = await apiFetch( '/film/projects/' + filmProjectId);
      const data = await fresh.json();
      setFilmProject(data.project);
      setStatus('Story and world saved');
    } catch (e) { setStatus(e.message || 'Could not save story/world'); }
  }

  async function addCharacter() {
    if (!filmProjectId || !characterDraft.name.trim()) return;
    const r = await apiFetch( '/film/projects/' + filmProjectId + '/characters', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(characterDraft)
    });
    const data = await r.json();
    if (!r.ok) { setStatus(data.error || 'Could not add character'); return; }
    setFilmProject(data.project);
    setCharacterDraft({ name:'', role:'', appearance:'', personality:'', description:'' });
    setStatus('Character added to story bible');
  }

  async function renderSelectedShot() {
    if (!filmProjectId || !editDraft.shotId) return;
    setStatus('Rendering shot with FFmpeg…');
    try {
      const response = await apiFetch('/film/projects/' + filmProjectId + '/shots/' + editDraft.shotId + '/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not render shot.');
      const fresh = await apiFetch('/film/projects/' + filmProjectId);
      const project = await fresh.json();
      setFilmProject(project.project);
      setStatus('Rendered shot saved as a new media asset');
    } catch (error) {
      setStatus(error.message || 'Shot render failed');
    }
  }

  async function saveShotProductionTools() {
    if (!filmProjectId || !editDraft.shotId) return;
    const r = await apiFetch( '/film/projects/' + filmProjectId + '/shots/' + editDraft.shotId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        duration,
        edit: editDraft,
        effects: effectDraft,
        audioMix: audioDraft
      })
    });
    const data = await r.json();
    if (!r.ok) { setStatus(data.error || 'Could not save shot production settings.'); return; }
    setFilmProject(data.project);
    setStatus('Shot production settings saved');
  }

  async function addFilmScene() {
    if (!filmProjectId) return;
    const r = await apiFetch( '/film/projects/' + filmProjectId + '/scenes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Scene', description: filmIdea || 'Scene description', dramaticBeat: '', characters: [], blocking: '', action: '', dialogue: '', mood: '', weather: '', props: [] })
    });
    const data = await r.json();
    if (r.ok) {
      setFilmProject(data.project);
      const created = data.project.scenes[data.project.scenes.length - 1];
      setSelectedSceneId(created?.id || '');
      syncSceneDraft(created);
      setStatus('Scene created');
    }
  }

  async function addFilmShot() {
    if (!filmProjectId) return;
    const r = await apiFetch( '/film/projects/' + filmProjectId + '/shots', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...shotDraft, sceneId: shotDraft.sceneId || selectedSceneId || filmProject?.scenes?.[0]?.id || null })
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
    const r = await apiFetch( '/film/projects/' + filmProjectId + '/takes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...takeDraft, shotId })
    });
    const data = await r.json();
    if (r.ok) {
      const fresh = await apiFetch( '/film/projects/' + filmProjectId);
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
      const r = await apiFetch( '/film/projects/' + filmProjectId + '/assets/upload', { method: 'POST', body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Could not upload media.');
      const fresh = await apiFetch( '/film/projects/' + filmProjectId);
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
    const r = await apiFetch( '/film/projects/' + filmProjectId + '/assets/' + assetId + '/attach-take', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ takeId })
    });
    const data = await r.json();
    if (r.ok) setFilmProject(data.project);
  }

  async function runContinuityCheck() {
    if (!filmProjectId) return;
    try {
      setStatus('Checking continuity…');
      const r = await apiFetch('/film/projects/' + filmProjectId + '/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'continuity' }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Continuity check failed.');
      setContinuityReport(data);
      setStatus('Continuity check complete');
      notify(data.recommendations?.length ? data.recommendations.length + ' continuity findings' : 'Continuity looks consistent', data.recommendations?.length ? 'info' : 'success');
    } catch (e) { notify(e.message || 'Continuity check failed', 'error'); }
  }

  async function reviewFilmProject(mode = 'review') {
    if (!filmProjectId) return;
    const r = await apiFetch( '/film/projects/' + filmProjectId + '/assistant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode })
    });
    const data = await r.json();
    if (r.ok) { setFilmReview(data); setFilmTab('assistant'); setStatus('Production review ready'); }
  }

  async function selectFilmTake(shotId, takeId) {
    const r = await apiFetch( '/film/projects/' + filmProjectId + '/shots/' + shotId + '/select-take', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ takeId })
    });
    const data = await r.json();
    if (r.ok) setFilmProject(data.project);
  }

  const filmShots = filmProject?.shots || [];
  const filmTakes = filmProject?.takes || [];

  const isLuma = provider.startsWith('luma');
  const selectedProviderInfo = providers.find(item => item.id === provider);

  if (!authReady) return <div className="auth-screen"><div className="auth-card">Checking access…</div></div>;

  if (!authenticated) {
    return (
      <div className="auth-screen">
        <form className="auth-card" onSubmit={(event) => { event.preventDefault(); authMode === 'login' ? login() : register(); }}>
          <div className="eyebrow">PRIVATE WORKSPACE</div>
          <h1>Cinematic Agent</h1>
          <p>{authMode === 'login' ? 'Sign in to access your production workspace.' : 'Create your filmmaking workspace account.'}</p>
          <input type="email" value={loginEmail} onChange={event => setLoginEmail(event.target.value)} placeholder="Email address" autoComplete="email" autoFocus />
          <input type="password" value={loginPassword} onChange={event => setLoginPassword(event.target.value)} placeholder="Password (8+ characters)" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} />
          {loginError && <div className="auth-error">{loginError}</div>}
          <button type="submit">{authMode === 'login' ? 'Sign in' : 'Create account'}</button>
          <button type="button" className="ghost auth-switch" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setLoginError(''); }}>{authMode === 'login' ? 'Create a new account' : 'Back to sign in'}</button>
        </form>
      </div>
    );
  }

  const navItems = [
    ['generator', '/generator', 'Generator', 'Sparkles'],
    ['projects', '/projects', 'Projects', 'LayoutDashboard'],
    ['story', '/story', 'Story & World', 'BookOpen'],
    ['shots', '/shots', 'Scenes & Shots', 'Clapperboard'],
    ['takes', '/takes', 'Takes & Camera', 'Camera'],
    ['continuity', '/continuity', 'Continuity', 'Link'],
    ['assets', '/assets', 'Media Assets', 'FolderOpen'],
    ['assistant', '/assistant', 'AI Production Help', 'WandSparkles']
  ];

  return <div className={`app-shell density-${density}`}>
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="brand">
        <div className="brand-mark"><Icon name="Clapperboard" size={20}/></div>
        <div><strong>Cinematic Agent</strong><span>AI filmmaking workspace</span></div>
      </div>
      <nav className="sidebar-nav">
        <span className="nav-label">WORKSPACE</span>
        {navItems.map(([id, path, label, icon]) => <button key={id} className={routes[route] === id ? 'nav-item active' : 'nav-item'} onClick={() => navigate(path)} aria-current={routes[route] === id ? 'page' : undefined}>
          <Icon name={icon} size={18}/><span>{label}</span>
        </button>)}
        <span className="nav-label">SYSTEM</span>
        <button className={routes[route] === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('/settings')} aria-current={routes[route] === 'settings' ? 'page' : undefined}><Icon name="Settings" size={18}/><span>Appearance</span></button>
      </nav>
      <div className="sidebar-bottom">
        <div className="connection-status"><span className="status-dot"/><span>Engine connected</span></div>
        <button className="nav-item" onClick={logout}><Icon name="LogOut" size={18}/><span>Sign out</span></button>
      </div>
    </aside>
    <div className="app">
    <header>
      <div><div className="eyebrow">AI FILMMAKING</div><h1>Cinematic Agent</h1><p>Describe what you want. The engine handles the production path.</p></div>
      <div className="header-actions">
        <div className="provider-chip"><Icon name="Zap" size={15}/><b>{provider === 'auto' ? 'Auto routing' : (selectedProviderInfo?.name || 'Provider')}</b></div>
        <button className="menu-button" onClick={() => navigate('/settings')} aria-label="Open appearance settings" title="Appearance"><Icon name="Settings" size={18}/></button>
      </div>
    </header>

    {showSettings && <section className="panel settings appearance-panel"><h2>Appearance</h2><p className="hint">Visual preferences will live here. Provider credentials remain server-side environment configuration and are never exposed as user-editable workspace fields.</p><label>Interface density<select value={density} onChange={e => setDensity(e.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label></section>}

    {showWorkspaceMenu && <section className="panel dashboard-panel">
      <div className="section-head">
        <div><div className="eyebrow">WORKSPACE</div><h2>Production dashboard</h2><span className="hint">Resume a project or continue a visual sequence without searching through the workspace.</span></div>
        <span className="tag">{filmProjects.length} projects · {filmProjects.reduce((n, p) => n + (p.shots?.length || 0), 0)} shots</span>
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-card dashboard-new">
          <div className="dashboard-icon"><Icon name="Plus" size={20}/></div>
          <div><strong>Start a film project</strong><span>Open the full production workspace for scenes, shots, takes, assets and continuity.</span></div>
          <button onClick={() => { setFilmMode(true); setFilmProject(null); setFilmProjectId(''); }}>Create / open production</button>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-card-head"><strong>Film projects</strong><span>{filmProjects.length}</span></div>
          <div className="dashboard-list">
            {filmProjects.slice(0, 4).map(project => <button key={project.id} className="dashboard-item" onClick={() => { setFilmMode(true); loadFilmProject(project.id); }}>
              <span><b>{project.title}</b><small>{project.genre || 'Genre not set'} · {project.scenes?.length || 0} scenes · {project.shots?.length || 0} shots</small></span><span>→</span>
            </button>)}
            {!filmProjects.length && <span className="hint">No film projects yet. Start one when you are ready.</span>}
          </div>
        </div>
    {showWorkspaceMenu && filmMode && <section className="panel film-assistant">
      <div className="section-head">
        <div><h2><Icon name="WandSparkles" size={18}/> Director Assistant</h2><span className="hint">Use normal filmmaking language. The agent turns your idea into scenes, shots, continuity and production tasks.</span></div>
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
    </section>}

    {filmMode && <section className="panel film-workspace">
      <div className="section-head">
        <div><h2><Icon name="Clapperboard" size={18}/> Normal Film Production Workspace</h2><span className="hint">Plan the film, record real camera takes, track continuity, then bring approved media into the edit.</span></div>
        <span className="tag">PRODUCTION</span>
      </div>
      <div className="film-project-bar">
        <select value={filmProjectId} onChange={e => { setFilmProjectId(e.target.value); loadFilmProject(e.target.value); }}>
          <option value="">Select a film project</option>
          {filmProjects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <button onClick={createFilmProject}>New film project</button><button onClick={exportFilm} disabled={!filmProjectId}>Export timeline</button>
      </div>
      {!filmProject ? <div className="workspace-empty"><strong>Start a real production project</strong><span>Create a project to get scenes, a shot list, take logging and continuity tracking.</span></div> :
      <div className="workspace-body">
        <div className="workspace-tabs" role="tablist" aria-label="Production workspace">
          <button className={filmTab === 'story' ? 'active' : ''} onClick={() => { setFilmTab('story'); syncStoryDraft(filmProject); }}>Story & World</button>
          <button className={filmTab === 'shots' ? 'active' : ''} onClick={() => setFilmTab('shots')}>Shot List</button>
          <button className={filmTab === 'takes' ? 'active' : ''} onClick={() => setFilmTab('takes')}>Camera / Takes</button>
          <button className={filmTab === 'continuity' ? 'active' : ''} onClick={() => setFilmTab('continuity')}>Continuity</button>
          <button className={filmTab === 'assets' ? 'active' : ''} onClick={() => setFilmTab('assets')}>Media Assets</button>
          <button className={filmTab === 'assistant' ? 'active' : ''} onClick={() => setFilmTab('assistant')}>AI Help</button>
        </div>

        {(filmTab === 'shots' || filmTab === 'takes' || filmTab === 'assets') && <div className="production-tool-dock">
          <div className="production-tool-heading">
            <div><strong>Production tools</strong><span>Open only the tool group you need for the current shot or take.</span></div>
            <button className="tool-collapse" onClick={() => setProductionTool('')}>Collapse</button>
          </div>
          <div className="production-tool-icons" role="tablist" aria-label="Production tools">
            {[
              ['shot','Clapperboard','Shot'],
              ['camera','Camera','Camera'],
              ['edit','Scissors','Edit'],
              ['effects','Sparkles','Effects'],
              ['audio','Volume','Audio'],
              ['layers','Layers','Layers'],
              ['timing','Timer','Timing']
            ].map(([id,icon,label]) => <button key={id} role="tab" aria-selected={productionTool === id} className={productionTool === id ? 'production-tool-icon active' : 'production-tool-icon'} onClick={() => setProductionTool(productionTool === id ? '' : id)} title={label + ' tools'}><span><Icon name={icon} size={16}/></span><small>{label}</small></button>)}
          </div>

          {productionTool === 'shot' && <div className="production-tool-panel">
            <div className="tool-panel-head"><strong>Shot controls</strong><span>Build the next shot without filling the whole workspace.</span></div>
            <div className="tool-control-grid">
              <label>Framing<select value={shotDraft.framing} onChange={e => setShotDraft({...shotDraft,framing:e.target.value})}><option>wide shot</option><option>full shot</option><option>medium shot</option><option>close-up</option><option>extreme close-up</option></select></label>
              <label>Angle<select value={shotDraft.angle} onChange={e => setShotDraft({...shotDraft,angle:e.target.value})}><option>eye level</option><option>low angle</option><option>high angle</option><option>over the shoulder</option><option>POV</option></select></label>
              <label>Movement<select value={shotDraft.movement} onChange={e => setShotDraft({...shotDraft,movement:e.target.value})}><option>static</option><option>pan</option><option>tilt</option><option>push-in</option><option>tracking</option><option>handheld</option></select></label>
              <label>Lens<input value={shotDraft.lens} onChange={e => setShotDraft({...shotDraft,lens:e.target.value})}/></label>
            </div>
            <div className="tool-actions">
              <button onClick={addFilmShot}>Add shot to production</button>
              <button className="ghost" disabled={!result?.generation?.id} onClick={() => { if (result?.generation?.id) { setReferenceGenerationId(result.generation.id); setPrompt(prompt + ' Continue from the selected shot, preserving character, location and visual identity.'); setStatus('Current result set as the next-shot reference'); } }}>Use current result as next shot</button>
            </div>
          </div>}

          {productionTool === 'camera' && <div className="production-tool-panel">
            <div className="tool-panel-head"><strong>Camera & capture</strong><span>Record the physical camera settings for the selected take.</span></div>
            <div className="tool-control-grid">
              <label>Camera<input value={takeDraft.camera} onChange={e => setTakeDraft({...takeDraft,camera:e.target.value})} placeholder="Camera body"/></label>
              <label>Lens<input value={takeDraft.lens} onChange={e => setTakeDraft({...takeDraft,lens:e.target.value})}/></label>
              <label>FPS<input type="number" value={takeDraft.fps} onChange={e => setTakeDraft({...takeDraft,fps:Number(e.target.value)})}/></label>
              <label>Shutter<input value={takeDraft.shutter} onChange={e => setTakeDraft({...takeDraft,shutter:e.target.value})}/></label>
              <label>ISO<input value={takeDraft.iso} onChange={e => setTakeDraft({...takeDraft,iso:e.target.value})}/></label>
              <label>White balance<input value={takeDraft.whiteBalance} onChange={e => setTakeDraft({...takeDraft,whiteBalance:e.target.value})}/></label>
            </div>
            <div className="tool-actions"><button disabled={!takeDraft.shotId} onClick={() => addFilmTake(takeDraft.shotId)}>Save camera take</button><span className="hint">Choose “Log take” below to attach these settings to a specific shot.</span></div>
          </div>}

          {productionTool === 'edit' && <div className="production-tool-panel">
            <div className="tool-panel-head"><strong>Edit this shot</strong><span>Set editorial instructions for the selected take.</span></div>
            <div className="tool-control-grid">
              <label>Shot<select value={editDraft.shotId} onChange={e => setEditDraft({...editDraft,shotId:e.target.value})}><option value="">Choose shot</option>{filmShots.map(s => <option key={s.id} value={s.id}>Shot {s.number}</option>)}</select></label>
              <label>Trim in (sec)<input type="number" min="0" step="0.1" value={editDraft.trimIn} onChange={e => setEditDraft({...editDraft,trimIn:Number(e.target.value)})}/></label>
              <label>Trim out (sec)<input type="number" min="0" step="0.1" value={editDraft.trimOut} onChange={e => setEditDraft({...editDraft,trimOut:Number(e.target.value)})}/></label>
              <label>Speed<select value={editDraft.speed} onChange={e => setEditDraft({...editDraft,speed:Number(e.target.value)})}><option value="0.5">0.5× slow</option><option value="1">1× normal</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>
              <label>Transition<select value={editDraft.transition} onChange={e => setEditDraft({...editDraft,transition:e.target.value})}><option>cut</option><option>cross dissolve</option><option>fade</option><option>dip to black</option><option>match cut</option></select></label>
              <label>Volume %<input type="number" min="0" max="200" value={editDraft.volume} onChange={e => setEditDraft({...editDraft,volume:Number(e.target.value)})}/></label>
            </div>
            <div className="tool-actions"><button disabled={!editDraft.shotId} onClick={saveShotProductionTools}>Save shot edit settings</button><button disabled={!editDraft.shotId} onClick={renderSelectedShot}>Render shot</button></div>
            <div className="tool-note">Render shot applies the supported trim, speed, basic look and master-volume operations to the selected take and saves a new media asset. Multi-shot transitions, background replacement and separate audio stems remain later-stage operations.</div>
          </div>}

          {productionTool === 'effects' && <div className="production-tool-panel">
            <div className="tool-panel-head"><strong>Effects & look</strong><span>Prepare visual treatment without crowding the shot builder.</span></div>
            <div className="tool-control-grid">
              <label>Effect<select value={effectDraft.effect} onChange={e => setEffectDraft({...effectDraft,effect:e.target.value})}><option>none</option><option>film grain</option><option>soft glow</option><option>motion blur</option><option>vignette</option><option>black and white</option><option>cinematic contrast</option></select></label>
              <label>Intensity %<input type="number" min="0" max="100" value={effectDraft.intensity} onChange={e => setEffectDraft({...effectDraft,intensity:Number(e.target.value)})}/></label>
              <label>Background<select value={effectDraft.background} onChange={e => setEffectDraft({...effectDraft,background:e.target.value})}><option>original</option><option>replace</option><option>remove</option><option>blur</option></select></label>
              <label>Overlay<input value={effectDraft.overlay} onChange={e => setEffectDraft({...effectDraft,overlay:e.target.value})} placeholder="Optional visual layer"/></label>
            </div>
            <label className="tool-check"><input type="checkbox" checked={effectDraft.stabilization} onChange={e => setEffectDraft({...effectDraft,stabilization:e.target.checked})}/> Stabilize camera movement</label>
            <div className="tool-actions"><button disabled={!editDraft.shotId} onClick={saveShotProductionTools}>Save effects & background settings</button></div>
          </div>}

          {productionTool === 'audio' && <div className="production-tool-panel">
            <div className="tool-panel-head"><strong>Audio</strong><span>Keep dialogue, ambience, music and SFX controls close to the shot.</span></div>
            <div className="tool-control-grid">
              <label>Dialogue volume %<input type="number" min="0" max="200" value={audioDraft.dialogue} onChange={e => setAudioDraft({...audioDraft,dialogue:Number(e.target.value)})}/></label>
              <label>Music volume %<input type="number" min="0" max="200" value={audioDraft.music} onChange={e => setAudioDraft({...audioDraft,music:Number(e.target.value)})}/></label>
              <label>SFX volume %<input type="number" min="0" max="200" value={audioDraft.sfx} onChange={e => setAudioDraft({...audioDraft,sfx:Number(e.target.value)})}/></label>
              <label>Ambience volume %<input type="number" min="0" max="200" value={audioDraft.ambience} onChange={e => setAudioDraft({...audioDraft,ambience:Number(e.target.value)})}/></label>
            </div>
            <div className="tool-actions"><button disabled={!editDraft.shotId} onClick={saveShotProductionTools}>Save audio mix settings</button></div>
          </div>}

          {productionTool === 'layers' && <div className="production-tool-panel">
            <div className="tool-panel-head"><strong>Background & layers</strong><span>Think in editable layers: base video, background, foreground, text and overlays.</span></div>
            <div className="tool-layer-list">
              {[
                ['base','Base shot','Primary video','Clapperboard'],
                ['background','Background','Replace / remove / blur','FolderOpen'],
                ['foreground','Foreground effect','VFX / atmosphere','Sparkles'],
                ['text','Text / title','Optional overlay','WandSparkles'],
                ['audio','Audio bed','Music / ambience / SFX','Camera']
              ].map(([id,label,description,icon]) => <button key={id} className={selectedLayer === id ? 'tool-layer active' : 'tool-layer'} onClick={() => { setSelectedLayer(id); setStatus(label + ' layer selected'); }} aria-pressed={selectedLayer === id}><Icon name={icon} size={16}/><b>{label}</b><span>{description}</span></button>)}
            </div>
          </div>}

          {productionTool === 'timing' && <div className="production-tool-panel">
            <div className="tool-panel-head"><strong>Timing & sequence</strong><span>Control how this shot connects to the next shot.</span></div>
            <div className="tool-control-grid">
              <label>Shot duration sec<input type="number" min="0.1" step="0.1" value={duration} onChange={e => setDuration(Number(e.target.value))}/></label>
              <label>Transition<select value={editDraft.transition} onChange={e => setEditDraft({...editDraft,transition:e.target.value})}><option>cut</option><option>cross dissolve</option><option>fade</option><option>dip to black</option><option>match cut</option></select></label>
              <label>Next-shot action<select defaultValue="continue"><option value="continue">Continue scene</option><option value="reaction">Reaction shot</option><option value="insert">Insert / detail</option><option value="wide">Return to wide</option><option value="new-scene">New scene</option></select></label>
            </div>
            <div className="tool-actions"><button className="ghost" disabled={!result?.generation?.id} onClick={() => { if (result?.generation?.id) { setReferenceGenerationId(result.generation.id); setStatus('Next shot will use this result as its visual reference'); } }}>Carry current shot into next shot</button></div>
          </div>}
        </div>}

        {filmTab === 'takes' && <section className="timeline-panel" aria-label="Film timeline">
          <div className="timeline-head">
            <div><span className="eyebrow">EDIT TIMELINE</span><h3>Selected takes</h3><span className="hint">Each clip is a real project take. Trim, speed, effects and audio settings are applied when rendered.</span></div>
            <div className="timeline-actions"><button className="secondary-button" onClick={exportFilm} disabled={!filmProjectId}>Export review cut</button></div>
          </div>
          <div className="timeline-ruler" aria-hidden="true">{[0,2,4,6,8,10,12].map(t => <span key={t}>{t}s</span>)}</div>
          <div className="timeline-track">
            {(filmShots || []).map((shot, index) => {
              const take = (filmProject?.takes || []).find(t => t.id === shot.selectedTakeId) || (filmProject?.takes || []).find(t => t.shotId === shot.id);
              const asset = take?.assetId ? (filmProject?.assets || []).find(a => a.id === take.assetId) : null;
              const durationValue = Number(shot.duration || asset?.duration || 2) || 2;
              return <button key={shot.id} className={shot.selectedTakeId ? 'timeline-clip ready' : 'timeline-clip'} onClick={() => { setProductionTool('edit'); setEditDraft(d => ({...d, shotId: shot.id, ...(shot.edit || {})})); }} title={take ? 'Open edit controls for this take' : 'No take selected'}>
                <span className="clip-index">{index + 1}</span><strong>Shot {shot.number}</strong><span>{take ? 'Take ' + take.takeNumber : 'No take'}</span><b>{durationValue.toFixed(1)}s</b>
              </button>;
            })}
            {!filmShots?.length && <div className="timeline-empty">Add shots to see them on the timeline.</div>}
          </div>
          <div className="timeline-summary"><span>{filmShots?.length || 0} clips</span><span>{(filmProject?.takes || []).filter(t => t.selected).length} selected takes</span><span>Export uses project shot order</span></div>
        </section>}

        <div className="workspace-tool-dock">
          <div className="workspace-tool-heading">
            <div><strong>{filmTab === 'story' ? 'Story tools' : filmTab === 'shots' ? 'Scene tools' : filmTab === 'takes' ? 'Take tools' : filmTab === 'continuity' ? 'Continuity tools' : filmTab === 'assets' ? 'Asset tools' : 'AI director tools'}</strong><span>Keep specialist actions collapsed until you need them.</span></div>
            <button className="tool-collapse" onClick={() => setWorkspaceTool('')}>Collapse</button>
          </div>
          <div className="workspace-tool-icons">
            {(filmTab === 'story' ? [
              ['premise','FileText','Premise'],['characters','User','Characters'],['world','Globe','World'],['rules','ScrollText','Rules']
            ] : filmTab === 'shots' ? [
              ['scene','Clapperboard','Scene'],['blocking','Move','Blocking'],['coverage','Camera','Coverage'],['dialogue','Message','Dialogue'],['next','ArrowRight','Next shot']
            ] : filmTab === 'takes' ? [
              ['select','Check','Select'],['camera-log','Camera','Camera log'],['compare','Scale','Compare'],['notes','FileText','Notes']
            ] : filmTab === 'continuity' ? [
              ['characters-state','User','Characters'],['props-state','Box','Props'],['direction','ArrowLeftRight','Direction'],['lighting-state','Lightbulb','Lighting'],['qc','Check','QC']
            ] : filmTab === 'assets' ? [
              ['import','Upload','Import'],['organize','FolderOpen','Organize'],['inspect','Search','Inspect'],['attach','Link','Attach'],['integrity','Shield','Integrity']
            ] : [
              ['review','Brain','Review'],['coverage-ai','Camera','Coverage'],['continuity-ai','RefreshCw','Continuity'],['next-step','ArrowRight','Next step']
            ]).map(([id,icon,label]) => <button key={id} className={workspaceTool === id ? 'production-tool-icon active' : 'production-tool-icon'} onClick={() => setWorkspaceTool(workspaceTool === id ? '' : id)} title={label}><span><Icon name={icon} size={16}/></span><small>{label}</small></button>)}
          </div>

          {filmTab === 'story' && workspaceTool === 'premise' && <div className="workspace-tool-panel">
            <div className="tool-panel-head"><strong>Story premise</strong><span>Keep the central conflict visible while developing the project.</span></div>
            <label>Core premise<textarea rows="3" value={storyDraft.premise} onChange={e => setStoryDraft({...storyDraft,premise:e.target.value})} placeholder="Who wants what, what stands in the way, and why does it matter?"/></label>
            <div className="tool-actions"><button onClick={saveStoryWorld}>Save story premise</button></div>
          </div>}
          {filmTab === 'story' && workspaceTool === 'characters' && <div className="workspace-tool-panel">
            <div className="tool-panel-head"><strong>Character quick add</strong><span>Characters become persistent production references.</span></div>
            <div className="tool-control-grid"><label>Name<input value={characterDraft.name} onChange={e => setCharacterDraft({...characterDraft,name:e.target.value})}/></label><label>Role<input value={characterDraft.role} onChange={e => setCharacterDraft({...characterDraft,role:e.target.value})}/></label><label>Appearance<input value={characterDraft.appearance} onChange={e => setCharacterDraft({...characterDraft,appearance:e.target.value})}/></label><label>Personality<input value={characterDraft.personality} onChange={e => setCharacterDraft({...characterDraft,personality:e.target.value})}/></label></div>
            <div className="tool-actions"><button disabled={!characterDraft.name.trim()} onClick={addCharacter}>Add character</button><span className="hint">{filmProject?.characters?.length || 0} characters in this project.</span></div>
          </div>}
          {filmTab === 'story' && workspaceTool === 'world' && <div className="workspace-tool-panel">
            <div className="tool-panel-head"><strong>World quick editor</strong><span>Locations, factions and terminology drive visual continuity.</span></div>
            <div className="tool-control-grid"><label>Setting<input value={storyDraft.setting} onChange={e => setStoryDraft({...storyDraft,setting:e.target.value})}/></label><label>Locations<textarea rows="2" value={storyDraft.locations} onChange={e => setStoryDraft({...storyDraft,locations:e.target.value})}/></label><label>Factions<textarea rows="2" value={storyDraft.factions} onChange={e => setStoryDraft({...storyDraft,factions:e.target.value})}/></label><label>Terminology<textarea rows="2" value={storyDraft.terminology} onChange={e => setStoryDraft({...storyDraft,terminology:e.target.value})}/></label></div>
            <div className="tool-actions"><button onClick={saveStoryWorld}>Save world</button></div>
          </div>}
          {filmTab === 'story' && workspaceTool === 'rules' && <div className="workspace-tool-panel">
            <div className="tool-panel-head"><strong>World rules</strong><span>Rules prevent the AI from inventing contradictions.</span></div>
            <label>Rules<textarea rows="4" value={storyDraft.rules} onChange={e => setStoryDraft({...storyDraft,rules:e.target.value})} placeholder="One rule per line. Example: this technology only works at night."/></label>
            <div className="tool-actions"><button onClick={saveStoryWorld}>Save rules</button></div>
          </div>}

          {filmTab === 'shots' && workspaceTool === 'scene' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Scene control</strong><span>Choose the active scene and its narrative purpose.</span></div><div className="tool-control-grid"><label>Scene<select value={selectedSceneId || ''} onChange={e => { setSelectedSceneId(e.target.value); const scene=(filmProject.scenes||[]).find(x=>x.id===e.target.value); if(scene) syncSceneDraft(scene); }}><option value="">Choose scene</option>{(filmProject.scenes||[]).map(x=><option key={x.id} value={x.id}>Scene {x.number} · {x.title}</option>)}</select></label><label>Title<input value={sceneDraft.title} onChange={e=>setSceneDraft({...sceneDraft,title:e.target.value})}/></label><label>Mood<input value={sceneDraft.mood} onChange={e=>setSceneDraft({...sceneDraft,mood:e.target.value})}/></label><label>Dramatic beat<input value={sceneDraft.dramaticBeat} onChange={e=>setSceneDraft({...sceneDraft,dramaticBeat:e.target.value})}/></label></div><div className="tool-actions"><button disabled={!selectedSceneId} onClick={saveScene}>Save scene</button><button className="ghost" onClick={addFilmScene}>+ New scene</button></div></div>}
          {filmTab === 'shots' && workspaceTool === 'blocking' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Blocking & geography</strong><span>Define where characters are and how they move through the scene.</span></div><label>Blocking<textarea rows="3" value={sceneDraft.blocking} onChange={e=>setSceneDraft({...sceneDraft,blocking:e.target.value})} placeholder="Entry, movement, exits, eyelines, screen direction…"/></label><div className="tool-actions"><button disabled={!selectedSceneId} onClick={saveScene}>Save blocking</button></div></div>}
          {filmTab === 'shots' && workspaceTool === 'coverage' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Coverage check</strong><span>Use the shot list to cover the scene from multiple editorial angles.</span></div><div className="tool-layer-list"><button className="tool-layer active"><Icon name="Clapperboard" size={16}/><b>Establishing</b> <span>Where are we?</span></button><button className="tool-layer"><Icon name="Zap" size={16}/><b>Action</b> <span>What happens?</span></button><button className="tool-layer"><Icon name="CircleAlert" size={16}/><b>Reaction</b> <span>How does it feel?</span></button><button className="tool-layer"><Icon name="Search" size={16}/><b>Insert</b> <span>Important detail</span></button></div><div className="tool-actions"><button onClick={() => reviewFilmProject('coverage')}>Run production coverage review</button></div></div>}
          {filmTab === 'shots' && workspaceTool === 'dialogue' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Dialogue & action</strong><span>Keep spoken intent connected to physical performance.</span></div><div className="tool-control-grid"><label>Dialogue<textarea rows="3" value={sceneDraft.dialogue} onChange={e=>setSceneDraft({...sceneDraft,dialogue:e.target.value})}/></label><label>Action<textarea rows="3" value={sceneDraft.action} onChange={e=>setSceneDraft({...sceneDraft,action:e.target.value})}/></label></div><div className="tool-actions"><button disabled={!selectedSceneId} onClick={saveScene}>Save scene performance</button></div></div>}
          {filmTab === 'shots' && workspaceTool === 'next' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Next-shot planning</strong><span>Carry visual continuity forward instead of treating every shot as isolated.</span></div><div className="tool-actions"><button disabled={!result?.generation?.id} onClick={()=>{if(result?.generation?.id){setReferenceGenerationId(result.generation.id);setStatus('Current generated result is the visual reference for the next shot.')}}}>Carry current result forward</button><button className="ghost" onClick={()=>setProductionTool('timing')}>Open timing tools</button></div></div>}

          {filmTab === 'takes' && workspaceTool === 'select' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Select take</strong><span>Choose the take that becomes the current approved version.</span></div><div className="tool-layer-list">{filmShots.map(x=><button key={x.id} className="tool-layer" onClick={()=>{const t=filmTakes.filter(y=>y.shotId===x.id)[0]; if(t) selectFilmTake(x.id,t.id);}}><b>Shot {x.number}</b><span>{filmTakes.filter(y=>y.shotId===x.id).length} takes</span></button>)}</div></div>}
          {filmTab === 'takes' && workspaceTool === 'camera-log' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Camera log</strong><span>Compare technical settings before choosing a take.</span></div><div className="tool-layer-list">{filmTakes.slice(0,10).map(t=><button key={t.id} className="tool-layer"><b>Take {t.takeNumber}</b><span>{t.camera||'Camera —'} · {t.fps||'—'}fps · ISO {t.iso||'—'} · {t.shutter||'—'}</span></button>)}</div></div>}
          {filmTab === 'takes' && workspaceTool === 'compare' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Take comparison</strong><span>Put competing takes side by side conceptually before approval.</span></div><div className="tool-layer-list">{filmShots.map(x=><button key={x.id} className="tool-layer"><b>Shot {x.number}</b><span>{filmTakes.filter(y=>y.shotId===x.id).map(y=>'Take '+y.takeNumber).join(' · ')||'No takes'}</span></button>)}</div></div>}
          {filmTab === 'takes' && workspaceTool === 'notes' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Take notes</strong><span>Use the existing take form to record performance and technical observations.</span></div><div className="tool-actions"><button className="ghost" onClick={()=>setFilmTab('takes')}>Open full take logger</button></div></div>}

          {filmTab === 'continuity' && workspaceTool === 'characters-state' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Character continuity</strong><span>Check appearance, wardrobe and state before the next shot.</span></div><div className="tool-layer-list">{(filmProject.characters||[]).map(c=><button key={c.id} className="tool-layer"><b>{c.name}</b><span>{c.appearance||'Appearance not defined'} · {c.role||'Role not defined'}</span></button>)}{!(filmProject.characters||[]).length&&<span className="hint">Add characters in Story & World first.</span>}</div></div>}
          {filmTab === 'continuity' && workspaceTool === 'props-state' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Prop continuity</strong><span>Track important objects across scenes and takes.</span></div><div className="tool-layer-list">{[...new Set((filmProject.scenes||[]).flatMap(x=>x.props||[]))].map(p=><button key={p} className="tool-layer"><b>{p}</b><span>Referenced by scene planning</span></button>)}<span className="hint">Props are currently sourced from scene plans; persistent prop-state records come next.</span></div></div>}
          {filmTab === 'continuity' && workspaceTool === 'direction' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Screen direction</strong><span>Review movement, blocking and eyeline continuity.</span></div><div className="tool-layer-list">{filmShots.slice(0,12).map(x=><button key={x.id} className="tool-layer"><b>Shot {x.number}</b><span>{x.movement} · {x.angle} · {x.description||'No description'}</span></button>)}</div></div>}
          {filmTab === 'continuity' && workspaceTool === 'lighting-state' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Lighting continuity</strong><span>Compare lighting notes across the shot list.</span></div><div className="tool-layer-list">{filmShots.slice(0,12).map(x=><button key={x.id} className="tool-layer"><b>Shot {x.number}</b><span>{x.lighting||'Lighting not defined'}</span></button>)}</div></div>}
          {filmTab === 'continuity' && workspaceTool === 'qc' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Continuity QC</strong><span>Use the production assistant for a project-state review.</span></div><div className="tool-actions"><button onClick={() => reviewFilmProject('continuity')}>Run continuity / production review</button></div></div>}

          {filmTab === 'assets' && workspaceTool === 'import' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Import media</strong><span>Bring video, images or audio into the project and inspect technical metadata.</span></div><div className="tool-actions"><button onClick={()=>document.getElementById('film-asset-file-input')?.click()} disabled={uploadingAsset}>Choose media file</button><span className="hint">The existing uploader will hash and inspect the file.</span></div></div>}
          {filmTab === 'assets' && workspaceTool === 'organize' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Organize assets</strong><span>Group assets by project, shot and take.</span></div><div className="tool-layer-list">{(filmProject.assets||[]).slice(0,12).map(a=><button key={a.id} className="tool-layer"><b>{a.name}</b><span>{a.shotId?'Shot linked':'Project asset'} · {a.mimeType||'unknown'}</span></button>)}</div></div>}
          {filmTab === 'assets' && workspaceTool === 'inspect' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Media inspection</strong><span>Technical metadata captured during import.</span></div><div className="tool-layer-list">{(filmProject.assets||[]).slice(0,12).map(a=><button key={a.id} className="tool-layer"><b>{a.name}</b><span>{a.width&&a.height?a.width+'×'+a.height:'dimensions —'} · {a.duration!=null?a.duration+'s':'duration —'} · {a.codec||'codec —'}</span></button>)}</div></div>}
          {filmTab === 'assets' && workspaceTool === 'attach' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Attach media</strong><span>Connect imported assets to takes and shots.</span></div><div className="tool-actions"><button className="ghost" onClick={()=>setFilmTab('assets')}>Use the asset cards below to attach media</button></div></div>}
          {filmTab === 'assets' && workspaceTool === 'integrity' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Asset integrity</strong><span>Checksums help identify changed or duplicated source media.</span></div><div className="tool-layer-list">{(filmProject.assets||[]).slice(0,12).map(a=><button key={a.id} className="tool-layer"><b>{a.name}</b><span>{a.sha256?'SHA-256 recorded':'No checksum'}</span></button>)}</div></div>}

          {filmTab === 'assistant' && workspaceTool === 'review' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Production review</strong><span>Analyze actual project state before deciding the next action.</span></div><div className="tool-actions"><button onClick={reviewFilmProject}>Analyze production</button></div></div>}
          {filmTab === 'assistant' && workspaceTool === 'coverage-ai' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Coverage intelligence</strong><span>Ask the existing assistant to identify missing establishing, action and reaction coverage.</span></div><div className="tool-actions"><button onClick={() => reviewFilmProject('coverage')}>Analyze coverage</button></div></div>}
          {filmTab === 'assistant' && workspaceTool === 'continuity-ai' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Continuity intelligence</strong><span>Review character, prop and screen-direction consistency.</span></div><div className="tool-actions"><button onClick={() => reviewFilmProject('continuity')}>Analyze continuity</button></div></div>}
          {filmTab === 'assistant' && workspaceTool === 'next-step' && <div className="workspace-tool-panel"><div className="tool-panel-head"><strong>Next production step</strong><span>Let the existing production review identify what is missing.</span></div><div className="tool-actions"><button onClick={() => reviewFilmProject('next-step')}>Find next action</button></div></div>}
        </div>

        {filmTab === 'story' && <div className="story-workspace">
          <div className="story-column">
            <div className="subhead"><strong>Story Bible</strong><span className="hint">Persistent creative rules for this project.</span></div>
            <label>Premise<textarea rows="4" value={storyDraft.premise} onChange={e => setStoryDraft({...storyDraft,premise:e.target.value})} placeholder="What is the core story?"/></label>
            <div className="grid3">
              <label>Theme<input value={storyDraft.theme} onChange={e => setStoryDraft({...storyDraft,theme:e.target.value})} placeholder="e.g. trust has a cost"/></label>
              <label>Tone<input value={storyDraft.tone} onChange={e => setStoryDraft({...storyDraft,tone:e.target.value})} placeholder="e.g. dark, tense"/></label>
              <label>Setting<input value={storyDraft.setting} onChange={e => setStoryDraft({...storyDraft,setting:e.target.value})} placeholder="Where/when?"/></label>
            </div>
            <div className="subhead character-head"><strong>Character Bible</strong><span className="hint">{filmProject?.characters?.length || 0} characters</span></div>
            <div className="character-form">
              <div className="grid3">
                <label>Name<input value={characterDraft.name} onChange={e => setCharacterDraft({...characterDraft,name:e.target.value})}/></label>
                <label>Role<input value={characterDraft.role} onChange={e => setCharacterDraft({...characterDraft,role:e.target.value})}/></label>
                <label>Appearance<input value={characterDraft.appearance} onChange={e => setCharacterDraft({...characterDraft,appearance:e.target.value})}/></label>
              </div>
              <div className="grid3">
                <label>Personality<input value={characterDraft.personality} onChange={e => setCharacterDraft({...characterDraft,personality:e.target.value})}/></label>
                <label className="wide-field">Description<input value={characterDraft.description} onChange={e => setCharacterDraft({...characterDraft,description:e.target.value})}/></label>
              </div>
              <button onClick={addCharacter} disabled={!characterDraft.name.trim()}>Add character</button>
            </div>
            <div className="character-list">
              {(filmProject?.characters || []).map(character => <div className="character-card" key={character.id}><b>{character.name}</b><span>{character.role || 'Role not defined'}</span><small>{character.appearance || 'Appearance not defined.'} {character.personality ? '· ' + character.personality : ''}</small></div>)}
              {!filmProject?.characters?.length && <span className="hint">Add the first character to establish persistent visual and narrative identity.</span>}
            </div>
          </div>
          <div className="story-column">
            <div className="subhead"><strong>World Bible</strong><span className="hint">One item per line.</span></div>
            <label>World rules<textarea rows="6" value={storyDraft.rules} onChange={e => setStoryDraft({...storyDraft,rules:e.target.value})} placeholder="One rule per line. Example: The system cannot reverse time."/></label>
            <label>Important locations<textarea rows="5" value={storyDraft.locations} onChange={e => setStoryDraft({...storyDraft,locations:e.target.value})} placeholder="One location per line."/></label>
            <label>Factions / groups<textarea rows="4" value={storyDraft.factions} onChange={e => setStoryDraft({...storyDraft,factions:e.target.value})} placeholder="One faction per line."/></label>
            <label>Terminology<textarea rows="4" value={storyDraft.terminology} onChange={e => setStoryDraft({...storyDraft,terminology:e.target.value})} placeholder="Important names, systems, technologies, magic terms…"/></label>
            <button onClick={saveStoryWorld}>Save story & world</button>
          </div>
        </div>}

        {filmTab === 'shots' && <div className="workspace-grid">
          <div>
            <div className="subhead"><strong>Scene builder</strong><button onClick={addFilmScene}>+ Scene</button></div>
            <div className="scene-list">{(filmProject.scenes || []).map(s => <button className={selectedSceneId === s.id ? 'scene-card active' : 'scene-card'} key={s.id} onClick={() => { setSelectedSceneId(s.id); syncSceneDraft(s); }}><b>Scene {s.number}</b><span>{s.title}</span><small>{s.dramaticBeat || s.description || 'No dramatic beat yet.'}</small></button>)}{!filmProject.scenes?.length && <span className="hint">No scenes yet.</span>}</div>
            {selectedSceneId && <div className="scene-builder-form">
              <div className="grid2">
                <label>Scene title<input value={sceneDraft.title} onChange={e => setSceneDraft({...sceneDraft,title:e.target.value})}/></label>
                <label>Location<input value={sceneDraft.location} onChange={e => setSceneDraft({...sceneDraft,location:e.target.value})} placeholder="Where does it happen?"/></label>
              </div>
              <div className="grid3">
                <label>Time of day<input value={sceneDraft.timeOfDay} onChange={e => setSceneDraft({...sceneDraft,timeOfDay:e.target.value})} placeholder="Night, dawn…"/></label>
                <label>Mood<input value={sceneDraft.mood} onChange={e => setSceneDraft({...sceneDraft,mood:e.target.value})} placeholder="Tense, joyful…"/></label>
                <label>Weather<input value={sceneDraft.weather} onChange={e => setSceneDraft({...sceneDraft,weather:e.target.value})}/></label>
              </div>
              <label>Dramatic beat<textarea rows="2" value={sceneDraft.dramaticBeat} onChange={e => setSceneDraft({...sceneDraft,dramaticBeat:e.target.value})} placeholder="What changes emotionally or narratively in this scene?"/></label>
              <label>Characters<input value={sceneDraft.characters} onChange={e => setSceneDraft({...sceneDraft,characters:e.target.value})} placeholder="Comma-separated character names"/></label>
              <label>Blocking / geography<textarea rows="2" value={sceneDraft.blocking} onChange={e => setSceneDraft({...sceneDraft,blocking:e.target.value})} placeholder="Where are the characters and how do they move?"/></label>
              <div className="grid2"><label>Action<textarea rows="3" value={sceneDraft.action} onChange={e => setSceneDraft({...sceneDraft,action:e.target.value})} placeholder="What physically happens?"/></label><label>Dialogue<textarea rows="3" value={sceneDraft.dialogue} onChange={e => setSceneDraft({...sceneDraft,dialogue:e.target.value})} placeholder="Important dialogue or dialogue intent"/></label></div>
              <label>Props<input value={sceneDraft.props} onChange={e => setSceneDraft({...sceneDraft,props:e.target.value})} placeholder="Comma-separated important props"/></label>
              <label>Scene description<textarea rows="2" value={sceneDraft.description} onChange={e => setSceneDraft({...sceneDraft,description:e.target.value})}/></label>
              <button onClick={saveScene}>Save scene plan</button>
            </div>}
          </div>
          <div>
            <div className="subhead"><strong>Shot list</strong><span className="hint">{filmShots.length} shots</span></div>
            <div className="shot-form">
              <div className="grid3">
                <label>Scene<select value={shotDraft.sceneId || selectedSceneId || ''} onChange={e => setShotDraft({...shotDraft,sceneId:e.target.value})}>
                  <option value="">Choose scene</option>
                  {(filmProject.scenes || []).map(s => <option key={s.id} value={s.id}>Scene {s.number} · {s.title}</option>)}
                </select></label>
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
            <div className="timeline-editor" aria-label="Film timeline">
              <div className="subhead"><strong>Timeline</strong><span className="hint">Ordered selected takes · {filmShots.filter(s => s.selectedTakeId).length} clips</span></div>
              <div className="timeline-track">
                {filmShots.map((shot, index) => {
                  const take = filmTakes.find(t => t.id === shot.selectedTakeId) || filmTakes.find(t => t.shotId === shot.id);
                  const asset = take ? filmAssets.find(a => a.id === take.assetId) : null;
                  return <button key={shot.id} className="timeline-clip" onClick={() => { setEditDraft({...editDraft, shotId: shot.id}); setProductionTool('edit'); }}>
                    <span className="timeline-index">{index + 1}</span>
                    <b>Shot {shot.number}</b>
                    <small>{take ? (asset?.name || 'Selected take') : 'No take'}</small>
                    <em>{shot.duration || asset?.duration || 0}s</em>
                  </button>;
                })}
                {!filmShots.length && <span className="hint">Add shots to build the timeline.</span>}
              </div>
              <div className="tool-actions"><button onClick={exportFilm} disabled={!filmProjectId || !filmShots.length}><Icon name="Download" size={15}/> Render & export timeline</button></div>
            </div>

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

        {filmTab === 'continuity' && <div className="continuity-board"><div className="subhead"><strong>Continuity board</strong><button onClick={runContinuityCheck}>Run continuity check</button></div><span className="hint">Checks the actual project state: characters, world rules, scene/shot attachment, camera continuity and logged continuity events.</span><div className="continuity-grid"><div><b>{filmProject?.characters?.length || 0}</b><small>Characters with persistent identity</small></div><div><b>{[...new Set((filmProject?.scenes||[]).flatMap(x=>x.props||[]))].length}</b><small>Tracked scene props</small></div><div><b>{(filmProject?.shots||[]).filter(x=>x.sceneId).length}/{filmProject?.shots?.length || 0}</b><small>Shots attached to scenes</small></div><div><b>{filmProject?.continuity?.length || 0}</b><small>Logged continuity events</small></div></div>{continuityReport && <div className="review-result"><strong>{continuityReport.recommendations?.length ? 'Findings' : 'No obvious continuity gaps'}</strong>{(continuityReport.recommendations || []).map((item,i)=><span key={i}>• {item}</span>)}</div>}</div>}

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
              <input id="film-asset-file-input" type="file" accept="video/*,image/*,audio/*" disabled={uploadingAsset} onChange={e => { const file=e.target.files?.[0]; if(file) uploadFilmAsset(file); e.target.value=''; }}/>
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
    </section>}

    <section className="panel format-panel compact-setup">
      <div className="setup-heading">
        <div>
          <div className="eyebrow">PRODUCTION SETUP</div>
          <h2>What are you making?</h2>
        </div>
        <span className="hint">Keep the workspace focused. Detailed choices open only when needed.</span>
      </div>
      <div className="setup-bar">
        <div className="format-picker">
          <button type="button" className={formatMenuOpen ? 'format-picker-button open' : 'format-picker-button'} onClick={() => setFormatMenuOpen(!formatMenuOpen)}>
            <span className="format-picker-icon"><Icon name={({ 'audio-story':'Volume', 'picture-story':'Image', 'motion-comic':'Sparkles', cinematic:'Clapperboard', anime:'Sparkles', documentary:'Clapperboard', explainer:'LayoutDashboard' })[selectedFormat] || 'Clapperboard'} size={22}/></span>
            <span className="format-picker-copy">
              <b>{mediaFormats.find(f => f.id === selectedFormat)?.name || selectedFormat}</b>
              <small>Production format</small>
            </span>
            <span className="chevron">{formatMenuOpen ? '⌃' : '⌄'}</span>
          </button>
          {formatMenuOpen && <div className="format-menu">
            {mediaFormats.map(format => {
              const icons = { 'audio-story': 'Volume', 'picture-story': 'Image', 'motion-comic': 'Sparkles', cinematic: 'Clapperboard', anime: 'Sparkles', documentary: 'Clapperboard', explainer: 'LayoutDashboard' };
              return <button type="button" key={format.id} className={selectedFormat === format.id ? 'format-option active' : 'format-option'} onClick={() => { setSelectedFormat(format.id); setFormatMenuOpen(false); }}>
                <span className="format-option-icon"><Icon name={icons[format.id] || 'Clapperboard'} size={18}/></span>
                <span><b>{format.name}</b><small>{format.description}</small></span>
                {selectedFormat === format.id && <strong>✓</strong>}
              </button>;
            })}
          </div>}
        </div>
        <label className="setup-field">Genre
          <select value={genre} onChange={e => setGenre(e.target.value)}>
            <option>action</option><option>adventure</option><option>comedy</option><option>drama</option><option>fantasy</option><option>horror</option><option>mystery</option><option>romance</option><option>science fiction</option><option>thriller</option><option>historical</option><option>educational</option>
          </select>
        </label>
        <button className="setup-plan-button" onClick={buildFormatPlan} disabled={planning || !prompt.trim()}>{planning ? 'Planning…' : 'Build production plan'} <span>→</span></button>
      </div>
      <div className="selected-format-note">
        <span>{mediaFormats.find(f => f.id === selectedFormat)?.description || 'Choose a production format for this project.'}</span>
        <span className="tag">{selectedFormat}</span>
      </div>
      {formatPlan && <div className="plan-summary">
        <strong>{formatPlan.project.format_name} · {formatPlan.project.genre}</strong>
        <span>{formatPlan.production_model.stages.length} stages · {formatPlan.story.beats.length} beats · {formatPlan.tasks.visual.length} visual tasks · {formatPlan.tasks.audio.length} audio tasks</span>
        <small>Provider-neutral: the plan describes production requirements first; the media router selects actual workers later.</small>
      </div>}
    </section>

    <main id="main-content" tabIndex="-1">
      <section className="hero-workspace">
      <section className="panel composer">
        <div className="section-head"><h2>Generate a shot</h2><span className="status"><i className={generating ? 'busy' : ''}/> {status}</span></div>
        <label>Scene description<textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows="7" placeholder="Describe the shot you want to generate…"/></label>
        <div className="search-toolbar">
          <button type="button" className={showGenerationControls ? 'control-icon active' : 'control-icon'} onClick={() => setShowGenerationControls(!showGenerationControls)} title="Generation controls" aria-label="Generation controls"><Icon name="Settings" size={16}/></button>
          <span className="control-summary">{duration}s · {ratio} · {framing}</span>
          <div className="provider-dropdown"><span className="provider-icon"><Icon name="Zap" size={13}/></span><select value={provider} onChange={e => setProvider(e.target.value)}><option value="auto">Auto · route automatically</option>{providers.filter(p => p.id !== 'comfyui' || p.configured).map(p => <option key={p.id} value={p.id}>{p.name}{p.configured ? '' : ' · unavailable'}</option>)}</select></div>
        </div>
        {showGenerationControls && <div className="generation-controls-panel">
          <label>Duration<select value={duration} onChange={e => setDuration(Number(e.target.value))}><option value="2">2 seconds</option><option value="4">4 seconds</option><option value="6">6 seconds</option><option value="8">8 seconds</option></select></label>
          <label>Aspect ratio<select value={ratio} onChange={e => setRatio(e.target.value)}><option>16:9</option><option>9:16</option><option>1:1</option><option>4:3</option><option>3:4</option><option>21:9</option></select></label>
          <label>Framing<select value={framing} onChange={e => setFraming(e.target.value)}><option>wide shot</option><option>full body</option><option>medium shot</option><option>close-up</option><option>extreme close-up</option></select></label>
          <label>Camera movement<select value={cameraMovement} onChange={e => setCameraMovement(e.target.value)}><option>static camera</option><option>slow push-in</option><option>slow pull-back</option><option>slow pan</option><option>slow tracking shot</option></select></label>
          <label>Lighting<select value={lighting} onChange={e => setLighting(e.target.value)}><option>natural cinematic</option><option>soft daylight</option><option>dramatic low light</option><option>night neon</option><option>warm sunset</option></select></label>
        </div>}
        {isLuma && <div className="hint provider-note">Luma generation runs independently from the Hugging Face ZeroGPU quota. Luma currently supports Ray 2 and Ray Flash 2 through its API.</div>}
        {referenceGenerationId && <div className="hint">Continuity reference selected. LTX uses the previous video as a visual reference; other providers currently use continuity prompting until their native reference workflow is wired.</div>}
        <button className="generate" disabled={generating} onClick={generate}>{generating ? 'Generating…' : 'Generate cinematic shot'} <span>→</span></button>
      </section>

      <section className="panel preview">
        <div className="section-head"><h2>Result</h2>{result && <span className="tag">{result.provider}</span>}</div>
        {!result ? <div className="empty"><div className="play"><Icon name="Play" size={20}/></div><strong>Your generated shot will appear here</strong><span>The selected provider will execute this shot and the result will be saved with production metadata.</span></div> : <div className="result">
          <div className="resultbox">{result.videoUrl ? <video src={result.videoUrl} controls playsInline/> : <div><strong>{result.message || 'No video returned'}</strong><small>{result.detail || ''}</small></div>}</div>
          {result.generation && <div className="meta"><span>{result.generation.model}</span><span>{result.generation.mode}</span>{result.generation.duration != null && <span>{result.generation.duration}s</span>}{result.generation.width && <span>{result.generation.width}×{result.generation.height}</span>}{result.generation.estimatedCostUsd != null && <span>Est. ${result.generation.estimatedCostUsd}</span>}</div>}
          <div className="actions">
            {result.videoUrl && <a href={result.videoUrl} download className="button">Download</a>}
            <button disabled={!result?.generation?.id || !filmProjectId} onClick={importResultToProject}><Icon name="Plus" size={15}/> Add to film project</button>
            <button onClick={() => { if (result?.generation?.id) { setReferenceGenerationId(result.generation.id); setPrompt(prompt + ' Continue the same scene while preserving the character, clothing, location and visual identity. Change only what this new shot description requests.'); setStatus('Visual continuity reference selected'); } }}>Use as next shot</button>
          </div>
        </div>}
      </section>
      </section>
    </main>
    <aside className="inspector" aria-label="Generation inspector">
      <div className="inspector-head"><div><span className="eyebrow">INSPECTOR</span><h2>Shot settings</h2></div><Icon name="PanelRight" size={18}/></div>
      <div className="inspector-section"><strong>Generation</strong><label>Provider<select value={provider} onChange={e => setProvider(e.target.value)}><option value="auto">Auto routing</option>{providers.filter(p => p.id !== 'comfyui' || p.configured).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Duration<select value={duration} onChange={e => setDuration(Number(e.target.value))}><option value="2">2 sec</option><option value="4">4 sec</option><option value="6">6 sec</option><option value="8">8 sec</option></select></label><label>Aspect ratio<select value={ratio} onChange={e => setRatio(e.target.value)}><option>16:9</option><option>9:16</option><option>1:1</option><option>4:3</option><option>3:4</option><option>21:9</option></select></label></div>
      <div className="inspector-section"><strong>Camera</strong><div className="inspector-grid"><label>Framing<select value={framing} onChange={e => setFraming(e.target.value)}><option>wide shot</option><option>full body</option><option>medium shot</option><option>close-up</option><option>extreme close-up</option></select></label><label>Movement<select value={cameraMovement} onChange={e => setCameraMovement(e.target.value)}><option>static camera</option><option>slow push-in</option><option>slow pull-back</option><option>slow pan</option><option>slow tracking shot</option></select></label></div></div>
      <div className="inspector-section"><strong>Current status</strong><div className="inspector-status"><span className={generating ? 'status-dot busy' : 'status-dot'}/>{status}</div>{generating && <div className="progress-track" aria-label={`Generation progress ${progress}%`}><span style={{width: progress + '%'}}/></div>}</div>
      {result?.generation && <div className="inspector-section"><strong>Result metadata</strong><div className="metadata-list"><span>Model <b>{result.generation.model || '—'}</b></span><span>Duration <b>{result.generation.duration ?? '—'}s</b></span><span>Ratio <b>{result.generation.ratio || ratio}</b></span><span>Estimated cost <b>{result.generation.estimatedCostUsd != null ? '
    </aside>
    <footer>V1 • LTX + Luma adapters • Visual continuity • Persistent film timeline</footer>
    {generating && <div className="generation-overlay" role="status" aria-live="polite"><div className="progress-spinner"/><div className="generation-overlay-copy"><strong>{status}</strong><span>{progress}% · The engine is processing your shot.</span></div><button className="secondary-button" onClick={cancelGeneration} aria-label="Cancel generation">Cancel</button></div>}
    {retryJobId && !generating && <div className="retry-banner" role="alert"><span>Generation failed.</span><button className="secondary-button" onClick={retryGeneration}>Retry</button></div>}
    {notice && <div className={`toast toast-${notice.type}`} role="status" aria-live="polite"><Icon name={notice.type === 'error' ? 'CircleAlert' : 'Check'} size={17}/>{notice.message}</div>
    }
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
 + result.generation.estimatedCostUsd : 'Not configured'}</b></span><span>QC <b>{result.qualityControl?.decision || 'Pending'}</b></span></div></div>}
    </aside>
    <footer>V1 • LTX + Luma adapters • Visual continuity • Persistent film timeline</footer>
    {generating && <div className="generation-overlay" role="status" aria-live="polite"><div className="progress-spinner"/><div className="generation-overlay-copy"><strong>{status}</strong><span>{progress}% · The engine is processing your shot.</span></div><button className="secondary-button" onClick={cancelGeneration} aria-label="Cancel generation">Cancel</button></div>}
    {retryJobId && !generating && <div className="retry-banner" role="alert"><span>Generation failed.</span><button className="secondary-button" onClick={retryGeneration}>Retry</button></div>}
    {notice && <div className={`toast toast-${notice.type}`} role="status" aria-live="polite"><Icon name={notice.type === 'error' ? 'CircleAlert' : 'Check'} size={17}/>{notice.message}</div>
    }
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
