"""Journey oracle from Figma (read-only use_figma, file 0md9BEFI1rU0aRAvf98TWO, page "04 · E2E Model").

  * Traceability: section 478:130933 "E2E Model / Full lifecycle, routing and traceability", frames MODEL/trace/0…168
    ("Traceability · source steps 1–8 / 174" …). Each step: "<UXJ-nn-Snn> / <UX ref>", actor, ACTION, ORACLE, RECOVERY, NEXT,
    NATIVE SPECS. Stored here: id, UX ref, ACTION, ORACLE, RECOVERY (ACTION ≤90, ORACLE ≤110, RECOVERY ≤90 chars as read;
    NATIVE SPECS omitted). Every step in Figma is marked "Execution NOT_RUN" and "PROPOSED_JOIN_BY_PACKAGE_AND_JOURNEY".
  * Journey register 342:8: 14 DESIGN_V8 journeys (J01–J14) — a different namespace from UXJ-01…42 (Figma: "Join by
    Given/When/Then and entity transitions, never the J number alone").
  * Decision register 342:9: D01–D14, UXD-01–UXD-14, EX-LOCK-03, OBSERVER_READ_ONLY, API TBD — all "Proposed not approved".
"""
import os

ACTORS = {
    1: 'New user / Admin', 2: 'Admin / invited member', 3: 'Project maintainer', 4: 'AI admin / operator', 5: 'Viewer / author',
    6: 'Specification author / reviewer', 7: 'Two authorized authors', 8: 'Author / authorized spec merge reviewer',
    9: 'Tech Lead / author', 10: 'Developer / analyst', 11: 'Catalog maintainer / Tech Lead', 12: 'Memory maintainer / reviewer',
    13: 'Plan author / reviewer', 14: 'Workflow author / Tech Lead', 15: 'Tech Lead / plan reviewer', 16: 'Operator / checkpoint reviewer',
    17: 'Operator / developer', 18: 'Operator / platform owner', 19: 'Developer / Security Officer',
    20: 'Independent Tech Lead / Security Officer', 21: 'Authorized maintainer / reviewers', 22: 'BA / independent acceptance reviewer',
    23: 'Memory reviewer / operator', 24: 'Member / reviewer', 25: 'System Observer', 26: 'Authorized config owner',
    27: 'Admin / project owner', 28: 'Platform / security QA / owner', 29: 'Document maintainer', 30: 'Specification author',
    31: 'Tech Lead / BA', 32: 'Developer / maintainer', 33: 'Agent maintainer / reviewer', 34: 'Catalog maintainer / security reviewer',
    35: 'Catalog owner / operator', 36: 'Author → Tech Lead → operator → independent reviewer', 37: 'Desktop developer / device owner',
    38: 'Org admin / finance owner / operator', 39: 'Document maintainer / Viewer', 40: 'Keyboard and assistive technology user',
    41: 'Any authorized member / operator', 42: 'Org owner / catalog/document maintainer',
}

TRACE_TXT = """
UXJ-01-S01|UX-IAM-01|Sign in and confirm account|Validated actor and intended-route session receipt|Reject reused/expired state; recover network without losing authorized intent
UXJ-01-S02|UX-TEN-01|Create org/workspace/project|One durable scoped hierarchy and initial Admin membership|Duplicate slug/create race resolves once; cannot grant System config
UXJ-01-S03|UX-TEN-02|Open readiness and configure real dependencies|Each mandatory item has actual connection/config/index/grant evidence|Incomplete/unknown items remain blockers with responsible next screen
UXJ-01-S04|UX-SHELL-01|Open project library/repo from stable route|Authorized scope and deep-link context retained|Old/wrong-scope route gives safe denial, not another tenant
UXJ-02-S01|UX-IAM-02|Issue invite and inspect delivery|Actual invitation token/delivery receipt|Unavailable delivery retains pending status
UXJ-02-S02|UX-IAM-01|Choose intended identity|Server account matches invitation recipient|Wrong account shown with account change/reject path
UXJ-02-S03|UX-IAM-02|Accept invitation|Exactly one scoped membership with assigned role|Concurrent accept/revoke/expiry has recorded winner
UXJ-02-S04|UX-IAM-03|Inspect effective role union then revoke while online|Current server grant explainable; revoked effects rejected|Last Admin protected; stale client cannot keep protected access
UXJ-03-S01|UX-TEN-02|Choose repo through authorized installation|Provider installation/repository grant verified|Revoked or wrong-installation stays disconnected
UXJ-03-S02|UX-CODE-01|Resolve branch and browse immutable source|Header/tree/file share actual full OID|Moved branch shows refresh/pinned choice
UXJ-03-S03|UX-CODE-06|Start and inspect index job|Actual per-file diagnostics/analyzer/source versions|Malformed/rate-limited files preserve partial state
UXJ-03-S04|UX-CODE-10|Handle missed/forged/replayed webhook and reconnect|HMAC/inbox dedupe and source/check gap reconciliation|Invalid signature denied; duplicate delivery does not duplicate mutation
UXJ-04-S01|UX-LLM-01|Add/test provider secret|Actual diagnostic receipt and server secret handle|No request/unknown status cannot say Healthy
UXJ-04-S02|UX-LLM-02|Approve compatible routing|Versioned model/tool/context capability routing|Incompatible fallback blocked with clear reason
UXJ-04-S03|UX-LLM-03|Allocate and reserve constrained budget|Durable balances and concurrent cap|Unknown charge keeps hold; reset boundaries not fabricated
UXJ-04-S04|UX-LLM-04|Resolve rate limit/rotate/fallback and explicitly resume|Actual attempt/credential/routing/usage correlation|No auto-resume/refill or blind charged retry
UXJ-05-S01|UX-SPEC-01|Expand selected collection/folders|Paged authorized children and real aggregate scope|Unknown/denied subtree count is not leaked
UXJ-05-S02|UX-SPEC-04|Search full corpus and open exact result|Stable doc ID/revision/breadcrumb from real result|Partial/stale results disclose limits and refresh route
UXJ-05-S03|UX-SPEC-05|Use independent outline/preview/source|Selected content produces actual outline/sections|Readonly and unsupported content modes explicit
UXJ-05-S04|UX-SHELL-03|Share/reopen stable document route|Authorized resource/section/revision restored|Rename/move resolves identity or explicit historical location
UXJ-06-S01|UX-SPEC-05|Create/edit Markdown source and preview|Actual content and generated selected-doc outline|Invalid render/source preserves unsaved draft
UXJ-06-S02|UX-SPEC-07|Save and reconnect/restart|Exact server revision/hash separate from local backup|409/offline/revoke preserves allowable local draft
UXJ-06-S03|UX-SPEC-09|Add stable requirements/acceptance cases/source links|Requirement IDs and original case references persisted|Ambiguous/missing criteria highlighted
UXJ-06-S04|UX-SPEC-10|Request review/comment/resolve at pinned revision|Actual reviewer/thread/decision receipts|Changed revision or revoked reviewer renews review
UXJ-07-S01|UX-COLLAB-01|Join same authorized doc branch from two clients|Actual room grant and synced CRDT updates|Wrong branch/project/revoked ticket denied
UXJ-07-S02|UX-SPEC-07|Observe remote ACK and authoritative save|Distinct update ACK and durable commit receipts|Socket connection alone does not claim Saved
UXJ-07-S03|UX-COLLAB-02|Freeze while second client has in-flight/offline edits|Authoritative revision cut/write epoch fenced|Late patch cannot mutate Frozen revision
UXJ-07-S04|UX-SPEC-07|Recover late client work as new draft/review|Preserved offline diff under current authorization|Revoke blocks upload; user sees explicit recovery path
UXJ-08-S01|UX-SPEC-08|Create branch and compare actual base/ours/theirs|Version ancestry and region classification|No common base is declared
UXJ-08-S02|UX-SPEC-10|Review required regions/paragraphs|Actual human decisions at proposal fingerprint|Lease expiry and reviewer revoke block commit
UXJ-08-S03|UX-SPEC-08|Resolve and commit reviewed merge|One authoritative merged revision|Concurrent head/rename/delete invalidates stale merge but retains draft
UXJ-08-S04|UX-SPEC-07|Reopen merged content/history|Persisted source/revision/actor evidence|Lost response reconciles operation rather than repeating merge
UXJ-09-S01|UX-SPEC-11|Preflight saved docs/requirements/dependencies|Exact eligible selection manifest|Missing/dirty/denied dependency blocks cut
UXJ-09-S02|UX-COLLAB-02|Confirm real freeze barrier|Frozen receipt only after authoritative cut|In-flight edits handled explicitly
UXJ-09-S03|UX-SPEC-12|Submit idempotently to preparation job|Same submission/job on duplicate key|Freeze does not auto-run or auto-approve plan
UXJ-09-S04|UX-SPEC-12|Unlock/supersede and submit a new revision|Affected run/approval impact and old-writer fence|Late output rejected; after merge use corrective delivery
UXJ-10-S01|UX-CODE-06|Index actual selected OID with malformed/excluded files|Per-file supported/analyzer/partial receipt|Timeout/cancel/Qdrant failure declares incomplete coverage
UXJ-10-S02|UX-CODE-04|Open definition/reference/peek|Actual relation source and declared semantic/syntax method|Ambiguous or unsupported relation is not exact jump
UXJ-10-S03|UX-CODE-03|Search scoped file/content/symbol|Actual authorized query results at OID|Invalid query and denied/stale hits handled
UXJ-10-S04|UX-CODE-07|Inspect impact/test/requirement edge and metric version|Traceable candidate vs verified test distinctions|NaN/negative/incompatible metric stays Unknown
UXJ-11-S01|UX-AGENT-03|Register/import and validate resource version|Source/digest/schema/compatibility evidence|Poisoned/untrusted/invalid resource quarantined
UXJ-11-S02|UX-AGENT-06|Validate mandatory rules/output/tool scope|Effective allowed manifest|Override cannot weaken mandatory network/path/output rules
UXJ-11-S03|UX-AGENT-09|Pin reviewed resources to workflow/plan|Explicit consumer versions and contracts|Incompatible or revoked resource blocks assignment
UXJ-11-S04|UX-AGENT-12|Preview impact and revoke during active work|Current policy/fence/consumer outcome receipts|Historical evidence retained; unsafe new/effective use denied
UXJ-12-S01|UX-MEM-01|Choose actual layer/scope/source|Authorized catalog and evidence state|Hidden source/count excluded
UXJ-12-S02|UX-MEM-02|Import/resolve duplicate/partial result|Per-record actual ingestion receipts|Retry failed subset without duplicates
UXJ-12-S03|UX-MEM-02|Independently promote eligible record|Reviewer/source evidence and verified status|Missing/poisoned evidence not eligible
UXJ-12-S04|UX-MEM-04|Migrate/revoke and inspect dependent packages|Actual index/metric/grant/lineage change|Cached vector result cannot bypass revoke
UXJ-13-S01|UX-CODE-08|Select source ranges and inspect actual provenance|Exact allowed OID/ranges/analyzer metadata|Secret/denied/stale selection blocked or excluded explicitly
UXJ-13-S02|UX-MEM-03|Select mandatory/optional memory and model|Actual token/capability bounds and grants|Mandatory overflow requires explicit scope change
UXJ-13-S03|UX-MEM-03|Create immutable context package|Actual content hashes/manifest/permission receipts|No silent dropping of mandatory rule/source
UXJ-13-S04|UX-WF-04|Handoff pinned package to generation|Same package/spec/source/workflow fingerprint|Timeout/cancel/retry keeps original immutable identity or renewed review
UXJ-14-S01|UX-WF-01|Choose system template or custom definition|Immutable template vs editable derived version|System template cannot be overwritten
UXJ-14-S02|UX-WF-02|Configure typed nodes/dependencies/agents|Actual validated DAG/output boundaries|Cycle/missing mandatory node shows actionable node/field errors
UXJ-14-S03|UX-WF-03|Generate fallback proposal if no eligible workflow|Actual eligible default/provider/budget proposal receipt|Missing default/resources does not manufacture workflow
UXJ-14-S04|UX-WF-05|Review and approve current definition/plan separately|Current eligible actor and fingerprint|Generated proposal never silently activates or starts
UXJ-15-S01|UX-WF-04|Review tasks/dependency outputs/checkpoints|Actual typed plan revision/input manifest|No-op/missing parent/contract mismatch declared
UXJ-15-S02|UX-WF-05|Approve exact current fingerprint|Durable independent plan decision|Upstream change or superseded output invalidates
UXJ-15-S03|UX-EXEC-01|Admit eligible approved plan|Same submission/plan/version produces one durable run|Concurrent start dedupes and quota/role recheck required
UXJ-15-S04|UX-AGENT-10|Open run task/agent version/input/output|Linked actual identities across every surface|No silent latest version/current commit substitution
UXJ-16-S01|UX-EXEC-01|Inspect task readiness/capacity/budget/dependency|Actual server admission blockers|No sandbox/lock while required checkpoint/dependency blocked
UXJ-16-S02|UX-WF-06|Review current checkpoint evidence|Barrier and eligible actor identity|Missing role/stale artifact blocks decision
UXJ-16-S03|UX-WF-06|Approve/reject checkpoint explicitly|Recorded current decision/winner|Deadline warns; never auto-approves
UXJ-16-S04|UX-EXEC-01|Observe one admitted fenced attempt|Durable scheduler/lease/budget receipt|Two schedulers cannot double-admit or publish
UXJ-17-S01|UX-EXEC-03|Inspect assigned agent/input/grants and tool authorization|Actual pinned version/current tool/path/policy decision|Forbidden path/tool/network denied
UXJ-17-S02|UX-EXEC-05|Observe canonical multi-file lock order/fence|Actual scoped monotonic lease ownership|Zombie/opposite-lock-order race safely rejected/recovered
UXJ-17-S03|UX-EXEC-04|Inspect actual sandbox logs/PTY/output bytes|Process/tool/sidecar/runtime receipts|Unready/violating container/hook does not execute unsafely
UXJ-17-S04|UX-EXEC-07|Validate output and consume finalized parent artifact|Contract/digest/lineage and combined-tree evidence|Retries exhausted or superseded producer blocks consumer
UXJ-18-S01|UX-EXEC-02|Request pause and inspect command stages|Ledger + actual safe-point receipt|Accepted is not Effective
UXJ-18-S02|UX-EXEC-06|Kill/restart and select verified compatible snapshot|Real immutable bytes/runtime/input/fence compatibility|Missing/corrupt snapshot cannot claim lossless restore
UXJ-18-S03|UX-EXEC-06|Retry/resume under current source/policy/grants|New fenced attempt/admission receipt|Superseded input/revoke/unknown charged effect blocks unsafe resume
UXJ-18-S04|UX-EXEC-08|Cancel vs publish/merge and observe cleanup|Recorded effect winner and fenced cleanup outcome|Merged PR requires corrective change; late writer cannot publish
UXJ-19-S01|UX-EXEC-07|Assemble actual combined tree/artifacts|Current integrated source and finalized inputs|Missing/conflicting parent output blocks tests
UXJ-19-S02|UX-GOV-01|Run actual security/test/output checks|Report producer/version/hash/current fingerprint|Unavailable scan remains Unknown
UXJ-19-S03|UX-GOV-01|Inspect real finding/veto and review false positive|Independent disposition and remediation evidence|Secret or hard veto cannot be overridden by arbitrary checkbox
UXJ-19-S04|UX-GOV-02|Handoff current trusted evidence to eligible reviewers|Same current fingerprint|Policy/role/head drift renews readiness
UXJ-20-S01|UX-GOV-02|Inspect eligible slots/authors/current policy|Actual person/grant/quorum evaluation|Same person two roles or custom role name cannot fake independence
UXJ-20-S02|UX-GOV-06|Comment/remind or assign missing qualified reviewer|Revision-bound actual thread/reminder|Read/timeout is never approval
UXJ-20-S03|UX-GOV-02|Sign/reject concurrently|Recorded decision winner/fingerprint|Revoke/demotion/head/policy change invalidates stale signatures
UXJ-20-S04|UX-GOV-03|Refresh current guard before merge effect|Current server eligibility/evidence again|Previously green UI alone cannot authorize effect
UXJ-21-S01|UX-GOV-03|Create PR from current authorized diff|Provider PR receipt or explicit unknown outcome|Lost response reconciles by correlation rather than duplicates
UXJ-21-S02|UX-GOV-03|Refresh required trusted checks at actual head|Provider check IDs/context/head receipt|Unknown/missing/old-head checks remain blocking
UXJ-21-S03|UX-CODE-05|Handle rebase/conflict/new head|Actual diff/base/head and stale-signature invalidation|Manual close/reopen/merge and late failed check remain visible
UXJ-21-S04|UX-GOV-03|Conditional merge with current guard|Provider confirmed exact-head merge OID|Branch policy/permission/quorum rechecked; cancel does not undo merged history
UXJ-22-S01|UX-GOV-04|Collect required PRs/merged revision/cases|Actual combined closure scope|Partial merge/missing mandatory case stays incomplete
UXJ-22-S02|UX-GOV-04|Run original positive/negative/race acceptance|Independent actual business oracle at merged revision|Low drift/checkbox/AST parse not sufficient
UXJ-22-S03|UX-SPEC-13|Observe per-requirement and collection progress|Verified/unknown/failed outcomes and missing members|No fabricated percentage from unrelated task count
UXJ-22-S04|UX-GOV-04|Handle failed rescan/revert/new source change|Reopened/corrective delivery with lineage|Stale IMPLEMENTED invalidated appropriately
UXJ-23-S01|UX-MEM-05|Create incident/lesson draft from actual run|Real successful or failed-run provenance|Failed DAG is allowed incident draft, not success evidence
UXJ-23-S02|UX-MEM-02|Review and promote only eligible knowledge|Independent evidence/reviewer receipt|Unverified content excluded from retrieval
UXJ-23-S03|UX-EXEC-08|Finalize artifacts and stop/fence/reclaim|Actual retained hashes/process stop/lease journal|Persist or cleanup failure keeps explicit remaining holds
UXJ-23-S04|UX-GOV-05|Inspect retained audit/evidence after cleanup|Authorized immutable referenced bytes remain available|Retry cleanup cannot delete required memory/artifact lineage
UXJ-24-S01|UX-COLLAB-03|Reconnect and replay inbox/activity cursor|Deduped durable scoped items|Dropped stream or stale target does not lose unread work
UXJ-24-S02|UX-COLLAB-03|Read comment/diff/activity while browsing history|Current redacted revision anchors with preserved scroll|No forced autoscroll or exposed private raw reasoning
UXJ-24-S03|UX-GOV-06|Open current target/comment/reminder|Same authorized current gate/diff|Read never signs/approves
UXJ-24-S04|UX-GOV-05|Inspect required audit persistence|Actual critical-effect audit policy evidence|Unavailable append follows signed rule; no fake durable audit
UXJ-25-S01|UX-OBS-01|Authenticate separate Observer grant|Actual environment/scope entitlement|Workspace role alone rejected
UXJ-25-S02|UX-OBS-02|Inspect stale/missing/partial collector data|Actual freshness/units/cohort/quality|No data is not zero load or Healthy
UXJ-25-S03|UX-OBS-03|Drill trace/profile and check compatibility|Actual authorized bytes and compatible sample metadata|Incompatible profiles blocked
UXJ-25-S04|UX-OBS-04|Create export then revoke before download|Real job/redaction/hash and current download policy|Ready artifact does not bypass revoked session/scope
UXJ-26-S01|UX-CFG-01|Inspect System/Org/Workspace/Project precedence|Actual server effective digest/source|Parent scope remains read-only without grant
UXJ-26-S02|UX-CFG-01|Override/save/reset concurrently|Revision-checked durable config|409 retains input; reset inherits nearest parent
UXJ-26-S03|UX-CFG-02|Preview current policy change impact|Affected pending gate/run/admission fingerprints|Weakening safety to approve current work is blocked
UXJ-26-S04|UX-GOV-02|Re-evaluate pending signatures/current guard|Current policy/eligibility evidence|Old green signature cannot silently remain valid
UXJ-27-S01|UX-IAM-04|Preview actor/run/gate/ownership impact|Current active dependencies and replacement responsibilities|Last eligible owner/reviewer conflicts remain blockers
UXJ-27-S02|UX-TEN-04|Archive/transfer with accepted target and retention|Actual durable hierarchy/hold journal|Active unfenced work or unknown spend prevents purge
UXJ-27-S03|UX-SAAS-03|Export/delete only eligible scoped objects|Actual per-object lifecycle outcomes|Referenced required evidence/hold cannot be removed
UXJ-27-S04|UX-TEN-04|Restore with latest revocation/deletion state|Actual current grant/tombstone reconciliation|Restore never auto-opens revoked session/run
UXJ-28-S01|UX-EXEC-09|Contain Redis/queue/worker/DB/Temporal/S3 failure|Actual durable operation/fence/outbox state|No two writers or lost unknown effects
UXJ-28-S02|UX-OBS-05|Restore/replay against external newer state|Measured restore + deletion/authorization/effect journal reconciliation|No resurrected erased tenant or duplicate external PR/charge
UXJ-28-S03|UX-SHELL-02|Verify mock boundary and authority after recovery|Production cannot import synthetic success handlers|Test seed remains isolated from production
UXJ-28-S04|UX-OBS-05|Run signed workload/tenant/isolation/canary gates|Independent deployment/browser/service/security/DR evidence|Local fixture passes do not authorize release
UXJ-29-S01|UX-SPEC-01|Load only expanded paged children|Authorized stable folder/doc IDs and meaningful count|Partial/unknown counts explicit
UXJ-29-S02|UX-SPEC-02|Move/rename/reorder with revision and impact preview|Atomic valid parent/scope mutation|Cycles, stale parent, permission change rejected
UXJ-29-S03|UX-SPEC-04|Find renamed/moved document globally|Stable ID resolves current/history path|Current and frozen historical path labels stay separate
UXJ-29-S04|UX-SPEC-13|Inspect affected requirements/frozen set links|References remain pinned and broken candidates visible|Catalog-only rename cannot rewrite old frozen content manifest
UXJ-30-S01|UX-SPEC-03|Preview folder/file mapping, format and duplicates|Exact proposed doc catalog change|Unsupported/malformed/oversize rows shown before action
UXJ-30-S02|UX-SPEC-03|Import then retry failed subset after lost response|Idempotent per-item committed/skipped/failed/unknown receipt|No duplicates or all-success from partial job
UXJ-30-S03|UX-SPEC-09|Review imported acceptance/references|Stable requirements and resolved actual links|Unresolved references remain missing/ambiguous
UXJ-30-S04|UX-SPEC-14|Export selected exact revision set|Actual manifest/content hashes and authorized download|Partial export and changed permission remain explicit
UXJ-31-S01|UX-SPEC-11|Select documents and resolve closure/bounds|Exact eligible version-set proposal|Cross-scope/missing/dirty member blocks selection
UXJ-31-S02|UX-COLLAB-02|Create a signed authoritative revision cut|Immutable complete manifest or explicit preparation failure|No mixed partially frozen set labeled complete
UXJ-31-S03|UX-MEM-03|Build context using the same set/requirements/source|Actual package manifest and token/grant receipts|Oversized mandatory content cannot be silently dropped
UXJ-31-S04|UX-WF-05|Review/admit same version-set fingerprint|Actual plan/run linked to frozen manifest|Any relevant upstream/policy change requires renewed current review
UXJ-32-S01|UX-CODE-01|Select repo/ref and lazily browse files|Resolved full OID shared by all views|Denied/deleted/moved ref declared
UXJ-32-S02|UX-CODE-02|Read code/select lines/copy permalink/history|Immutable actual source/blob/range link|Large/binary/LFS/renamed content handled honestly
UXJ-32-S03|UX-CODE-04|Inspect symbols/refs with method/quality|Actual declared syntax/semantic evidence|Unsupported/ambiguous is not verified jump
UXJ-32-S04|UX-CODE-09|Enter authorized edit workspace and stage/diff/commit proposal|Actual scoped worktree and protected Git operation|Dirty branch switch preserves draft; unknown push reconciled
UXJ-32-S05|UX-GOV-03|Create/verify actual PR/check/merge|Trusted exact-head provider receipts|Current guards required; browsing itself never grants execution
UXJ-33-S01|UX-AGENT-01|Create stable agent/version draft|Durable definition identity distinct from runtime|Duplicating config retains provenance but does not copy approvals
UXJ-33-S02|UX-AGENT-02|Configure effective model/tool/memory/output/limits|Validated actual bounded config manifest|Inherited safety policy cannot be weakened
UXJ-33-S03|UX-AGENT-07|Resolve exact project readiness blockers|Actual current dependency/grant/capability/budget receipts|Published remains Unrunnable while blocker unknown
UXJ-33-S04|UX-AGENT-08|Run controlled independent smoke/evaluation|Actual isolated tool/provider/case/output/cost receipts|Partial/unknown/failed mandatory checks block signed release policy
UXJ-33-S05|UX-AGENT-09|Publish and pin explicit version to workflow proposal|Actual version/review/consumer manifest|Latest publication does not mutate approved/running plan
UXJ-34-S01|UX-AGENT-04|Register/test/discover MCP tools|Actual protocol/tool schema/health receipt|Wrong protocol/credentials/stale health rejected
UXJ-34-S02|UX-AGENT-03|Review/publish approved resource version and allowlist|Immutable bounded tool/resource manifest|Tool schema drift or unknown source needs renewed review
UXJ-34-S03|UX-AGENT-05|Validate hook/plugin/sidecar/runtime/OS compatibility|Real supported image/digest/capability evidence|Unimplemented Firecracker/Kata/OS fallback never says Ready
UXJ-34-S04|UX-AGENT-06|Admit only approved output/tool/network/path contract|Actual server grant at effect time|Prompt/tool metadata cannot escalate authority
UXJ-35-S01|UX-AGENT-03|Publish new immutable resource/agent version|Actual digest/version/readiness receipts|No overwrite of old version
UXJ-35-S02|UX-AGENT-09|Inspect consumers and propose version migration|Affected workflow/plan/delivery diff|No auto-upgrade of active attempt
UXJ-35-S03|UX-AGENT-12|Revoke old resource/grant during protected effect|Current effect denial/fence and recorded winner|Retain historical evidence; cancellation after merge has corrective path
UXJ-35-S04|UX-EXEC-08|Verify cleanup and safe replacement admission|Actual reclaimed/fenced resources and reapproved new input|Unsafe late writer or unknown charge remains blocked
UXJ-36-S01|UX-SPEC-11|Freeze actual requirements/revision set|Authoritative selected manifest|Missing/dirty/denied inputs block
UXJ-36-S02|UX-MEM-03|Pin actual source/context/resources/model|Immutable allowed package|Mandatory overflow or stale provenance blocks
UXJ-36-S03|UX-WF-05|Approve typed plan/current fingerprint|Actual eligible approval and same run admission|No demo plan/run swap
UXJ-36-S04|UX-EXEC-07|Execute actual bounded agent tasks and test combined output|Actual sandbox/tool/output contract/hash/lineage|Tool failure and unknown effects reconcile
UXJ-36-S05|UX-GOV-03|Review current evidence and merge actual exact-head PR|Independent quorum/check/provider merge receipt|Stale reviewer/head/CI/policy cannot effect
UXJ-36-S06|UX-GOV-04|Verify mandatory business outcomes|Independent positive/negative/race cases at merged revision|Run Completed or low drift cannot close delivery
UXJ-36-S07|UX-EXEC-08|Stop/fence/reclaim with retained evidence|Actual cleanup journal/artifact retention|Failed cleanup remains visible and retryable
UXJ-37-S01|UX-DESK-01|Install/connect actual signed device session|Typed narrow IPC/current device grant|Wrong account/revoked device denied
UXJ-37-S02|UX-DESK-02|Open allowed local repo/index/edit offline|Actual local Git/source/draft authority|Symlink/root escape blocked; no remote Saved claim
UXJ-37-S03|UX-DESK-03|Use eligible local sandbox/PTY/run control|Actual supported OS/isolation/process/fence receipt|No unsafe fallback for absent gVisor/runtime capability
UXJ-37-S04|UX-DESK-04|Update/reconnect/revoke while preserving work|Signed compatibility/update/current policy evidence|Drafts retained; old device protected effects denied
UXJ-38-S01|UX-SAAS-01|Inspect/allocate seats and concurrent quota|Actual entitlement/seat version|Duplicate concurrent admissions denied
UXJ-38-S02|UX-SAAS-02|Handle billing/usage/unknown charge|Provider/ledger reconciliation receipts|Duplicate webhook/mismatched invoice remains explicit
UXJ-38-S03|UX-EXEC-08|Safely stop/reclaim while suspended|Authorized current operator cleanup receipt|Expired entitlement does not prevent safe stop
UXJ-38-S04|UX-SAAS-01|Reactivate under signed provider/entitlement policy|Current reconciled admission permission|No auto-resume of previously stopped run
UXJ-39-S01|UX-SPEC-14|Preview referenced requirements/sets/PRs and archive|Current scoped impact/retention receipt|Referenced evidence cannot be hard deleted
UXJ-39-S02|UX-SPEC-02|Restore at current parent/name/permission policy|Actual revision-checked restore and stable ID|Collision or denied parent requires explicit resolution
UXJ-39-S03|UX-SPEC-04|Open old shared link/search result|Authorized current or historical identity|No denied ancestor/content count leak
UXJ-39-S04|UX-SPEC-13|Verify historical and current delivery references|Pinned historical manifest still intact|Restore does not auto-approve/reopen unsafe old execution
UXJ-40-S01|UX-SHELL-05|Navigate tree and expand/select without pointer|Correct focus/selection/ARIA and authorized loaded children|Virtualization restores focused row; optional large counts remain honest
UXJ-40-S02|UX-SPEC-02|Move using pointer/menu/keyboard alternative|Same actual valid move/impact receipt as drag|No cycle or inaccessible only-drag control
UXJ-40-S03|UX-SHELL-04|Resize panes and resolve form error summary|Readable critical controls at zoom/narrow width|Labels and focus not hidden by sticky toolbar
UXJ-40-S04|UX-EXEC-02|Use task list and visible run control/checkpoint|Same authorized actual command/decision|Unsupported action reason visible; no hover-only graph controls
UXJ-40-S05|UX-GOV-02|Complete eligible review via keyboard and AT|Current actual decision and accessible feedback|No color-only quorum/error or focus theft
UXJ-41-S01|UX-SHELL-02|Submit actual mutation with scoped idempotency/revision|Durable operation receipt at declared stage|Unknown response retains intent and operation ID
UXJ-41-S02|UX-EXEC-02|Observe command/event gap without duplicate effect|Snapshot/cursor/sequence reconciliation|Stale/wrong-scope events cannot regress or complete state
UXJ-41-S03|UX-GOV-03|Reconcile unknown external PR/merge|Actual provider correlation and current guard|No blind second PR/merge/charge
UXJ-41-S04|UX-SHELL-03|Restore route/draft/current authority|Same authorized identity and stable context|Disconnected UI does not retain revoked effect permission
UXJ-42-S01|UX-AGENT-12|Inspect dependencies and retire agent/resources|Signed current impact/revoke behavior|Referenced version remains auditable
UXJ-42-S02|UX-SPEC-14|Retain/archive frozen doc and delivery references|Actual retained manifest/content bytes|No deletion of mandatory active evidence
UXJ-42-S03|UX-GOV-05|Export redacted authorized immutable evidence|Actual job/digest/current access policy|Revoke/expiry/partial job blocks inappropriate download
UXJ-42-S04|UX-SAAS-03|Apply eligible retention/erasure journal|Actual scope/objects/holds/deletion receipts|Restore cannot revive erased content/access
"""

# Frontend-observable part of a step (what this run can verify on the deployed UI without an authorized service) and the
# evidence that verifies it. Everything else in the step's ORACLE needs a real service receipt => BLOCKED_BACKEND.
FE_STEPS = {
    'UXJ-01-S04': ('Stable route and deep-link context retained on direct load/reload/back/forward; unknown route gives safe "view not found"',
                   ['CF-PRE-008', 'FE01-ROUTE-001', 'FE01-ROUTE-002', 'FE01-ROUTE-003', 'FE04-XENGINE-ROUTES-CHROMIUM', 'FE04-XENGINE-ROUTES-FIREFOX', 'FE04-XENGINE-ROUTES-WEBKIT']),
    'UXJ-05-S04': ('Route + query (authority/definition/schema) restored after reload (document id not seedable without service)', ['FE01-ROUTE-002']),
    'UXJ-18-S01': ('Command stages shown as returned; Accepted/Received never shown as Effective without matching effect readback', ['FX-SVC-ACCEPTED', 'FX-SVC-RECEIVED', 'FX-SVC-EFFECTIVE', 'FX-SVC-MISMATCH']),
    'UXJ-41-S01': ('Mutation sent once with Idempotency-Key, If-Match and expected revision; unknown response keeps operation id and asks to reconcile',
                   ['FX-SVC-ACCEPTED', 'FX-SVC-NETFAILAFTERSEND', 'FX-SVC-TIMEOUTAFTERSEND', 'FX-SVC-HTTP500']),
    'UXJ-41-S03': ('Unknown outcome: no automatic resend, "Reconcile this operation; do not resend"', ['FX-SVC-NETFAILAFTERSEND', 'FX-SVC-TIMEOUTAFTERSEND', 'FX-SVC-HTTP409']),
    'UXJ-41-S04': ('After 401/expiry the UI disconnects and drops command authority without stale success feedback', ['FX-SVC-401-DISCONNECT', 'FX-SVC-EXPIRY', 'FX-SERVICE-FND-005']),
    'UXJ-25-S01': ('Observer audience session shows no workspace records and no command controls', ['FX-SVC-OBSERVER']),
    'UXJ-28-S03': ('Production bundle ships no synthetic success handler: release manifest "no mock backend included"; every service view states "No observed service data / No sample entities"',
                   ['CF-PRE-002', 'OBS-NOMOCK-001']),
    'UXJ-40-S01': ('Tree keyboard navigation (APG Tree)', ['FE03-KBD-TREE', 'FE03-KBD-TREE-FIREFOX', 'FE03-KBD-TREE-WEBKIT']),
    'UXJ-40-S03': ('Critical controls readable at narrow width; labels/focus not hidden by the fixed header', ['FE02-SCROLL-001-CHROMIUM', 'FE02-SCROLL-001-WEBKIT', 'FE02-SCROLL-001-FIREFOX', 'A11Y-TARGET-001', 'FE02-AUTO-216']),
    'UXJ-40-S04': ('Protected actions always visible with a readable blocker reason (no hover-only control)', ['OBS-BLOCKERS-001', 'DEF-NAV-run-admission']),
    'UXJ-40-S05': ('Keyboard + assistive-technology review flow', []),
    'UXJ-14-S02': ('Local DAG validation with actionable node/field errors (local, no service)', []),
    'UXJ-06-S01': ('Local Markdown edit + preview + generated outline (Monaco; trusted typing required)', []),
    'UXJ-40-S02': ('Keyboard/menu alternative to drag move', []),
}


def steps():
    out = []
    for line in TRACE_TXT.strip().splitlines():
        sid, ux, action, oracle, recovery = line.split('|')
        j = int(sid[4:6])
        out.append({'step_id': sid, 'journey_id': sid[:6], 'ux_ref': ux, 'actor': ACTORS[j], 'action': action, 'oracle': oracle, 'recovery': recovery})
    return out


DESIGN_V8 = [
    ('J01', 'Access', 'Login → invitation → workspace → project', 'Wrong account, expired invite, revoked access'),
    ('J02', 'Setup', 'Connect repository → reconcile → readiness', 'Disconnect, empty repo, insufficient permission'),
    ('J03', 'Author spec', 'Draft → save → diff → freeze → review', 'Offline, dirty tab, frozen draft, conflict/lease'),
    ('J04', 'Understand code', 'File/symbol → source → references → evidence', 'Stale/partial index, denied/binary/large file'),
    ('J05', 'Prepare plan', 'Specs + source + memory → context review → generation → plan', 'Stale/revoked context, generation failure'),
    ('J06', 'Admit run', 'Workflow version → contract → policy/budget/sandbox → admission', 'Budget/capacity/lock, missing contract, changed policy'),
    ('J07', 'Execute', 'Parallel tasks → checkpoint → resume → artifacts', 'Heartbeat stale, rejected signal, wrong snapshot'),
    ('J08', 'Recover run', 'Pause/cancel/retry → reconcile → cleanup', 'Unknown outcome, reconnect, cleanup-held/failed'),
    ('J09', 'Review outputs', 'Durable artifact → manifest/snapshot → handoff', 'Not durable, snapshot unavailable, revoked resource'),
    ('J10', 'Governance', 'Risk/security → independent reviewers → signed gate', 'Scanner unavailable, secret confirmed, missing reviewer'),
    ('J11', 'Deliver', 'Diff → PR → exact-head CI → merge', 'CI failed/old head, conflict, PR unknown/partial merge'),
    ('J12', 'Close loop', 'Acceptance → verification → cleanup → memory', 'Acceptance failed, unknown verification, locks held'),
    ('J13', 'Admin lifecycle', 'Registry/provider/policy/memory change → impact → activation', 'Revoke, archived project, restore/reconcile'),
    ('J14', 'Observe', 'Trace/metrics/profile → diagnostic handoff → export', 'No/partial data, incompatible profile, export failure'),
]
DECISIONS = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'D11', 'D12', 'D13', 'D14'] + \
            [f'UXD-{i:02d}' for i in range(1, 15)] + ['EX-LOCK-03', 'OBSERVER_READ_ONLY', 'API TBD']

if __name__ == '__main__':
    s = steps()
    from collections import Counter
    c = Counter(x['journey_id'] for x in s)
    assert len(s) == 174, len(s)
    assert len(c) == 42
    assert len({x['step_id'] for x in s}) == 174
    print(len(s), len(c))
