# SRS/ADR conformance — 2026-10-08

**The handoff is a frontend implementation and integration proposal. It does not satisfy the complete Atlas product E2E acceptance yet.** No Java/Spring/Modulith backend, Temporal workflows, PostgreSQL schema/RLS, sandbox runtime or Test/Prod Compose files exist in the supplied source. No live backend was exercised.

The two supplied specifications are copied byte-for-byte under `specifications/`; `specifications/source-manifest.json` records their SHA-256 and sizes. This report supersedes the current status in checkpoints 12–14 while keeping their historical evidence. Current frontend verification is in [UI-UX-ACCEPTANCE.md](UI-UX-ACCEPTANCE.md); current deployment plan and acceptance obligations are in [DEPLOY-READINESS-20261009.md](DEPLOY-READINESS-20261009.md).

## Interpretation and unresolved conflicts

| ID | Source discrepancy | Handoff treatment / required resolution |
|---|---|---|
| C01 | SRS BR-SAND-01 / EX-AGENT-04 restores onto the current target commit; ADR-004 requires the exact snapshot base_commit first | Adopt ADR safe recovery design: exact base, restore patch/untracked files + structured state, then explicit safe rebase. Backend owners must resolve the SRS conflict before recovery can pass. Frontend only displays receipts. |
| C02 | SRS FR-7.3 / section9.2 mentions raw chain-of-thought; ADR-004 excludes hidden raw reasoning | Emit/render structured TASK/TOOL/CHECKPOINT/ARTIFACT progress and resume state. Raw reasoning fields are omitted. Update the business contract wording before claiming FR-7.3 fully accepted. |
| C03 | SRS FR-3.4 and BR-SPEC-05 use In-Sync <=0.3; config table says warning0.5 | Keep in-sync0.3 and block>0.7; 0.5 may be a separate alert threshold. Backend must define a distinct alert field and approve its schema; do not silently replace the Implemented boundary. |
| C04 | Scope/RTM/journeys mention terminal <200ms; detailed NFR-1.2 allows <=300ms at peak with batching | Preserve detailed batching50–100ms/max32KiB; separately measure normal latency and peak <=300ms. Confirm precedence; no local timing certifies production NFRs. |
| C05 | Config table lists subsets of layers per key; general12.2 says Project>Workspace>Org>System | Resolver follows general precedence and null inheritance. Backend validates which layers each key accepts; it must not allow forbidden overrides. |
| C06 | SRS §7 domain/entity enum spellings differ; Luong4 says DRAFT/APPROVED rather than PROPOSED/PLAN_APPROVED | Adapter must explicitly normalize backend enums to `DOMAIN_STATES`; do not infer approval from a label. Revision_Required is supported from governance rules. |
| C07 | SRS RTM references BR-GAP-05, which has no formal rule body | Treat as unresolved reference; map budget blocking to BR-DAG-02 and FR-1.3 provisionally. |

`atlas-ui/v1` and flattened presentation configuration names remain proposed DTOs. The ADR `/api/v1` layout is compatible with an explicit backend adapter, but no endpoint/mapping has been approved. Do not label these as an existing backend API. Entitlement/plan limits have their separate System→Plan→Org→Workspace→Project policy; they are not the four-layer operational resolver.

## Changes made in this continuation

- Added a shared secret policy at create/save/import/duplicate/export boundaries, including preserved fields, unsaved/recovery exports and legacy revision exports. Environment map keys named KEY/name/key/env/variable no longer evade reference checks. Explicit `{name, valueRef}` descriptors remain supported. Failed imports/saves produce no new draft or revision. This heuristic does not replace full diff/entropy scanning. Existing stored revisions are not rewritten or deleted.
- Added sensitive action metadata, password fields and input clearing on all send outcomes. Fingerprints continue to commit to the exact canonical payload, so distinct credentials produce distinct receipts. Inputs are excluded from the journal. Secret-operation response reasons/evidence are omitted, including status reconciliation after reload. Services must redact their own logs/traces/artifacts and mark secret fields; UI treatment is not server-side secret protection. Hashes of weak secret values may be guessable; do not describe a fingerprint as encryption.
- Fixed null configuration inheritance while retaining explicit zero/false and source revision.
- Enabled PR-triggered frontend CI with read permissions. Historical audit workflow now uploads evidence rather than committing/pushing it, and failures are not ignored. Neither workflow deploys. Backend Modulith/integration/RLS/Temporal/SAST/SBOM/image checks from ADR§38 are still absent and required.

## Requirement matrix

The machine-readable registry contains all 35 FR, 10 NFR, 40 formal BR, 27 exception flows, 19 ADR, 14 assumptions and 19 configuration entries. Every row has source provenance and a remaining acceptance obligation. Links to source/tests below mean **partial frontend coverage**, not a product-level PASS.

| Requirement | Owner / journey | Current client support | Source / client checks | Required backend or live evidence |
|---|---|---|---|---|
| FR-1.1 | M1 / J0 | Scope bar, cross-scope response rejection; session-keyed query cache | src/data/service.ts; src/data/service-query.ts; e2e/scope-presence.spec.ts | OAuth onboarding and org/workspace/project ownership plus PostgreSQL RLS, object/vector tenant isolation |
| FR-1.2 | M1 / J0 | Grant/entitlement/quota gates; membership UI | src/data/app-store.ts; src/data/permissions.test.ts; src/views/modules/ArchivePanels.tsx | Union custom roles; immutable six templates; last-admin guard; server authorization on each API and stream |
| FR-1.3 | M1 / J0,J4 | BYOK definitions, masked service inputs and budget presentation | src/lib/secret-policy.ts; src/data/service.ts; src/views/modules/SrsDetails.tsx | Encrypted key pool, priority/weight failover 429/5xx, usage ledger, three budget ceilings, 80% warning and safe 100% block |
| FR-1.4 | M1 / J0,J4 | Resource definitions and exact revision/hash pins | src/generated/schemas.json; src/views/definitions/PinPicker.tsx | Six workspace registries plus agent templates; pinned immutable server revisions and authorized compose/extract |
| FR-1.5 | M1 / J4,J7 | Memory authoring, local pins and curation UI | src/views/modules/ArchivePanels.tsx; src/lib/definitions.ts | Working/structural/episodic/semantic engines; verified preseed retrieval; context budgets and tenant-safe memory |
| FR-1.6 | M1 / J0 | Invitation definition and observed policy display | src/views/modules/SrsDetails.tsx; src/generated/schemas.json | 72h invitation TTL, OAuth identity match, consume-once token, expired/revoked rejection, default Viewer |
| FR-2.1 | M2 / J1 | Observed specs and local document authoring | src/views/specs/SpecificationsPage.tsx; src/lib/documents.ts | Verified idempotent GitHub App webhook ingestion, Markdown parse and persisted SpecDocument |
| FR-2.2 | M2 / J2 | Branch/document scoped Yjs rooms | src/data/collaboration.ts; e2e/realtime.spec.ts | Persistent branches, same-branch convergence, cross-branch three-way merge; freeze enforced by server |
| FR-2.3 | M2 / J1,J2 | Conflict states and service actions displayed | src/data/states.ts; src/components/NativeStatePanels.tsx | Real conflict computation <=3s; record input revision and detection timestamps |
| FR-2.4 | M2 / J1,J2 | Human merge UI and revision-aware command transport | src/views/specs/SpecificationsPage.tsx; src/data/service.ts | Base/A/B conflict regions, Keep A/B/custom resolution, version_id CAS and FCFS loser reload |
| FR-2.5 | M2 / J1,J4 | Lock/submit remain distinct actions; all effects require readback | src/data/states.ts; src/views/modules/SrsDetails.tsx; src/data/service.ts | LOCKED precondition, explicit Submit, event publication; Unlock pauses previous DAG and is audited |
| FR-2.6 | M2/M3 / J6 | Implemented state is observed, never inferred from an acknowledgement | src/data/states.ts; src/views/modules/SrsDetails.tsx | Merged webhook, incremental AST/vector rescan; D<=0.3 Implemented, otherwise Submitted_To_AI + warning |
| FR-3.1 | M3 / J3 | Code explorer/editor and evidence views | src/views/code/CodePage.tsx | Tree-sitter multi-language scan <=15s/100K LOC; syntax warnings; batching and semantic adapters |
| FR-3.2 | M3 / J3 | Code graph presentation | src/views/code/CodePage.tsx | Authoritative symbols, caller/callee relations and cross-language resolution confidence |
| FR-3.3 | M3 / J3 | Evidence inspection, with provenance from service | src/views/code/CodePage.tsx | Spec-to-symbol evidence and calibrated confidence; no client-invented links |
| FR-3.4 | M3 / J3,J6 | Drift boundary helper; no local authority for production drift | src/data/configuration.ts; src/data/realtime.test.ts | Qdrant hybrid retrieval/text fallback; D=1-(0.4 sim+0.4 coverage+0.2 exp(-0.05 age)); server weights and >0.7 block |
| FR-4.1 | M4 / J0,J4 | React Flow/list workflow drafting and revision pins | src/views/workflow/WorkflowPage.tsx; src/lib/workflows.ts | Versioned active workflows, manual/meta proposal, Org fallback, human approval, coder+QA validation |
| FR-4.2 | M4 / J4 | Plan-first journey and service-provided DAG rendering | src/views/modules/SrsDetails.tsx; src/views/execution/model.ts | Memory preparation then PROPOSED plan; dependencies, task memory slices, human PLAN_APPROVED admission |
| FR-4.3 | M4 / J4 | Checkpoint controls require advertised action and grant | src/views/execution/ExecutionWorkspace.tsx; src/data/service.ts | WAITING_HUMAN_CHECKPOINT prevents lock/container before authorization; dependencies must complete |
| FR-4.4 | M4 / J4 | Retry/resume controls and snapshot inspection; Unknown never resends | src/views/execution/ExecutionWorkspace.tsx; src/data/service.ts | Temporal replay, safe structured snapshots in PG/S3, strict output contract and max 3 reflection retries, working-memory purge; resolve C01 |
| FR-4.5 | M4 / J7 | Draft/promote memory interaction via service | src/views/modules/ArchivePanels.tsx | Only retry, Medium/High, reject or veto generate episodic Draft; human promote, no trivial Low auto-memory |
| FR-5.1 | M5 / J4,J6 | Sandbox definition and readonly execution inspector | src/views/execution/ExecutionWorkspace.tsx; src/generated/schemas.json | gVisor/rootless isolation, no host Docker/privileged DinD, egress/package proxy, sidecars, resource caps and cleanup |
| FR-5.2 | M5 / J4 | Lock observation and grant-gated force-release transport | src/views/execution/ExecutionWorkspace.tsx; src/data/service.ts | Exclusive (repo_id,file_path), TTL1800/heartbeat30/wait60 configurable; audited force release and immediate cancel/reject release |
| FR-5.3 | M5/M7 / J4 | xterm readonly bounded byte queue and consumer ACK | src/data/terminal-batch.ts; src/views/live/LiveTerminal.tsx; src/data/realtime.test.ts; e2e/realtime.spec.ts | Real producer/gateway batching 50-100ms/max32KiB; peak <=300ms and 10-20FPS; backpressure under slow consumers |
| FR-6.1 | M6 / J5 | Six axes, veto and configured threshold presentation | src/views/modules/SrsDetails.tsx; src/data/configuration.ts | Server risk weights .25/.2/.2/.15/.1/.1; Low<.3, Medium<.7, High>=.7 or veto regardless score |
| FR-6.2 | M6 / J5 | Observed reviewer/signature eligibility; no local approval authority | src/views/modules/SrsDetails.tsx; src/data/service.ts | Distinct eligible principals, no author/committer/plan/checkpoint approver self-sign; missing role blocks; 12h/24h reminder never bypasses |
| FR-6.3 | M6 / J5 | Draft/import/export guards; masked inputs; sensitive response exclusion | src/lib/secret-policy.ts; src/lib/secret-policy.test.ts; src/data/service.test.ts; e2e/definitions.spec.ts; e2e/service.spec.ts | 100% generated diff regex+Shannon entropy scan BEFORE Gate/commit/PR, remediation and server log/trace/artifact redaction |
| FR-6.4 | M6 / J0-J7 | Device receipt journal only; explicitly not an audit ledger | src/lib/storage.ts; src/data/service.ts | PG append-only triggers, previous/current SHA256 hash chain and WORM object archive; tamper verification |
| FR-6.5 | M6 / J5,J6 | PR-triggered frontend CI; does not implement business auto-merge | ../../.github/workflows/atlas-web.yml; docs/DEPLOY-ACCEPTANCE.md | Exact PR SHA checks/status, Low merges only after Passed; Failed => Rejected/Revision_Required audit; conflicts stop for manual rebase |
| FR-7.1 | M7 / J1,J6 | No public webhook receiver in this frontend archive | docs/INTEGRATION.md | GitHub HMAC SHA256, delivery deduplication, internal event queue, five backoff retries/DLQ |
| FR-7.2 | M7 / J2,J4 | Scoped presence stream, expiry and transport guards | src/views/live/CollaborationWorkspace.tsx; src/data/stream.ts; e2e/realtime.spec.ts | Authenticated presence/cursor fanout, heartbeat expiry default60s, measured <200ms across peers |
| FR-7.3 | M7 / J4 | Structured thought tree only; raw reasoning omitted (C02) | src/views/live/useRunStream.ts; src/data/realtime.test.ts; e2e/realtime.spec.ts | Valid parent/root and render latency; producer must emit structured progress events, resolve SRS raw-CoT wording |
| FR-7.4 | M7 / J2,J5 | Monaco/Yjs bindings; server-owned initial text and readonly before sync | src/data/collaboration.ts; src/components/CodeEditor.tsx; e2e/realtime.spec.ts | Persisted CRDT snapshots/branch authorization; immutable review diff and comments; revoked/frozen writes fail server-side |
| FR-7.5 | M7 / J0-J7 | Scoped in-app notifications with service fields | src/views/live/CollaborationWorkspace.tsx; src/data/stream.ts | Persisted notifications, authorized mark-read/unread and realtime fanout; Slack/Discord outside MVP |
| FR-7.6 | M7/Observer / O1 | Independent entry/router/store; Observer cannot acquire Workspace authority | src/telemetry-console/main.tsx; telemetry-console.html; e2e/realtime.spec.ts; e2e/staging.spec.ts | Two HTTPS hosts and host-only cookies; OTel/Tempo/Prometheus/Loki/Pyroscope, trace/profile/flamegraph correlation, obs-gated dumps/exports |

## Nonfunctional acceptance

| Requirement | Current limitation | Required proof |
|---|---|---|
| NFR-1.1 | No AST engine in archive; local browser perf is unrelated | 100K LOC Tree-sitter <=15s; representative languages and syntax errors; server scan timing |
| NFR-1.2 | Client bounds tested; peer timings are local only, not production latency proof | CRDT/cursor <200ms; terminal NFR batching/<=300ms peak; clock basis/throughput/device/network recorded |
| NFR-1.3 | No backend conflict computation | Git push/save to conflict detection <=3s; measured producer-to-result timestamps |
| NFR-2.1 | No sandbox runtime in archive | Sandbox escape/egress/no host socket, unprivileged runtime and package allowlist assertions |
| NFR-2.2 | Client heuristics cover designated drafts only; no proof of arbitrary source secret absence | Full diff regex+entropy scan coverage and plaintext absence across logs/artifacts/telemetry |
| NFR-2.3 | Scope rejection tested; does not certify database isolation | Cross-org reads/writes incl IDs, caches, WS, PG RLS, vectors and object paths; tenant BYOK encryption |
| NFR-2.4 | Independent client entries present; live host/cookie perimeter unverified | Independent HTTPS hosts, bundle entry, router, auth cookies/storage; no Workspace routes or business POST from Observer |
| NFR-3.1 | Java modules absent | Spring Modulith verification: public API/events only, no private cross-module calls |
| NFR-3.2 | Database/backend absent | No direct cross-owned table JOIN/query; architecture/integration assertions |
| NFR-3.3 | atlas-ui/v1 is a frontend proposal; contract not approved | Serializable/versioned contracts and module boundaries fit later service extraction |

## Architecture obligations

Use Java25 LTS / Spring Boot4.1.x / Modulith2.1.x / Spring AI2.0.x per the supplied baseline, with versions revalidated when the backend is built. Seven business modules plus SaaS control plane communicate through public APIs/events, never private cross-module calls or direct cross-owned table queries. PostgreSQL is domain truth; Redis is ephemeral coordination/cache; Qdrant is retrieval; S3 stores durable artifacts; Temporal is durable execution, not domain truth. The small Node/TypeScript Yjs service only owns CRDT transport, with Java authorization, persistence and freeze authority.

Use gVisor/rootless isolation and internal egress/package proxies; no privileged DinD or host Docker socket. Use OTel/Tempo/Prometheus/Loki/Pyroscope and tenant-safe telemetry. MVP excludes core n8n orchestration, Kafka, Neo4j, Kubernetes and premature microservices. Billing provider remains behind a port and is not chosen by this frontend.

For all 51 SRS entities, server storage, ownership and migrations remain required. IndexedDB draft revisions and the receipt journal are device artifacts; they do not stand in for SpecDocument, AgentArtifactSnapshot or immutable AuditLedger.

## Additional SaaS and delivery sections of the ADR

| ADR sections | Client support / required implementation |
|---|---|
| 0–5, 25–26 | Frontend scope guards are present. Organization remains the strong tenant boundary; backend control/execution planes, seven modules plus SaaS control and ownership enforcement are absent. |
| 27–29 | Client checks advertised entitlements/limits separately from role grants. Subscription/plan lifecycle, billing adapter port, idempotent provider webhooks, usage metering, quota resolution System→Plan→Org→Workspace→Project and server enforcement still require implementation. No billing vendor was selected. |
| 30–34 | OAuth GitHub App, per-action RBAC/entitlement/quota, PG RLS, KMS/Vault envelope-encrypted BYOK, tenant-scoped gateway/worker access, memory/tool contracts, safe recovery and independent human approvals require backend security/recovery evidence. |
| 35–36 | REST commands and bounded scoped WS clients, Yjs transport and two independent SPA entries are implemented. Server stream authorization/persistence/freeze, independent live domains/cookies and full observability integrations remain unverified. |
| 37–39 | Local frontend CI/release checks are available. Test/Prod Compose, architecture/integration/RLS/Temporal replay, provider/MCP/webhook contracts, SAST/dependency/SBOM/image scans, authorized staging and manual production approval remain required. |
| 40–45 | MVP exclusions are retained. PhaseA–H backend/commercialization work is not replaced by UI views; public SaaS readiness requires isolation, recovery, budgets, governance, monitoring, backups, quotas and operational proof. Suggested backend repository/service structure and production topology are not present. |
| 46–47 | Durable truth and safety stay server-owned; volatile containers/Redis/UI do not certify durability. Supplied dependency version references are planning baselines, not independently verified current releases. |

## Acceptance disposition

The 2026-10-08 conformance checkpoint is retained in `ui-review/verification-conformance-20261008.json`. Final frontend source `06c4f25404b5b20a5e2bf6261936792f137ee740` passed the three-engine CI run linked in [UI-UX-ACCEPTANCE.md](UI-UX-ACCEPTANCE.md), including 1,725 functional checks and 174 review checks. That result establishes the documented frontend gates, not a full-system green run.

Live journeys J0–J7 and O1 are **NOT_RUN / BLOCKED** pending the backend source/API contract, GitHub App test installation, scoped test tenants, Test Compose fixtures and independent authenticated HTTPS origins. `LIVE-E2E-ACCEPTANCE.md` defines the exact positive and negative outcomes and proof to collect. Authorized source/evidence push has completed on `handoff/frontend-e2e`. Deployment remains subject to the UI review gate; no PR review comment, merge, deployment or staging write was performed.
