# Video Model and Data Policy

Smart-BethG Video Agent separates production generation from model-training eligibility. A provider's output is never treated as training data merely because the user paid for the service or owns the input.

## Asset classes
- OWNED_DATA: project-controlled material with the necessary rights.
- LICENSED_TRAINING_DATA: material whose exact license/contract explicitly permits the intended training or fine-tuning use.
- GENERATION_ONLY_DATA: provider output approved for production but not confirmed for training another model.
- RESTRICTED_DATA: unclear provenance, unresolved rights, or pending review.

Every asset intended for training should preserve asset_id, source_type, source_provider, source_model, source_job_id, ownership_status, license_name, license_version, training_allowed, commercial_use_allowed, redistribution_allowed, derivative_model_allowed, restrictions, and provenance notes.

Unknown, false, restricted, or expired training permission is a hard rejection for training ingestion.

## Provider strategy
Open/open-weight does not automatically mean unrestricted. The exact model version and license must be recorded.

Proprietary hosted models are replaceable production providers. Their outputs are generation-only by default. Training use requires an explicit current official permission or contract for the intended purpose.

Current engineering classifications:
- Wan 2.2: preferred local/open starting point; verify the exact checkpoint license before training or redistribution.
- LTX-2.5: preferred local/customization path; follow the LTX-2.x license and derivative-model restrictions.
- VACE: control/editing layer; each underlying model license remains applicable.
- HunyuanVideo: useful for permitted Hunyuan derivatives, not a blanket license for an unrelated Smart-BethG foundation model.
- Veo, Seedance, Kling and other proprietary providers: production generation first; training eligibility must be verified separately.

This is an engineering policy, not legal advice. Provider terms and exact model licenses control.

## Model adapter contract
Video providers must implement a normalized contract:
- getCapabilities()
- validateRequest(request)
- submit(request, context)
- getStatus(job, context)
- cancel(job, context)
- fetchOutput(job, context)
- normalizeResult(raw, context)

The film planner must not contain provider-specific API calls.

## Router policy
The router evaluates task capability, local/remote preference, cost, availability, credentials, requested provider, and data/training policy.

A request with purpose=training-data must never select a provider whose trainingOutput is false or unknown.

A request with purpose=production may use generation-only providers.

## Long-term model strategy
Project-controlled and explicitly licensed data should form the foundation of future Smart-BethG model development. Premium providers remain optional quality/coverage providers, not assumed sources of synthetic training data.

Re-verify official terms before every commercial training run.

Last engineering review: 2026-10-05.