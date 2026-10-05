/**
 * Canonical filmmaking production-graph schema.
 *
 * This is additive to the existing media_* tables. It deliberately keeps
 * filmmaking facts in first-class relational records instead of hiding the
 * production graph inside media_projects.metadata JSON.
 */

export async function ensureFilmGraphSchema(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS film_projects (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT REFERENCES app_users(id),
      title TEXT NOT NULL,
      logline TEXT NOT NULL DEFAULT '',
      genre TEXT,
      format TEXT NOT NULL DEFAULT 'cinematic',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS film_stories (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      premise TEXT NOT NULL DEFAULT '',
      theme TEXT NOT NULL DEFAULT '',
      tone TEXT NOT NULL DEFAULT '',
      acts JSONB NOT NULL DEFAULT '[]'::jsonb,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(project_id)
    );

    CREATE TABLE IF NOT EXISTS film_characters (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      appearance JSONB NOT NULL DEFAULT '{}'::jsonb,
      wardrobe JSONB NOT NULL DEFAULT '{}'::jsonb,
      personality JSONB NOT NULL DEFAULT '{}'::jsonb,
      relationships JSONB NOT NULL DEFAULT '[]'::jsonb,
      voice_identity JSONB NOT NULL DEFAULT '{}'::jsonb,
      reference_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
      continuity_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
      approved_identity_asset_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS film_locations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      environment JSONB NOT NULL DEFAULT '{}'::jsonb,
      time_variants JSONB NOT NULL DEFAULT '{}'::jsonb,
      lighting JSONB NOT NULL DEFAULT '{}'::jsonb,
      reference_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
      continuity_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS film_props (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      appearance JSONB NOT NULL DEFAULT '{}'::jsonb,
      owner_character_id TEXT REFERENCES film_characters(id) ON DELETE SET NULL,
      reference_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
      continuity_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS film_styles (
      project_id TEXT PRIMARY KEY REFERENCES film_projects(id) ON DELETE CASCADE,
      visual JSONB NOT NULL DEFAULT '{}'::jsonb,
      cinematography JSONB NOT NULL DEFAULT '{}'::jsonb,
      color JSONB NOT NULL DEFAULT '{}'::jsonb,
      lighting JSONB NOT NULL DEFAULT '{}'::jsonb,
      framing JSONB NOT NULL DEFAULT '{}'::jsonb,
      motion JSONB NOT NULL DEFAULT '{}'::jsonb,
      audio JSONB NOT NULL DEFAULT '{}'::jsonb,
      music JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS film_screenplays (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      source_format TEXT NOT NULL DEFAULT 'structured',
      source_text TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(project_id)
    );

    CREATE TABLE IF NOT EXISTS film_sequences (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      screenplay_id TEXT NOT NULL REFERENCES film_screenplays(id) ON DELETE CASCADE,
      number INTEGER NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      purpose TEXT NOT NULL DEFAULT '',
      order_index INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(screenplay_id, number)
    );

    CREATE TABLE IF NOT EXISTS film_scenes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      screenplay_id TEXT REFERENCES film_screenplays(id) ON DELETE SET NULL,
      sequence_id TEXT REFERENCES film_sequences(id) ON DELETE SET NULL,
      number INTEGER NOT NULL,
      slug TEXT NOT NULL DEFAULT '',
      location_id TEXT REFERENCES film_locations(id) ON DELETE SET NULL,
      time_of_day TEXT NOT NULL DEFAULT '',
      objective TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL DEFAULT '',
      dialogue TEXT NOT NULL DEFAULT '',
      emotional_state JSONB NOT NULL DEFAULT '{}'::jsonb,
      visual_direction JSONB NOT NULL DEFAULT '{}'::jsonb,
      audio_direction JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'planned',
      approval_state TEXT NOT NULL DEFAULT 'DRAFT',
      order_index INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS film_shots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      scene_id TEXT NOT NULL REFERENCES film_scenes(id) ON DELETE CASCADE,
      number INTEGER NOT NULL,
      purpose TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL DEFAULT '',
      character_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      prop_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      framing TEXT NOT NULL DEFAULT '',
      angle TEXT NOT NULL DEFAULT '',
      camera_id TEXT NOT NULL DEFAULT '',
      lens TEXT NOT NULL DEFAULT '',
      movement TEXT NOT NULL DEFAULT '',
      camera_position JSONB NOT NULL DEFAULT '{}'::jsonb,
      blocking JSONB NOT NULL DEFAULT '{}'::jsonb,
      lighting JSONB NOT NULL DEFAULT '{}'::jsonb,
      visual_style JSONB NOT NULL DEFAULT '{}'::jsonb,
      duration_seconds NUMERIC,
      fps NUMERIC,
      storyboard_panel_id TEXT,
      approved_take_id TEXT,
      continuity_in_id TEXT,
      continuity_out_id TEXT,
      approval_state TEXT NOT NULL DEFAULT 'DRAFT',
      order_index INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS film_events (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      scene_id TEXT REFERENCES film_scenes(id) ON DELETE CASCADE,
      shot_id TEXT REFERENCES film_shots(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      time_mode TEXT NOT NULL DEFAULT 'SHOT_RELATIVE',
      time_value_ms BIGINT NOT NULL DEFAULT 0,
      duration_ms BIGINT NOT NULL DEFAULT 0,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      source_event_id TEXT REFERENCES film_events(id) ON DELETE SET NULL,
      offset_ms BIGINT NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'planned',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS film_dialogue (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL REFERENCES film_events(id) ON DELETE CASCADE,
      scene_id TEXT REFERENCES film_scenes(id) ON DELETE CASCADE,
      shot_id TEXT REFERENCES film_shots(id) ON DELETE CASCADE,
      character_id TEXT REFERENCES film_characters(id) ON DELETE SET NULL,
      text TEXT NOT NULL,
      start_ms BIGINT,
      end_ms BIGINT,
      emotion TEXT NOT NULL DEFAULT '',
      delivery_direction TEXT NOT NULL DEFAULT '',
      voice_id TEXT NOT NULL DEFAULT '',
      audio_asset_id TEXT,
      approved_take_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS film_continuity_states (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      scene_id TEXT REFERENCES film_scenes(id) ON DELETE CASCADE,
      shot_id TEXT REFERENCES film_shots(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      state JSONB NOT NULL DEFAULT '{}'::jsonb,
      source_event_id TEXT REFERENCES film_events(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS film_assets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      asset_type TEXT NOT NULL,
      uri TEXT NOT NULL DEFAULT '',
      mime_type TEXT NOT NULL DEFAULT '',
      duration_seconds NUMERIC,
      width INTEGER,
      height INTEGER,
      fps NUMERIC,
      checksum TEXT,
      source_type TEXT NOT NULL DEFAULT 'generated',
      provider TEXT,
      model TEXT,
      model_version TEXT,
      job_id TEXT,
      parent_asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      reference_asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      approval_state TEXT NOT NULL DEFAULT 'GENERATED',
      version INTEGER NOT NULL DEFAULT 1,
      rights_profile_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS film_takes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      shot_id TEXT NOT NULL REFERENCES film_shots(id) ON DELETE CASCADE,
      asset_id TEXT REFERENCES film_assets(id) ON DELETE SET NULL,
      take_number INTEGER NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'generated',
      camera_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      generation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      quality_control JSONB NOT NULL DEFAULT '{}'::jsonb,
      approval_state TEXT NOT NULL DEFAULT 'GENERATED',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(shot_id, take_number)
    );

    CREATE TABLE IF NOT EXISTS film_approvals (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      state TEXT NOT NULL,
      reviewer_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS film_rights_profiles (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      source TEXT NOT NULL DEFAULT '',
      license TEXT NOT NULL DEFAULT '',
      license_version TEXT NOT NULL DEFAULT '',
      training_allowed BOOLEAN NOT NULL DEFAULT FALSE,
      commercial_training_allowed BOOLEAN NOT NULL DEFAULT FALSE,
      redistribution_allowed BOOLEAN NOT NULL DEFAULT FALSE,
      derivative_model_allowed BOOLEAN NOT NULL DEFAULT FALSE,
      restrictions JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS film_timelines (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      duration_ms BIGINT NOT NULL DEFAULT 0,
      fps NUMERIC NOT NULL DEFAULT 24,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(project_id, version)
    );

    CREATE TABLE IF NOT EXISTS film_timeline_clips (
      id TEXT PRIMARY KEY,
      timeline_id TEXT NOT NULL REFERENCES film_timelines(id) ON DELETE CASCADE,
      track_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      start_ms BIGINT NOT NULL,
      duration_ms BIGINT NOT NULL,
      in_ms BIGINT NOT NULL DEFAULT 0,
      out_ms BIGINT,
      linked_clip_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      event_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE INDEX IF NOT EXISTS idx_film_projects_owner ON film_projects(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_film_characters_project ON film_characters(project_id);
    CREATE INDEX IF NOT EXISTS idx_film_locations_project ON film_locations(project_id);
    CREATE INDEX IF NOT EXISTS idx_film_props_project ON film_props(project_id);
    CREATE INDEX IF NOT EXISTS idx_film_scenes_project_order ON film_scenes(project_id, order_index);
    CREATE INDEX IF NOT EXISTS idx_film_shots_scene_order ON film_shots(scene_id, order_index);
    CREATE INDEX IF NOT EXISTS idx_film_events_shot_time ON film_events(shot_id, time_value_ms);
    CREATE INDEX IF NOT EXISTS idx_film_events_source ON film_events(source_event_id);
    CREATE INDEX IF NOT EXISTS idx_film_continuity_entity ON film_continuity_states(project_id, entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_film_assets_project ON film_assets(project_id);
    CREATE INDEX IF NOT EXISTS idx_film_takes_shot ON film_takes(shot_id);
    CREATE INDEX IF NOT EXISTS idx_film_approvals_entity ON film_approvals(project_id, entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_film_timelines_project ON film_timelines(project_id, version);
    CREATE INDEX IF NOT EXISTS idx_film_timeline_clips_timeline ON film_timeline_clips(timeline_id, start_ms);

    CREATE TABLE IF NOT EXISTS film_storyboard_panels (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      scene_id TEXT REFERENCES film_scenes(id) ON DELETE CASCADE,
      shot_id TEXT REFERENCES film_shots(id) ON DELETE CASCADE,
      panel_number INTEGER NOT NULL,
      image_asset_id TEXT,
      caption TEXT NOT NULL DEFAULT '',
      camera_notes TEXT NOT NULL DEFAULT '',
      blocking_notes TEXT NOT NULL DEFAULT '',
      continuity_notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS film_version_records (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      change_summary TEXT NOT NULL DEFAULT '',
      created_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(entity_type, entity_id, version)
    );

    CREATE TABLE IF NOT EXISTS film_audio_tracks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      timeline_id TEXT REFERENCES film_timelines(id) ON DELETE CASCADE,
      track_type TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      channel_layout TEXT NOT NULL DEFAULT 'stereo',
      gain_db NUMERIC NOT NULL DEFAULT 0,
      pan NUMERIC NOT NULL DEFAULT 0,
      mute BOOLEAN NOT NULL DEFAULT FALSE,
      solo BOOLEAN NOT NULL DEFAULT FALSE,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS film_audio_clips (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      track_id TEXT NOT NULL REFERENCES film_audio_tracks(id) ON DELETE CASCADE,
      asset_id TEXT REFERENCES film_assets(id) ON DELETE SET NULL,
      start_ms BIGINT NOT NULL,
      duration_ms BIGINT NOT NULL,
      source_in_ms BIGINT NOT NULL DEFAULT 0,
      source_out_ms BIGINT,
      gain_db NUMERIC NOT NULL DEFAULT 0,
      fade_in_ms BIGINT NOT NULL DEFAULT 0,
      fade_out_ms BIGINT NOT NULL DEFAULT 0,
      automation JSONB NOT NULL DEFAULT '{}'::jsonb,
      event_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS film_camera_sources (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      device_name TEXT NOT NULL DEFAULT '',
      uri TEXT NOT NULL DEFAULT '',
      codec TEXT,
      fps NUMERIC,
      resolution TEXT,
      timecode_start TEXT,
      checksum TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS film_camera_clips (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES film_projects(id) ON DELETE CASCADE,
      source_id TEXT NOT NULL REFERENCES film_camera_sources(id) ON DELETE CASCADE,
      shot_id TEXT REFERENCES film_shots(id) ON DELETE SET NULL,
      asset_id TEXT REFERENCES film_assets(id) ON DELETE SET NULL,
      in_ms BIGINT NOT NULL DEFAULT 0,
      out_ms BIGINT,
      sync_offset_ms BIGINT NOT NULL DEFAULT 0,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_film_storyboard_shot ON film_storyboard_panels(shot_id, panel_number);
    CREATE INDEX IF NOT EXISTS idx_film_versions_entity ON film_version_records(project_id, entity_type, entity_id, version);
    CREATE INDEX IF NOT EXISTS idx_film_audio_tracks_timeline ON film_audio_tracks(timeline_id);
    CREATE INDEX IF NOT EXISTS idx_film_audio_clips_track_time ON film_audio_clips(track_id, start_ms);
    CREATE INDEX IF NOT EXISTS idx_film_camera_sources_project ON film_camera_sources(project_id);
    CREATE INDEX IF NOT EXISTS idx_film_camera_clips_shot ON film_camera_clips(shot_id);
  `);
}
