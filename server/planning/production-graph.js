export function buildProductionGraph({ format, storyPlan, visualTasks = [], audioTasks = [], pipelineTasks = [] }) {
  const nodes = [];
  const edges = [];
  const projectId = storyPlan.project?.id || 'project';

  const addNode = (id, type, stage, data = {}) => {
    nodes.push({ id, type, stage, status: 'planned', ...data });
  };
  const link = (from, to, relation = 'depends_on') => {
    edges.push({ from, to, relation });
  };

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

  const addTasks = (tasks, type) => {
    for (const task of tasks) {
      const taskId = projectId + ':' + type + ':' + task.task_id;
      addNode(taskId, type, task.stage || task.purpose, task);
      link(projectId + ':story', taskId, 'plans');
    }
  };

  addTasks(pipelineTasks, 'production-task');
  addTasks(visualTasks, 'visual-task');
  addTasks(audioTasks, 'audio-task');

  return {
    schema_version: 'production-graph-v1',
    project_id: projectId,
    format,
    nodes,
    edges,
    summary: {
      nodes: nodes.length,
      edges: edges.length,
      executable_tasks: nodes.filter(n => n.type === 'visual-task' || n.type === 'audio-task').length
    }
  };
}
