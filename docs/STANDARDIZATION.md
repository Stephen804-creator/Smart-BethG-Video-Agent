# Media Intelligence Engine — Standardization Status

This document defines the production baseline for this repository. It separates implemented standards from capabilities that still require engineering.

## Implemented baseline

### Architecture
- Provider-neutral media tasks.
- Provider/model separation from creative intent.
- Capability-based provider routing.
- Explicit paid-provider permission.
- Production planning before execution.
- Production graph with story, scene, shot, continuity and task nodes.
- Execution jobs with lifecycle states.
- Persistent local job history.

### Story and production planning
- Story, beat, scene, shot and entity structures.
- World-bible/entity state representation.
- Shot-list coverage planning.
- Format-specific production pipelines.
- Provider-neutral visual and audio task descriptions.
- Production graph context links from tasks to scenes/shots.

### Knowledge
- Structured knowledge records with definition, purpose, applicability, relationships, diagnostics, AI implications, source, version and confidence.
- Task-aware knowledge retrieval.
- Knowledge-reference validation.
- Domains covering cinematography, visual storytelling, production, continuity, AI video, editing, audio, media management and quality control.

### Asset management
- Real file upload endpoint.
- Asset ingestion into film projects.
- Persistent project/scene/shot linkage.
- MIME type, size, provenance source and URI metadata.
- Runtime media directories excluded from Git.

### Quality control
- Generation metadata schema.
- Evaluation fields.
- Production assistant coverage checks.
- Continuity/event records.
- Separate candidate generation from production approval.

## Areas that still require engineering

### 1. Persistent production database
Current film-project and job stores are JSON files. A production-grade deployment should migrate projects, scenes, shots, takes, assets, jobs and continuity events into PostgreSQL or another transactional database, with migrations and indexes.

### 2. Object storage
Uploaded and generated media should move from the Render/local filesystem to object storage with signed URLs, checksums, lifecycle policies and resumable uploads.

### 3. Asset ingestion UI
The backend can ingest files, but the UI still needs drag/drop or file selection, upload progress, retry, preview, metadata editing and attachment to a scene/shot/take.

### 4. Media asset inspection
Add server-side probing for duration, dimensions, codec, frame rate, audio streams, file hash and basic technical metadata. Images need dimensions and color/profile metadata; audio needs duration, sample rate and channels.

### 5. Real editing/timeline engine
The current system plans editing but does not provide a real non-linear timeline. Required areas include tracks, trims, splits, transitions, audio overlaps, captions, markers, versioning and export.

### 6. Real audio production
The current sound layer is planning/schema only. Workers are still required for voice, dialogue, ambience, Foley, SFX, music, synchronization, mixing and mastering.

### 7. Image generation workers
Image-generation tasks exist in plans, but a real provider-neutral image worker interface and adapters are required.

### 8. Video worker standardization
The ComfyUI worker is the first concrete worker. It needs workflow validation, media-type-aware output handling, cancellation, progress events, retries, concurrency control and worker capability declarations.

### 9. Provider routing maturity
Add cost estimates, quota state, latency history, success/failure history, cooldowns, retry policy, fallback policy and routing explanations. No paid fallback should occur without explicit permission.

### 10. Job orchestration
Move from request-blocking execution to a persistent queue with resumable jobs, cancellation, retries, concurrency limits, progress events and idempotency keys.

### 11. Continuity engine
Continuity events currently exist, but the system needs ordered scene/shot sequence numbers rather than lexical ID comparison, explicit before/after state snapshots, contradiction detection and automatic continuity requirements on tasks.

### 12. Knowledge graph
The knowledge records are structured, but relationships should become queryable graph edges. Add prerequisites, conflicts, alternatives, evidence/examples and rule priority.

### 13. Knowledge provenance
Replace generic internal source labels with real source metadata for externally sourced knowledge: source title, publisher/author, URL, publication/update date, license and retrieval date.

### 14. Evaluation engine
Turn quality-control fields into actual evaluators for duration, resolution, motion stability, identity consistency, prompt adherence, framing, camera movement, audio sync and technical validity.

### 15. Human feedback loop
Record director edits as first-class events: recommendation, human decision, reason, produced result and final approval. This is important future training/evaluation data.

### 16. Dataset pipeline
The manifest is a foundation. Add immutable asset hashes, rights/licensing checks, dataset partitions, schema migrations, rejected examples, evaluation labels and export formats.

### 17. Workflow registry
ComfyUI workflows should be versioned, validated against worker capabilities, named, hashed and linked to successful/failed generations.

### 18. Model registry
Track model family, version, quantization, license, capabilities, context limits, input/output types and known limitations separately from providers.

### 19. Security
Add authentication/authorization, secret isolation, upload validation, MIME/content verification, rate limits, request size policies, path safety, audit logs and SSRF protection for remote worker URLs.

### 20. Observability
Add structured logs, correlation IDs, job metrics, worker health history, latency, failure reasons, storage usage and operational dashboards.

### 21. API contract
Define versioned request/response schemas, validation, error codes, pagination, idempotency and OpenAPI documentation.

### 22. Testing
Add unit tests for planners/router/knowledge/continuity, integration tests for worker adapters and API tests for production flows. Add fixtures for successful and failed generations.

### 23. Browser production workspace
The film workspace still needs proper scene navigation, shot ordering, take review, asset preview, continuity warnings, timeline handoff and project autosave/version history.

### 24. Real camera/media workflows
Support importing footage from phones, cameras and recorders through files rather than pretending browser capture is equivalent to cinema-camera ingestion. Hardware capture can be added later through supported browser/capture-card paths.

### 25. AI reasoning layer
The current film assistant is deterministic planning logic. A true reasoning provider layer is still required for open-ended script analysis, alternative shot reasoning, continuity diagnosis, research and director dialogue. The reasoning provider must remain independent of media-generation workers.

### 26. Long-form film intelligence
For 1–2 hour films, add hierarchical memory: project bible → episode/act → sequence → scene → beat → shot → take → asset. Do not send the entire project context to a model for every operation.

### 27. Serialization and interchange
Add import/export for common project data formats and a stable internal interchange model so the platform is not locked to one UI or provider.

### 28. Compliance and rights
Every external asset/model/provider must have a recorded usage policy. Training-dataset eligibility must be checked independently from production eligibility.

## Standard target

The long-term production path is:

Director intent → story model → production plan → knowledge retrieval → continuity resolution → production graph → capability router → worker → candidate asset → technical validation → creative evaluation → human approval → edit/timeline → final master → dataset record.

Infrastructure providers are workers behind this path. The core platform should not depend on a particular GPU marketplace, model host or media-generation company.
