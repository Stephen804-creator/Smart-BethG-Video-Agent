# Video Model and Data Policy

## Purpose

Smart-BethG Video Agent must remain model-provider agnostic and must protect the provenance and permitted use of every media asset. This policy separates production generation from model-training data so proprietary provider output is never accidentally used for training when the applicable terms do not permit it.

## Core rule

Ownership of an input dataset does not automatically grant permission to use a provider's generated output for training another model. Smart-BethG therefore treats training eligibility as a separate, explicit property of every asset.

If an official provider agreement or model license does not clearly permit a proposed training use, the output is classified as generation-only.

This document is an engineering policy, not legal advice. Exact current provider terms and any negotiated enterprise agreement control.

## Asset classes

### OWNED_DATA

Original footage, images, audio, annotations, metadata, and other material for which the project has the necessary rights.

Owned data may be used for training only when the project has also confirmed that all underlying third-party rights, releases, licenses, privacy permissions, and contractual restrictions permit that training use.

### LICENSED_TRAINING_DATA

Third-party or model-derived data whose license or contract explicitly permits the intended training/fine-tuning/derivative-model use.

The exact license/version and permitted scope must be recorded.

### GENERATION_ONLY_DATA

Provider-generated output that may be used for production or other permitted purposes but has not been confirmed as eligible for training another model.

Generation-only assets must not enter a training corpus.

### RESTRICTED_DATA

Assets with unclear provenance, unresolved rights, contractual restrictions, or a pending legal review.

Restricted assets must not enter training.

## Required provenance metadata

Every media asset that can enter the training pipeline should carry, at minimum:

- asset_id
- source_type
- source_provider
- source_model
- source_job_id
- ownership_status
- license_name
- license_version
- source_uri
- created_at
- training_allowed
- commercial_use_allowed
- redistribution_allowed
- derivative_model_allowed
- restrictions
- provenance_notes

Training ingestion must reject assets whose training_allowed value is false, unknown, or expired/pending review.

## Provider tiers

### Tier 1 — Project-controlled data and models

Preferred foundation for Smart-BethG's long-term model-development program.

Use data that the project can legally control and models/licenses that permit the intended fine-tuning or derivative-model workflow.

### Tier 2 — Open/open-weight models

Examples may include LTX, HunyuanVideo, Wan and other models, but each model must be evaluated using its exact current license. "Open" or "open-weight" does not by itself mean unrestricted commercial use, redistribution, or training of unrelated models.

### Tier 3 — Proprietary production providers

Examples include Veo, Seedance, Kling and other hosted models.

These should be implemented as replaceable provider adapters. Their output is production data by default, not training data.

A proprietary provider's output may enter training only after the exact applicable terms or contract explicitly permit the intended use.

### Tier 4 — Future Smart-BethG model

A future first-party model should be trained only from datasets whose provenance and training permissions are established. The training pipeline must preserve lineage from source asset to derived dataset and model version.

## Provider-specific engineering position

This is a snapshot for engineering decisions and must be re-verified before a commercial training run.

### Google Veo / Google Cloud

Google Cloud terms state that Customer Data is not used to train or fine-tune AI models without the customer's prior permission or instruction, and generated output is treated as Customer Data. However, the terms also restrict using AI-service output to create or improve models similar to Google Models, subject to stated exceptions.

Engineering classification: production-generation provider. Do not use Veo output as training data for an independent Smart-BethG video model without confirming that the exact product, contract, and proposed training use are permitted.

### Kling

Kling's published user policy includes restrictions against using its Services or Output to create, test, improve, train, or otherwise develop AI/ML models.

Engineering classification: generation-only for model-training purposes.

### HunyuanVideo

The HunyuanVideo Community License permits specified Model Derivatives, but also restricts using Hunyuan or its Output to improve another AI model outside the permitted Hunyuan/Model Derivative pathway.

Engineering classification: potentially useful for Hunyuan-derived model development, subject to the exact license and distribution/commercial conditions. Do not treat it as permission to train an unrelated Smart-BethG foundation model.

### LTX-2.5

LTX-2.5 is distributed under a community license with commercial-use conditions and provisions for derivatives, but its terms restrict using output to train, improve, fine-tune, or create another ML/AI/competing model except as permitted for LTX derivatives.

Engineering classification: strong candidate for a controlled local/open-weight model path and permitted LTX-family derivative work, but not a blanket source of training data for an unrelated model.

### Wan

Wan releases must be evaluated against the exact repository/model version and license before use. Apache-licensed components/models may offer a more permissive path, but the exact model license and any separate asset/data restrictions must be recorded before training or redistribution.

Engineering classification: candidate open-model provider; license verification required per model version.

### Seedance

Treat Seedance as a proprietary production provider unless the exact official API/product agreement explicitly permits the intended model-training use. Do not rely on third-party websites or summaries as evidence of training rights.

Engineering classification: generation-only until the official contractual terms confirm otherwise.

## Model adapter contract

The application must not hard-code proprietary models into film logic.

Conceptually:

VideoGenerationProvider
- getCapabilities()
- validateRequest()
- submit()
- getStatus()
- cancel()
- fetchOutput()
- normalizeResult()

The agent sends a normalized VideoGenerationRequest. Each provider adapter translates it to the provider's API or local runtime.

The normalized result must preserve provider/model identity and asset provenance.

## Model routing

The router may select among local, open-weight, and proprietary providers based on:

- required generation capability
- reference-image/video requirements
- duration and resolution
- continuity requirements
- cost
- latency
- availability
- user/provider credentials
- license/training policy
- project policy

A missing proprietary API key must not make the entire video agent unusable if an eligible fallback provider is available.

## Training-data gate

The training pipeline must perform a hard eligibility check before copying or ingesting an asset:

1. Resolve asset provenance.
2. Resolve exact provider/model/license.
3. Determine training_allowed.
4. Check intended training purpose against restrictions.
5. Reject unknown, restricted, or generation-only assets.
6. Record the accepted asset and its provenance in the dataset manifest.

No UI, API, or background job should bypass this gate.

## Strategic rule

Smart-BethG should not build its long-term model strategy around generating a large synthetic dataset from a proprietary provider and assuming that payment grants training rights.

The preferred strategy is:

Project-controlled data
→ permitted open/open-weight model or first-party training
→ controlled derivatives
→ future Smart-BethG model

while proprietary models remain optional high-quality production providers.

## Re-verification

Provider terms, model licenses, pricing, capabilities, and restrictions can change. Before a production training run, the project must re-check the official terms for the exact model/version/product being used and record the verification date.

Last research snapshot: 2026-10-05.
