# Smart-BethG Filmmaking Workspace — Repository Audit

Status: Initial architecture audit  
Baseline: `main`  
Target: `docs/FILMMAKING_WORKSPACE_SPECIFICATION.md`  
Audit branch: `filmmaking-workspace-spec`

## Purpose

This audit compares the current repository implementation with the filmmaking workspace specification.

It is intentionally conservative. A feature is not marked implemented merely because a field, route, placeholder, or planning function exists.

## Executive assessment

Smart-BethG already has a useful production foundation:

- film projects with stories, characters, world data, scenes, shots, takes, assets and continuity events
- structured story/media planning
- provider-neutral media tasks
- provider routing
- ComfyUI worker integration
- asynchronous jobs, persistence, recovery, cancellation and worker leases
- canonical media resolution
- generation QC
- production-runner orchestration
- sound-plan schema
- database persistence for durable operational state
- authentication and protected media

However, it is **not yet a complete filmmaking workspace**.

The largest gaps are not another video model. They are the production data model, Film Intelligence, screenplay/scene/shot relationships, event-based synchronization, timeline/editor, audio production, continuity depth, approval/versioning, real-camera workflow, and a coherent beginner/professional workspace UI.

The existing repository should therefore be treated as a strong execution foundation, not as completion of the filmmaking product.

## Status legend

- IMPLEMENTED — meaningful underlying behavior exists.
- PARTIAL — useful foundation exists but important functionality is missing.
- ARCHITECTURE PRESENT — direction exists but production behavior is incomplete.
- UNVERIFIED — code exists but real end-to-end behavior has not been demonstrated.
- MISSING — target capability is not materially implemented.
- NEEDS REDESIGN — current implementation conflicts with the target architecture.

## 1. Product definition

**Status: PARTIAL**

The repository is a working cinematic/video generation application with film-project concepts, but the complete filmmaking workspace described in the specification is not yet present.

The current product still exposes provider/generation concepts more prominently than a complete film-production lifecycle.

Target:
Idea → Story → Film Bible → Screenplay → Scenes → Shots → Storyboard → Production → Review → Edit → Sound → Synchronization → Final Film.

Current:
Story/planning → media generation → jobs/assets → limited film-production state.

## 2. Project architecture

**Status: PARTIAL**

`server/film-production.js` already models:

- project
- story
- characters
- world
- scenes
- shots
- takes
- assets
- continuity

This is a strong starting point.

The project model still needs richer first-class entities for:

- screenplay
- sequences
- locations
- props
- storyboard panels
- production events
- timeline clips
- dialogue cues
- music cues
- SFX cues
- ambience
- approvals
- revisions
- provenance
- production plans

## 3. Film Bible

**Status: PARTIAL**

Characters and world data exist.

Characters already have name, role, description, appearance, personality, relationships, state and references.

World data already includes setting, rules, locations, factions and terminology.

What is missing is a deeper structured Film Bible with durable visual/audio style, wardrobe, recurring props, location variants, approved identity assets, and explicit continuity constraints.

## 4. Screenplay

**Status: MISSING / PARTIAL FOUNDATION**

Story planning exists in `server/planning/story-planner.js`.

The planner creates beats, scenes, characters, locations, props, continuity guidance and a basic shot plan.

This is useful planning infrastructure but is not yet a real screenplay system.

Missing or insufficient:

- screenplay document model
- screenplay editor
- screenplay revisions
- screenplay-to-scene relationships
- screenplay dialogue blocks
- structured screenplay parsing
- scene headings
- action/dialogue/transition semantics
- screenplay version history

## 5. Scene system

**Status: PARTIAL**

Scenes are first-class records.

Current fields include location, time of day, description, dramatic beat, characters, blocking, action, dialogue, mood, weather, props and status.

This is a good foundation.

Missing:

- sequence entity
- scene objective/emotional arc as structured data
- richer scene dependencies
- production events
- explicit continuity-in/out state
- screenplay source references
- approval/version state

## 6. Shot system

**Status: PARTIAL**

Shots are first-class records and include:

- scene relationship
- shot type
- framing
- angle
- lens
- movement
- lighting
- audio
- duration
- description
- notes
- edit metadata
- effects metadata
- audio mix metadata
- selected take

This is one of the strongest existing parts of the project.

Missing:

- camera identity/position
- blocking
- visual events
- dialogue cues
- SFX cues
- music cues
- ambience cues
- storyboard relationship
- reference assets
- continuity-in/out
- generation history as a structured relation
- approval/version state
- richer provenance

## 7. Shared production entity architecture

**Status: PARTIAL**

The repository already uses shared project/scene/shot IDs.

This is correct.

However, the current production views are not yet fully unified around a single production graph.

The target architecture requires screenplay, storyboard, shot list, floor plan, continuity and timeline to reference the same underlying entities.

That relationship layer still needs to be designed and implemented.

## 8. Storyboard

**Status: MISSING**

No complete storyboard entity/workspace is established in the current production model.

A storyboard should become a first-class view of Shots rather than an isolated image gallery.

## 9. Camera / blocking / floor plan

**Status: PARTIAL FOUNDATION**

Shots contain basic camera concepts such as framing, angle, lens and movement, and scenes contain blocking text.

This is not yet a professional spatial planning system.

Missing:

- camera positions
- subject positions
- movement paths
- floor-plan representation
- spatial scene graph
- FOV visualization
- blocking waypoints
- spatial continuity

## 10. Production media

**Status: PARTIAL / IMPLEMENTED FOUNDATION**

The repository has real generation workers, provider routing, media tasks, asset storage and generated output.

The provider registry now includes local profiles for Wan 2.2, LTX-2.5 and VACE, plus premium adapter slots.

Important qualification: local profiles are routing/workflow architecture, not proof that every model is installed and working on a user's hardware.

## 11. Film Intelligence

**Status: MISSING**

There are planning functions such as `buildStoryPlan` and `buildMediaPlan`, but there is not yet a dedicated project-aware Film Intelligence subsystem.

Missing:

- Film Assistant
- project-aware conversational context
- structured screenplay assistance
- structured rewrite proposals
- scene editing proposals
- shot planning dialogue
- continuity reasoning tools
- approval-aware mutations
- deterministic validation around AI changes

This should be one of the next major architectural areas.

## 12. Auto Director

**Status: PARTIAL**

`server/orchestration/production-runner.js` provides real orchestration for visual production jobs.

It supports:

- production graphs
- task normalization
- validation
- provider selection
- execution
- cancellation
- persisted job state
- evaluation

But this is currently closer to a production execution engine than a complete Auto Director.

The missing layer is the filmmaking intelligence that decides what should be produced and why.

## 13. Event and synchronization system

**Status: ARCHITECTURE PRESENT / NEEDS REDESIGN**

The sound schema contains a `sync` field, and media planning explicitly says physical-action sounds should synchronize with visible movement.

That is good intent.

It is not yet a true shared event system.

The required architecture is:

Action → Event → Media → Timeline.

Current implementation does not yet make typed production events a first-class cross-modal entity.

This is a major architectural gap and should not be solved by adding more prompt text.

## 14. Dialogue and voice

**Status: PARTIAL / UNVERIFIED**

Sound planning has dialogue support, and provider architecture includes audio capability metadata.

However, a complete dialogue production system with:

- speaker identity
- exact timing
- voice identity
- generated take
- lip-sync relationship
- approved take
- timeline placement

is not yet established.

## 15. Music

**Status: PARTIAL**

Music exists in the sound plan schema and audio-mix metadata.

A complete music-production workflow is not yet implemented.

Missing:

- music generation/selection pipeline
- cue model
- timeline relationship
- BPM/tempo metadata where relevant
- scene/sequence emotional relationship
- approved music takes

## 16. SFX and ambience

**Status: PARTIAL**

SFX, foley and ambience exist as sound-plan concepts.

The system needs to evolve from descriptive planning into event-linked media production.

For example, a sword-draw SFX should be attached to a sword-draw event, not simply listed in a sound plan.

## 17. Continuity

**Status: PARTIAL**

Continuity events exist and story planning generates continuity guidance.

The repository also has entity-state infrastructure.

This is a useful foundation.

Missing:

- rich character state transitions
- prop state transitions
- wardrobe state
- spatial state
- lighting state
- explicit continuity checkpoints
- automated conflict detection across shots
- continuity-aware generation constraints
- approved continuity state

## 18. Media and assets

**Status: PARTIAL / STRONG FOUNDATION**

The asset system supports uploaded media, hashing, media probing, scene/shot relationships and persistent project assets.

Generation artifacts also have canonical storage handling.

Missing:

- full asset version graph
- source/reference lineage
- comprehensive provenance
- approval state
- derivative relationships
- richer asset roles

## 19. Timeline / editor

**Status: MISSING / METADATA FOUNDATION**

Shot records have edit/effects/audioMix metadata and render modules exist.

The README explicitly describes editing/effects/audio controls as metadata-only until a real render/export worker is connected.

The target requires a real multi-track timeline/editor.

Missing:

- interactive timeline
- linked A/V clips
- frame-accurate editing
- sync locking
- track management
- clip operations
- transitions
- automation
- robust undo/redo
- persistent timeline entity model

## 20. Audio mixer

**Status: MISSING / PARTIAL FOUNDATION**

Shot-level audioMix metadata exists.

The sound schema has mix metadata.

This is not yet a real mixer.

Missing:

- multi-track audio workspace
- gain automation
- ducking
- fades
- pan
- loudness validation
- mix preview
- final audio render

## 21. Review and approval

**Status: PARTIAL**

Selected takes exist.

Job states include queued/running/completed/failed/cancelled.

Generation QC exists.

But the production approval lifecycle is not yet complete.

Target states should distinguish at least:

DRAFT → GENERATED → REVIEW → APPROVED / REJECTED → SUPERSEDED / ARCHIVED.

The approval model should work across scenes, shots, assets, takes and major production proposals.

## 22. QC and validation

**Status: PARTIAL / STRONG FOUNDATION**

Video QC exists and generation tasks have validation.

The system also has production graph validation.

Missing:

- project-wide QC
- continuity QC
- timeline QC
- synchronization QC
- provenance QC across a final dataset
- export-readiness validation

## 23. Versioning and history

**Status: PARTIAL**

Generation attempts/jobs and selected takes provide some history.

A complete production revision system is not yet present.

Missing:

- screenplay versions
- scene versions
- shot versions
- project snapshots
- timeline versions
- proposal history
- explicit supersession relationships

## 24. Model/provider routing

**Status: IMPLEMENTED FOUNDATION**

The repository now has:

- provider registry
- capability metadata
- policy metadata
- scoring
- local preference
- paid preference
- training-data gate
- provider implementation state

This should remain an internal infrastructure layer.

## 25. Local / Self-Hosted / Premium

**Status: ARCHITECTURE PRESENT / PARTIAL**

The provider architecture supports local ComfyUI and premium provider slots.

The product-level deployment model is not yet fully implemented as three polished user experiences.

The intended hierarchy remains:

Local → Self-Hosted → Premium.

## 26. Rights and provenance

**Status: PARTIAL / IMPORTANT FOUNDATION**

Provider policy metadata and the video model/data policy exist.

The system distinguishes generation-only providers and training eligibility.

However, asset-level rights metadata still needs to become a first-class production record and travel with every relevant dataset item.

## 27. Future training dataset

**Status: PARTIAL FOUNDATION**

The repository already records generation metadata and has dataset/evaluation concepts.

Story planning also produces dataset-oriented structures.

The complete rights-controlled training dataset pipeline is not yet implemented.

Needed:

- immutable provenance record
- training eligibility gate
- evaluation score
- human rating
- approval
- source/reference lineage
- dataset version
- export manifest

## 28. Real-camera workflow

**Status: PARTIAL FOUNDATION**

The asset system supports uploaded/camera media and take records include camera, lens, FPS, shutter, ISO, white balance, location, recording time and media URI.

This is a strong foundation for real footage.

Missing:

- ingest workflow
- camera/media browser
- take review
- synchronized production metadata
- real-camera shot matching
- proxy workflow
- professional production paperwork

## 29. Beginner workspace

**Status: MISSING / PARTIAL UI FOUNDATION**

The current application has a React frontend, but the target beginner workflow is not yet the central product experience.

Needed:

New Film → Idea → Story → World → Script → Scenes → Storyboard → Shots → Production → Review → Edit → Sound → Export.

The UI should hide model/provider complexity by default.

## 30. Professional workspace

**Status: PARTIAL FOUNDATION**

Several professional concepts exist in the data model:

- lens
- framing
- movement
- angle
- lighting
- blocking
- camera metadata
- takes
- assets

The professional production workspace itself is not yet complete.

## 31. Security and reliability

**Status: IMPLEMENTED FOUNDATION**

The repository already contains:

- authentication
- protected media
- environment-managed provider secrets
- rate limiting
- asynchronous generation jobs
- database persistence
- worker claims
- heartbeats
- cancellation
- recovery
- bounded terminal job history
- canonical media resolution

This is one of the strongest current areas.

## 32. Failure recovery

**Status: IMPLEMENTED FOUNDATION**

The job system now supports persisted jobs, recovery, cancellation, retries, worker leases and heartbeats.

Generated artifacts and project persistence have also been addressed in the earlier reliability work.

This should be preserved as production infrastructure while higher-level filmmaking features are added.

## 33. Main architectural risks discovered

### Risk 1 — Film project storage boundary

The current film store still uses a JSON implementation locally while PostgreSQL is intended as the durable source of truth.

This boundary needs continued cleanup so the production model does not become split-brain.

### Risk 2 — Planning vs production model

Story/media planners produce useful schemas, but they are not yet fully unified with the persistent film project entities.

We need one canonical production graph rather than several parallel representations.

### Risk 3 — Sound is descriptive rather than event-driven

The sound schema is useful, but synchronization needs first-class events.

### Risk 4 — Timeline is not yet a first-class entity

Editing metadata exists, but the actual timeline model and editor are missing.

### Risk 5 — Film Intelligence is missing

The system has planners and execution, but not yet the specialized project-aware intelligence layer envisioned for Smart-BethG.

### Risk 6 — UI can outrun backend reality

The specification explicitly requires real underlying behavior, not placeholder screens.

New UI should only be added when the corresponding data/API behavior exists or is being implemented as the same vertical slice.

## 34. Recommended implementation order

Do not add more premium providers first.

Do not start foundation-model training.

Do not build a giant generic chatbot.

The recommended next sequence is:

1. Canonical production graph and data model.
2. Rich Film Bible entities.
3. Screenplay/scene/shot relationship model.
4. First-class production events and synchronization model.
5. Film Intelligence / Film Assistant with structured proposals.
6. Storyboard as a view of Shots.
7. Continuity state engine and validators.
8. Production approvals/versioning.
9. Real timeline model.
10. Audio/dialogue/music/SFX event integration.
11. Real timeline/editor.
12. Full Auto Director orchestration.
13. Beginner workspace.
14. Professional production workspace.
15. Real-camera workflow expansion.
16. Runtime/model packaging.
17. Larger training-data pipeline.

## 35. Bottom line

Smart-BethG is not starting from zero.

The existing repository already contains important infrastructure for jobs, media generation, provider routing, persistence, assets, film projects, planning, sound metadata, QC and reliability.

But it should not yet be called a complete filmmaking workspace.

The central missing layer is the **production intelligence and shared production graph** that connects story, screenplay, scenes, shots, events, continuity, assets, audio, timeline and final delivery.

That is the next architectural frontier.

The correct development strategy is therefore:

**Strengthen the production model first → add Film Intelligence → add event synchronization → build the timeline/audio system → then expand generation capabilities.**

