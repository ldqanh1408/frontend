# Atlas — Tech Stack & Architecture Decision Records (ADR)

**Document type:** Technology Stack + Architecture Decision Records  
**Target product:** Multi-User Collaborative AI Engineering & Specification Workspace  
**Product model:** B2B SaaS, with optional enterprise/self-host deployment later  
**Primary engineering language:** Java  
**Status:** Proposed baseline for MVP → Production  
**Date:** 2026-10-01

---

## 0. Executive Decision

Atlas should be built as a **Java-first B2B SaaS platform** using a **Modular Monolith** for the control plane and business domain, while isolating specialized runtimes where they provide a clear technical advantage.

The selected baseline is:

- **Java 25 LTS**
- **Spring Boot 4.1.x**
- **Spring Modulith 2.1.x**
- **Spring AI 2.0.x**
- **Temporal Java SDK 1.39.x**
- **PostgreSQL**
- **Redis**
- **Qdrant**
- **S3-compatible Object Storage (MinIO locally, cloud S3 in production)**
- **Tree-sitter Java bindings + language-specific semantic analyzers**
- **React + TypeScript + Vite**
- **Monaco Editor + Yjs + y-monaco**
- **React Flow**
- **xterm.js**
- **Node.js/TypeScript only for CRDT/Yjs collaboration runtime**
- **containerd/Docker + gVisor for MVP sandbox isolation**
- **Firecracker/Kata as a later hardened execution option**
- **OpenTelemetry + Prometheus + Grafana + Tempo + Loki + Pyroscope**
- **GitHub App**
- **GitHub Actions**
- **n8n only as an optional external integration/automation layer**
- **No Kafka, Neo4j, Kubernetes, or microservice split in MVP unless load evidence requires them**

Atlas remains **microservice-ready**, but does not pay microservice operational complexity before it is needed.

The product is designed as a **multi-tenant SaaS from day one**:

```text
SaaS Platform
└── Organization (Tenant / Billing Account)
    ├── Workspace
    │   ├── Project
    │   │   ├── Repository
    │   │   ├── Specifications
    │   │   ├── Agent Workflows
    │   │   ├── Task DAGs
    │   │   └── Sandboxes
    │   └── Memory Banks / Agent Catalog
    ├── Members / Roles
    ├── LLM Key Pool
    ├── Subscription / Entitlements
    └── Usage / Budget / Audit
```

---

# 1. Product Classification: Is Atlas a SaaS?

## Decision

**Yes. Atlas should be treated as a B2B SaaS product.**

It is not merely an AI agent application and it is not merely an internal developer tool.

The core SaaS tenant is:

```text
Organization
```

An Organization owns:

- members;
- workspaces;
- projects;
- repositories;
- RBAC;
- LLM credentials;
- budgets;
- workflow definitions;
- memory banks;
- sandbox policies;
- audit data;
- usage data;
- subscription entitlements.

The tenancy hierarchy is:

```text
Organization
    ↓
Workspace
    ↓
Project
    ↓
Repository / Specification / DAG / Agent Execution
```

This is already aligned with the product requirements.

---

# 2. SaaS Product Model

## 2.1 Tenant boundary

`Organization` is the strongest logical tenant boundary.

Every tenant-owned persistent entity must carry an immutable tenant reference:

```text
organization_id
```

Where appropriate:

```text
organization_id
workspace_id
project_id
```

All service-layer queries must resolve tenant context explicitly.

Example:

```java
public record TenantContext(
    UUID organizationId,
    UUID workspaceId,
    UUID projectId,
    UUID userId
) {}
```

A repository query should never be written as:

```java
repository.findById(projectId);
```

without tenant validation.

Preferred form:

```java
repository.findByOrganizationIdAndId(
    tenant.organizationId(),
    projectId
);
```

PostgreSQL RLS provides a second protection layer.

---

## 2.2 SaaS isolation model

### MVP / Team / Business

Use:

```text
Shared application
Shared PostgreSQL cluster
Shared Redis
Shared Qdrant cluster
Shared object storage
Logical tenant isolation
PostgreSQL RLS
organization_id partition keys / filters
```

This gives acceptable cost and operational simplicity.

### Enterprise later

Support optional stronger isolation:

```text
Shared Control Plane
       │
       ├── Tenant A → shared data plane
       ├── Tenant B → dedicated DB
       └── Tenant C → dedicated execution workers / VPC
```

Possible enterprise modes:

1. Shared DB + RLS.
2. Dedicated PostgreSQL database.
3. Dedicated vector collection/cluster.
4. Dedicated sandbox worker pool.
5. Customer VPC execution plane.
6. Fully self-hosted enterprise deployment.

Do not implement all six in MVP. Design the tenant routing abstraction so they can be added.

---

# 3. Control Plane vs Execution Plane

Atlas should distinguish business/control state from dangerous AI execution.

```text
┌─────────────────────────────────────────────────────────┐
│                     CONTROL PLANE                       │
│                                                         │
│ Spring Boot + Spring Modulith                           │
│ Auth / RBAC / Specs / Workflow / Governance / Billing  │
│ Memory metadata / GitHub integration / API             │
│                                                         │
│ PostgreSQL / Redis / Qdrant / Temporal                  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ signed execution contract
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    EXECUTION PLANE                      │
│                                                         │
│ Agent Workers                                           │
│ Git Worktrees                                           │
│ gVisor / Firecracker Sandbox                            │
│ Sidecars                                                │
│ Tests / Linters / Build tools                           │
│ Tool/MCP execution                                      │
└─────────────────────────────────────────────────────────┘
```

The execution plane must not receive unrestricted access to the control plane database.

It receives only scoped, short-lived execution credentials.

---

# 4. Final Technology Stack

## 4.1 Backend / Core Platform

| Concern | Selected technology | Decision |
|---|---|---|
| Language | Java 25 LTS | Selected |
| Backend framework | Spring Boot 4.1.x | Selected |
| Modular architecture | Spring Modulith 2.1.x | Selected |
| Security | Spring Security | Selected |
| API | REST + WebSocket; gRPC for internal/execution boundaries where useful | Selected |
| Validation | Jakarta Validation | Selected |
| ORM | Spring Data JPA / Hibernate | Selected |
| Complex SQL | jOOQ where queries justify it | Optional |
| Database migration | Flyway | Selected |
| AI abstraction | Spring AI 2.0.x | Selected |
| Durable workflows | Temporal Java SDK 1.39.x | Selected |
| Build | Maven | Selected |
| Testing | JUnit 5 + AssertJ + Testcontainers | Selected |
| API contract | OpenAPI 3.x | Selected |

### Version policy

Use stable production releases only.

As of 2026-10-01:

- Spring Boot stable: **4.1.1**
- Spring Modulith stable: **2.1.1**
- Spring AI stable: **2.0.1**
- Temporal Java SDK latest observed stable: **1.39.0**

Avoid preview/milestone framework versions in production.

---

# 5. Backend Module Layout

The backend remains a modular monolith.

```text
backend/
├── bootstrap/
│
├── mod-auth-workspace/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   └── interfaces/
│
├── mod-spec-resolver/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   └── interfaces/
│
├── mod-code-intelligence/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   └── interfaces/
│
├── mod-agent-orchestrator/
├── mod-sandbox-lock/
├── mod-governance/
└── mod-collaborative-gateway/
```

Rules:

1. No module imports another module's internal implementation.
2. Cross-module synchronous access goes through a public application interface.
3. Cross-module asynchronous access goes through domain/application events.
4. One module may not query another module's tables directly.
5. Contracts should allow extraction into a service later.

---

# 6. ADR-001 — Use Java 25 LTS as the Primary Backend Language

**Status:** Accepted

## Context

The system includes:

- complex state machines;
- enterprise RBAC;
- multi-tenancy;
- durable workflows;
- GitHub integrations;
- concurrency locks;
- WebSocket traffic;
- governance rules;
- agent execution;
- MCP/tool invocation;
- memory orchestration.

The primary developer skill is Java.

## Decision

Use **Java 25 LTS** for the main backend and Temporal workers.

## Rationale

- Strong type system.
- Mature concurrency/runtime.
- Excellent Spring ecosystem.
- Strong Temporal Java SDK.
- Spring AI supports modern AI abstractions.
- Java 25 fits current Spring Boot compatibility.
- Reduced cognitive/context switching for the primary developer/team.

## Consequences

Positive:

- one main backend language;
- easier refactoring;
- strong tooling;
- production maturity.

Negative:

- selected specialized components remain TypeScript/native.
- some AI examples/ecosystem code is still Python-first.

## Rejected alternative

**Python as main backend** — rejected because the product is more enterprise workflow/control-plane heavy than ML-research heavy.

---

# 7. ADR-002 — Modular Monolith Before Microservices

**Status:** Accepted

## Context

There are seven strongly defined business modules, but the MVP team should not absorb distributed-system overhead unnecessarily.

## Decision

Implement the backend as a **Spring Modulith modular monolith**.

## Why

Microservices on day one would add:

- network contracts;
- service discovery;
- distributed tracing complexity;
- distributed transactions;
- deployment overhead;
- message infrastructure;
- more CI pipelines;
- more failure modes.

Without providing enough MVP benefit.

## Extraction rule

A module may become a service only when at least one of these becomes true:

- materially different scaling characteristics;
- security/isolation requirement;
- independent release velocity;
- high CPU workload blocks primary backend;
- dedicated technology/runtime becomes necessary.

Likely first extraction candidates:

```text
code-intelligence
sandbox-execution
agent-worker
collaboration-server
```

---

# 8. ADR-003 — Temporal for Durable Agent and Task-DAG Execution

**Status:** Accepted

## Context

Agent tasks must survive:

- process crashes;
- worker restarts;
- LLM timeouts;
- 429/5xx;
- human approval waits;
- budget blocking;
- sandbox failure;
- long execution periods.

## Decision

Use **Temporal** as the durable workflow engine.

Temporal stores orchestration progress.

Atlas stores domain state and execution artifacts.

```text
Temporal
= where is the workflow?

Atlas Artifact Snapshot
= what has the agent produced?
```

These are complementary.

## Generic workflow interpreter

Do not generate Java workflow code for every user-created DAG.

Use one generic Temporal workflow:

```text
ProjectAgentWorkflow JSON
          ↓
Temporal DAG Interpreter
          ↓
Node executor
```

Node types:

```text
AGENT
TOOL
MCP
SANDBOX
TEST
CONDITION
PARALLEL
HUMAN_GATE
GOVERNANCE_GATE
MEMORY_PREP
```

## Retry classes

Retry automatically:

- network timeout;
- worker failure;
- transient model failure;
- idempotent tool failure;
- sandbox infrastructure failure.

Do not automatically retry:

- security veto;
- budget exhaustion;
- explicit human rejection;
- cancellation;
- invalid permissions;
- repeated deterministic business failure.

---

# 9. ADR-004 — Durable Agent Snapshot and Resume

**Status:** Accepted

## Decision

Every meaningful execution boundary may generate an `AgentArtifactSnapshot`.

Snapshot storage is independent of sandbox lifetime.

## Snapshot structure

Metadata in PostgreSQL:

```text
snapshot_id
execution_id
subtask_id
sequence
status
base_commit
workflow_version
agent_definition_version
memory_package_id
next_action
created_at
```

Large artifacts in object storage:

```text
git.patch
untracked-files.tar.zst
terminal.log
test-results.json
coverage
generated artifacts
resume-state.json
```

## Important rule

Do **not** depend on raw hidden chain-of-thought as a resume mechanism.

Persist structured state:

```text
goal
completed work
important findings
decisions
modified files
tool outputs
unresolved issues
next action
```

## Resume flow

```text
Worker dies
   ↓
Temporal retries
   ↓
load latest safe snapshot
   ↓
create new sandbox
   ↓
checkout snapshot base commit
   ↓
restore files + git patch
   ↓
restore structured AgentResumeState
   ↓
continue execution
```

Use the exact snapshot `base_commit` by default.

Do not blindly apply an old patch to the newest branch head.

Rebase/merge against the latest target branch only after recovered work reaches a safe state.

---

# 10. ADR-005 — Spring AI for Agent Runtime

**Status:** Accepted

## Decision

Use **Spring AI 2.0.x** as the main Java AI integration layer.

Responsibilities:

- model abstraction;
- ChatClient;
- structured output;
- tool calling;
- MCP clients;
- vector-store integration;
- RAG;
- advisors/interceptors;
- telemetry integration.

Atlas should still own its agent domain model.

```text
Atlas Agent Definition
        ↓
Runtime Compiler
        ↓
Spring AI
        ↓
Model / Tool / MCP
```

Do not expose framework-specific concepts directly in the domain model.

Example:

```java
public record AgentDefinition(
    UUID id,
    String version,
    ModelPolicy model,
    String instructions,
    List<SkillRef> skills,
    List<ToolRef> tools,
    List<McpRef> mcpServers,
    List<RuleRef> rules,
    MemoryPolicy memoryPolicy,
    OutputContract outputContract
) {}
```

This avoids locking the product model to Spring AI or another agent framework.

---

# 11. ADR-006 — Atlas Owns Memory, Not n8n or the LLM Provider

**Status:** Accepted

## Decision

Memory is a first-class Atlas domain.

Memory types:

```text
Working Memory
Structural Graph Memory
Episodic Memory
Semantic Memory
```

Storage:

| Memory | Primary storage |
|---|---|
| Working | Redis |
| Structural | PostgreSQL graph tables + AST index |
| Episodic | PostgreSQL + Qdrant embeddings |
| Semantic | PostgreSQL documents + Qdrant |
| Large memory source artifacts | S3/MinIO |

## Retrieval flow

```text
Task
 ↓
Memory Resolver
 ├── PostgreSQL full text / metadata
 ├── Qdrant vector search
 ├── AST structural search
 └── policy filters
 ↓
rank / deduplicate / token-budget
 ↓
TaskMemoryPackage
 ↓
Agent
```

The memory package is explicitly injectable and reviewable.

---

# 12. ADR-007 — PostgreSQL Is the System of Record

**Status:** Accepted

## Use PostgreSQL for

- organizations;
- workspaces;
- projects;
- users and membership;
- RBAC;
- specs/version metadata;
- workflow definitions;
- DAG state;
- agent definitions;
- agent executions;
- governance;
- audit ledger;
- billing/usage metadata;
- memory metadata;
- AST symbol metadata;
- configuration;
- GitHub installation data.

## Multi-tenancy

Use:

- `organization_id`;
- indexes beginning with tenant key where practical;
- PostgreSQL RLS on tenant-sensitive tables;
- application-level tenant context;
- integration tests that explicitly attempt cross-tenant access.

## Do not

- create one schema per customer in MVP;
- create one database per customer in MVP;
- depend only on ORM filters for tenant security.

---

# 13. ADR-008 — Redis for Ephemeral Coordination, Not Durable Truth

**Status:** Accepted

Use Redis for:

- short-term working memory;
- lock heartbeats;
- presence;
- WebSocket fan-out hints;
- hot cache;
- temporary execution context;
- rate-limit counters.

Durable state must not exist only in Redis.

Redis loss must not lose:

- approved specifications;
- workflow definitions;
- execution snapshots;
- audit ledger;
- subscription state;
- verified memory.

---

# 14. ADR-009 — Qdrant for Vector Retrieval

**Status:** Accepted

Use Qdrant for:

```text
code embeddings
spec embeddings
semantic memory embeddings
episodic memory embeddings
```

PostgreSQL remains source-of-truth for metadata/content references.

A vector record should reference:

```text
organization_id
workspace_id
project_id
document_id / memory_id / symbol_id
version
visibility
```

Never perform vector search without tenant filtering.

Fallback:

```text
Qdrant unavailable
    ↓
PostgreSQL FTS / AST text search
```

---

# 15. ADR-010 — Tree-sitter as Universal Syntax Layer, Not the Entire Semantic Engine

**Status:** Accepted

## Decision

Use Tree-sitter Java bindings for multi-language syntax parsing.

Supported language target:

```text
Java
TypeScript / JavaScript
Python
Go
Rust
C++
```

Tree-sitter handles:

- AST;
- syntax ranges;
- classes/functions/method declarations;
- imports;
- lexical symbols;
- incremental parsing.

But Tree-sitter alone is not enough for fully accurate type-aware call graphs.

Therefore:

```text
                 Code Intelligence
                       │
                  Tree-sitter
                       │
                 Syntax Graph
                       │
     ┌─────────────────┼─────────────────┐
     ▼                 ▼                 ▼
   Java                TS              Python
JDT/JavaParser       TS Server         Pyright
     │                 │                 │
     └─────────────────┼─────────────────┘
                       ▼
                 Semantic Graph
```

Implement semantic adapters incrementally.

For MVP, prioritize the languages actually needed by target users.

---

# 16. ADR-011 — React/Vite for an IDE-Like Frontend

**Status:** Accepted

## Decision

Use:

```text
React
TypeScript
Vite
Monaco Editor
React Flow
TanStack Query
Zustand
xterm.js
```

## Why not Next.js as the core workspace?

Atlas is primarily an authenticated IDE-like SPA, not an SEO/content site.

Main screens are:

- specification editor;
- repository browser;
- code intelligence;
- DAG builder;
- agent execution viewer;
- terminal;
- diff/merge;
- memory management;
- governance;
- observability.

Server-side rendering adds limited value to these authenticated surfaces.

A separate marketing site may use Next.js or another framework later.

---

# 17. ADR-012 — Yjs for Collaborative Specification Editing

**Status:** Accepted

Use:

```text
Monaco
 ↓
y-monaco
 ↓
Yjs
 ↓
Yjs WebSocket collaboration server
```

Use a small **Node.js/TypeScript collaboration service** for CRDT runtime.

Do not reimplement the Yjs protocol in Java.

Java remains authoritative for:

- auth;
- authorization;
- branch state;
- spec state;
- locks;
- approval;
- durable document versions;
- audit.

The collaboration service owns only live CRDT/session concerns.

---

# 18. ADR-013 — S3-Compatible Object Storage for Agent Artifacts

**Status:** Accepted

Use:

- **MinIO** in local/test environments;
- cloud-native **S3-compatible storage** in SaaS production.

Artifacts include:

```text
agent snapshots
git patches
terminal logs
test output
coverage reports
sandbox exports
large audit evidence
profiling dumps
uploaded memory documents
```

Database stores references and hashes, not large binary payloads.

Every object key must contain tenant-safe identity or be resolved through a tenant-safe metadata lookup.

Example:

```text
org/{orgId}/project/{projectId}/execution/{executionId}/snapshot/{sequence}/git.patch
```

Never trust object-path tenant IDs provided directly by clients.

---

# 19. ADR-014 — Hardened Sandbox Through gVisor First

**Status:** Accepted

## MVP

```text
containerd / Docker
      ↓
gVisor runsc
      ↓
ephemeral agent sandbox
```

Use:

- isolated Git worktree;
- CPU quota;
- memory quota;
- disk quota;
- execution timeout;
- no host Docker socket;
- blocked external egress by default;
- allowlisted internal package proxy;
- short-lived scoped credentials.

## Later

Evaluate:

- Firecracker;
- Kata Containers;
- dedicated node pools.

Firecracker is appropriate when stronger isolation and higher-scale ephemeral execution justify the infrastructure complexity.

---

# 20. ADR-015 — OpenTelemetry-Centered Observability

**Status:** Accepted

Stack:

```text
OpenTelemetry SDK / Collector
        │
        ├── traces → Tempo
        ├── metrics → Prometheus
        ├── logs → Loki
        └── profiles → Pyroscope
                         │
                      Grafana
```

Track SaaS and AI-specific telemetry:

```text
request latency
WebSocket connections
workflow latency
Temporal failures
agent execution time
LLM provider latency
token usage
LLM cost
tool call latency
sandbox startup time
sandbox crashes
snapshot size
memory retrieval latency
vector search latency
AST scan latency
tenant usage
```

High-cardinality identifiers must be controlled carefully.

Do not turn raw customer prompts/source code into default telemetry labels.

---

# 21. ADR-016 — n8n Is an Integration Layer, Not Core Orchestration

**Status:** Accepted

n8n may later automate:

```text
PR created
 ↓
update Jira
 ↓
notify Slack
 ↓
update Notion
 ↓
send email
```

Do not use n8n as source-of-truth for:

- `TaskDAG`;
- `AgentExecutionState`;
- sandbox lifecycle;
- governance;
- human milestone gate;
- billing;
- durable retry;
- security policy.

Core:

```text
Java / Temporal
```

External automation:

```text
n8n
```

n8n is optional for MVP.

---

# 22. ADR-017 — No Kafka in MVP

**Status:** Accepted

Use initially:

```text
Spring Modulith application events
+
transactional event publication/outbox where needed
+
Temporal for durable process orchestration
```

Kafka becomes justified when:

- independent services require event replay;
- throughput becomes materially high;
- multiple independent consumers need durable streams;
- service extraction occurs;
- cross-region/event-driven integration becomes necessary.

Do not add Kafka only because the architecture is "event driven."

---

# 23. ADR-018 — No Neo4j in MVP

**Status:** Accepted

Represent AST graph relationships first using PostgreSQL:

```text
ast_symbol
symbol_reference
call_edge
inheritance_edge
module_dependency
```

Use recursive queries/materialized paths/cache where necessary.

Evaluate Neo4j or another graph database only if real query complexity/performance shows PostgreSQL is insufficient.

---

# 24. ADR-019 — No Kubernetes for the First Production Release

**Status:** Accepted with migration path

## MVP / early production

Use:

```text
Docker Compose for dev/test
Managed PostgreSQL
Managed Redis
Qdrant
S3
Temporal Cloud or self-host Temporal
Containerized app
Dedicated sandbox worker hosts
Reverse proxy / load balancer
```

Kubernetes becomes valuable when:

- multiple app replicas;
- many sandbox worker pools;
- autoscaling requirements;
- multiple regions;
- dedicated enterprise execution pools;
- operational team capacity exists.

Avoid making Kubernetes a prerequisite for product validation.

---

# 25. SaaS Architecture

```text
                               Internet
                                   │
                        CDN / WAF / Load Balancer
                                   │
                 ┌─────────────────┴──────────────────┐
                 ▼                                    ▼
          app.atlas.dev                        observer.atlas.dev
                 │                                    │
            Workspace SPA                       Telemetry SPA
                 │                                    │
                 └─────────────────┬──────────────────┘
                                   ▼
                         Spring Boot Control Plane
                                   │
      ┌──────────────┬─────────────┼──────────────┬──────────────┐
      ▼              ▼             ▼              ▼              ▼
 PostgreSQL        Redis        Temporal        Qdrant           S3
      │                            │
      │                            ▼
      │                      Worker Fleet
      │                            │
      │                    ┌───────┴────────┐
      │                    ▼                ▼
      │                Agent Worker     AST Worker
      │                    │
      │                    ▼
      │              Sandbox Manager
      │                    │
      │                    ▼
      │              gVisor Sandbox
      │                    │
      │              Git Worktree
      │
      └────────── Tenant / Governance / Usage State
```

---

# 26. SaaS Control Plane

Add a dedicated SaaS domain/module:

```text
mod-saas-control/
```

Responsibilities:

```text
Organization lifecycle
Subscription
Plan
Entitlements
Seat limits
Usage meter
Quota
Trial
Billing status
Tenant suspension
Feature flags
Enterprise tenancy mode
```

Do not couple business modules directly to Stripe/Paddle/etc.

Domain:

```java
interface EntitlementService {
    boolean isEnabled(UUID organizationId, Feature feature);
}

interface UsageMeter {
    void record(UsageEvent event);
}

interface BillingProvider {
    CheckoutSession createCheckout(...);
    void handleWebhook(...);
}
```

This lets commercial provider choice change independently.

---

# 27. SaaS Billing Model

Because the SRS supports BYOK, billing Atlas only by LLM tokens would be wrong.

Recommended future pricing dimensions:

```text
Base subscription
+
Seats
+
Concurrent agent executions
+
Sandbox compute minutes
+
Storage
+
Optional Atlas-managed LLM usage
+
Enterprise isolation/support
```

Example metering:

```text
LLMUsageLedger
SandboxUsageLedger
StorageUsageLedger
AgentExecutionUsage
SeatSnapshot
```

A `UsageEvent` might be:

```json
{
  "organizationId": "...",
  "projectId": "...",
  "type": "SANDBOX_COMPUTE",
  "quantity": 142,
  "unit": "CPU_SECOND",
  "occurredAt": "..."
}
```

## Billing provider ADR

**Status:** Deferred intentionally.

Do not hard-wire the platform to a billing vendor before the company's legal entity, target market, tax model and merchant-of-record strategy are known.

Implement a `BillingProvider` port.

Possible adapters:

- Stripe Billing;
- Paddle;
- enterprise manual invoicing.

This is a commercial/legal deployment decision rather than an architectural reason to rewrite the core.

---

# 28. SaaS Entitlements vs RBAC

RBAC answers:

> Is this user allowed to perform this action?

Entitlements answer:

> Has this Organization purchased/enabled this product capability?

Both checks are required.

Example:

```text
User has permission:
    agent_workflow:create = true

But organization plan:
    custom_agent_workflows = false

→ deny with upgrade/entitlement response
```

Do not encode pricing plan into role names.

Correct:

```text
RBAC
+
Entitlements
+
Resource limits
```

---

# 29. SaaS Resource Limits

Every tenant-controlled resource needs a quota.

Examples:

```text
max_members
max_projects
max_repositories
max_concurrent_agents
max_sandboxes
max_sandbox_cpu
max_sandbox_memory
max_agent_runtime_minutes
max_memory_storage_gb
max_artifact_storage_gb
max_vector_count
max_websocket_connections
max_api_requests_per_minute
```

Resolution:

```text
System default
   ↓
Plan
   ↓
Organization override
   ↓
Workspace override
   ↓
Project override
```

Existing dynamic configuration should stay separate where configuration is not a commercial entitlement.

---

# 30. Tenant Security

Minimum SaaS security controls:

## Authentication

- GitHub OAuth/GitHub App for initial product model.
- Support OIDC/SAML SSO later for enterprise.
- short-lived application sessions;
- refresh/session rotation;
- CSRF protection where cookie auth is used.

## Authorization

Every action evaluates:

```text
authenticated user
tenant membership
project scope
RBAC permission
plan entitlement
resource quota
governance policy
```

## Database

- PostgreSQL RLS.
- explicit tenant filters.
- tenant-context integration tests.
- no cross-module raw table access.

## Secrets

Store:

```text
GitHub App secrets
LLM BYOK keys
MCP credentials
integration secrets
```

using KMS/Vault/envelope encryption.

Do not store usable plaintext keys in PostgreSQL.

## Sandbox

AI execution is treated as untrusted code.

---

# 31. BYOK LLM Gateway

The SRS already expects organization-level key pools.

Architecture:

```text
Agent
 ↓
Atlas LLM Gateway
 ↓
Budget / entitlement
 ↓
Routing policy
 ↓
Provider resolver
 ├── OpenAI
 ├── Anthropic
 ├── Google
 ├── DeepSeek
 ├── Azure OpenAI
 └── self-hosted vLLM
```

Key:

```text
encrypted_data_key
encrypted_secret
provider
priority
weight
status
monthly_limit
```

Do not let workers decrypt arbitrary organization credentials.

Use a scoped gateway request.

---

# 32. Code Intelligence Service Design

MVP stays inside the Java modular backend/worker.

Pipeline:

```text
Repository
 ↓
Incremental file detector
 ↓
Tree-sitter parse
 ↓
AST Symbol extraction
 ↓
language semantic adapter
 ↓
Symbol graph
 ↓
chunking
 ↓
embedding
 ↓
Qdrant
 ↓
Code Evidence
```

Long-running scans execute as worker tasks rather than HTTP request threads.

---

# 33. Agent Runtime

Conceptual execution:

```text
SubTask
 ↓
AgentDefinition
 ↓
Resolve:
  model
  tools
  skills
  rules
  MCP
  memory policy
  output contract
 ↓
prepare TaskMemoryPackage
 ↓
Temporal Agent Activity
 ↓
Agent loop
 ├── model
 ├── tool
 ├── sandbox
 ├── MCP
 └── checkpoint
 ↓
structured output validation
 ↓
snapshot
 ↓
next DAG node
```

Agent definitions are versioned and immutable for active executions.

If the user changes an Agent Definition:

```text
AgentDefinition v7 → new executions
AgentDefinition v6 → existing execution continues pinned
```

unless an explicit migration/restart occurs.

---

# 34. Human-in-the-Loop

Use Temporal Signals/Updates for durable approval.

```text
Workflow
 ↓
WAITING_HUMAN_CHECKPOINT
 ↓
Temporal waits
 ↓
user approves
 ↓
Signal
 ↓
Workflow continues
```

No polling loop is required.

Persist the approval in Atlas domain storage and write immutable audit records.

Temporal state must not be the sole audit record.

---

# 35. Realtime Architecture

Use two paths.

## Business commands

```text
REST
```

Examples:

```text
create project
lock spec
approve plan
retry subtask
approve gate
```

## Live streams

```text
WebSocket
```

Examples:

```text
presence
CRDT
terminal output
agent status events
notifications
DAG progress
```

For high-volume terminal output:

```text
pty
 ↓
window/batch
 ↓
stream
 ↓
WebSocket
 ↓
xterm.js
```

Do not persist every terminal character synchronously to the primary DB.

Batch/compress durable logs to object storage.

---

# 36. Frontend Applications

Use two separately built SPAs.

```text
frontend/
├── workspace-web/
└── telemetry-console/
```

The workspace SPA includes:

```text
Specification IDE
Code Intelligence
Repository Browser
3-way Merge
DAG / Workflow Builder
Agent Fleet
Memory Hub
Governance
Audit views
Settings
```

Telemetry console:

```text
traces
metrics
logs
profiles
sandbox health
agent performance
system saturation
```

Do not share browser session/cookie scope between security perimeters.

---

# 37. Deployment Strategy

## Local development

```text
docker-compose.dev.yml
```

Services:

```text
postgres
redis
qdrant
minio
temporal
backend
yjs-collab
frontend
otel-collector
prometheus
grafana
```

Sandbox runtime can be simplified locally.

---

## Automated test

```text
docker-compose.test.yml
```

Use:

- seed scenarios;
- mock GitHub;
- mock LLM provider;
- Testcontainers for Java integration tests;
- tenant isolation tests;
- crash/resume tests;
- Temporal workflow replay tests.

---

## First SaaS production

Recommended topology:

```text
Managed PostgreSQL
Managed Redis
Object Storage
Qdrant Cloud or managed/self-operated cluster
Temporal Cloud or production Temporal cluster
2+ Control Plane replicas
N Agent Workers
Dedicated sandbox hosts
OTel collector
Managed load balancer
WAF/CDN
```

Do not run dangerous sandbox workloads on the same host/process security boundary as the main production database/control plane.

---

# 38. CI/CD

GitHub Actions stages:

```text
PR
 ↓
format / compile
 ↓
unit tests
 ↓
Spring Modulith architecture verification
 ↓
integration tests
 ↓
tenant isolation tests
 ↓
Temporal workflow replay tests
 ↓
SAST / dependency scan
 ↓
container build
 ↓
SBOM
 ↓
image vulnerability scan
 ↓
deploy staging
 ↓
E2E
 ↓
manual production approval
 ↓
production
```

Use immutable image tags:

```text
atlas-backend:<git-sha>
```

Do not deploy `latest`.

---

# 39. Test Strategy

Required layers:

## Unit

- domain rules;
- state transitions;
- risk scoring;
- entitlement;
- budget policies.

## Module tests

Use Spring Modulith module testing.

## Integration

Testcontainers:

```text
PostgreSQL
Redis
Qdrant
Temporal
```

## Contract

- GitHub webhook contracts;
- MCP contracts;
- LLM provider adapters;
- sandbox execution contracts.

## Security

Mandatory:

```text
cross-tenant access tests
RLS tests
RBAC tests
entitlement tests
secret redaction tests
sandbox escape hardening tests
```

## Failure recovery

Test explicitly:

```text
kill worker mid-agent
restart backend
timeout LLM
delete sandbox
expire lock
pause workflow
resume workflow
restore snapshot
```

Zero-loss recovery is a product capability and must have automated tests.

---

# 40. What Not to Build Yet

Do not introduce the following until justified:

```text
Kafka
Neo4j
Kubernetes
service mesh
multi-region active-active
custom vector database
custom workflow engine
custom CRDT implementation
full microservice decomposition
custom billing engine
```

These systems may become appropriate later, but premature adoption will slow MVP delivery.

---

# 41. Roadmap

## Phase A — Architecture Foundation

```text
Java 25
Spring Boot
Spring Modulith
PostgreSQL
Redis
GitHub App
Auth/RBAC
Org/Workspace/Project
```

## Phase B — Spec + Collaboration

```text
React/Vite
Monaco
Yjs
Spec branching
3-way merge
locking
```

## Phase C — Code Intelligence

```text
Tree-sitter
AST symbols
call/reference graph
Qdrant
Code Evidence
```

## Phase D — Agent Runtime

```text
Spring AI
AgentDefinition
Tools/MCP
Memory Resolver
Temporal
Task DAG
```

## Phase E — Safe Execution

```text
Git worktree
gVisor
sidecars
concurrency locking
terminal streaming
snapshot/resume
```

## Phase F — Governance

```text
risk engine
secret scanning
human gate
multi-signature
audit ledger
```

## Phase G — SaaS Commercialization

```text
Plan
Entitlements
Usage Meter
Quota
Subscription
BillingProvider adapter
trial/onboarding
tenant admin
support tooling
```

## Phase H — Scale

Only after metrics justify:

```text
service extraction
Kafka
Kubernetes
dedicated enterprise execution plane
Firecracker
graph database
multi-region
```

---

# 42. Suggested Repository Structure

```text
atlas/
│
├── backend/
│   ├── pom.xml
│   ├── bootstrap/
│   ├── mod-auth-workspace/
│   ├── mod-saas-control/
│   ├── mod-spec-resolver/
│   ├── mod-code-intelligence/
│   ├── mod-agent-orchestrator/
│   ├── mod-sandbox-lock/
│   ├── mod-governance/
│   └── mod-collaborative-gateway/
│
├── frontend/
│   ├── workspace-web/
│   └── telemetry-console/
│
├── collaboration/
│   └── yjs-server/
│
├── workers/
│   ├── temporal-worker/
│   ├── code-intelligence-worker/
│   └── sandbox-worker/
│
├── sandbox/
│   ├── templates/
│   ├── sidecars/
│   └── policies/
│
├── infra/
│   ├── docker/
│   ├── envoy/
│   ├── otel/
│   ├── grafana/
│   └── terraform/
│
├── contracts/
│   ├── openapi/
│   ├── events/
│   └── mcp/
│
└── docs/
    ├── architecture/
    └── adr/
```

This can still be one repository.

A monorepo does not imply a monolith at runtime.

---

# 43. Target Production Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  USERS                                      │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                               CDN / WAF
                                     │
                         ┌───────────┴───────────┐
                         │                       │
                  app.atlas.dev          observer.atlas.dev
                         │                       │
                 Workspace React SPA      Telemetry React SPA
                         │                       │
                         └───────────┬───────────┘
                                     │
                               API / WS LB
                                     │
                         ┌───────────▼────────────┐
                         │   Java Control Plane   │
                         │ Spring Boot + Modulith │
                         └───────────┬────────────┘
                                     │
        ┌──────────────┬─────────────┼─────────────┬───────────────┐
        │              │             │             │               │
        ▼              ▼             ▼             ▼               ▼
 PostgreSQL          Redis        Temporal       Qdrant            S3
        │                            │
        │                   ┌────────▼────────┐
        │                   │ Worker Fleet   │
        │                   └────────┬────────┘
        │                            │
        │                  execution contract
        │                            │
        │                   ┌────────▼────────┐
        │                   │ Sandbox Hosts  │
        │                   │ gVisor          │
        │                   └────────┬────────┘
        │                            │
        │                       Git Worktree
        │
        └──────── SaaS tenant/control state
```

---

# 44. SaaS Readiness Checklist

Atlas is ready to call itself SaaS only when all critical items below exist.

## Required before public multi-tenant production

- [ ] Organization is enforced as tenant boundary.
- [ ] PostgreSQL RLS enabled and tested.
- [ ] Cross-tenant security test suite exists.
- [ ] Every artifact/vector lookup is tenant scoped.
- [ ] Tenant secrets are encrypted using KMS/Vault strategy.
- [ ] Sandbox cannot reach host control-plane credentials.
- [ ] Rate limits exist.
- [ ] Resource quotas exist.
- [ ] Audit ledger exists.
- [ ] Backup and restore are tested.
- [ ] Object-storage retention policies exist.
- [ ] Agent snapshot/recovery is tested.
- [ ] Billing/entitlement module is separated from RBAC.
- [ ] Usage events are idempotent.
- [ ] Webhook processing is idempotent.
- [ ] Tenant deletion/export lifecycle is designed.
- [ ] Terms/privacy/data-retention policies are defined before commercial launch.

## Strongly recommended

- [ ] SOC2-ready audit/logging controls.
- [ ] Enterprise SSO architecture.
- [ ] per-tenant retention configuration.
- [ ] region/data residency strategy.
- [ ] encrypted backups.
- [ ] incident response runbook.
- [ ] cost anomaly alerts.
- [ ] per-tenant kill switch.

---

# 45. Final Decision Matrix

| Area | Decision |
|---|---|
| Product | B2B Multi-Tenant SaaS |
| Main backend language | Java 25 LTS |
| Core framework | Spring Boot 4.1.x |
| Architecture | Modular Monolith |
| Module enforcement | Spring Modulith |
| Agent SDK | Spring AI 2.0.x |
| Durable orchestration | Temporal |
| System of record | PostgreSQL |
| Ephemeral state | Redis |
| Vector search | Qdrant |
| Artifact store | S3 / MinIO |
| AST | Tree-sitter Java |
| Semantic code intelligence | Language adapters |
| Frontend | React + TypeScript + Vite |
| Editor | Monaco |
| Realtime collaboration | Yjs + y-monaco |
| DAG UI | React Flow |
| Terminal | xterm.js |
| CRDT runtime | small Node/TS service |
| Sandbox MVP | gVisor |
| Strong isolation later | Firecracker/Kata |
| Observability | OTel + Prometheus + Grafana + Tempo + Loki + Pyroscope |
| Core eventing MVP | Spring Modulith events / outbox |
| External automation | optional n8n |
| Kafka | Later if justified |
| Neo4j | Later if justified |
| Kubernetes | Later if justified |
| Billing implementation | provider abstraction; vendor selection deferred |
| SaaS tenant | Organization |
| SaaS billing scope | Organization |
| Execution recovery | Temporal + AgentArtifactSnapshot |

---

# 46. Architecture Principle

The most important architectural rule for Atlas is:

> **Processes are disposable; execution state and artifacts are durable.**

Therefore:

```text
backend process can die
worker can die
agent can die
sandbox can die
LLM call can fail
network can fail

BUT

TaskDAG survives
approved Spec survives
AgentExecutionState survives
AgentArtifactSnapshot survives
Audit survives
Memory survives
```

And the most important SaaS rule is:

> **Every request, artifact, vector, workflow, memory record and agent execution must have an explicit tenant boundary.**

---

# 47. References / Version Verification

Current framework versions were verified on 2026-10-01 against official project sources:

- Spring Boot: https://spring.io/projects/spring-boot/
- Spring Boot system requirements: https://docs.spring.io/spring-boot/system-requirements.html
- Spring Modulith: https://spring.io/projects/spring-modulith/
- Spring AI: https://docs.spring.io/spring-ai/reference/
- Temporal Java SDK: https://github.com/temporalio/sdk-java
- Tree-sitter: https://tree-sitter.github.io/tree-sitter/
- y-monaco: https://github.com/yjs/y-monaco

---

**End of document**
