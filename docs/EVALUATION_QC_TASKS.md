# Evaluation, Quality Testing and Quality Control Task Register

This document converts the full repository evaluation into an execution backlog. Status is explicit: DONE = implemented and evidenced in code; PARTIAL = a real foundation exists but the capability is incomplete; MISSING = not yet implemented; BLOCKED = requires an external runtime/provider or evidence that is not currently available.

## 1. Current baseline

- [PARTIAL] Real video generation: Hugging Face/LTX and Luma adapters exist; ComfyUI worker exists.
- [PARTIAL] Provider routing: capability, configuration, health and free/paid filtering exist; cost, latency, quota, historical success and quality-aware routing are missing.
- [PARTIAL] Film production data: projects, story/world/characters, scenes, shots, takes, assets and continuity exist.
- [PARTIAL] Production review: planning/coverage review exists, but it does not inspect generated pixels.
- [PARTIAL] Dataset records: structured generation/evaluation fields exist, but evaluation evidence is not yet automatically produced.
- [PARTIAL] Media metadata: duration probing exists; complete technical QC is not yet centralized.
- [MISSING] Automated software test suite and CI.
- [MISSING] Central quality/evaluation engine.
- [PARTIAL] Automated frame sampling is implemented; visual artifact analysis is still missing.
- [MISSING] Prompt/shot semantic adherence evaluation.
- [MISSING] Character/reference consistency evaluation.
- [MISSING] Background/scene consistency evaluation.
- [MISSING] Temporal flicker and motion-quality evaluation.
- [MISSING] Cinematography/directorial QC.
- [MISSING] Continuity QC between neighboring shots.
- [MISSING] Audio QC.
- [MISSING] Human review/accept/reject workflow with corrections.
- [MISSING] Evaluation history and take-to-take comparison.
- [MISSING] Provider performance learning from QC.
- [MISSING] VBench-compatible integration/benchmark runner.
- [MISSING] Long-video evaluation.
- [MISSING] Training-data eligibility enforcement from verified licensing metadata.

## 2. Execution order

### Phase 1 — Quality-control foundation
1. [DONE IN THIS ITERATION] Create a central video QC engine with technical validation.
2. [DONE IN THIS ITERATION] Add safe evaluation API for generated output files.
3. [DONE IN THIS ITERATION] Persist structured QC results in the dataset manifest.
4. [DONE IN THIS ITERATION] Automatically run QC after every successful generation.
5. [DONE IN THIS ITERATION] Add explicit PASS / REVIEW / FAIL decision rules.
6. [DONE IN THIS ITERATION] Add evaluation IDs, timestamps, evaluator version and evidence references.

### Phase 2 — Visual inspection
7. [DONE IN THIS ITERATION] Sample representative frames with ffmpeg.
8. [NEXT] Add frame-level image-quality checks from sampled evidence.
9. [NEXT] Add temporal-flicker diagnostics.
10. [NEXT] Add motion-smoothness diagnostics.
11. [NEXT] Add static/near-static detection.
12. [NEXT] Add visual artifact detection where reliable.

### Phase 3 — Semantic/directorial evaluation
13. [NEXT] Compare requested shot against generated video.
14. [NEXT] Evaluate subject/object presence.
15. [NEXT] Evaluate action completion.
16. [NEXT] Evaluate scene/background adherence.
17. [NEXT] Evaluate camera/framing/movement adherence.
18. [NEXT] Evaluate lighting/look adherence.
19. [NEXT] Evaluate character/reference consistency.

### Phase 4 — Production and continuity QC
20. [NEXT] Compare shot against previous/next approved take.
21. [NEXT] Check character wardrobe/state continuity.
22. [NEXT] Check props and world-state continuity.
23. [NEXT] Check screen direction and spatial continuity.
24. [NEXT] Check lighting and visual continuity.
25. [NEXT] Check required shot coverage.
26. [NEXT] Check audio requirements and synchronization.

### Phase 5 — Human review and learning
27. [NEXT] Add director review: approve, reject, revise, select take.
28. [NEXT] Record correction reason and replacement instruction.
29. [NEXT] Compare multiple takes using the same evaluation schema.
30. [NEXT] Feed evaluation outcomes into provider performance history.
31. [NEXT] Make routing quality-aware without silently spending money.

### Phase 6 — External benchmarks
32. [NEXT] Add optional VBench adapter/runner. VBench exposes 16 T2V dimensions and supports custom videos for several dimensions.
33. [NEXT] Add VBench-I2V evaluation where reference images exist.
34. [NEXT] Add long-video evaluation.
35. [NEXT] Keep benchmark scores separate from the application's cinematic/directorial QC.

### Phase 7 — Dataset/model readiness
36. [NEXT] Store raw generation, automatic evaluation, human evaluation and correction as separate records.
37. [NEXT] Verify licensing/terms before marking an asset training-eligible.
38. [NEXT] Prevent unverified assets from entering training datasets.
39. [NEXT] Build evaluation datasets from accepted/rejected examples.
40. [NEXT] Use the resulting evidence to improve prompts, routing, workflows and eventually custom models.

## 3. Definition of done for the quality system

A generated shot is not considered production-ready merely because a provider returned HTTP success. The system must be able to answer:

- Did a valid media file arrive?
- What technical properties does it actually have?
- What was the shot supposed to contain and do?
- What evidence supports the evaluation?
- Which quality dimensions passed or failed?
- Is the result PASS, REVIEW or FAIL?
- Why?
- What should the director change?
- Which take was selected?
- Can the result and its evaluation be reproduced or compared later?

The system must never invent a quality score when the required evaluator is unavailable. Unknown dimensions must remain UNKNOWN or NOT_EVALUATED.

## 4. Quality dimensions

The evaluation model intentionally separates dimensions rather than collapsing everything into one number. VBench provides a useful external reference: its T2V suite includes subject consistency, background consistency, temporal flickering, motion smoothness, dynamic degree, aesthetic quality, imaging quality and semantic dimensions such as human action, color, spatial relationship, scene and overall consistency.

Application-specific dimensions are added separately: prompt adherence, camera direction, cinematic intent, continuity, audio requirements, production readiness and director approval.

## 5. Evidence policy

Every automated finding should identify its evidence source where possible: ffprobe metadata, sampled frame, temporal statistic, reference asset, prompt requirement, continuity record, benchmark result or human review.

No evaluator should silently convert unavailable evidence into a passing score.

## 6. Current iteration

This iteration establishes the technical QC boundary and API. It intentionally does not pretend to have AI semantic vision before the required vision/evaluation workers are connected.
