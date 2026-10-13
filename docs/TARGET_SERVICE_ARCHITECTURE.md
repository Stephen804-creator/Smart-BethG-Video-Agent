# Target Service Architecture

Status: Target architecture; not a claim that all services are implemented.

## Decision

Smart BethG Video Agent is targeting independently deployable services, not a single deployable monolith. Service boundaries must be designed around ownership of data, independent scaling, and failure isolation. Kubernetes is a deployment target, not a substitute for good boundaries.

We should avoid both extremes: one large deployment that must scale and release as a unit, and a premature collection of tiny services that communicate through fragile chains. Start with the boundaries below and extract/deploy them independently as their contracts and operational needs become real.

## Target services

| Service | Owns | Can scale independently |
| --- | --- | --- |
| Web client | Browser experience and static assets | Yes |
| Identity and API edge | Authentication, session validation, API ingress, request limits | Yes |
| Production service | Film projects, story/world data, scenes, shots, takes, continuity, approvals | Yes |
| Orchestrator | Workflow state, task dependencies, routing decisions, retries, cancellation policy | Yes |
| Generation workers | Provider-specific image/video/audio inference tasks | Yes, by capability and GPU/resource class |
| Render workers | FFmpeg jobs, composition, media conversion, exports, quality checks | Yes, by CPU/memory/storage profile |
| Provider adapters | External model APIs and self-hosted inference endpoints | Independently deployable when operationally useful |
| PostgreSQL | Durable relational state and transactional coordination | Operated separately from application deployments |
| Object storage | Uploaded source media, generated media, thumbnails, exports | Independently scaled storage service |

These are logical boundaries. A service may initially share a repository and release pipeline with another service, but it must not rely on another process's memory or local filesystem as its durable interface.

## Communication and ownership rules

1. PostgreSQL is the canonical store for users, projects, workflow/job state, provider attempts, and media metadata. Do not treat local JSON files as a production source of truth.
2. Object storage holds binary media. Store stable object keys, checksums, size, MIME/type metadata, ownership, and lifecycle state in PostgreSQL. Local disk is scratch space only.
3. The orchestrator creates durable job records before dispatching work. Workers claim jobs through atomic database operations or a durable broker; a process-local queue is not the cross-replica coordination mechanism.
4. Every job has an explicit state machine, owner/project scope, attempt number, lease/heartbeat, cancellation state, idempotency key, timestamps, and structured failure details.
5. Worker operations must be idempotent or use a deduplication mechanism. A network timeout must not blindly trigger a second paid generation if the first provider request may already have succeeded.
6. Service-to-service calls use versioned contracts, timeouts, bounded retries, correlation IDs, and explicit error semantics. Avoid synchronous dependency chains for long-running generation/render work.
7. Credentials and provider keys remain server-side. Workers receive only the minimum credentials and permissions needed for their task.
8. Health checks distinguish liveness from readiness. Graceful shutdown stops new claims, finishes or releases active work safely, and does not mark incomplete jobs as successful.
9. No service may assume that a pod, container, or node will keep local files or memory between restarts.
10. Cross-service events are delivered at least once where applicable; consumers must tolerate duplicates. If event publication and a database transaction must remain consistent, use an outbox pattern or an equivalent durable mechanism.

## Kubernetes readiness requirements

Before deploying a service to Kubernetes, it should have:

- A dedicated container image and deployment configuration.
- Configuration supplied through environment/config maps and secrets supplied through a secret manager.
- Liveness, readiness, and startup probes appropriate to its behavior.
- CPU/memory requests and limits; GPU resource requests only for GPU workers.
- Graceful termination and a bounded shutdown period.
- Structured logs, metrics, traces, and correlation IDs.
- Timeouts, retry budgets, and concurrency limits.
- A service-specific least-privilege identity and network policy.
- Rolling-update and rollback behavior tested against the service's API/event contract.
- No dependency on local filesystem persistence.
- Automated unit, integration, contract, and relevant end-to-end tests.

Kubernetes manifests alone do not make the platform production-grade. Database migrations, object storage, secrets, monitoring, backups, restore tests, and provider failure behavior are part of readiness.

## Deployment shape

- Deploy the web client separately from backend services.
- Keep the identity/API edge and production-domain service independently releasable.
- Run orchestration separately from generation and render workers.
- Use worker pools keyed by capability/resource profile (for example, API inference, local GPU inference, and CPU-heavy FFmpeg rendering).
- Scale workers based on queue depth, age of oldest job, service time, and resource saturation, not CPU alone.
- Keep PostgreSQL and object storage outside ephemeral application containers, with backups and tested restoration.
- Use a durable broker only when job throughput, scheduling, fan-out, or decoupling requirements justify it. Do not introduce a broker merely to look cloud-native; PostgreSQL-backed claims can be an initial coordination layer if their concurrency and recovery guarantees are demonstrated.

## Migration plan

### Stage 1 — Correct durable contracts
- Finish PostgreSQL-backed job persistence and test persistence failures.
- Remove production dependence on JSON project state.
- Define stable job, provider-attempt, asset, and project contracts.
- Prove atomic claims, leases, crash recovery, cancellation, and idempotency.

### Stage 2 — Externalize media
- Move uploads, generated results, and exports to object storage.
- Make media references independent of the API container's filesystem.
- Add cleanup/lifecycle policies and integrity checks.

### Stage 3 — Split worker deployment
- Package generation and rendering workers as independent deployables.
- Route tasks by capabilities and resource requirements.
- Add bounded concurrency, autoscaling signals, and graceful shutdown.

### Stage 4 — Separate orchestration and domain APIs
- Establish versioned internal contracts and event semantics.
- Deploy production/project APIs and orchestration independently.
- Add service-level dashboards, traces, SLOs, and failure drills.

### Stage 5 — Kubernetes production rollout
- Add deployment/service/ingress, autoscaling, network policies, secrets, disruption budgets, and rollout/rollback configuration.
- Validate backup restore, node/pod failure, rolling deploys, provider outage, queue backlog, and object-storage outage before production launch.

## Release gates

Do not call the platform production-ready until we can demonstrate:

- Projects and jobs survive application restarts and a deployment rollout.
- Multiple worker replicas cannot execute the same non-idempotent job concurrently.
- A crashed worker's lease expires and work is recovered without silently losing state.
- A provider timeout does not cause uncontrolled duplicate paid generation.
- A failed render does not corrupt project state or strand temporary media indefinitely.
- Users cannot read or mutate another user's projects, assets, jobs, or exports.
- Generated media remains available when an API container is replaced.
- Database backup restoration and object-storage recovery have been tested.
- Each service can be rolled out or rolled back without requiring every other service to be redeployed.

This document defines the target and migration order. It does not certify that the current code has passed these release gates.
