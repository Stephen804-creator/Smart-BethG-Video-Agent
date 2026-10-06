# Smart-BethG Canonical Production Graph — Design v1

Status: Architecture design  
Branch: `filmmaking-workspace-spec`  
Purpose: Establish one canonical relationship model before Film Intelligence, synchronization, timeline and advanced workspace implementation.

## 1. Decision

Smart-BethG will use a canonical **Production Graph** as the shared production model.

The graph is not a replacement for the database. It is the domain model represented by durable database records and relationships.

The important rule is:

> A production fact should have one canonical owner and many references.

The UI, Film Assistant, Auto Director, storyboard, continuity system, generation workers and timeline should consume the same production entities instead of creating parallel copies.

## 2. Core hierarchy

The canonical hierarchy is:

```
Project
 ├─ Story
 ├─ Film Bible
 │   ├─ Character
 │   ├─ Location
 │   ├─ Prop
 │   └─ Style
 ├─ Screenplay
 │   └─ Sequence
 │       └─ Scene
 │           ├─ Shot
 │           └─ Event
 ├─ Asset
 ├─ Continuity State
 ├─ Timeline
 │   └─ Timeline Clip
 └─ Production / Approval records
```

Not every relationship is strictly hierarchical. Characters, locations, props, assets and events may be referenced by multiple scenes/shots.

## 3. Canonical entities

### Project

Owns the film and all project-scoped production data.

Minimum fields:

```
project_id
title
logline
genre
format
status
owner_user_id
created_at
updated_at
```

The Project is the root security and persistence boundary.

### Story

Owns story-level creative information:

```
story_id
project_id
premise
theme
tone
acts
story_version
```

### Character

```
character_id
project_id
name
role
description
appearance
wardrobe
personality
relationships
voice_identity
references
continuity_constraints
approved_identity_asset_id
```

### Location

```
location_id
project_id
name
description
environment
time_variants
lighting
references
continuity_constraints
```

### Prop

```
prop_id
project_id
name
description
appearance
owner_character_id
references
continuity_constraints
```

### Style

Project-level creative language:

```
style_id
project_id
visual_style
cinematography_language
color_direction
lighting_language
framing_preferences
motion_language
audio_language
music_direction
```

### Screenplay

```
screenplay_id
project_id
title
version
status
created_at
updated_at
```

A project may eventually have multiple screenplay revisions, but exactly one may be designated the active revision.

### Sequence

A production grouping between screenplay and scenes:

```
sequence_id
screenplay_id
project_id
number
title
purpose
order_index
```

### Scene

```
scene_id
project_id
sequence_id
screenplay_id
number
slug
location_id
time_of_day
objective
action
dialogue
emotional_state
visual_direction
audio_direction
status
approval_state
order_index
```

The existing scene model can evolve into this structure without losing its stable ID.

### Shot

```
shot_id
project_id
scene_id
number
purpose
description
action
character_ids[]
prop_ids[]
framing
angle
camera_id
lens
movement
camera_position
blocking
lighting
visual_style
duration
fps
storyboard_panel_id
approved_take_id
continuity_in_id
continuity_out_id
approval_state
order_index
```

The Shot remains the central production unit for visual work.

## 4. Events

Events are first-class production records.

An Event describes something that happens or must happen at a meaningful point in the production.

Minimum conceptual fields:

```
event_id
project_id
scene_id
shot_id
type
source
time_mode
time_value
duration
payload
status
```

Possible types:

```
ACTION
DIALOGUE
CAMERA
FACIAL
MUSIC
SFX
FOLEY
AMBIENCE
TRANSITION
EFFECT
CAPTION
CONTINUITY
```

Events do not themselves have to contain media.

For example:

```
event_id: evt-sword-draw-01
type: ACTION
shot_id: shot-12
time_mode: relative
time_value: 4.20
payload:
  action: draw_sword
  character_id: john
```

A sound event may reference the same action event:

```
event_id: evt-sword-sfx-01
type: SFX
source_event_id: evt-sword-draw-01
payload:
  effect: sword_draw
  offset_ms: -20
```

This creates synchronization through relationships rather than prompt instructions.

## 5. Time model

Smart-BethG should distinguish three useful timing spaces.

### Project timeline time

Absolute time in the assembled film.

Example:

```
00:01:14.200
```

### Shot-relative time

Time relative to the start of a Shot.

Example:

```
4.200s
```

### Event-relative offset

A media event may be positioned relative to another event.

Example:

```
source_event = sword_draw
offset = -20ms
```

The system should resolve relative events into timeline time during planning/rendering.

This allows an action to move without manually fixing every dependent sound cue.

## 6. Dialogue

Dialogue is an event-linked production entity.

Conceptual fields:

```
dialogue_id
event_id
scene_id
shot_id
character_id
text
start
end
emotion
delivery_direction
voice_id
audio_asset_id
approved_take_id
```

Dialogue may be represented as screenplay content before production and as a timed event after production planning.

## 7. Audio cues

Music, SFX, foley and ambience should reference events or explicit timeline ranges.

Example:

```
SFX
source_event_id = evt-sword-draw-01
asset_id = asset-sword-draw-07
offset_ms = -20
```

The same event can therefore drive:

- visual action
- camera movement
- SFX
- music change
- dialogue timing
- continuity update

## 8. Continuity state

Continuity should not merely be a list of notes.

A Continuity State is a snapshot or transition describing the known state of entities.

Conceptual fields:

```
continuity_state_id
project_id
scene_id
shot_id
entity_type
entity_id
state
source_event_id
created_at
```

Examples:

Character:

```
entity_type = character
entity_id = john
state:
  wardrobe = black_jacket
  injury = left_arm_cut
  emotional_state = tense
```

Prop:

```
entity_type = prop
entity_id = sword
state:
  holder = john
  location = right_hand
  condition = drawn
```

A later shot can be validated against the last approved state.

## 9. Assets

Assets remain physical media artifacts.

An Asset should reference its production context but should not become the production graph itself.

Conceptual fields:

```
asset_id
project_id
asset_type
uri
mime_type
duration
width
height
fps
checksum
source_type
provider
model
model_version
job_id
parent_asset_ids[]
reference_asset_ids[]
approval_state
version
rights_profile_id
created_at
```

This preserves the distinction:

Production entity = what the film says/does.

Asset = media artifact used to realize it.

## 10. Takes

A Take is a production attempt or recorded version of a Shot.

```
take_id
shot_id
asset_id
take_number
source_type
camera_metadata
generation_metadata
quality_control
approval_state
created_at
```

Only the approved take should become the default visual realization of a Shot.

Rejected and superseded takes remain available according to retention policy.

## 11. Storyboard

A Storyboard Panel is a view/artifact attached to a Shot.

```
storyboard_panel_id
shot_id
asset_id
panel_order
camera_notes
action_notes
approval_state
version
```

The storyboard does not create a second Shot.

## 12. Timeline

The Timeline is the temporal source of truth for the assembled film.

Minimum:

```
timeline_id
project_id
version
duration
fps
tracks[]
```

A Timeline Clip:

```
clip_id
timeline_id
track_id
source_type
source_id
start
duration
in_point
out_point
linked_clip_ids[]
event_ids[]
```

Source types may include:

```
SHOT
VIDEO_ASSET
DIALOGUE
VOICE
MUSIC
SFX
AMBIENCE
CAPTION
EFFECT
```

The timeline references production entities and assets rather than copying their creative definitions.

## 13. Approval

Approval is a separate production concern.

Conceptual record:

```
approval_id
project_id
entity_type
entity_id
state
reviewer
notes
created_at
```

States:

```
DRAFT
GENERATED
REVIEW
APPROVED
REJECTED
SUPERSEDED
ARCHIVED
```

This allows a generated asset to exist without automatically becoming production truth.

## 14. Provenance

Rights/provenance should be attached to assets and relevant generated artifacts.

A rights profile can contain:

```
rights_profile_id
source
license
license_version
training_allowed
commercial_training_allowed
redistribution_allowed
derivative_model_allowed
restrictions
```

Provider/model information should be separate from rights classification.

## 15. Relationship rules

The following rules are architectural invariants.

1. Every Scene belongs to exactly one Project.
2. Every Shot belongs to exactly one Project and normally one Scene.
3. Every Shot has a stable ID that survives UI reordering.
4. Storyboard panels reference Shots; they do not duplicate them.
5. Continuity states reference entities and events; they do not create duplicate characters/props.
6. Timeline clips reference Shots, Assets or other production entities.
7. Assets reference their source production context.
8. Takes belong to Shots.
9. Approved takes are explicit.
10. Events have stable IDs and can be referenced by multiple dependent media events.
11. Relative event timing should be resolvable to absolute timeline timing.
12. A rejected generation must not silently replace an approved artifact.
13. AI proposals must be distinguishable from approved project state.
14. Provider/model selection must not be embedded as the identity of a Shot.
15. Project state must remain understandable if a provider disappears.

## 16. Film Assistant integration

Film Assistant should operate on graph entities and proposals.

Example request:

> Make Scene 4 more suspenseful.

The assistant should read:

- Scene 4
- relevant characters
- Film Bible style
- previous/next scenes
- existing events
- continuity state
- approved assets

It can propose changes such as:

```
UPDATE scene-004
ADD camera event
ADD music intensity event
ADD ambience reduction
ADD SFX cue
PRESERVE dialogue
CONTINUITY CHECK: PASS
```

The assistant should not directly mutate approved production state without the required approval boundary.

## 17. Auto Director integration

Auto Director consumes graph state and produces durable production tasks.

Example:

```
Scene
  ↓
Shot plan
  ↓
Event plan
  ↓
Capability tasks
  ├─ visual
  ├─ dialogue
  ├─ voice
  ├─ music
  ├─ SFX
  └─ ambience
  ↓
Assets / Takes
  ↓
QC
  ↓
Approval
  ↓
Timeline
```

Each stage should preserve references to the originating graph entities.

## 18. Migration from current repository

Do not rewrite the existing film store in one destructive step.

Existing concepts map approximately as follows:

```
current project      → Project
current story        → Story
current characters   → Character
current world        → Film Bible / Location / Prop
current scene        → Scene
current shot         → Shot
current take         → Take
current asset        → Asset
current continuity   → Continuity State
sound plan           → Event/Cue planning
production graph     → orchestration inputs
```

The existing stable IDs should be preserved where possible.

The migration should be additive:

1. Define canonical schemas.
2. Add database tables/records.
3. Add adapters between current structures and canonical entities.
4. Migrate existing projects.
5. Add validators.
6. Move one workflow at a time to canonical entities.
7. Remove obsolete duplicate representations only after migration is proven.

## 19. What this design intentionally does NOT decide yet

This document does not lock down:

- PostgreSQL table names
- ORM choice
- frontend state library
- exact timeline engine
- exact screenplay file format
- exact event storage implementation
- exact model providers
- exact rendering engine
- final UI layout

Those are implementation decisions that should follow the domain model.

## 20. First implementation slice

The first code slice should not attempt the whole graph.

Implement only:

```
Project
Character
Location
Prop
Scene
Shot
Event
Asset
Take
```

with:

- stable IDs
- project ownership
- scene → shot relationship
- shot → event relationship
- event → event dependency
- shot → take relationship
- asset → shot/take relationship
- basic continuity state
- validation

Then build one vertical workflow:

```
Create Film
→ Create Scene
→ Create Shot
→ Create Action Event
→ Attach SFX Event
→ Generate/attach Asset
→ Create Take
→ Approve Take
```

If this slice works end-to-end, it establishes the foundation for the later Film Assistant and timeline without building throwaway architecture.

## 21. Success criteria

The graph design is successful when one production fact can be changed once and every dependent view can resolve the change.

Example:

If Shot 12's sword-draw event moves from 4.20s to 5.00s:

- the visual action remains tied to the same event;
- the sword-draw SFX follows its event relationship;
- dependent music/camera cues can be recalculated;
- continuity remains linked;
- the timeline can resolve the new position;
- Film Assistant can explain the change;
- the generation history remains intact.

That is the behavior Smart-BethG needs to become a true filmmaking system rather than a collection of generation tools.
