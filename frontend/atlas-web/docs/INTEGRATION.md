# Frontend integration and acceptance boundary

The repository contains two Vite entry documents: `index.html` for Workspace and `telemetry-console.html` for Observer. They share presentational primitives and design tokens. They have separate routers, Zustand stores, session clients and theme keys. Observer does not import the Workspace store, IndexedDB, command journal or restoration mechanism.

The latest instruction to implement and accept the whole handoff was used to proceed with the previously presented D1–D4 recommendations and the twelve Archive groups. The earlier UI review gate remains: no deployment, staging job or Cloudflare write has been performed.

## Serving the two applications

Local Vite development/preview rewrites `/observer/*` to the independent Observer entry. All other paths use Workspace. This local path routing is a convenience for UI acceptance, not proof of production cookie or tenant isolation.

Production requires distinct Workspace and Observer origins and their own fallback documents. Configure `VITE_OBSERVER_URL` to the Observer base URL and `VITE_WORKSPACE_URL` to the Workspace origin. Keep Observer routes under `/observer/*`; Workspace links convert that prefix to the configured Observer base URL. The Observer base URL therefore includes `/observer/` when that prefix is used on its host. Use HTTPS, separate service audiences, host-only Secure cookies and separate server authorization policies; do not use a shared parent-domain authentication cookie. The hosting/identity configuration is still pending UI approval and backend access.

## Proposed optional capabilities

`atlas-ui/v1` remains a proposed adapter, not an approved backend DTO. The existing REST command safeguards remain: current scope, grant, resource and expected revision; one POST per activation; preserved operation ID and fingerprint; Effective only after matching effect readback. A timeout or ambiguous acknowledgement never causes automatic resend.

Workspace capabilities may additionally advertise:

```json
{
  "streams": {
    "terminal": { "href": "wss://workspace-api.example/ws/terminal", "grant": "sandbox:view", "protocol": "atlas-stream/v1" }
  },
  "collaboration": { "href": "wss://workspace-api.example/ws/collab", "grant": "collab:edit_realtime", "protocol": "y-websocket", "roomPrefix": "specifications" },
  "configurationHref": "https://workspace-api.example/v1/configuration"
}
```

Streams for `presence`, `dag`, `thought` and `notifications` use the same endpoint shape. Endpoints must stay on the authenticated service origin, use WSS (loopback WS is allowed locally) and contain no credentials, query tokens or fragment. A stream sends a read-only subscription with kind, scope and resource ID. It accepts only text JSON frames of at most 64 KiB:

```json
{ "protocol": "atlas-stream/v1", "scope": "authorized-scope", "resourceId": "selected-resource", "seq": 1, "type": "terminal", "payload": { "text": "server-observed output" } }
```

The first sequence is a non-negative integer; subsequent sequences must increase by exactly one. Wrong scope/resource, duplicate or skipped sequence, invalid payload, expiry and revoked authority close the stream. Reconnect is explicit and requires inspection of the current authoritative snapshot. Terminal acknowledges consumed bytes after xterm's write callback. Its queue is bounded at 256 KiB, batches at 32 KiB and 50–100 ms; there is no terminal input or command transport over this channel.

`dag` payloads contain `revision` and canonical `tasks` (the execution model validates types, SRS states, identities and dependencies). Newer live revisions block commands until REST action preconditions are refreshed. `thought` payloads contain `id`, immutable `parentId`, kind (`TASK`, `TOOL`, `CHECKPOINT`, `ARTIFACT`), SubTask state and optional tool identifier. Unknown fields are discarded. Raw reasoning is never rendered. The list retains at most 10,000 entries and mounts at most fourteen rows.

Presence payloads are bounded lists of identities, names, file scope, Online/Idle/Offline state and ISO heartbeat. Expiry uses the resolved `presence_timeout_seconds`. A notification frame carries a scoped revisioned service record. Inbox links stay within allowed Workspace routes, and reading does not resolve or authorize the business action.

## Collaborative documents

Collaboration collection records provide immutable `document_id` and `branch_id`, plus optional read-only `content`. The Yjs room consists of encoded room prefix, scope, branch and document identity. Cross-tab broadcast channels are disabled. The server supplies initial Y.Text `content`; clients never seed the shared document from a device draft. Monaco stays read-only until sync and returns to read-only on authorization or connection loss. Providers and documents are disposed on unmount, scope change, expiry or page hide.

A Yjs sync acknowledgement is not a persisted snapshot, freeze receipt, lock, Submit to AI result or business acceptance. The backend must implement persistence, debounce/snapshot policy, authentication, membership, room scope enforcement, epochs and freeze semantics. Those server effects have not been exercised against a live backend.

## Configuration and scope changes

Configuration is a scoped revisioned snapshot with `layers` keyed by Project, Workspace, Org and System. The first defined value wins in that order; zero is a valid override. Resolved values retain source layer and revision. Runtime thresholds are not inferred from missing configuration. Risk and three budget classifications use numeric measurements and the resolved policy; server command authorization remains authoritative.

Scope choices are Tenancy records with a string `target_scope` and an offered `Switch scope` action. The request uses the original scope/revision/grant and follows the ordinary command journal. Only a matching Effective readback permits a session refresh. The refreshed session must match the selected target; otherwise the UI disconnects. Unknown keeps the original operation and current scope. Old query identities, selections, responses and live channels are discarded when session identity changes.

## What the tests establish

Unit/component tests cover local data integrity, grants, command identity, session expiry, scope guards, bounded stream processing and configuration boundaries. Browser tests use network-only test peers for REST, WebSocket and Yjs; no peer or fabricated success handler is bundled into production. Two real Monaco editors converge through the actual Yjs client, terminal output passes through xterm, and scope changes exercise matching receipts and Unknown outcomes.

Local peer timing is diagnostic evidence under an intercepted network, not proof of production latency, server persistence, delivery, CI or business acceptance. Current CI, live backend E2E, production origin/cookie isolation and manual NVDA/VoiceOver acceptance remain separate checks.

Monaco is pinned to the compatible 0.55 line for y-monaco's ESM import path. Basic syntax grammars and the existing explicit JS/TS analysis are available; a remote LSP/semantic index is not invented. Word-only automatic suggestions are disabled; this avoids treating unanalysed document words as semantic completion and avoids the standalone suggestion widget's invalid ARIA hierarchy. Large editor chunks are loaded only when a file/document is opened; the initial JavaScript budget is still 512 KiB.


## SRS/ADR baseline and sensitive inputs (2026-10-08)

`SRS-ADR-CONFORMANCE.md`, `requirements-traceability.json` and `LIVE-E2E-ACCEPTANCE.md` define the current scope and all pending live requirements. The supplied baseline documents and byte hashes are in `specifications/`. Product E2E remains blocked by absent backend/approved contracts; protocol peers are frontend evidence only.

Service action inputs may declare `secret: true` (or password type); the UI masks them and clears entered values after every send outcome. The command fingerprint remains SHA-256 of the exact canonical payload including the transient sensitive input, never a constant placeholder. Values are excluded from device receipts. A sensitivity flag is retained so arbitrary rejection reasons/effect evidence stay excluded during later reconciliation without retaining the value. A fingerprint is not encryption; weak input values may be guessable. Services must mark sensitive fields and redact all responses, logs, traces and artifacts themselves.

Shared draft checks run before writes and before downloads, including imported/preserved fields, legacy revisions and unsaved/recovery packets. These are heuristics, not a proof of absence of arbitrary secrets or an implementation of the required backend full-diff regex/entropy scan. Existing local revisions are not rewritten.

Operational config `null` or omitted values inherit the nearest allowed parent; explicit zero and false survive. The service must enforce allowed layers per key and invalidate its resolved cache. Flattened UI presentation fields (e.g. risk_low_threshold/risk_high_threshold and invite_ttl_hours) need an approved mapping to SRS risk_thresholds/invitation_token_ttl_hours; they are not a claim that an existing backend exposes these DTOs.

Resolve the C01 snapshot-base and C02 raw-reasoning conflicts before backend acceptance. This handoff uses exact snapshot base recovery and structured progress/resume events, per ADR-004. No raw hidden reasoning is rendered.
