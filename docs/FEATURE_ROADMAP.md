# Cinematic Agent / Media Intelligence Engine — Feature Roadmap

Status: Active development
Repository: `Stephen804-creator/Smart-BethG-Video-Agent`
Branch: `main`

## 1. Product direction

Cinematic Agent is being developed toward a provider-neutral Media Intelligence Engine for video creation, video understanding, production planning, generation, editing, evaluation, and long-running media projects.

The platform should own the intelligence and orchestration layer. Models, APIs, GPU machines, and external media providers are workers behind replaceable adapters.

Core principle:

`Director intent → media understanding → production plan → workflow → provider routing → generation → evaluation → human correction → production data`

No provider or GPU vendor should be hard-coded into the core architecture.

## 2. Development rules

1. Build real functionality before cosmetic expansion.
2. Build one dependable layer at a time and prove the end-to-end path.
3. Keep provider/model/workflow/infrastructure concerns separate.
4. Never silently spend money on a paid provider.
5. Keep API keys and credentials server-side.
6. Record production metadata from the beginning.
7. Treat generated media as production takes, not disposable files.
8. Preserve human/director control over creative decisions.
9. Use progressive disclosure in the UI: show important decisions first and advanced controls only when needed.
10. Do not claim a model, GPU, workflow, or integration works until it is actually connected and tested.
11. Track licensing and usage rights for media that may later enter datasets.
12. New providers should be adapters, not special cases scattered throughout the application.

## 3. Current foundation

Already present in the V1 codebase:

- React/Vite frontend and Express backend.
- Real LTX generation through the documented Hugging Face Gradio API.
- Luma adapters.
- Provider registry and capability-based scoring.
- Provider-neutral media task contract.
- ComfyUI worker boundary and workflow placeholder system.
- Production runner and execution planning.
- Film projects, scenes, shots, takes and explicit ordering.
- Asset upload, metadata extraction, hashing and attachment.
- Sequence support.
- Continuity records.
- Production/film planning layers.
- Knowledge base foundations.
- Dataset manifest foundations.
- Database foundations.
- Compact production-format selector.
- Collapsible advanced camera/look controls.

These foundations are not considered complete; they are the base on which the following roadmap will be built.

## 4. Phase A — Director Workspace

Goal: make the application feel like a professional creative workspace instead of a configuration form.

Features:
- Project dashboard.
- Recent projects and production activity.
- Clear project/sequence/mode navigation.
- Main director composer.
- Contextual generation controls.
- Compact production-format selector.
- Progressive disclosure for advanced controls.
- Prominent result/take area.
- Collapsible sequence/shot panel.
- Consistent empty, loading, success and error states.
- Generation progress and queue visibility.

Acceptance:
A director can enter a project, understand what is being created, prepare a generation request, submit it, review the result and continue without navigating through unrelated controls.

## 5. Phase B — Story and World Development

Goal: turn an idea into persistent structured creative knowledge.

Features:
- Story workspace.
- Premise and story concept.
- Story structure and acts.
- Character Bible.
- Character appearance/reference assets.
- Character personality and relationships.
- World Bible.
- Locations.
- Factions.
- World rules.
- Technology/magic/system rules.
- Historical events.
- Story terminology.
- Story memory.
- Character relationship evolution.
- Event/state tracking.

Acceptance:
A project can remember its story, characters and world rules across scenes and episodes instead of rebuilding context from scratch.

## 6. Phase C — Scene and Shot Intelligence

Goal: convert narrative intent into production-ready visual plans.

Features:
- Scene Builder.
- Scene purpose and dramatic beat.
- Characters present.
- Location/time/weather.
- Blocking.
- Action.
- Dialogue.
- Mood.
- Shot Designer.
- Automatic shot breakdown.
- Manual shot editing.
- Shot order.
- Framing.
- Camera movement.
- Lens/look.
- Lighting.
- Composition.
- Visual motifs.
- Reference assignment.

Acceptance:
A scene can be converted into an ordered shot plan containing enough information for a generation workflow.

## 7. Phase D — Continuity and Reference Intelligence

Goal: maintain visual and narrative consistency.

Features:
- Character reference sets.
- Location reference sets.
- Costume/prop reference sets.
- Shot-to-shot continuity state.
- Character position tracking.
- Clothing tracking.
- Lighting continuity.
- Prop continuity.
- Camera-direction/eyeline continuity.
- Scene state.
- Previous/next shot context.
- Continuity warnings.
- Continuity graph.

Acceptance:
The system can identify relevant prior context and pass it into a new shot plan instead of treating every generation as independent.

## 8. Phase E — Provider and Workflow Intelligence

Goal: make generation infrastructure interchangeable.

Features:
- Provider registry.
- Model registry.
- Workflow registry.
- Capability matching.
- Health status.
- Quota awareness.
- Cost awareness.
- Latency tracking.
- Success-rate tracking.
- Freshness/availability tracking.
- Transparent routing decisions.
- Provider fallback.
- Explicit paid-generation permission.
- ComfyUI workflow execution.
- Wan workflows.
- HunyuanVideo workflows.
- LTX workflows on user-controlled GPU infrastructure.
- Vast.ai worker.
- RunPod worker.
- Local GPU worker.
- Future custom-model worker.

Every generation should retain:
- provider
- model
- workflow
- infrastructure
- routing decision
- fallback attempts
- latency
- estimated cost
- quota state
- seed
- references
- generation ID
- task parameters

Acceptance:
The same provider-neutral request can be executed by different compatible workers without changing the application core.

## 9. Phase F — Generation Operations

Goal: make media generation usable at production scale.

Features:
- Generation queue.
- Job states.
- Retry handling.
- Cancellation.
- Batch shot generation.
- Generation history.
- Take management.
- Side-by-side take comparison.
- Favorite/select take.
- Generation metadata.
- Failed-generation diagnostics.
- Result storage.
- Persistent object storage.

Acceptance:
A project can contain many generation jobs and clearly track their state and selected takes.

## 10. Phase G — Prompt and Cinematography Intelligence

Goal: transform director intent into technically useful production instructions.

Knowledge areas:
- Shot sizes.
- Framing.
- Lenses.
- Camera movement.
- Depth of field.
- Exposure.
- Lighting.
- Composition.
- Blocking.
- Mise-en-scène.
- Eyelines.
- Establishing shots.
- Reaction shots.
- Inserts.
- POV.
- Visual motifs.
- Pacing.
- Genre conventions.

Features:
- Prompt normalization.
- Cinematic prompt expansion.
- Camera-aware prompting.
- Continuity-aware prompting.
- Negative constraints.
- Model-specific prompt translation.
- Prompt diagnostics.

Acceptance:
A simple creative request can become a structured production request without losing the director's intent.

## 11. Phase H — Storyboarding and Previsualization

Features:
- Storyboard frame generation.
- Shot preview cards.
- Scene boards.
- Visual reference boards.
- Shot-to-frame mapping.
- Previsualization sequence.
- Storyboard approval.
- Storyboard-to-generation handoff.

Acceptance:
The director can validate the visual plan before spending significant GPU resources on video.

## 12. Phase I — Video Understanding

Goal: understand existing video as structured media.

Features:
- Video ingestion.
- Scene detection.
- Shot-boundary detection.
- Object detection.
- Action detection.
- Character/entity recognition.
- Camera movement detection.
- Framing detection.
- Visual relationship analysis.
- Dialogue understanding.
- Transcription.
- Caption extraction.
- Audio event detection.
- Temporal event tracking.
- Semantic indexing.

Acceptance:
An uploaded video can be converted into searchable production information.

## 13. Phase J — Audio Intelligence

Features:
- Dialogue planning.
- Voice assets.
- Ambience.
- Foley.
- Sound effects.
- Music planning.
- Audio synchronization.
- Audio metadata.
- Scene-level sound plans.
- Mix/master workflow metadata.

Acceptance:
Audio becomes part of the production plan rather than an afterthought.

## 14. Phase K — Editing Intelligence

Features:
- Scene timeline.
- Shot timeline.
- Cut planning.
- Continuity editing.
- J-cuts.
- L-cuts.
- Match cuts.
- Reaction timing.
- Montage.
- Pacing analysis.
- Rough-cut generation.
- Timeline metadata.
- Edit decision records.

Acceptance:
Ordered takes can become a real editable rough cut.

## 15. Phase L — Color and Finishing

Features:
- Color notes.
- Shot matching.
- Exposure consistency checks.
- Look references.
- Color workflow metadata.
- Final-quality checks.
- Finishing pipeline.

Acceptance:
A sequence can move from rough edit toward a controlled final output.

## 16. Phase M — Delivery and Repurposing

Features:
- YouTube export.
- Vertical/social export.
- Trailer generation.
- Short-form extraction.
- Episode exports.
- Multiple aspect ratios.
- Captions/subtitles.
- Delivery presets.
- Export validation.

Acceptance:
One production can produce multiple correctly prepared deliverables.

## 17. Phase N — Serialized Story Production

Goal: support long-running entertainment universes.

Hierarchy:

`Series → Season → Episode → Scene → Shot → Take`

Features:
- Series management.
- Seasons.
- Episodes.
- Episode memory.
- Character state across episodes.
- Relationship progression.
- World-state progression.
- Event history.
- Recurring locations.
- Recurring visual references.
- Long-form continuity checks.

Acceptance:
A later episode can use established story/world state without manually reconstructing the entire history.

## 18. Phase O — Evaluation and Human Feedback

Features:
- Prompt adherence evaluation.
- Motion evaluation.
- Character consistency evaluation.
- Visual quality evaluation.
- Continuity evaluation.
- Human rating.
- Director corrections.
- Reason-for-rejection.
- Preferred-take records.
- Before/after correction records.

Example:

`AI recommendation → director correction → generation → result → evaluation`

Acceptance:
The platform records not only what was generated, but what the director considered correct or incorrect.

## 19. Phase P — Dataset and Learning Infrastructure

Goal: create structured production data that can support future research, evaluation and model development where licensing permits.

Dataset areas:
- Projects.
- Scripts.
- Scenes.
- Shots.
- Storyboards.
- Prompts.
- Reference images.
- Generated videos.
- Edited videos.
- Audio.
- Transcripts.
- Captions.
- Production notes.
- Workflows.
- Model metadata.
- Evaluations.
- Corrections.
- Documentation.

Every asset intended for dataset use should track:
- source
- ownership/rights
- provider
- model
- license/usage restrictions
- generation parameters
- consent/permission where applicable
- evaluation status

Important: provider/API outputs must not automatically enter a training dataset. Dataset eligibility must be determined from the applicable provider/model terms and asset rights.

Acceptance:
A production can produce structured, traceable records suitable for later evaluation or model-development work.

## 20. Phase Q — Model Experimentation

Features:
- Same-prompt multi-model testing.
- Workflow comparison.
- A/B generation comparison.
- Evaluation comparison.
- Seed tracking.
- Model/version tracking.
- Cost comparison.
- Latency comparison.
- Failure analysis.

Acceptance:
The platform can experimentally compare workers without changing the production architecture.

## 21. Phase R — Custom Media Models

Long-term:

`Media Intelligence Engine → YourVideoModel worker`

Features:
- Custom model adapter.
- Model version registry.
- Inference worker.
- Evaluation harness.
- Dataset export.
- Fine-tuning pipeline.
- Model benchmark suite.
- Model/version comparison.

The platform architecture must not require this model to exist today.

## 22. Phase S — Search and Knowledge Intelligence

Features:
- Search across projects.
- Search across scenes/shots.
- Search across characters.
- Search across assets.
- Search across generations.
- Search across production documentation.
- Knowledge retrieval.
- Source tracking.
- Knowledge confidence/versioning.
- Production evidence linking.

Example queries:
- “Show every shot containing Marcus.”
- “Find rejected night scenes.”
- “Show shots generated with this workflow.”
- “What continuity rules apply to this character?”

## 23. Phase T — API, Extensions and Platform Architecture

Features:
- Public/internal API.
- Provider adapter interface.
- Workflow plugin interface.
- Analysis plugin interface.
- Media format plugin interface.
- Authentication.
- Project permissions.
- Credential management.
- Usage controls.
- Extension registry.

Acceptance:
New providers and capabilities can be added without rewriting the core engine.

## 24. Phase U — Infrastructure, Storage and Reliability

Features:
- Persistent object storage.
- Production database.
- Job queue.
- Worker management.
- Health monitoring.
- Error tracking.
- Logs.
- Metrics.
- Cost monitoring.
- Backup/recovery.
- Storage lifecycle management.
- Security hardening.

Render's ephemeral filesystem is suitable for V1 testing but should not be treated as permanent production storage.

## 25. Long-term intelligence loop

The complete platform should eventually operate around this loop:

`KNOWLEDGE`
↓
`PLANNING`
↓
`PRODUCTION`
↓
`MEDIA OUTPUT`
↓
`EVALUATION`
↓
`HUMAN CORRECTION`
↓
`PRODUCTION DATA`
↓
`IMPROVED KNOWLEDGE / WORKFLOWS / MODELS`
↓
`BETTER PLANNING`

This feedback loop is more important than any individual video-generation provider.

## 26. Build order

We will not attempt the entire roadmap in one generation.

The working sequence is:

1. Stabilize the provider-neutral generation foundation.
2. Finish real ComfyUI workflow execution and GPU-worker integration.
3. Strengthen automatic provider routing.
4. Finish the Director Workspace UX.
5. Build Project Dashboard.
6. Build Story Workspace.
7. Build Character Bible and World Bible.
8. Build Scene Builder.
9. Build Shot Designer.
10. Strengthen reference and continuity intelligence.
11. Build generation queue and take management.
12. Add evaluation and human feedback.
13. Build storyboard/previsualization.
14. Expand video understanding.
15. Add audio and editing intelligence.
16. Add serialized-story production.
17. Strengthen dataset/evaluation infrastructure.
18. Add model experimentation.
19. Add custom-model worker architecture.
20. Expand API/extensions and production infrastructure.

Each step should produce a usable improvement before the next major layer is started.

## 27. Definition of done for each feature

A feature is not considered complete merely because its UI exists.

For each feature we should verify:

- Data model exists.
- Backend/API exists where required.
- UI exists where required.
- Real persistence works.
- Error states are handled.
- Existing functionality still works.
- The feature integrates with the surrounding workflow.
- No fake/placeholder success is presented.
- Important metadata is recorded.
- Security/credential handling is appropriate.
- The feature can be extended without rewriting unrelated systems.

## 28. Current immediate target

The next implementation work should follow the build order above rather than jumping randomly between future features.

Immediate engineering priority:

`Provider foundation → real ComfyUI/GPU workflows → routing → Director Workspace → Project Dashboard → Story/World system`

The roadmap is deliberately broad, but implementation remains incremental.
