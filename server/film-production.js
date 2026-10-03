import fs from 'fs';

function id(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

export function createFilmStore(filePath) {
  const read = () => {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch { return { projects: {} }; }
  };
  const write = data => {
    fs.mkdirSync(filePath.split('/').slice(0, -1).join('/'), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  };
  const view = p => ({ ...p, scenes:p.scenes||[], shots:p.shots||[], takes:p.takes||[], assets:p.assets||[], continuity:p.continuity||[] });
  const touch = p => { p.updatedAt = new Date().toISOString(); };

  return {
    listProjects() { return Object.values(read().projects).map(view).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)); },
    getProject(projectId) { const d=read(); return d.projects[projectId] ? view(d.projects[projectId]) : null; },
    createProject(input={}) {
      const d=read(), now=new Date().toISOString(), project={id:input.id||id('film'),title:String(input.title||'Untitled Film').trim(),genre:String(input.genre||'drama').trim(),logline:String(input.logline||'').trim(),format:'cinematic',createdAt:now,updatedAt:now,scenes:[],shots:[],takes:[],assets:[],continuity:[]};
      d.projects[project.id]=project; write(d); return view(project);
    },
    updateProject(projectId,input={}) {
      const d=read(), p=d.projects[projectId]; if(!p)return null;
      if(input.title!==undefined)p.title=String(input.title).trim();
      if(input.genre!==undefined)p.genre=String(input.genre).trim();
      if(input.logline!==undefined)p.logline=String(input.logline).trim();
      p.updatedAt=new Date().toISOString(); write(d); return view(p);
    },
    addScene(projectId,input={}) {
      const d=read(),p=d.projects[projectId];if(!p)return null;
      p.scenes=p.scenes||[]; const s={id:input.id||id('scene'),sequence:Number(input.sequence||p.scenes.length+1),number:p.scenes.length+1,title:String(input.title||('Scene '+(p.scenes.length+1))).trim(),location:String(input.location||'').trim(),timeOfDay:String(input.timeOfDay||'').trim(),description:String(input.description||'').trim(),status:'planned'};
      p.scenes.push(s);p.updatedAt=new Date().toISOString();write(d);return view(p);
    },
    addShot(projectId,input={}) {
      const d=read(),p=d.projects[projectId];if(!p)return null;
      p.shots=p.shots||[];const s={id:input.id||id('shot'),sequence:Number(input.sequence||p.shots.length+1),number:p.shots.length+1,sceneId:input.sceneId||p.scenes?.[0]?.id||null,shotType:String(input.shotType||'coverage'),framing:String(input.framing||'medium shot'),angle:String(input.angle||'eye level'),lens:String(input.lens||''),movement:String(input.movement||'static'),lighting:String(input.lighting||''),audio:String(input.audio||'production sound'),duration:Number(input.duration||0)||0,description:String(input.description||''),notes:String(input.notes||''),status:'planned',selectedTakeId:null};
      p.shots.push(s);p.updatedAt=new Date().toISOString();write(d);return view(p);
    },
    addTake(projectId,input={}) {
      const d=read(),p=d.projects[projectId];if(!p)return null;
      p.takes=p.takes||[];const t={id:input.id||id('take'),shotId:input.shotId||null,assetId:input.assetId||null,takeNumber:p.takes.filter(x=>x.shotId===input.shotId).length+1,camera:String(input.camera||''),lens:String(input.lens||''),fps:Number(input.fps||24)||24,shutter:String(input.shutter||''),iso:String(input.iso||''),whiteBalance:String(input.whiteBalance||''),location:String(input.location||''),recordedAt:input.recordedAt||new Date().toISOString(),mediaUri:String(input.mediaUri||''),notes:String(input.notes||''),selected:false};
      p.takes.push(t);p.updatedAt=new Date().toISOString();write(d);return t;
    },
    selectTake(projectId,shotId,takeId) {
      const d=read(),p=d.projects[projectId];if(!p)return null;
      for(const s of p.shots||[])if(s.id===shotId)s.selectedTakeId=takeId;
      for(const t of p.takes||[])if(t.shotId===shotId)t.selected=t.id===takeId;
      p.updatedAt=new Date().toISOString();write(d);return view(p);
    },
    addAsset(projectId,input={}) {
      const d=read(),p=d.projects[projectId];if(!p)return null;
      p.assets=p.assets||[];const a={id:input.id||id('asset'),name:String(input.name||'Untitled asset'),sourceType:String(input.sourceType||'camera'),uri:String(input.uri||''),sceneId:input.sceneId||null,shotId:input.shotId||null,mimeType:String(input.mimeType||''),notes:String(input.notes||''),createdAt:new Date().toISOString()};
      p.assets.push(a);p.updatedAt=new Date().toISOString();write(d);return a;
    },
    reorderScene(projectId, sceneId, sequence) {
      const d=read(),p=d.projects[projectId]; if(!p)return null;
      const scene=p.scenes.find(x=>x.id===sceneId); if(!scene)return null;
      scene.sequence=Math.max(1,Number(sequence)||1);
      p.scenes.sort((a,b)=>(a.sequence||0)-(b.sequence||0));
      p.scenes.forEach((x,i)=>{x.sequence=i+1;x.number=i+1;});
      touch(p); write(d); return view(p);
    },
    reorderShot(projectId, shotId, sequence) {
      const d=read(),p=d.projects[projectId]; if(!p)return null;
      const shot=p.shots.find(x=>x.id===shotId); if(!shot)return null;
      shot.sequence=Math.max(1,Number(sequence)||1);
      p.shots.sort((a,b)=>(a.sequence||0)-(b.sequence||0));
      p.shots.forEach((x,i)=>{x.sequence=i+1;x.number=i+1;});
      touch(p); write(d); return view(p);
    },
    updateShot(projectId, shotId, input={}) {
      const d=read(),p=d.projects[projectId]; if(!p)return null;
      const shot=p.shots.find(x=>x.id===shotId); if(!shot)return null;
      const fields=['sceneId','shotType','framing','angle','lens','movement','lighting','audio','duration','description','notes','status'];
      for(const field of fields) if(input[field]!==undefined) shot[field]=input[field];
      touch(p); write(d); return view(p);
    },
    addContinuityEvent(projectId,input={}) {
      const d=read(),p=d.projects[projectId];if(!p)return null;
      p.continuity=p.continuity||[];const e={id:input.id||id('continuity'),sceneId:input.sceneId||null,shotId:input.shotId||null,entity:String(input.entity||''),state:String(input.state||''),notes:String(input.notes||''),createdAt:new Date().toISOString()};
      p.continuity.push(e);p.updatedAt=new Date().toISOString();write(d);return e;
    }
  };
}
