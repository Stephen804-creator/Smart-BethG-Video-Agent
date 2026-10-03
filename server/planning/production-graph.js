export function buildProductionGraph({ format, storyPlan, visualTasks = [], audioTasks = [], pipelineTasks = [] }) {
  const nodes = [];
  const edges = [];
  const projectId = storyPlan.project?.id || 'project';

  const addNode = (id, type, stage, data = {}) => {
    nodes.push({ id, type, stage, status: 'planned', ...data });
  };
  const link = (from, to, relation = 'depends_on') => {
    if (!from || !to || from === to) return;
    if (!edges.some(edge => edge.from === from && edge.to === to && edge.relation === relation)) {
      edges.push({ from, to, relation });
    }
  };

  const sceneById = new Map((storyPlan.scenes || []).map(scene => [scene.scene_id, scene]));
  const beatToScene = new Map();
  for (const scene of storyPlan.scenes || []) {
    for (const beat of scene.beats || []) beatToScene.set(beat.id || beat.beat_id, scene.scene_id);
    if (scene.story_beat) beatToScene.set(scene.story_beat, scene.scene_id);
  }

  addNode(projectId + ':story', 'story', 'story', {
    title: storyPlan.project?.title || 'Untitled Project',
    genre: storyPlan.project?.genre || null,
    format
  });

  for (const entity of storyPlan.entity_state || []) {
    const entityId = projectId + ':entity:' + entity.id;
    addNode(entityId, 'entity', 'continuity', {
      entity_id: entity.id,
      entity_type: entity.type,
      name: entity.name,
      state: entity.state || {},
      continuity: entity.continuity || {}
    });
    link(projectId + ':story', entityId, 'defines');
  }

  let previousSceneId = null;
  for (const scene of storyPlan.scenes || []) {
    const sceneId = projectId + ':' + scene.scene_id;
    addNode(sceneId, 'scene', 'story', {
      scene_id: scene.scene_id,
      sequence: scene.sequence,
      purpose: scene.purpose,
      story_beat: scene.story_beat,
      location: scene.location,
      continuity: scene.continuity
    });
    link(projectId + ':story', sceneId, 'contains');
    if (previousSceneId) link(previousSceneId, sceneId, 'continues');

    for (const shot of scene.shot_plan || []) {
      const shotId = projectId + ':' + shot.shot_id;
      addNode(shotId, 'shot', 'shot-design', {
        scene_id: scene.scene_id,
        shot_id: shot.shot_id,
        purpose: shot.purpose,
        framing: shot.framing,
        camera: shot.camera,
        description: shot.description
      });
      link(sceneId, shotId, 'contains');
    }
    previousSceneId = sceneId;
  }

  const sceneNode = sceneId => sceneId ? projectId + ':' + sceneId : null;
  const shotNode = shotId => shotId ? projectId + ':' + shotId : null;

  const connectTaskContext = (taskNodeId, task) => {
    const sceneId = task.scene_id || task.sceneId || beatToScene.get(task.beat_id) || null;
    if (sceneId) link(sceneNode(sceneId), taskNodeId, 'provides-context');

    const scene = sceneById.get(sceneId);
    const shot = task.shot_id
      ? (scene?.shot_plan || []).find(item => item.shot_id === task.shot_id)
      : (format === 'cinematic' && scene?.shot_plan?.[0]);

    if (shot) link(shotNode(shot.shot_id), taskNodeId, 'implements');
  };

  const addTasks = (tasks, type) => {
    for (const task of tasks) {
      const taskId = projectId + ':' + type + ':' + (task.task_id || task.id || ('task-' + (nodes.length + 1)));
      addNode(taskId, type, task.stage || task.purpose, task);
      link(projectId + ':story', taskId, 'plans');
      connectTaskContext(taskId, task);
    }
  };

  addTasks(pipelineTasks, 'production-task');
  addTasks(visualTasks, 'visual-task');
  addTasks(audioTasks, 'audio-task');

  const visualNodes = nodes.filter(node => node.type === 'visual-task');
  const audioNodes = nodes.filter(node => node.type === 'audio-task');
  for (const visual of visualNodes) {
    const contextScene = visual.scene_id || visual.sceneId || beatToScene.get(visual.beat_id);
    const previousVisual = visualNodes.find(node =>
      node !== visual &&
      (node.scene_id || node.sceneId || beatToScene.get(node.beat_id)) === contextScene
    );
    if (previousVisual) link(previousVisual.id, visual.id, 'sequence-before');
  }

  for (const audio of audioNodes) {
    for (const visual of visualNodes) {
      const audioBeats = audio.beat_ids || [];
      if (audioBeats.length && visual.beat_id && audioBeats.includes(visual.beat_id)) {
        link(visual.id, audio.id, 'audio-for');
      }
    }
  }

  return {
    schema_version: 'production-graph-v2',
    project_id: projectId,
    format,
    nodes,
    edges,
    summary: {
      nodes: nodes.length,
      edges: edges.length,
      executable_tasks: nodes.filter(n => n.type === 'visual-task' || n.type === 'audio-task').length,
      context_linked_tasks: nodes.filter(n => ['visual-task', 'audio-task'].includes(n.type) && edges.some(e => e.to === n.id && ['provides-context', 'implements'].includes(e.relation))).length
    }
  };
}
