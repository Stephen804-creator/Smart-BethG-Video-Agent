# Smart-BethG Filmmaking Workspace Specification

Status: Design specification / target architecture  
Branch: `filmmaking-workspace-spec`  
Product: Smart-BethG Video Agent

## 1. Purpose

Smart-BethG is intended to be a serious filmmaking workspace with AI orchestration built into it. It is not a collection of prompt wrappers and it is not defined by any particular video, audio, image, voice, or language model.

The production architecture is the durable foundation. Models and providers are replaceable implementation details.

This specification defines the target filmmaking workspace that Smart-BethG should grow toward.

The goal of this document is not to reproduce any existing filmmaking application. Existing open-source and other systems are research references only. Their workflows, strengths, weaknesses, failure modes, and architectural ideas may inform Smart-BethG, but Smart-BethG should implement its own design.

## 2. Core principles

1. Build Smart-BethG's own architecture.
2. Study existing systems for lessons, not for identity.
3. Reuse third-party code only when there is a clear engineering reason and its license and dependencies permit it.
4. Prefer a clean independent implementation when practical.
5. Keep the film project, not the chat session, as the durable source of truth.
6. Use stable IDs and relationships between production entities.
7. Avoid duplicating the same production fact across independent modules.
8. Make model/provider choice replaceable through internal routing.
9. Default the user experience to Auto mode rather than exposing a model zoo.
10. Treat continuity, timing, synchronization, provenance, recovery, and validation as core functionality.
11. Support both AI-generated filmmaking and real-camera/real-footage workflows.
12. Every expensive or destructive AI operation should have an appropriate review/approval boundary.
13. Preserve enough structured provenance that future Smart-BethG model training can be performed from rights-controlled data.
14. Do not confuse application licensing, model licensing, dataset rights, and generated-output rights.

## 3. Product definition

Smart-BethG should let a beginner move from an idea to a finished film while also providing professional controls for users who understand filmmaking.

A user should be able to start with:

> New Film

and progress through:

Idea → Story → Film Bible → Screenplay → Scenes → Shot Plan → Storyboard → Production → Review → Edit → Sound → Synchronization → Final Film.

The same project model should support users who bring their own camera footage.

## 4. Target workspace

The primary workspace should expose the major filmmaking areas without forcing users to understand the underlying AI infrastructure.

Target areas:

- Project
- Story / Idea
- Film Bible
- Screenplay
- Scene Breakdown
- Shot Planner
- Storyboard
- Camera / Blocking / Floor Plan
- Production
- Media / Assets
- Continuity
- Timeline / Editor
- Audio / Mixer
- Review / Approval
- QC / Validation
- Export / Delivery
- Film Assistant

These should be views over shared production data wherever possible, not isolated databases containing duplicated facts.

## 5. Shared production model

The core architecture should be relationship-driven.

Conceptual hierarchy:

```
FILM PROJECT
├── Story
├── Film Bible
│   ├── Characters
│   ├── Locations
│   ├── Props
│   ├── Visual Style
│   └── Audio Style
├── Screenplay
├── Sequences
│   └── Scenes
│       └── Shots
├── Storyboard
├── Production Assets
├── Continuity
├── Timeline
└── Delivery
```

A Shot should not have separate unrelated copies in the storyboard, shot list, floor plan, continuity system, and timeline.

A single Shot entity should be referenced by those views.

## 6. Three major sources of truth

### 6.1 Film Bible — world and identity truth

The Film Bible stores persistent creative facts such as:

- character identity
- appearance
- wardrobe
- personality
- relationships
- location identity
- recurring props
- visual style
- lighting language
- camera language
- audio style
- project-wide constraints

### 6.2 Production graph — what should happen

The production graph describes:

- scenes
- shots
- actions
- dialogue
- character participation
- camera instructions
- visual events
- audio events
- continuity dependencies
- generated assets
- approvals

### 6.3 Timeline — when it happens

The timeline stores actual temporal placement of:

- video
- dialogue
- voice
- music
- SFX
- ambience
- transitions
- effects
- captions
- other production events

The timeline should become the temporal source of truth for the assembled film.

## 7. Film Bible

The Film Bible should contain structured records for:

### Characters

- character_id
- name
- age/range
- description
- appearance
- wardrobe
- personality
- relationships
- voice identity
- visual references
- continuity constraints
- approved identity assets

### Locations

- location_id
- name
- description
- environment
- time-of-day variants
- lighting
- visual references
- continuity constraints

### Props

- prop_id
- name
- description
- appearance
- owner/character
- continuity state
- reference assets

### Style

- visual style
- cinematography language
- color direction
- lighting language
- framing preferences
- motion language
- audio language
- music direction

## 8. Story and screenplay

The screenplay system should support:

- story premise
- logline
- themes
- acts
- sequences
- scenes
- action
- dialogue
- character relationships
- scene objectives
- emotional beats
- transitions
- revisions
- version history

The screenplay should be parseable into structured scene and production information.

A screenplay paragraph should not be the only representation of the information needed downstream.

## 9. Scene system

Each Scene should have a stable ID and structured information including:

- scene number
- sequence
- location
- time
- characters
- props
- objective
- action
- dialogue
- emotional state
- visual direction
- audio direction
- continuity state
- shots
- production status
- approval state

Scene changes should propagate through dependent planning views rather than creating disconnected copies.

## 10. Shot system

A Shot is one of the most important production entities.

Target fields include:

- shot_id
- scene_id
- shot number
- shot purpose
- description
- action
- characters
- props
- framing / shot size
- camera
- lens / focal length
- camera movement
- camera position
- blocking
- lighting
- visual style
- duration
- fps
- dialogue cues
- SFX cues
- music cues
- ambience cues
- visual event references
- storyboard panel
- reference media
- generated media
- approved take
- continuity-in state
- continuity-out state
- generation history
- rights/provenance metadata

## 11. Storyboard

The storyboard should provide visual planning for shots.

It should support:

- storyboard panels
- shot references
- camera/framing information
- action
- dialogue
- duration
- visual references
- generated keyframes
- manual sketches/uploads where appropriate
- panel approval
- regeneration
- ordering

The storyboard should reference the same Shot entities used elsewhere.

## 12. Camera, blocking and floor plan

For users who need professional planning, Smart-BethG should eventually support:

- camera positions
- subject positions
- movement paths
- blocking
- lens/FOV
- shot direction
- scene geography
- floor plans
- waypoints
- spatial continuity

A camera position in a floor-plan view should be linked to its Shot rather than being an independent duplicate.

## 13. Production pipeline

Production should be task-oriented rather than model-oriented.

A user asks for a production result.

Smart-BethG determines which internal pipeline is appropriate.

Potential internal capabilities:

- image generation
- video generation
- video continuation
- image-to-video
- video editing
- voice generation
- dialogue generation
- lip synchronization
- music generation
- SFX generation
- ambience generation
- compositing
- upscaling
- subtitles
- final rendering

The user-facing product should normally expose Auto rather than requiring the user to select the underlying model.

## 14. Film Intelligence

Film Intelligence is a specialized filmmaking capability, not a generic chatbot.

It may use a general language model underneath, but its behavior should be constrained by:

- active project
- film schema
- screenplay
- Film Bible
- continuity state
- production state
- task-specific tools
- structured output schemas
- validators
- approval rules

Core capabilities may include:

- story development
- screenplay generation
- screenplay rewriting
- scene development
- dialogue writing
- character development
- adaptation
- scene expansion/compression
- shot planning
- continuity checking
- production planning
- next-scene/episode suggestions
- production-ready specification generation

## 15. Film Assistant

The user may interact with Film Intelligence through a small chat-like Film Assistant.

The assistant should understand the active film automatically.

Example:

> Make Scene 4 more suspenseful.

The assistant should produce a structured proposal rather than silently rewriting unrelated project data.

Example proposal:

```
SCENE CHANGE PROPOSAL

Camera:
Add slow push-in.

Lighting:
Reduce practical intensity.

Music:
Increase tension from event X.

SFX:
Add distant metallic impact.

Dialogue:
No change.

Continuity:
No conflict detected.
```

The user can approve, reject, or edit the proposal.

## 16. Auto Director

Auto Director should orchestrate production tasks.

Conceptually:

```
User Intent
    ↓
Film Intelligence
    ↓
Production Plan
    ↓
Scene / Shot Plan
    ↓
Capability Router
    ├── Visual
    ├── Voice
    ├── Music
    ├── SFX
    └── Other
    ↓
Generation
    ↓
Validation
    ↓
Review / Approval
    ↓
Timeline
    ↓
Render
```

Auto Director must not become a single opaque function that cannot be inspected or recovered.

Each important stage should produce durable artifacts and state.

## 17. Event and synchronization system

Synchronization must be a first-class architectural feature.

The system should represent meaningful events independently of the media files.

Example:

```
EVENT: JOHN_DRAW_SWORD
time: 14.20s

visual:
  sword draw action

sfx:
  sword_draw.wav
  start: 14.18s

camera:
  push_in
  start: 13.90s

music:
  tension increase
  start: 13.80s

dialogue:
  next line
  start: 14.50s
```

This is an illustrative representation, not a fixed timing algorithm.

The important principle is:

**Action → Event → Media → Timeline**

rather than independently generating media and hoping they synchronize.

The event system should support:

- action events
- dialogue events
- facial/lip events
- camera events
- music events
- SFX events
- ambience events
- transitions
- effects
- captions
- continuity events

## 18. Dialogue and voice

Dialogue should have structured timing:

- dialogue_id
- character
- text
- start
- end
- emotion
- delivery direction
- voice identity
- generated audio
- approved take

The generated voice should feed the visual/lip-sync pipeline when required.

## 19. Music, SFX and ambience

Audio elements should be attached to production events or timeline ranges.

SFX examples:

- sword draw
- door close
- footsteps
- impact
- vehicle movement
- environmental sounds

Music should support:

- cue points
- intensity
- transitions
- BPM/tempo where relevant
- scene relationships
- emotional direction

Ambience should support persistent scene environment.

## 20. Continuity

Continuity should track:

- character appearance
- wardrobe
- props
- injuries
- location state
- time
- lighting
- weather/environment
- character position
- object state
- approved visual identity
- previous/next shot relationships

The continuity system should detect conflicts before expensive generation when practical.

Examples:

- character changes clothes unexpectedly
- missing prop
- impossible location transition
- inconsistent time of day
- object state changes without an event
- character appears with a different approved identity

## 21. Media and asset management

Every generated or imported asset should have durable metadata.

Minimum conceptual fields:

- asset_id
- project_id
- scene_id
- shot_id
- asset_type
- source
- provider/model
- model_version
- generation job
- parameters
- creation time
- parent/reference assets
- approval state
- version
- rights/provenance
- storage location
- checksum where appropriate

Generated media must be resolvable by the canonical media system already established in Smart-BethG.

## 22. Timeline and editing

The timeline should support multiple synchronized tracks.

Conceptually:

```
VIDEO
DIALOGUE
VOICE
MUSIC
SFX
AMBIENCE
CAPTIONS
EFFECTS
```

Requirements should eventually include:

- frame-accurate placement
- trimming
- splitting
- moving
- linking
- sync lock
- track management
- fades
- transitions
- volume automation
- versioning
- undo/redo
- preview
- render/export

The editor should preserve relationships to Shot and Event IDs.

## 23. Audio mixing

The audio workspace should eventually support:

- dialogue level
- music level
- SFX level
- ambience level
- ducking
- fades
- pan
- gain
- loudness validation
- mute/solo
- track grouping

## 24. Review and approval

AI generation should not automatically become final production truth.

Important states should include concepts such as:

```
DRAFT
GENERATED
REVIEW
APPROVED
REJECTED
SUPERSEDED
ARCHIVED
```

A rejected take should remain available for history where appropriate but should not silently become the active approved take.

## 25. QC and validation

Smart-BethG should eventually validate:

- missing media
- broken references
- timeline overlaps
- missing dialogue audio
- missing SFX events
- continuity conflicts
- duration mismatches
- invalid assets
- unsupported formats
- unresolved generation jobs
- provenance restrictions
- export readiness

QC should be deterministic where possible rather than relying entirely on an LLM.

## 26. Versioning and history

The project should preserve:

- screenplay revisions
- scene revisions
- shot revisions
- generation attempts
- asset versions
- approvals
- rejected takes
- timeline revisions
- production decisions

Users should be able to understand how a final result was produced.

## 27. Model and provider routing

Models should be selected internally according to capability and policy.

The router may consider:

- task capability
- local availability
- self-hosted availability
- premium availability
- credentials
- cost
- latency
- quality target
- continuation requirements
- hardware constraints
- rights/training policy

The user normally sees Auto.

Advanced technical details may be inspectable but should not dominate the default experience.

## 28. Deployment modes

### Smart-BethG Local

Models/runtime operate on the user's own hardware.

The user supplies the compute resources and storage.

### Smart-BethG Self-Hosted

Smart-BethG runs on company-controlled or user-controlled/rented infrastructure.

The application experience should remain the full Smart-BethG workspace rather than a stripped-down API wrapper.

### Smart-BethG Premium

Premium external providers may be used when capability, quality, speed, or availability justifies them.

Premium providers are optional dependencies, not the foundation of Smart-BethG.

### BYO provider/API

Where appropriate, users may supply their own provider credentials.

Credentials must be protected, encrypted where stored, redacted from logs, and never exposed to frontend clients or ordinary job history.

## 29. Rights and provenance

Rights metadata must be tracked independently from generation metadata.

Conceptual classifications:

- OWNED_DATA
- LICENSED_TRAINING_DATA
- GENERATION_ONLY_DATA
- RESTRICTED_DATA

Relevant fields may include:

- source
- license
- license version
- training allowed
- commercial training allowed
- redistribution allowed
- derivative model allowed
- restrictions
- provider/model
- generation job
- input references

Unknown or restricted training rights must not silently enter a training dataset.

The architecture must distinguish:

- application license
- model license
- dataset rights
- input rights
- output rights
- redistribution rights
- training rights

## 30. Future Smart-BethG model development

The application should collect structured, rights-aware production data from the beginning.

Potential future dataset records may include:

- project
- scene
- shot
- prompt
- story description
- characters
- location
- camera
- lens
- movement
- lighting
- style
- video
- dialogue
- voice
- music
- SFX
- ambience
- duration
- FPS
- resolution
- model/provider/version
- generation parameters
- quality score
- human rating
- approval
- rights/provenance

This does not mean Smart-BethG should train a giant foundation model immediately.

The immediate goal is to build the best filmmaking system possible while preserving a future path toward Smart-BethG-controlled models.

## 31. Real-camera workflow

The architecture should support:

- camera media import
- footage organization
- shot matching
- scene matching
- take management
- continuity
- metadata
- proxies where appropriate
- timeline editing
- AI assistance
- audio synchronization
- captions
- post-production

AI-generated footage and real footage should be able to coexist in the same project.

## 32. Beginner experience

A beginner should not need to understand:

- diffusion models
- model weights
- GPU VRAM
- APIs
- ComfyUI
- LoRAs
- model providers

The beginner flow should be:

```
New Film
↓
Describe Idea
↓
Build Story
↓
Approve Characters / World
↓
Generate Screenplay
↓
Review Scenes
↓
Generate Storyboard
↓
Generate Shots
↓
Review
↓
Generate / Import Production Media
↓
Synchronize
↓
Edit
↓
Sound
↓
QC
↓
Export
```

## 33. Professional controls

Advanced users should eventually be able to control:

- lens
- camera
- framing
- movement
- blocking
- lighting
- duration
- FPS
- references
- generation parameters
- audio cues
- timeline
- continuity
- asset versions
- provider preferences
- local/self-hosted/premium routing

Advanced controls should be additive, not required for basic use.

## 34. Security and reliability

The system should maintain:

- authenticated access where required
- protected provider credentials
- input validation
- safe file handling
- job isolation
- durable job state
- retry policies
- cancellation
- worker leases
- heartbeats
- recovery after restart
- bounded job history
- audit/history records

The existing Smart-BethG work on persisted jobs, worker leases, cancellation, canonical media resolution and database-backed state is part of this foundation.

## 35. Failure recovery

Every major production stage should be restartable.

The system should avoid forcing users to regenerate an entire project because one shot failed.

Examples:

- regenerate one shot
- replace one voice take
- replace one SFX
- revise one scene
- rerender one timeline segment
- retry a failed provider
- resume after server restart

Expensive successful artifacts should remain reusable.

## 36. Architecture boundaries

Smart-BethG should separate:

- UI
- project state
- film intelligence
- production planning
- event/timeline engine
- media management
- model/provider routing
- generation workers
- storage
- provenance
- QC
- rendering/export

No single model or provider should become the architectural center of the product.

## 37. Current implementation assessment

This section must be maintained as implementation progresses.

Categories:

- IMPLEMENTED
- PARTIALLY_IMPLEMENTED
- ARCHITECTURE_PRESENT
- UNVERIFIED
- MISSING
- NEEDS_REDESIGN
- FUTURE

The assessment should be based on repository evidence and tests, not assumptions.

## 38. Phased implementation strategy

### Phase 1 — Production foundation

- shared project model
- stable IDs
- Film Bible
- scenes
- shots
- asset relationships
- durable state
- provenance
- existing job reliability

### Phase 2 — Film Intelligence

- Film Assistant
- screenplay understanding
- structured scene planning
- shot planning
- continuity assistance
- structured proposals
- validators

### Phase 3 — Visual production

- storyboard
- image generation
- video generation
- references
- continuity-aware generation
- shot approval

### Phase 4 — Audio production

- dialogue
- voice
- lip synchronization
- music
- SFX
- ambience
- event-based synchronization

### Phase 5 — Timeline and post-production

- multi-track timeline
- editing
- audio mixing
- captions
- QC
- rendering
- export

### Phase 6 — Real filmmaking workflow

- camera import
- take management
- production planning
- floor plan
- blocking
- production paperwork
- real footage + AI footage

### Phase 7 — Runtime and model independence

- Smart-BethG Local
- Smart-BethG Self-Hosted
- model packaging/runtime
- hardware detection
- model installation
- provider routing
- controlled training-data pipeline

### Phase 8 — Future Smart-BethG models

Only after sufficient rights-controlled data, evaluation infrastructure, compute, and clear technical justification:

- specialized Smart-BethG derivatives
- distillation
- model improvement
- potentially new Smart-BethG foundation models

## 39. Research boundary

Existing projects are references for learning.

We should record:

- useful architectural patterns
- useful UX patterns
- useful data models
- failures
- limitations
- missing capabilities
- engineering tradeoffs

We should not define Smart-BethG as a clone or aggregation of any particular project.

MIT or Apache licensing may permit reuse of some code, but permission alone is not a reason to reuse it.

GPL and non-commercial projects may still be valuable research references while requiring greater separation from implementation.

All third-party model weights, datasets, assets, and dependencies require their own license/provenance review.

## 40. Definition of success

Smart-BethG should eventually feel like one coherent filmmaking environment.

A user should be able to move from idea to production without repeatedly translating the same creative information between disconnected tools.

The system should understand the film, maintain continuity, plan shots, coordinate specialized generation systems, synchronize events and media, preserve production history, recover from failures, and produce a valid final deliverable.

The defining feature is not that Smart-BethG uses a particular model.

The defining feature is that **Smart-BethG understands and manages the filmmaking process as a structured production system.**
