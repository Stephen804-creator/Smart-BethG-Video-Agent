/**
 * Transactional persistence for the canonical filmmaking graph.
 *
 * The graph is deliberately persisted independently from the legacy film JSON
 * store. This module is idempotent: re-running a migration updates the same
 * stable IDs instead of creating duplicate production entities.
 */

const j = (value, fallback) => JSON.stringify(value == null ? fallback : value);

async function upsert(db, sql, values) {
  await db.query(sql, values);
}

export async function persistCanonicalFilmGraph(db, graph) {
  if (!db || !graph?.project?.id) throw new Error('A canonical film graph requires a project.');

  const client = await db.connect();
  const counts = {};
  const count = (key, rows = []) => { counts[key] = rows.length; };

  try {
    await client.query('BEGIN');

    const p = graph.project;
    await upsert(client, `INSERT INTO film_projects
      (id, owner_user_id, title, logline, genre, format, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (id) DO UPDATE SET
        owner_user_id=COALESCE(EXCLUDED.owner_user_id, film_projects.owner_user_id),
        title=EXCLUDED.title, logline=EXCLUDED.logline, genre=EXCLUDED.genre,
        format=EXCLUDED.format, status=EXCLUDED.status, updated_at=NOW()`,
      [p.id, p.ownerUserId || null, p.title || 'Untitled Film', p.logline || '', p.genre || null, p.format || 'cinematic', p.status || 'draft']);
    counts.project = 1;

    const s = graph.story;
    if (s) {
      await upsert(client, `INSERT INTO film_stories
        (id, project_id, premise, theme, tone, acts, version)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (project_id) DO UPDATE SET
          premise=EXCLUDED.premise, theme=EXCLUDED.theme, tone=EXCLUDED.tone,
          acts=EXCLUDED.acts, version=EXCLUDED.version, updated_at=NOW()`,
        [s.id, p.id, s.premise || '', s.theme || '', s.tone || '', j(s.acts, []), s.version || 1]);
      counts.story = 1;
    }

    for (const rights of graph.rightsProfiles || []) {
      await upsert(client, `INSERT INTO film_rights_profiles
        (id,project_id,source,license,license_version,training_allowed,commercial_training_allowed,redistribution_allowed,derivative_model_allowed,restrictions)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO UPDATE SET
          source=EXCLUDED.source,license=EXCLUDED.license,license_version=EXCLUDED.license_version,
          training_allowed=EXCLUDED.training_allowed,commercial_training_allowed=EXCLUDED.commercial_training_allowed,
          redistribution_allowed=EXCLUDED.redistribution_allowed,derivative_model_allowed=EXCLUDED.derivative_model_allowed,
          restrictions=EXCLUDED.restrictions`,
        [rights.id,p.id,rights.source||'',rights.license||'',rights.licenseVersion||'',
          Boolean(rights.trainingAllowed),Boolean(rights.commercialTrainingAllowed),Boolean(rights.redistributionAllowed),
          Boolean(rights.derivativeModelAllowed),j(rights.restrictions,{})]);
    }
    count('rightsProfiles', graph.rightsProfiles);

    for (const c of graph.characters || []) {
      await upsert(client, `INSERT INTO film_characters
        (id,project_id,name,role,description,appearance,wardrobe,personality,relationships,voice_identity,reference_assets,continuity_constraints)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (id) DO UPDATE SET
          project_id=EXCLUDED.project_id,name=EXCLUDED.name,role=EXCLUDED.role,
          description=EXCLUDED.description,appearance=EXCLUDED.appearance,wardrobe=EXCLUDED.wardrobe,
          personality=EXCLUDED.personality,relationships=EXCLUDED.relationships,voice_identity=EXCLUDED.voice_identity,
          references=EXCLUDED.reference_assets,continuity_constraints=EXCLUDED.continuity_constraints,updated_at=NOW()`,
        [c.id,p.id,c.name||'',c.role||'',c.description||'',j(c.appearance,{}),j(c.wardrobe,{}),j(c.personality,{}),j(c.relationships,[]),j(c.voiceIdentity,{}),j(c.references,[]),j(c.continuityConstraints,{})]);
    }
    count('characters', graph.characters);

    for (const l of graph.locations || []) {
      await upsert(client, `INSERT INTO film_locations
        (id,project_id,name,description,environment,time_variants,lighting,reference_assets,continuity_constraints)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (id) DO UPDATE SET
          name=EXCLUDED.name,description=EXCLUDED.description,environment=EXCLUDED.environment,
          time_variants=EXCLUDED.time_variants,lighting=EXCLUDED.lighting,reference_assets=EXCLUDED.reference_assets,
          continuity_constraints=EXCLUDED.continuity_constraints,updated_at=NOW()`,
        [l.id,p.id,l.name||'Location',l.description||'',j(l.environment,{}),j(l.timeVariants,{}),j(l.lighting,{}),j(l.references,[]),j(l.continuityConstraints,{})]);
    }
    count('locations', graph.locations);

    for (const prop of graph.props || []) {
      await upsert(client, `INSERT INTO film_props
        (id,project_id,name,description,appearance,owner_character_id,reference_assets,continuity_constraints)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (id) DO UPDATE SET
          name=EXCLUDED.name,description=EXCLUDED.description,appearance=EXCLUDED.appearance,
          owner_character_id=EXCLUDED.owner_character_id,reference_assets=EXCLUDED.reference_assets,
          continuity_constraints=EXCLUDED.continuity_constraints,updated_at=NOW()`,
        [prop.id,p.id,prop.name||'Prop',prop.description||'',j(prop.appearance,{}),prop.ownerCharacterId||null,j(prop.references,[]),j(prop.continuityConstraints,{})]);
    }
    count('props', graph.props);

    const style = graph.styles?.[0];
    if (style) {
      await upsert(client, `INSERT INTO film_styles
        (project_id,visual,cinematography,color,lighting,framing,motion,audio,music)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (project_id) DO UPDATE SET
          visual=EXCLUDED.visual,cinematography=EXCLUDED.cinematography,color=EXCLUDED.color,
          lighting=EXCLUDED.lighting,framing=EXCLUDED.framing,motion=EXCLUDED.motion,
          audio=EXCLUDED.audio,music=EXCLUDED.music,updated_at=NOW()`,
        [p.id,j(style.visual,{}),j(style.cinematography,{}),j(style.color,{}),j(style.lighting,{}),j(style.framing,{}),j(style.motion,{}),j(style.audio,{}),j(style.music,{})]);
      counts.style = 1;
    }

    const sp = graph.screenplay;
    if (sp) {
      await upsert(client, `INSERT INTO film_screenplays
        (id,project_id,title,version,status,source_format,source_text)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (project_id) DO UPDATE SET
          title=EXCLUDED.title,version=EXCLUDED.version,status=EXCLUDED.status,
          source_format=EXCLUDED.source_format,source_text=EXCLUDED.source_text,updated_at=NOW()`,
        [sp.id,p.id,sp.title||'',sp.version||1,sp.status||'draft',sp.sourceFormat||'structured',sp.sourceText||'']);
      counts.screenplay = 1;
    }

    for (const seq of graph.sequences || []) {
      await upsert(client, `INSERT INTO film_sequences
        (id,project_id,screenplay_id,number,title,purpose,order_index)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO UPDATE SET
          screenplay_id=EXCLUDED.screenplay_id,number=EXCLUDED.number,title=EXCLUDED.title,
          purpose=EXCLUDED.purpose,order_index=EXCLUDED.order_index,updated_at=NOW()`,
        [seq.id,p.id,seq.screenplayId||sp?.id,Number(seq.number||1),seq.title||'',seq.purpose||'',Number(seq.orderIndex||seq.number||1)]);
    }
    count('sequences', graph.sequences);

    for (const scene of graph.scenes || []) {
      await upsert(client, `INSERT INTO film_scenes
        (id,project_id,screenplay_id,sequence_id,number,slug,location_id,time_of_day,objective,action,dialogue,emotional_state,visual_direction,audio_direction,status,approval_state,order_index)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT (id) DO UPDATE SET
          screenplay_id=EXCLUDED.screenplay_id,sequence_id=EXCLUDED.sequence_id,number=EXCLUDED.number,
          slug=EXCLUDED.slug,location_id=EXCLUDED.location_id,time_of_day=EXCLUDED.time_of_day,
          objective=EXCLUDED.objective,action=EXCLUDED.action,dialogue=EXCLUDED.dialogue,
          emotional_state=EXCLUDED.emotional_state,visual_direction=EXCLUDED.visual_direction,
          audio_direction=EXCLUDED.audio_direction,status=EXCLUDED.status,approval_state=EXCLUDED.approval_state,
          order_index=EXCLUDED.order_index,updated_at=NOW()`,
        [scene.id,p.id,scene.screenplayId||sp?.id||null,scene.sequenceId||null,Number(scene.number||1),scene.slug||'',scene.locationId||null,
          scene.timeOfDay||'',scene.objective||'',scene.action||'',scene.dialogue||'',j(scene.emotionalState,{}),j(scene.visualDirection,{}),j(scene.audioDirection,{}),scene.status||'planned',scene.approvalState||'DRAFT',Number(scene.orderIndex||scene.number||1)]);
    }
    count('scenes', graph.scenes);

    for (const shot of graph.shots || []) {
      if (!shot.sceneId) throw new Error(`Shot ${shot.id} has no sceneId.`);
      await upsert(client, `INSERT INTO film_shots
        (id,project_id,scene_id,number,purpose,description,action,character_ids,prop_ids,framing,angle,camera_id,lens,movement,camera_position,blocking,lighting,visual_style,duration_seconds,fps,approved_take_id,continuity_in_id,continuity_out_id,approval_state,order_index)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
        ON CONFLICT (id) DO UPDATE SET
          scene_id=EXCLUDED.scene_id,number=EXCLUDED.number,purpose=EXCLUDED.purpose,description=EXCLUDED.description,
          action=EXCLUDED.action,character_ids=EXCLUDED.character_ids,prop_ids=EXCLUDED.prop_ids,framing=EXCLUDED.framing,
          angle=EXCLUDED.angle,camera_id=EXCLUDED.camera_id,lens=EXCLUDED.lens,movement=EXCLUDED.movement,
          camera_position=EXCLUDED.camera_position,blocking=EXCLUDED.blocking,lighting=EXCLUDED.lighting,visual_style=EXCLUDED.visual_style,
          duration_seconds=EXCLUDED.duration_seconds,fps=EXCLUDED.fps,approved_take_id=EXCLUDED.approved_take_id,
          continuity_in_id=EXCLUDED.continuity_in_id,continuity_out_id=EXCLUDED.continuity_out_id,
          approval_state=EXCLUDED.approval_state,order_index=EXCLUDED.order_index,updated_at=NOW()`,
        [shot.id,p.id,shot.sceneId,Number(shot.number||1),shot.purpose||'',shot.description||'',shot.action||'',j(shot.characterIds,[]),j(shot.propIds,[]),
          shot.framing||'',shot.angle||'',shot.cameraId||'',shot.lens||'',shot.movement||'',j(shot.cameraPosition,{}),j(shot.blocking,{}),j(shot.lighting,{}),j(shot.visualStyle,{}),
          shot.duration??null,shot.fps??null,shot.approvedTakeId||null,shot.continuityInId||null,shot.continuityOutId||null,shot.approvalState||'DRAFT',Number(shot.orderIndex||shot.number||1)]);
    }
    count('shots', graph.shots);

    for (const event of graph.events || []) {
      await upsert(client, `INSERT INTO film_events
        (id,project_id,scene_id,shot_id,event_type,source,time_mode,time_value_ms,duration_ms,payload,source_event_id,offset_ms,status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO UPDATE SET
          scene_id=EXCLUDED.scene_id,shot_id=EXCLUDED.shot_id,event_type=EXCLUDED.event_type,source=EXCLUDED.source,
          time_mode=EXCLUDED.time_mode,time_value_ms=EXCLUDED.time_value_ms,duration_ms=EXCLUDED.duration_ms,payload=EXCLUDED.payload,
          source_event_id=EXCLUDED.source_event_id,offset_ms=EXCLUDED.offset_ms,status=EXCLUDED.status,updated_at=NOW()`,
        [event.id,p.id,event.sceneId||null,event.shotId||null,event.eventType,event.source||'manual',event.timeMode||'SHOT_RELATIVE',
          Number(event.timeValueMs||0),Number(event.durationMs||0),j(event.payload,{}),event.sourceEventId||null,Number(event.offsetMs||0),event.status||'planned']);
    }
    count('events', graph.events);

    for (const d of graph.dialogue || []) {
      await upsert(client, `INSERT INTO film_dialogue
        (id,project_id,event_id,scene_id,shot_id,character_id,text,start_ms,end_ms,emotion,delivery_direction,voice_id,audio_asset_id,approved_take_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (id) DO UPDATE SET
          event_id=EXCLUDED.event_id,scene_id=EXCLUDED.scene_id,shot_id=EXCLUDED.shot_id,character_id=EXCLUDED.character_id,
          text=EXCLUDED.text,start_ms=EXCLUDED.start_ms,end_ms=EXCLUDED.end_ms,emotion=EXCLUDED.emotion,
          delivery_direction=EXCLUDED.delivery_direction,voice_id=EXCLUDED.voice_id,audio_asset_id=EXCLUDED.audio_asset_id,
          approved_take_id=EXCLUDED.approved_take_id,updated_at=NOW()`,
        [d.id,p.id,d.eventId,d.sceneId||null,d.shotId||null,d.characterId||null,d.text||'',d.startMs??null,d.endMs??null,d.emotion||'',d.deliveryDirection||'',d.voiceId||'',d.audioAssetId||null,d.approvedTakeId||null]);
    }
    count('dialogue', graph.dialogue);

    for (const a of graph.assets || []) {
      await upsert(client, `INSERT INTO film_assets
        (id,project_id,asset_type,uri,mime_type,duration_seconds,width,height,fps,checksum,source_type,provider,model,model_version,job_id,parent_asset_ids,reference_asset_ids,approval_state,version,rights_profile_id,metadata)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        ON CONFLICT (id) DO UPDATE SET
          asset_type=EXCLUDED.asset_type,uri=EXCLUDED.uri,mime_type=EXCLUDED.mime_type,duration_seconds=EXCLUDED.duration_seconds,
          width=EXCLUDED.width,height=EXCLUDED.height,fps=EXCLUDED.fps,checksum=EXCLUDED.checksum,source_type=EXCLUDED.source_type,
          provider=EXCLUDED.provider,model=EXCLUDED.model,model_version=EXCLUDED.model_version,job_id=EXCLUDED.job_id,
          parent_asset_ids=EXCLUDED.parent_asset_ids,reference_asset_ids=EXCLUDED.reference_asset_ids,approval_state=EXCLUDED.approval_state,
          version=EXCLUDED.version,rights_profile_id=EXCLUDED.rights_profile_id,metadata=EXCLUDED.metadata,updated_at=NOW()`,
        [a.id,p.id,a.assetType||'media',a.uri||a.url||'',a.mimeType||'',a.durationSeconds??a.duration??null,a.width??null,a.height??null,a.fps??null,a.checksum||null,
          a.sourceType||'generated',a.provider||null,a.model||null,a.modelVersion||null,a.jobId||null,j(a.parentAssetIds||[],[]),j(a.referenceAssetIds||[],[]),a.approvalState||'GENERATED',
          Number(a.version||1),a.rightsProfileId||null,j(a.metadata||{}, {})]);
    }
    count('assets', graph.assets);

    for (const t of graph.takes || []) {
      if (!t.shotId) continue;
      await upsert(client, `INSERT INTO film_takes
        (id,project_id,shot_id,asset_id,take_number,source_type,camera_metadata,generation_metadata,quality_control,approval_state)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO UPDATE SET
          shot_id=EXCLUDED.shot_id,asset_id=EXCLUDED.asset_id,take_number=EXCLUDED.take_number,source_type=EXCLUDED.source_type,
          camera_metadata=EXCLUDED.camera_metadata,generation_metadata=EXCLUDED.generation_metadata,quality_control=EXCLUDED.quality_control,
          approval_state=EXCLUDED.approval_state`,
        [t.id,p.id,t.shotId,t.assetId||null,Number(t.takeNumber||1),t.sourceType||'generated',j(t.cameraMetadata||{},{}),j(t.generationMetadata||{},{}),j(t.qualityControl||{},{}),t.approvalState||'GENERATED']);
    }
    count('takes', graph.takes);

    for (const c of graph.continuity || []) {
      await upsert(client, `INSERT INTO film_continuity_states
        (id,project_id,scene_id,shot_id,entity_type,entity_id,state,source_event_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (id) DO UPDATE SET
          scene_id=EXCLUDED.scene_id,shot_id=EXCLUDED.shot_id,entity_type=EXCLUDED.entity_type,
          entity_id=EXCLUDED.entity_id,state=EXCLUDED.state,source_event_id=EXCLUDED.source_event_id`,
        [c.id,p.id,c.sceneId||null,c.shotId||null,c.entityType||'unknown',c.entityId||'',j(c.state,{}),c.sourceEventId||null]);
    }
    count('continuity', graph.continuity);

    await client.query('COMMIT');
    return { enabled: true, migrated: true, projectId: p.id, counts };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
