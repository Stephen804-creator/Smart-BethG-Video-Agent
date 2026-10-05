# Canonical Production Graph — Database Migration Plan

## Purpose

This document turns the canonical production graph design into a concrete PostgreSQL persistence boundary without replacing the working media and job system.

The migration is additive. Existing media tables and the JSON film store remain readable while the canonical filmmaking graph is introduced and validated.

## Database boundary

The canonical filmmaking graph is stored in first-class `film_*` tables.

Existing `media_*` tables continue to own infrastructure concerns such as media generations, jobs, worker leases, provider execution, and compatibility entity state.

The JSON file used by `server/film-production.js` is a compatibility source during migration. It must not remain a second long-term source of truth.

## First-class tables

- `film_projects`: project identity and ownership
- `film_stories`: premise, theme, tone and acts
- `film_characters`: character identity and continuity constraints
- `film_locations`: location and environment identity
- `film_props`: prop identity and ownership
- `film_styles`: project visual, cinematography and audio language
- `film_screenplays`: screenplay document and version
- `film_sequences`: ordered screenplay sections
- `film_scenes`: scene-level dramatic and production facts
- `film_shots`: canonical shot planning entity
- `film_events`: timed production events and dependencies
- `film_dialogue`: dialogue attached to events
- `film_continuity_states`: continuity state snapshots
- `film_assets`: physical or generated media artifacts
- `film_takes`: candidate and approved takes
- `film_approvals`: explicit review state
- `film_rights_profiles`: rights and training constraints
- `film_timelines`: timeline versions
- `film_timeline_clips`: multi-track timeline placement

The executable schema is in `server/film-graph-schema.js`.

## Identity rules

Stable IDs matter more than numeric ordering.

Scene and shot numbers may change when users reorder production. Their IDs must not change.

A shot is identified by its stable ID, not its current number. Storyboard panels, takes, events, continuity records and timeline clips reference those IDs.

## Event timing

Events use integer milliseconds.

Time mode distinguishes project-absolute, shot-relative and event-relative timing. An event can depend on another event through a source event ID and an offset.

Example:

- `JOHN_DRAW_SWORD` at 14,200 ms within a shot
- `SWORD_DRAW_SFX` references that event with a -20 ms offset

A future resolver converts relative timing into absolute timeline positions. Media generation should consume that event plan rather than inventing independent audio timing.

## Approval rules

Approval is explicit. The intended lifecycle is:

`DRAFT → GENERATED → REVIEW → APPROVED`

Rejected or superseded artifacts must never silently replace an approved take.

Provider and model identity belong to the generated artifact, not the shot. A shot can therefore be regenerated with another provider without changing shot identity.

## Rights rules

Rights are stored independently from provider metadata.

A rights profile records source, license/version, training permission, commercial-training permission, redistribution permission, derivative-model permission and restrictions.

This prevents a provider from being incorrectly treated as permission to train a future Smart-BethG model.

## Migration phases

### Phase 0 — Schema installation

Create the canonical tables and indexes. No existing records are deleted or rewritten.

### Phase 1 — Compatibility projection

For each existing film project, create a canonical project record and preserve the original project JSON.

Map obvious records:

`project → story → characters/world → scenes → shots → assets → takes → continuity`

Do not invent missing screenplay, event or timeline data.

### Phase 2 — Dual-read validation

Read canonical and legacy records side by side in development.

Validate missing parents, duplicate IDs, orphan shots, ownership, take/shot relationships, event dependencies, timeline ranges and approval references.

### Phase 3 — Canonical writes

Move mutation families to the canonical graph one at a time:

1. project
2. characters, locations and props
3. scenes
4. shots
5. events
6. assets and takes
7. continuity
8. approvals

The legacy JSON becomes a projection/cache rather than the authoritative write target.

### Phase 4 — First production vertical slice

Prove:

`Create Film → Scene → Shot → Action Event → Dependent SFX Event → Asset → Take → Approval`

This is the first test of the synchronization model.

### Phase 5 — Timeline and audio

Add timeline placement and event resolution. Dialogue, music, SFX and ambience become event/timeline consumers rather than independent descriptive fields.

### Phase 6 — Legacy retirement

Only after migration, dual-read validation, recovery tests and production workflows are stable should the old JSON store be removed from the source-of-truth path.

## Not part of this migration slice

The following should consume the canonical graph later rather than create competing models:

- screenplay editor UI
- storyboard renderer
- floor-plan editor
- full continuity engine
- Film Assistant
- Auto Director
- professional timeline UI
- audio mixer
- real-camera ingest
- model packaging and training pipeline

## Safety requirements

The migration must be additive, idempotent, recoverable, ownership-aware and testable without a live generation provider.

No migration should delete existing media, jobs, assets or user projects.

## Definition of done

1. A fresh PostgreSQL database can create the canonical schema.
2. Existing installations can install it without data loss.
3. Project, scene, shot, event, asset and take relationships are first-class.
4. Event dependencies can represent synchronized visual/audio actions.
5. Approval and rights are first-class records.
6. Existing media/job infrastructure remains functional.
7. Legacy JSON can later be imported without destructive rewriting.
