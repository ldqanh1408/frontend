"""Figma oracle data, transcribed from read-only `use_figma` Plugin-API reads of file 0md9BEFI1rU0aRAvf98TWO (2026-10-05).

Sources (node ids are exact):
  * 04 · E2E Model / "Atlas/E2E Model/Planned inventory/Dark" (342:5): 210 rows, columns
    "View ID + name | Surface/module | Current Dark/Light nodes | Journey candidates | States/components | Notes | Presence status".
    Notes are stored by template key (the inventory repeats ~40 note templates; text truncated at 160 chars as read).
    Journey candidates are a function of Surface/module in every one of the 210 rows (checked during extraction), so they are
    stored once per surface.
  * 01 · Current UI · Dark (236:728) / 02 · Current UI · Light (254:728): 18 module frames "Atlas/<Theme>/<route>", 17 state
    frames "Atlas/<Theme>/States/<id>", 49 "<type> · unified fields" frames, 7 definition-state frames.
  * Field contract of the 49 unified-fields frames: children named "Field group · <group>" and "Field · <key>" (label at 14 px,
    hint at 12 px), badge "<n> fields · device draft", top bar "Atlas / <module> / Definitions".
Nothing was written to the Figma file.
"""
import csv, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FILE_KEY = '0md9BEFI1rU0aRAvf98TWO'

PAGES = [('258:728', '00 · Start here'), ('236:728', '01 · Current UI · Dark'), ('254:728', '02 · Current UI · Light'),
         ('132:728', '03 · Design system'), ('342:3', '04 · E2E Model'), ('359:592', '05 · Gap closure · Dark'),
         ('359:593', '06 · Gap closure · Light'), ('359:594', '07 · Prototype flows'), ('359:595', '08 · Dev handoff'),
         ('278:728', '90 · Archive')]

SURFACES = {
    'ide': 'Workspace identity', 'ten': 'Workspace tenancy', 'gw': 'Workspace gateway', 'ag': 'Workspace agents',
    'mem': 'Workspace memory', 'cfg': 'Workspace configuration', 'code': 'Workspace code', 'ex': 'Workspace execution',
    'sp': 'Workspace specifications', 'gov': 'Workspace governance', 'wf': 'Workspace workflow', 'sh': 'Workspace shell',
    'col': 'Workspace collaboration', 'obs': 'Observer observer',
}
_EX = 'UXJ-15 · UXJ-16 · UXJ-17 · UXJ-18 · UXJ-19 · UXJ-23 · UXJ-28 · UXJ-35 · UXJ-36 · UXJ-38 · UXJ-40 · UXJ-41'
JOURNEYS = {
    'ide': 'UXJ-01 · UXJ-02 · UXJ-27', 'ten': 'UXJ-01 · UXJ-03 · UXJ-27', 'gw': 'UXJ-04',
    'ag': 'UXJ-11 · UXJ-15 · UXJ-33 · UXJ-34 · UXJ-35 · UXJ-42', 'mem': 'UXJ-12 · UXJ-13 · UXJ-23 · UXJ-31 · UXJ-36',
    'cfg': 'UXJ-26', 'code': 'UXJ-03 · UXJ-10 · UXJ-13 · UXJ-21 · UXJ-32', 'ex': _EX,
    'sp': 'UXJ-05 · UXJ-06 · UXJ-07 · UXJ-08 · UXJ-09 · UXJ-22 · UXJ-29 · UXJ-30 · UXJ-31 · UXJ-36 · UXJ-39 · UXJ-40 · UXJ-42',
    'gov': 'UXJ-19 · UXJ-20 · UXJ-21 · UXJ-22 · UXJ-23 · UXJ-24 · UXJ-26 · UXJ-32 · UXJ-36 · UXJ-40 · UXJ-41 · UXJ-42',
    'wf': 'UXJ-13 · UXJ-14 · UXJ-15 · UXJ-16 · UXJ-31 · UXJ-36', 'sh': 'UXJ-01 · UXJ-05 · UXJ-28 · UXJ-40 · UXJ-41',
    'col': 'UXJ-07 · UXJ-09 · UXJ-24 · UXJ-31', 'obs': 'UXJ-25 · UXJ-28',
}
STATUS = {'M': 'Missing', 'P': 'Partial', 'V': 'Present · visual', 'R': 'Review scope'}
COMP = {'X': 'No exact Current visual established', 'P': 'Partial form/narrative/reference only', 'V': 'Default layout only'}
NOTES = {
    'n0': 'No dedicated Current visual for this exact intent/state was established. A module owner, sidebar link, field authoring, state-name list or Archive specimen does…',
    'nR': 'Internal review/gallery/index or overlapping scope entry. Proposed documentation/canonical-view consolidation only; removal/out-of-scope is NOT confirmed. Keep…',
    'nV': 'Dedicated default layout exists in both themes. This is visual presence only; business action links, full state matrix and lifecycle/code-ready DoD are not comp…',
    'ten': 'Organization/workspace/project or lifecycle request fields exist; first-run outcome, readiness, concurrent changes and impact/recovery screens are incomplete.',
    'acc': 'Current access shell and authoring fields cover a subset; account acceptance, role-specific data, permission transitions and recovery are incomplete.',
    'gw': 'Gateway/budget authoring and narrative inspection exist; actual provider/routing/ledger state screens and receipt branches are incomplete.',
    'res': 'Typed resource authoring exists; the resource-specific catalog, version/consumer impact, evaluation and activation journey are incomplete.',
    'mem': 'Memory fields and source/lineage references exist; import results, quarantine, reviewer decisions, promotions and retrieval states are incomplete.',
    'cfg': 'Scoped policy authoring exists; effective inheritance, review and permission-specific state screens are incomplete.',
    'code': 'Source IDE/import/query/index fields exist; provider-backed integration, semantic search, scan jobs, full call graph and repository evidence require specialized…',
    'agent': 'Agent authoring exists; evaluate/publish/default binding/assignment/readiness transitions lack dedicated click-through outcomes.',
    'spcat': 'The document tree and catalog reference exist; folder operations, large-volume results, import exceptions and relationship drill-down are incomplete.',
    'freeze': 'Freeze/cut/AI submission inspector is described; live lease/lock and frozen-edit recovery states lack complete UI and transitions.',
    'merge': 'Base/current/local/resolved revision concepts and recovery controls exist; actual comparison editor, repeated conflict and dirty/session guard branches are inco…',
    'ctx': 'Context/lineage inspector and exact saved-pin authoring exist; context review, excluded sources, budget and stale/revoked recovery branches are incomplete.',
    'wf': 'Local workflow graph/policy exists; plan/version/template review and generated-proposal decisions remain separate missing states/flows.',
    'task': 'Task execution contract and pins exist; approved immutable input lineage and contract-validity outcomes lack complete UI.',
    'run': 'Run shell and admission request fields exist; admitted/running graph, blocker resolution and command feedback branches are incomplete.',
    'attempt': 'Task/attempt/activity narrative inspector exists; live graph/list rows, attempt selectors, tool episodes and checkpoint transitions are incomplete.',
    'snap': 'Retry/resume request fields exist; snapshot selection/compatibility, protected confirmation and command outcomes are missing.',
    'gate': 'Review shell and review authoring exist; independent reviewer/quorum, signed gate, veto and stale approval layouts/flows are incomplete.',
    'pr': 'PR/review request authoring exists; eligibility slot selection, exact-head checks, merge fences and provider reconciliation screens are incomplete.',
    'accept': 'Merged revision and independent acceptance fields/reference exist; mandatory case outcomes, corrective delivery and memory closure lack connected states.',
    'ready': 'A disconnected checklist exists; authorized prerequisite details and resolution-to-ready transitions are missing.',
    'revoke': 'Session/audience recovery reference exists; dedicated mid-edit revocation, retained draft and sign-in return flow are incomplete.',
    'mcp': 'MCP consumer/lifecycle reference describes impact; no complete version impact and revoke/replacement interaction is provided.',
    'unk': 'A dedicated unknown-operation inspector preserves original identity; reconcile-result/error/re-auth/retry branches are incomplete.',
    'clean': 'Cleanup/fencing/retention inspector exists; resource-by-resource cleanup and explicit held/failed/recovery states are incomplete.',
    'pol': 'Policy lifecycle reference describes consumers/revisions; impact approval, activation and rollback feedback are not connected.',
    'ops': 'Operations handoff authoring exists; incident investigation, affected run context and authorized recovery handoff are incomplete.',
    'obs': 'Observer shell exists; no complete read-only diagnostic overview and drill-down flow.',
    'tel': 'Telemetry query authoring exists; agent telemetry results/units/freshness states are incomplete.',
    'exp': 'Diagnostic export request authoring exists; protected export list/download/revocation flow is incomplete.',
    'dq': 'Stale/data-quality reference exists; source-specific partial/missing/skew panels and recovery are incomplete.',
    'expjob': 'Export request fields exist; queued/running/partial/failed/expired artifact job states are missing.',
    'hand': 'Incident handoff fields exist; redacted evidence selection and receiving workspace/operator handoff are incomplete.',
    'ckpt': 'A checkpoint decision request editor exists; evidence review, role denial, stale revision and outcome branches are missing.',
    'cancel': 'A cancel/cleanup request editor exists; destructive scope/impact confirmation and Requested/Accepted/Unknown/Effective branches are missing.',
    'inspect': 'Task/input/access narrative inspection exists; exact instance data, focusable drill-down and stale/denied state interactions are incomplete.',
}
# view_id|title|surface|dark|light|component class+count|status|note   (row order = Figma order, 342:5)
_M = '|-|-|X0|M|n0'
INVENTORY_TXT = f"""
workspace/login|Sign in|ide{_M}
workspace/auth-help|Sign-in help|ide{_M}
workspace/invite|Accept invitation|ide{_M}
workspace/onboarding|Create organization|ten|236:4258|254:1894|P28|P|ten
workspace/projects|Projects|ten|236:4258|254:1894|P28|P|ten
workspace/project-new|Connect a repository|ten|236:4258|254:1894|P28|P|ten
workspace/setup-complete|Project ready|ten{_M}
workspace/members|Members & roles|ide|236:4007|254:1807|P28|P|acc
workspace/invitations|Pending invitations|ide|236:4007|254:1807|P28|P|acc
workspace/roles|Roles & permissions|ide|236:4007|254:1807|P28|P|acc
workspace/role-editor|Custom role editor|ide|236:4007|254:1807|P28|P|acc
workspace/access|Effective access|ide|236:4007|254:1807|P28|P|acc
workspace/gateway|LLM Gateway|gw|236:3226|254:1546|P28|P|gw
workspace/routing|Model routing & failover|gw|236:3226|254:1546|P28|P|gw
workspace/budgets|Budget allocation|gw|236:3226|254:1546|P28|P|gw
workspace/hub|MCP servers|ag|236:1866|254:1109|P28|P|res
workspace/skills|Skills|ag|236:1866|254:1109|P28|P|res
workspace/rules|Rules|ag|236:1866|254:1109|P28|P|res
workspace/plugins|Plugins|ag|236:1866|254:1109|P28|P|res
workspace/hooks|Lifecycle hooks|ag|236:1866|254:1109|P28|P|res
workspace/sidecars|Sandbox sidecars|ag|236:1866|254:1109|P28|P|res
workspace/memory|Memory Bank|mem|236:2967|254:1463|P28|P|mem
workspace/memory-settings|Memory retrieval settings|mem|236:2967|254:1463|P28|P|mem
workspace/memory-import|Import knowledge|mem|236:2967|254:1463|P28|P|mem
workspace/curation|Memory review queue|mem|236:2967|254:1463|P28|P|mem
workspace/settings|Organization settings|cfg|236:3752|254:1726|P28|P|cfg
workspace/runtime-settings|Runtime configuration|cfg|236:3752|254:1726|P28|P|cfg
workspace/risk-policy|Risk & approval policy|cfg|236:3752|254:1726|P28|P|cfg
workspace/integrations|Repository integration|code|236:1306|254:935|P28|P|code
workspace/default-agent|Organization default agent|ag|236:1608|254:1027|P29|P|agent
workspace/sandbox-templates|Sandbox templates|ex|236:1866|254:1109|P28|P|res
workspace/overview|Project overview|sh|236:729|254:729|V23|V|nV
workspace/specs|Specifications|sp|250:2813|254:2321|P4|P|spcat
workspace/editor|Specification IDE|sp|236:985|254:833|V29|V|nV
workspace/locked|Locked specification|sp|250:2991|254:2453|P4|P|freeze
workspace/history|Branches & version history|sp{_M}
workspace/spec-diff|Specification changes|sp{_M}
workspace/merge|Visual three-way merge|gov|250:2909|254:2389|P3|P|merge
workspace/code|Code explorer IDE|code|236:1306|254:935|V28|V|nV
workspace/search-code|Semantic code search|code|236:1306|254:935|P28|P|code
workspace/evidence|Code evidence|code|236:1306|254:935|P28|P|code
workspace/scan|Repository scan|code|236:1306|254:935|P28|P|code
workspace/drift|Doc-code drift|code{_M}
workspace/memory-prep|Prepare task memory|mem|250:3347|254:2717|P4|P|ctx
workspace/plans|Task plans|wf|236:2121|254:1190|P27|P|wf
workspace/plan-detail|Proposed task plan|wf|236:2121|254:1190|P27|P|wf
workspace/workflow|Workflow builder|wf|236:2121|254:1190|V27|V|nV
workspace/agent-compose|Compose an agent|ag|236:1608|254:1027|P29|P|agent
workspace/meta-agent|Generate workflow with AI|wf{_M}
workspace/contracts|Output contracts|ag|250:3437|254:2785|P4|P|task
workspace/runs|Agent runs|ex|236:2375|254:1269|P28|P|run
workspace/run-detail|Human checkpoint|ex|251:2903|254:2854|P6|P|attempt
workspace/terminal|Sandbox terminal|ex{_M}
workspace/activity-tree|Agent activity tree|ex|251:2903|254:2854|P6|P|attempt
workspace/artifacts|Run artifacts|ex{_M}
workspace/snapshot|Snapshot recovery|ex|301:8269|301:109228|P26|P|snap
workspace/sandboxes|Sandboxes & locks|ex{_M}
workspace/locks|File lock ownership|ex{_M}
workspace/gates|Governance queue|gov|236:2674|254:1366|P28|P|gate
workspace/gate-detail|High-risk approval gate|gov|236:2674|254:1366|P28|P|gate
workspace/gate-medium|Medium-risk approval gate|gov|236:2674|254:1366|P28|P|gate
workspace/diff-review|Collaborative code review|gov{_M}
workspace/security|Security findings|gov{_M}
workspace/pull-request|Pull request & CI|gov|236:2674|254:1366|P28|P|pr
workspace/ci-failed|CI failed|gov{_M}
workspace/pr-conflict|Pull request conflict|gov{_M}
workspace/post-merge|Post-merge verification|gov|251:3202|254:3064|P4|P|accept
workspace/audit|Audit ledger|gov{_M}
workspace/notifications|Notifications|col{_M}
workspace/exceptions|State & exception catalog|code|-|-|X0|R|nR
workspace/components|Component states|code|-|-|X0|R|nR
workspace/index|Screen index|code|-|-|X0|R|nR
workspace/setup-readiness|Project readiness|ten|236:729|254:729|P23|P|ready
workspace/invite-identity|Invitation identity check|ide{_M}
workspace/access-revoked|Access changed|ide|251:3408|254:3210|P4|P|revoke
workspace/repo-reconcile|Repository reconciliation|ten{_M}
workspace/budget-ledger|Budget & usage ledger|gw|236:3226|254:1546|P28|P|gw
workspace/registry-impact|Resource version impact|ag|250:3255|254:2651|P4|P|mcp
workspace/memory-lineage|Knowledge provenance|mem|250:3347|254:2717|P4|P|ctx
workspace/workflow-proposal|Review proposed workflow|wf|236:2121|254:1190|P27|P|wf
workspace/draft-recovery|Recover local edits|sp|250:2909|254:2389|P3|P|merge
workspace/stale-merge|Merge review is out of date|gov|250:2909|254:2389|P3|P|merge
workspace/input-lineage|Approved input lineage|sp|250:3437|254:2785|P4|P|task
workspace/greenfield|New implementation review|code{_M}
workspace/generation-job|Plan preparation job|wf{_M}
workspace/admission|Task admission & blockers|ex|236:2375|254:1269|P28|P|run
workspace/artifact-handoff|Artifact handoff & integration|ex{_M}
workspace/recovery|Execution recovery|ex|251:3018|254:2927|P5|P|unk
workspace/secret-triage|Security incident triage|gov{_M}
workspace/reviewer-eligibility|Independent reviewer eligibility|ide|236:2674|254:1366|P28|P|pr
workspace/signature-history|Signature history|gov{_M}
workspace/pr-reconcile|Resolve uncertain PR outcome|gov|251:3018|254:2927|P5|P|unk
workspace/acceptance|Acceptance evidence|gov|251:3202|254:3064|P4|P|accept
workspace/cleanup|Cleanup & retained evidence|ex|251:3107|254:2995|P4|P|clean
workspace/offboarding|Offboarding & project archive|ide|236:4258|254:1894|P28|P|ten
workspace/policy-impact|Policy change impact|cfg|251:3498|254:3278|P4|P|pol
workspace/incident-recovery|Operational recovery handoff|cfg|236:5048|254:2164|P27|P|ops
workspace/business-states|Business state gallery|code|-|-|X0|R|nR
workspace/design-journeys|E2E design walkthroughs|code|-|-|X0|R|nR
workspace/code-symbols|Symbol table & call graph|code|236:1306|254:935|P28|P|code
workspace/ai-context|Review AI context|mem|250:3347|254:2717|P4|P|ctx
workspace/ide-states|IDE state gallery|code|-|-|X0|R|nR
workspace/organizations|Organizations|ten|236:4258|254:1894|P28|P|ten
workspace/workspaces|Workspaces & projects|ten|236:4258|254:1894|P28|P|ten
workspace/workspace-settings|Workspace settings|ten|236:4258|254:1894|P28|P|ten
workspace/workflow-templates|Workflow templates|wf|236:2121|254:1190|P27|P|wf
workspace/conflicts|Specification conflicts|sp|250:2909|254:2389|P3|P|merge
workspace/memory-layers|Memory layers|mem|236:2967|254:1463|P28|P|mem
workspace/risk-review|Risk & security review|gov|236:2674|254:1366|P28|P|gate
workspace/wf-review|WF integration review|sh|236:2121|254:1190|P27|P|wf
workspace/ide-journeys|IDE end-to-end journeys|sp|-|-|X0|R|nR
workspace/scope-workspaces|Workspaces & projects|ten|-|-|X0|R|nR
workspace/execution|Agent execution|ex|236:2375|254:1269|P28|P|run
workspace/execution-states|Execution states|ex|-|-|X0|R|nR
observer/obs-login|Observer sign in|obs{_M}
observer/obs-overview|System overview|obs|236:5048|254:2164|P27|P|obs
observer/traces|Distributed traces|obs{_M}
observer/trace-detail|Trace waterfall|obs{_M}
observer/metrics|Metrics & logs|obs{_M}
observer/profiler|Continuous profiler|obs{_M}
observer/telemetry|Agent telemetry|obs|303:118726|303:119563|P26|P|tel
observer/infra|Sandbox infrastructure|obs{_M}
observer/saturation|Collaboration & lock saturation|obs{_M}
observer/obs-audit|Diagnostic audit explorer|obs{_M}
observer/exports|Telemetry export center|obs|303:119989|303:120819|P26|P|exp
observer/index|Observer screen index|obs|-|-|X0|R|nR
observer/data-quality|Telemetry data quality|obs|251:3788|254:3486|P4|P|dq
observer/export-job|Diagnostic export job|obs|303:119989|303:120819|P26|P|expjob
observer/profile-compatibility|Profile comparison readiness|obs{_M}
observer/diagnostic-handoff|Incident evidence handoff|obs|303:120414|303:121244|P26|P|hand
workspace/state-wrong-account|wrong-account|ide{_M}
workspace/state-expired-invitation|expired-invitation|ide{_M}
workspace/state-access-changed|access-changed|sh{_M}
workspace/state-repo-disconnected|repo-disconnected|code{_M}
workspace/state-budget-blocked|budget-blocked|gw{_M}
workspace/state-resource-revoked|resource-revoked|ag{_M}
workspace/state-memory-deprecated|memory-deprecated|mem{_M}
workspace/state-offline-draft|offline-draft|sp{_M}
workspace/state-merge-stale|merge-stale|gov{_M}
workspace/state-input-superseded|input-superseded|sh{_M}
workspace/state-empty-repository|empty-repository|code{_M}
workspace/state-generation-failed|generation-failed|sh{_M}
workspace/state-checkpoint-required|checkpoint-required|sh{_M}
workspace/state-artifact-not-durable|artifact-not-durable|sh{_M}
workspace/state-snapshot-unavailable|snapshot-unavailable|ex{_M}
workspace/state-scanner-unavailable|scanner-unavailable|code{_M}
workspace/state-secret-confirmed|secret-confirmed|gov{_M}
workspace/state-reviewer-missing|reviewer-missing|ide{_M}
workspace/state-old-head-ci|old-head-ci|sh{_M}
workspace/state-pr-unknown|pr-unknown|sh{_M}
workspace/state-partial-merge|partial-merge|gov{_M}
workspace/state-acceptance-failed|acceptance-failed|gov{_M}
workspace/state-verification-unknown|verification-unknown|gov{_M}
workspace/state-cleanup-held|cleanup-held|ex{_M}
workspace/state-project-archived|project-archived|sh{_M}
workspace/state-restore-reconcile|restore-reconcile|sh{_M}
workspace/ide-state-source-loading|Source loading|sp{_M}
workspace/ide-state-source-failed|Source unavailable|sp{_M}
workspace/ide-state-source-denied|Repository access revoked|sp{_M}
workspace/ide-state-source-empty|Empty repository|sp{_M}
workspace/ide-state-binary-file|Unsupported binary file|sp{_M}
workspace/ide-state-large-file|File too large|sp{_M}
workspace/ide-state-stale-index|Commit and AST mismatch|code{_M}
workspace/ide-state-partial-index|Partial index|code{_M}
workspace/ide-state-offline-draft|Offline document edit|sp{_M}
workspace/ide-state-dirty-tab|Close an unsaved tab|sp{_M}
workspace/ide-state-frozen-draft|Server froze while editing|sp{_M}
workspace/ide-state-stale-context|Context revision changed|mem{_M}
workspace/v6-state-spec-acceptance|Specification IDE · acceptance inspector|gov{_M}
workspace/v6-state-code-linked-spec|Code IDE · notification specification|code{_M}
workspace/v6-state-greenfield-context|New implementation · review context|mem{_M}
workspace/v6-state-context-confirm|Confirm the exact specification and source|mem{_M}
workspace/v6-state-multi-spec-plan|Notification implementation proposal|wf{_M}
workspace/v6-state-context-review|Review source payload and specification|mem{_M}
workspace/v6-state-context-revoked|Revoked context · stop and recover|mem{_M}
workspace/v6-state-scope-confirm|Keep drafts in original workspace|mem{_M}
workspace/execution-state-empty|execution state empty|ex{_M}
workspace/execution-state-parallel|execution state parallel|ex{_M}
workspace/execution-state-checkpoint|execution state checkpoint|ex{_M}
workspace/execution-state-failed|execution state failed|ex{_M}
workspace/execution-state-budget|execution state budget|gw{_M}
workspace/execution-state-paused|execution state paused|ex{_M}
workspace/execution-state-cleanup-error|execution state cleanup error|ex{_M}
workspace/execution-state-completed|execution state completed|ex{_M}
workspace/execution-detail-terminal|execution detail terminal|ex{_M}
workspace/execution-detail-artifacts|execution detail artifacts|ex{_M}
workspace/execution-detail-memory|execution detail memory|mem{_M}
workspace/execution-command-requested|execution command requested|ex{_M}
workspace/execution-command-accepted|execution command accepted|ex{_M}
workspace/execution-command-outcome-unknown|execution command outcome unknown|ex|251:3018|254:2927|P5|P|unk
workspace/execution-dialog-checkpoint|execution dialog checkpoint|ex|300:110478|300:111285|P26|P|ckpt
workspace/execution-dialog-cancel|execution dialog cancel|ex|301:8683|301:109634|P26|P|cancel
workspace/execution-dialog-resume|execution dialog resume|ex|301:8269|301:109228|P26|P|snap
workspace/execution-dialog-retry|execution dialog retry|ex|301:8269|301:109228|P26|P|snap
workspace/execution-agent-t-01|execution agent t 01|ex{_M}
workspace/execution-agent-t-03|execution agent t 03|ex{_M}
workspace/execution-agent-t-04|execution agent t 04|ex{_M}
workspace/execution-agent-t-05|execution agent t 05|ex{_M}
workspace/execution-agent-t-06|execution agent t 06|ex{_M}
workspace/execution-agent-t-07|execution agent t 07|ex{_M}
workspace/execution-inspector-context|execution inspector context|mem|250:3437|254:2785|P4|P|inspect
workspace/execution-inspector-access|execution inspector access|ex|250:3437|254:2785|P4|P|inspect
workspace/execution-dialog-snapshot|execution dialog snapshot|ex|301:8269|301:109228|P26|P|snap
workspace/execution-dialog-lineage|execution dialog lineage|ex|250:3437|254:2785|P4|P|inspect
workspace/execution-dialog-manifest|execution dialog manifest|ex|250:3437|254:2785|P4|P|inspect
workspace/execution-permission-viewer|execution permission viewer|ide{_M}
workspace/execution-command-approve-gate-requested|execution command approve gate requested|ex{_M}
workspace/execution-command-cancel-requested|execution command cancel requested|ex{_M}
workspace/execution-command-resume-requested|execution command resume requested|ex{_M}
workspace/execution-command-retry-requested|execution command retry requested|ex{_M}
"""

# Current UI frames (01/02). kind: module (route = deployed hash route of the same name), state, def (unified fields), defstate.
MODULE_FRAMES = {  # route: (dark, light)
    'home': ('236:729', '254:729'), 'specifications': ('236:985', '254:833'), 'code': ('236:1306', '254:935'),
    'collaboration': ('236:3496', '254:1638'), 'agents': ('236:1608', '254:1027'), 'resources': ('236:1866', '254:1109'),
    'workflow': ('236:2121', '254:1190'), 'memory': ('236:2967', '254:1463'), 'execution': ('236:2375', '254:1269'),
    'governance': ('236:2674', '254:1366'), 'gateway': ('236:3226', '254:1546'), 'configuration': ('236:3752', '254:1726'),
    'identity': ('236:4007', '254:1807'), 'tenancy': ('236:4258', '254:1894'), 'saas': ('236:4512', '254:1982'),
    'desktop': ('236:4776', '254:2072'), 'observer': ('236:5048', '254:2164'), 'connection': ('236:5309', '254:2253'),
}
STATE_FRAMES = {  # id: (dark, light, title, owner route)
    'SP-Catalog': ('250:2813', '254:2321', 'Specifications · catalog, outline and relationships', 'specifications'),
    'SP-Conflict': ('250:2909', '254:2389', 'Specifications · resolve a revision conflict', 'specifications'),
    'SP-Freeze': ('250:2991', '254:2453', 'Specifications · freeze and submit deliberately', 'specifications'),
    'CI-Coverage': ('251:3305', '254:3137', 'Code intelligence · exact source and semantic coverage', 'code'),
    'AG-Readiness': ('250:3078', '254:2518', 'Agent · readiness is independent from publication', 'agents'),
    'AG-Guardrails': ('250:3168', '254:2586', 'Agent · guardrails and tool permissions', 'agents'),
    'RS-MCP': ('250:3255', '254:2651', 'Resources · MCP lifecycle and consumers', 'resources'),
    'MM-Context': ('250:3347', '254:2717', 'Memory · source lineage and context budget', 'memory'),
    'WF-Task': ('250:3437', '254:2785', 'Workflow · task inspector and immutable inputs', 'workflow'),
    'EX-TaskAttempt': ('251:2903', '254:2854', 'Execution · task, attempt and agent activity', 'execution'),
    'CMD-Unknown': ('251:3018', '254:2927', 'Operation · reconcile an unknown outcome', 'connection'),
    'EX-Cleanup': ('251:3107', '254:2995', 'Execution · cancellation, fencing and cleanup', 'execution'),
    'RV-Acceptance': ('251:3202', '254:3064', 'Delivery · independent acceptance at the merged revision', 'governance'),
    'IAM-Scope': ('251:3408', '254:3210', 'Access · session recovery and audience boundaries', 'identity'),
    'CFG-Policy': ('251:3498', '254:3278', 'Configuration · review, activate and roll back policy', 'configuration'),
    'SAAS-Budget': ('251:3598', '254:3348', 'Budget and billing · reserve, observe and reconcile', 'saas'),
    'DT-Unavailable': ('251:3693', '254:3417', 'Desktop · runtime installation and recovery', 'desktop'),
    'OB-Stale': ('251:3788', '254:3486', 'Observer · stale data, alerts and operator actions', 'observer'),
}
DEF_STATE_FRAMES = {
    'Unified definition catalogue': ('307:13273', '307:119977'), 'Definition state · validation': ('307:13679', '307:120381'),
    'Definition state · history': ('307:13711', '307:120411'), 'Definition state · archive': ('307:13743', '307:120441'),
    'Definition state · conflict': ('307:13773', '307:120471'), 'Definition state · handoff': ('307:13803', '307:120501'),
    'Definition state · revision-pins': ('326:13736', '326:27605'),
}

# Navigation IA shown identically in every Current UI module frame.
NAV = [('BUILD', ['Overview', 'Specifications', 'Code intelligence', 'Agents', 'Resources', 'Workflow & planning', 'Runs & activity',
                  'Reviews & delivery']),
       ('KNOWLEDGE & SERVICES', ['Memory & context', 'AI access & budget', 'Collaboration', 'Configuration & policy']),
       ('ADMINISTRATION', ['People & access', 'Organization & projects', 'Usage, billing & data', 'Desktop & runtime',
                           'Operations observer', 'Connection & receipts'])]
NAV_ROUTE = {'Overview': 'home', 'Specifications': 'specifications', 'Code intelligence': 'code', 'Agents': 'agents',
             'Resources': 'resources', 'Workflow & planning': 'workflow', 'Runs & activity': 'execution',
             'Reviews & delivery': 'governance', 'Memory & context': 'memory', 'AI access & budget': 'gateway',
             'Collaboration': 'collaboration', 'Configuration & policy': 'configuration', 'People & access': 'identity',
             'Organization & projects': 'tenancy', 'Usage, billing & data': 'saas', 'Desktop & runtime': 'desktop',
             'Operations observer': 'observer', 'Connection & receipts': 'connection'}
SHELL = ['Browse definitions', 'Search workspace', 'Device drafts / disconnected service', 'Acknowledgement ≠ effective execution']

# Structural copy per module frame (title, purpose, controls). Illustrative sample content ("Authentication.md", code lines,
# "Implementation assistant", digests) is deliberately excluded: the frames carry the banner "Design example · Illustrative UI
# content". Strings ending in "…" were truncated at 90 chars during extraction and are matched as prefixes.
_SVC_COMMON = ['Refresh', 'Connect service', 'Name', 'State', 'Revision', 'Observed', 'Connect this lifecycle', 'Lifecycle',
               'Continue the journey', 'Select a resource', 'Grants and a resource revision are required before acting.',
               'Connect a service session to inspect action preconditions.', 'Inspect before acting', 'Operation receipts',
               'No operations recorded for this session scope.']
_DRAFT_COMMON = ['Service lifecycle', 'DEVICE DRAFTS', 'Validate draft', 'Evaluate', 'Publish', 'Assign', 'Save draft',
                 'Publishing and runnable readiness require service receipts.', 'Export draft']
MODULE_EXPECT = {
    'home': {'title': 'Turn specifications into traceable work', 'purpose': 'Author requirements, inspect source and prepare agent work with explicit checkpoints.',
             'controls': ['Connect workspace', 'Document drafts', 'Agent drafts', 'Workflow drafts', 'Workspace session',
                          'Build your first complete journey', 'Define the outcome', 'Inspect the source', 'Constrain the agent',
                          'Plan and admit work', 'Workspace readiness', 'Service observation required', 'Repository',
                          'Provider & budget', 'Runtime capabilities',
                          'Local drafts are usable before connecting. Production execution is not verified.']},
    'specifications': {'title': 'Specifications', 'purpose': 'Review, freeze, submit and reconcile shared document revisions.',
                       'controls': ['Import', 'New folder', 'New document', 'DOCUMENTS', 'Search catalog', 'Create revision cut',
                                    'Folder catalog ≠ document outline', 'Source', 'Preview', 'Request review', 'Freeze',
                                    'Submit to AI', 'Export source', 'Save draft', 'Outline', 'Requirements', 'DOCUMENT OUTLINE',
                                    'Document lifecycle', 'In review', 'Merged', 'Locked / frozen manifest', 'Submitted to AI',
                                    'Implemented after acceptance', 'Connect review and freeze services before submission.',
                                    'Resolve connection']},
    'code': {'title': 'Code intelligence', 'purpose': 'Inspect exact refs, full commit IDs, index quality and repository integration receipts.',
             'controls': ['Connect repository', 'Import folder', 'LOCAL SOURCE SNAPSHOT', 'Search source', 'Literal content search',
                          'Definition', 'References', 'History', 'Add to context', 'Edit workspace',
                          'Read-only · local snapshot · not a Git commit', 'Symbols & quality', 'Coverage boundary',
                          'Analyze JS/TS', 'Export source manifest']},
    'collaboration': {'title': 'Collaboration', 'purpose': 'Track shared room epochs, durable acknowledgements, comments and unresolved edits.',
                      'controls': _SVC_COMMON + ['Disconnected / Joining / Syncing / Durable ACK / Offline / Epoch changed / Conflict',
                                                 'Document IDE', 'Review inbox', 'Join room', 'Reconnect', 'Resolve conflict', 'Comment',
                                                 'Request freeze barrier', 'Room', 'Acknowledgements', 'Presence', 'Comments']},
    'agents': {'title': 'Agents', 'purpose': 'Evaluate definitions, pin resource versions and make explicit assignments.',
               'controls': _DRAFT_COMMON + ['New agent', 'Instructions', 'Model', 'Tools', 'Memory', 'Guardrails', 'Readiness', 'Versions',
                                            'Provider / model', 'Runtime / budget']},
    'resources': {'title': 'Resource registry', 'purpose': 'Manage MCP, skills, rules, plugins, hooks and sidecars with explicit version pins.',
                  'controls': _DRAFT_COMMON + ['New resource', 'Definition', 'Readiness', 'Versions', 'Consumers', 'Resource type',
                                               'Endpoint / artifact reference',
                                               'Discovery does not allow execution. Compatibility and health must be observed.']},
    'workflow': {'title': 'Workflow definitions & plans', 'purpose': 'Validate versioned task graphs, review generated plans and resolve admission blockers.',
                 'controls': ['Agent definitions', 'New workflow', 'Add task', 'Validate draft', 'Generate with AI', 'Activate',
                              'Admit run', 'Save draft', 'Graph', 'Task list', 'Pins & inputs', 'Human checkpoint',
                              'Local graph validation ≠ admitted execution', 'Inspect service admission', 'Export workflow draft']},
    'memory': {'title': 'Memory & context', 'purpose': 'Curate typed knowledge, inspect lineage and assemble bounded, revision-aware context.',
               'controls': _DRAFT_COMMON + ['New memory', 'Definition', 'Content', 'Lineage', 'Context package', 'Readiness', 'Versions',
                                            'Layer', 'Source revision / snapshot', 'Knowledge type', 'Source digest']},
    'execution': {'title': 'Runs & agent activity', 'purpose': 'Observe runs, tasks, attempts and tools; reconcile controls and verify cleanup.',
                  'controls': _SVC_COMMON + ['Agent definition', 'Plan', 'Delivery acceptance', 'Operations', 'Admit run', 'Pause', 'Resume',
                                             'Cancel', 'Approve', 'Reject', 'Retry task', 'Restore snapshot', 'Reconcile',
                                             'Inspect cleanup', 'Tasks', 'Agent activity', 'Tools', 'Logs & PTY']},
    'governance': {'title': 'Reviews & delivery', 'purpose': 'Check independent approvals, actual PR and CI state, merge fences and acceptance evidence.',
                   'controls': _SVC_COMMON + ['Run evidence', 'Requirement source', 'Repository', 'Run preflight', 'Request review',
                                              'Approve', 'Reject', 'Create PR', 'Reconcile PR', 'Merge', 'Verify acceptance',
                                              'Close delivery', 'Corrective action', 'Export evidence', 'Preflight',
                                              'Reviewer eligibility', 'Requirements', 'PR & CI']},
    'gateway': {'title': 'AI access & budget', 'purpose': 'Manage provider credentials, routing, capability checks and spend reservations.',
                'controls': _SVC_COMMON + ['Agent readiness', 'Run admission', 'Billing', 'Add credential', 'Test provider', 'Set routing',
                                           'Reserve budget', 'Rotate credential', 'Revoke credential', 'Reconcile usage', 'Provider',
                                           'Credential references', 'Routing', 'Health']},
    'configuration': {'title': 'Configuration & policy', 'purpose': 'Inspect inheritance, effective overrides, revision conflicts and runtime capabilities.',
                      'controls': _DRAFT_COMMON + ['New policy draft', 'Definition', 'Readiness', 'Versions', 'Consumers', 'Proposed scope',
                                                   'Change reason', 'Policy JSON', 'Rollback proposal',
                                                   'A local draft does not change effective organization policy.']},
    'identity': {'title': 'People & access', 'purpose': 'Manage membership, invitations, effective permissions and session recovery.',
                 'controls': _SVC_COMMON + ['Invited / Active / Suspended / Revoked', 'Organization settings', 'Separate observer session',
                                            'Invite member', 'Change role', 'Revoke sessions', 'Offboard', 'Membership',
                                            'Effective permissions', 'Sessions', 'Audit']},
    'tenancy': {'title': 'Organization & projects', 'purpose': 'Select a scope, inspect onboarding blockers and manage project lifecycle.',
                'controls': _SVC_COMMON + ['Draft / Onboarding / Ready / Archived / Deletion pending', 'Provider access', 'Policies',
                                           'Create project', 'Transfer ownership', 'Archive', 'Request deletion', 'Readiness', 'Scope',
                                           'Impact']},
    'saas': {'title': 'Usage, billing & data', 'purpose': 'Inspect entitlements, seat quotas, invoice reconciliation and tenant data lifecycle.',
             'controls': _SVC_COMMON + ['Spend reservations', 'Membership', 'Audit evidence', 'Manage seats', 'Change entitlement',
                                        'Reconcile invoice', 'Request data export', 'Set retention', 'Request erasure', 'Seats & quotas',
                                        'Usage', 'Reservations', 'Invoices']},
    'desktop': {'title': 'Desktop & local runtime', 'purpose': 'Inspect device-bound sessions, local capabilities, runtime compatibility and update recove…',
                'controls': _SVC_COMMON + ['Local source import', 'Runtime policy', 'Runs', 'Pair device', 'Check runtime', 'Open terminal',
                                           'Schedule run', 'Check updates', 'Apply update', 'Revoke device', 'Device session',
                                           'Repositories', 'Runtime & PTY', 'Scheduling']},
    'observer': {'title': 'Operations observer', 'purpose': 'Inspect timestamped telemetry, drill into traces and coordinate diagnostics with a separat…',
                 'controls': _SVC_COMMON + ['Disconnected / Receiving / Partial / Stale / Incident / Recovery pending / Observed',
                                            'Workspace runs', 'Policy capabilities', 'Refresh telemetry', 'Inspect trace',
                                            'Export diagnostics', 'Check readiness', 'Request recovery', 'Acknowledge incident',
                                            'Metrics', 'Traces', 'Logs', 'Profiles']},
    'connection': {'title': 'Connection & operation receipts', 'purpose': 'Connect your service and reconcile uncertain effects.',
                   'controls': ['Export device drafts', 'Service connection', 'Disconnected', 'Audience', 'Workspace',
                                'Observer uses a separate session.', 'Service URL', 'No credentials in the URL.', 'Connect',
                                'Session & operation receipts', 'No authenticated session', 'Received / Accepted',
                                'Acknowledgement only. The effect is not yet verified.', 'Effective',
                                'Requires a matched operation, scope, input fingerprint and effect readback.', 'Unknown',
                                'Preserve the original operation ID and reconcile before retrying.']},
}
SERVICE_TAB_ROUTES = ['collaboration', 'execution', 'governance', 'gateway', 'identity', 'tenancy', 'saas', 'desktop', 'observer']

# ---- 49 unified-fields frames: field contract -------------------------------------------------------------------------------
# Header: @title|figma module|field count|schema label in status bar|dark node|light node
# '@OWN' = standard Ownership group (targetScope*, ownerRef*, description, labels, changeReason).
# Field: key|label|hint-code. Hint codes: R required (label ends " *"), L list, J JSON, P exact pins, H https, V vault ref,
# T ISO-8601 timestamp, U:<unit>:<range>, O:<options>, '' none.
DEF_TXT = r"""
@Agent definition|Agents|35|agent|294:2320|294:97049
@OWN
#Instructions
instructions|System instructions *|R
responsibilities|Responsibility and boundaries|
escalationPolicy|Escalation and human handoff|
#Model
model|Pinned model resource reference *|R
temperature|Sampling temperature|U:ratio:0–2
topP|Top P|U:ratio:0–1
maxOutputTokens|Maximum output tokens|U:tokens:1–2000000
#Dependencies
tools|Tool references|L
resourcePins|Resource revision pins|P
memoryPins|Memory revision pins|P
skillPins|Skill revision pins|P
rulePins|Rule revision pins|P
pluginPins|Plugin revision pins|P
hookPins|Hook revision pins|P
sidecarPins|Sidecar revision pins|P
#Safety
guardrails|Guardrails|J
allowedPaths|Writable paths|L
deniedPaths|Denied paths|L
allowedDomains|Network domain allowlist|L
humanApproval|Require human approval|
#Output
outputSchema|Output JSON schema|J
#Release
evaluationSuiteRef|Evaluation suite reference|
replacementRef|Replacement version reference|
#Limits
timeoutSeconds|Attempt timeout|U:seconds:1–86400
retryMaxAttempts|Maximum attempts|U:attempts:1–20
retryBackoffSeconds|Initial retry delay|U:seconds:0–3600
maxConcurrency|Maximum concurrency|U:workers:1–1000
tokenBudget|Token budget|U:tokens:1–2000000
budget|Cost ceiling|U:USD:0–1000000
currency|Budget currency|O:USD
@Model resource|Resources|29|model-resource|297:2608|297:98151
@OWN
#Connection
type|Resource type|O:model
provider|Provider adapter|O:openai, anthropic, google, azure, openai-compatible, local
endpoint|Provider API endpoint|H
model|Provider model ID *|R
credentialReference|Credential vault reference|V
apiVersion|API version|
region|Provider region|
#Dependencies
capabilities|Declared capabilities|L
allowlist|Allowed invocation capabilities|L
#Limits
contextWindowTokens|Context window|U:tokens:1–2000000
maxOutputTokens|Maximum output|U:tokens:1–2000000
rateLimitRpm|Requests per minute|U:requests/minute:1–1000000
rateLimitTpm|Tokens per minute|U:tokens/minute:1–100000000
timeoutSeconds|Attempt timeout|U:seconds:1–86400
retryMaxAttempts|Maximum attempts|U:attempts:1–20
retryBackoffSeconds|Initial retry delay|U:seconds:0–3600
maxConcurrency|Maximum concurrency|U:workers:1–1000
tokenBudget|Token budget|U:tokens:1–2000000
budget|Cost ceiling|U:USD:0–1000000
currency|Budget currency|O:USD
#Capabilities
supportsTools|Declared tool calling|
supportsStructuredOutput|Declared structured output|
supportsVision|Declared image input|
#Advanced
policy|Resource policy|J
@MCP server|Resources|29|mcp-resource|297:3139|297:98674
@OWN
#Connection
type|Resource type|O:mcp
transport|Transport|O:streamable-http, stdio
endpoint|Server endpoint|H
command|Executable for desktop stdio|
args|Executable arguments|L
environmentRefs|Environment vault references|J
credentialReference|Credential vault reference|V
authMode|Authentication mode|O:none, oauth, vault-reference
oauthScopes|Requested OAuth scopes|L
#Compatibility
protocolVersion|MCP protocol version|
#Dependencies
capabilities|Requested server capabilities|L
allowlist|Allowed tool IDs|L
deniedTools|Denied tool IDs|L
#Safety
inputPolicy|Tool input constraints|J
outputPolicy|Tool output constraints|J
humanApproval|Require invocation approval|
#Limits
discoveryTtlSeconds|Discovery freshness window|U:seconds:1–86400
timeoutSeconds|Attempt timeout|U:seconds:1–86400
retryMaxAttempts|Maximum attempts|U:attempts:1–20
retryBackoffSeconds|Initial retry delay|U:seconds:0–3600
maxConcurrency|Maximum concurrency|U:workers:1–1000
tokenBudget|Token budget|U:tokens:1–2000000
budget|Cost ceiling|U:USD:0–1000000
currency|Budget currency|O:USD
@Tool contract|Resources|22|tool-resource|298:3198|298:99311
@OWN
#Definition
type|Resource type|O:tool
adapterRef|Implementation adapter reference *|R
#Contract
inputSchema|Input JSON schema|J
outputSchema|Output JSON schema|J
#Safety
effect|Declared effect|O:read-only, write, external-side-effect
humanApproval|Require human approval|
idempotent|Declared idempotent effect|
#Dependencies
capabilities|Required capabilities|L
allowlist|Granted invocation boundaries|L
#Advanced
policy|Tool policy|J
#Limits
timeoutSeconds|Attempt timeout|U:seconds:1–86400
retryMaxAttempts|Maximum attempts|U:attempts:1–20
retryBackoffSeconds|Initial retry delay|U:seconds:0–3600
maxConcurrency|Maximum concurrency|U:workers:1–1000
tokenBudget|Token budget|U:tokens:1–2000000
budget|Cost ceiling|U:USD:0–1000000
currency|Budget currency|O:USD
@Sandbox template|Resources|29|sandbox-resource|298:3700|298:99805
@OWN
#Runtime
type|Resource type|O:sandbox
runtime|Runtime|O:gvisor
imageRef|Immutable image digest *|R
#Limits
cpuMillis|CPU limit|U:millicores:100–64000
memoryMiB|Memory limit|U:MiB:128–262144
diskMiB|Ephemeral storage|U:MiB:128–1048576
timeoutSeconds|Attempt timeout|U:seconds:1–86400
retryMaxAttempts|Maximum attempts|U:attempts:1–20
retryBackoffSeconds|Initial retry delay|U:seconds:0–3600
maxConcurrency|Maximum concurrency|U:workers:1–1000
tokenBudget|Token budget|U:tokens:1–2000000
budget|Cost ceiling|U:USD:0–1000000
currency|Budget currency|O:USD
#Safety
allowNetwork|Allow network|
allowedDomains|Egress domain allowlist|L
allowedPaths|Writable paths|L
mounts|Mount declarations|J
environmentRefs|Environment references|J
#Dependencies
capabilities|Runtime capabilities|L
allowlist|Granted runtime capabilities|L
#Connection
credentialReference|Credential vault reference|V
#Lifecycle
cleanupDeadlineSeconds|Cleanup deadline|U:seconds:1–86400
artifactRetention|Artifact retention|O:policy-reference, delete-after-acceptance
retentionPolicyRef|Retention policy reference|
@Agent skill|Resources|17|skill-resource|298:100339|298:102187
@OWN
#Definition
type|Resource type|O:skill
instructions|Skill instructions *|R
#Provenance
sourceUrl|Source URL|H
sourceRevision|Immutable source revision|
license|License identifier|
#Dependencies
capabilities|Required capabilities|L
dependencies|Exact dependencies|P
#Compatibility
supportedRuntimes|Compatible runtimes|L
#Safety
allowedTools|Allowed tools|L
#Contract
inputSchema|Input JSON schema|J
outputSchema|Output JSON schema|J
#Lifecycle
replacementRef|Replacement revision|
@Agent rule|Resources|14|rule-resource|298:100816|298:102664
@OWN
#Definition
type|Resource type|O:rule
ruleText|Rule content *|R
#Safety
severity|Enforcement level|O:advisory, block, approval-required
#Scope
applicableTaskTypes|Applicable task types|L
allowedPaths|Allowed paths|L
#Policy
condition|Applicability predicate|J
enforcement|Enforcement policy|J
#Lifecycle
effectiveFrom|Effective from|T
replacementRef|Replacement revision|
@Agent plugin|Resources|17|plugin-resource|298:101257|298:103105
@OWN
#Definition
type|Resource type|O:plugin
packageRef|Immutable package / artifact reference *|R
#Provenance
integrityHash|Artifact SHA-256 *|R
license|License identifier|
#Compatibility
supportedRuntimes|Compatible runtimes|L
#Dependencies
capabilities|Requested capabilities|L
allowlist|Allowed invocation capabilities|L
dependencies|Pinned dependencies|P
#Advanced
configuration|Plugin configuration|J
#Contract
inputSchema|Configuration schema|J
#Connection
credentialReference|Credential vault reference|V
#Safety
humanApproval|Require activation approval|
@Lifecycle hook|Resources|15|hook-resource|298:101742|298:103590
@OWN
#Definition
type|Resource type|O:hook
event|Lifecycle trigger|O:before-task, after-task, before-tool, after-tool, on-failure, on-cleanup
handlerRef|Pinned handler reference *|R
#Safety
failurePolicy|Hook failure policy|O:block, warn, retry
humanApproval|Require human approval|
#Contract
inputSchema|Input JSON schema|J
#Dependencies
capabilities|Required capabilities|L
allowlist|Allowed effects|L
#Limits
timeoutSeconds|Timeout|U:seconds:1–3600
retryMaxAttempts|Maximum attempts|U:attempts:1–20
@Runtime sidecar|Resources|19|sidecar-resource|299:4763|299:102348
@OWN
#Runtime
type|Resource type|O:sidecar
imageRef|Immutable image digest *|R
args|Process arguments|L
ports|Port declarations|J
environmentRefs|Environment vault references|J
healthProbe|Health probe definition|J
restartPolicy|Restart policy|O:never, on-failure
#Limits
cpuMillis|CPU limit|U:millicores:100–64000
memoryMiB|Memory limit|U:MiB:128–262144
startupDeadlineSeconds|Startup deadline|U:seconds:1–3600
#Safety
allowNetwork|Allow network|
allowedDomains|Network domain allowlist|L
#Dependencies
capabilities|Required capabilities|L
allowlist|Allowed effects|L
@Memory record|Memory & context|23|memory|299:5232|299:102809
@OWN
#Content
layer|Memory layer|O:working, structural, episodic, semantic
content|Memory content *|R
contentFormat|Content format|O:markdown, text, json
tags|Tags|L
#Provenance
source|Source provenance|J
sourcePins|Exact source revisions|P
sourceRunRef|Run / task / attempt reference|
#Lineage
parentMemoryRef|Parent memory reference|
#Policy
sensitivity|Sensitivity|O:workspace, restricted
retention|Retention policy reference *|R
#Lifecycle
expiresAt|Expiry|T
replacementRef|Replacement reference|
#Context
mandatory|Mandatory context item|
priority|Context priority|U:priority:0–100
tokenBudget|Context token ceiling|U:tokens:1–2000000
#Retrieval
embeddingModelRef|Embedding model revision|
indexNamespace|Authorized index namespace|
minRetrievalScore|Minimum retrieval score|U:ratio:0–1
@Memory retrieval policy|Memory & context|16|memory-policy|299:103283|299:104090
@OWN
#Retrieval
enabledLayers|Enabled memory layers|L
retrievalMode|Retrieval mode|O:keyword, vector, hybrid
embeddingModelRef|Embedding model revision|
topK|Maximum candidates|U:items:1–500
minScore|Minimum score|U:ratio:0–1
#Context
deduplicate|Deduplicate exact sources|
tokenBudget|Context token ceiling|U:tokens:1–2000000
#Policy
requireReview|Review before promotion|
#Lifecycle
retentionPolicyRef|Retention policy reference|
#Advanced
promotionRules|Promotion policy|J
revocationRules|Revocation policy|J
@Context package request|Memory & context|15|context-package|299:103698|299:104505
@OWN
#Selection
documentPins|Document revision pins|P
sourcePins|Source / resource revision pins|P
memoryPins|Memory revision pins|P
mandatoryIds|Mandatory selected IDs|L
#Limits
tokenBudget|Token ceiling|U:tokens:1–2000000
byteBudget|UTF-8 byte ceiling|U:bytes:1–100000000
overflowPolicy|Overflow policy|O:block
#Destination
intendedTaskRef|Intended task reference|
modelRef|Intended model reference|
purpose|Selection purpose *|R
@Repository connection|Code intelligence|20|repository|299:104897|299:105792
@OWN
#Repository
provider|Repository provider|O:github
installationRef|GitHub App installation reference *|R
repositoryId|Provider repository ID *|R
repositoryOwner|Repository owner *|R
repositoryName|Repository name *|R
#Refs
defaultBranch|Default branch|
trackedRef|Tracked ref / branch *|R
expectedCommitOid|Expected Git commit OID|
#Sync
syncMode|Sync policy|O:webhook-and-reconcile, manual
reconcileIntervalSeconds|Reconciliation interval|U:seconds:30–86400
#Access
requestedPermissions|Requested App permissions|L
allowWriteWorkspace|Request explicit edit workspace|
#Index
includePaths|Included paths|L
excludePaths|Excluded paths|L
#Lifecycle
retentionPolicyRef|Snapshot retention policy|
@Code index policy|Code intelligence|20|index-policy|299:105349|299:106244
@OWN
#Source
repositoryRef|Repository reference *|R
commitOid|Exact Git commit OID *|R
#Adapters
languages|Included languages|L
adapters|Per-language AST / semantic adapter versions|J
unsupportedLanguagePolicy|Unsupported language behavior|O:mark-partial, block
#Index
mode|Index mode|O:full, incremental
baseIndexRef|Base index revision|
includePaths|Included paths|L
excludePaths|Excluded paths|L
freshnessSeconds|Index freshness policy|U:seconds:1–86400
#Limits
maxFileBytes|Per-file analysis byte limit|U:bytes:1–100000000
maxFiles|File count limit|U:files:1–1000000
maxDurationSeconds|Job deadline|U:seconds:1–86400
#Relations
includeTestRelations|Request test relation extraction|
includeRequirementRelations|Request requirement relation extraction|
@Source query|Code intelligence|15|source-query|299:106687|299:107499
@OWN
#Source
repositoryRef|Repository reference *|R
commitOid|Exact Git commit OID *|R
#Query
query|Query text *|R
queryType|Query type|O:literal, symbol, path, references, impact
paths|Path filter|L
languages|Language filter|L
caseSensitive|Case-sensitive match|
#Limits
maxResults|Result limit|U:results:1–500
contextLines|Context lines|U:lines:0–100
#Provenance
adapterRevision|Requested semantic adapter revision|
@Document properties|Specifications|16|document-metadata|299:107093|299:107905
@OWN
#Classification
documentType|Document type|O:requirements, architecture, api-contract, test-plan, runbook, decision, other
priority|Priority|O:critical, high, medium, low
sensitivity|Sensitivity|O:workspace, restricted
tags|Tags|L
#Review
reviewOwnerRef|Review owner reference|
#Lifecycle
reviewDueAt|Review due|T
retentionPolicyRef|Retention policy reference|
#Relations
relatedDocumentPins|Related document revisions|P
requirementIds|Requirement IDs|L
repositoryRef|Related repository reference|
commitOid|Related exact Git revision|
@Specification submission request|Specifications|15|spec-submission|300:6554|300:105804
@OWN
#Inputs
manifestRef|Immutable manifest reference *|R
manifestHash|Manifest SHA-256 *|R
documentPins|Exact document revisions|P
#Destination
workflowRef|Requested workflow revision|
agentRef|Requested agent revision|
#Lifecycle
supersedesRef|Superseded submission reference|
submissionReason|Submission reason *|R
#Review
acknowledgeImmutableInputs|Acknowledge immutable inputs|
#Limits
tokenBudget|Context token ceiling|U:tokens:1–2000000
budget|Cost ceiling|U:USD:0–1000000
@Provider credential request|AI access & budget|15|provider-credential|300:6971|300:106213
@OWN
#Connection
provider|Provider adapter|O:openai, anthropic, google, azure, openai-compatible
credentialReference|Credential vault reference|V
endpoint|Provider API endpoint|H
#Access
allowedModels|Allowed model IDs|L
allowedScopes|Allowed invocation scopes|L
#Lifecycle
rotationDueAt|Rotation due|T
expiresAt|Credential expiry|T
replacementCredentialRef|Replacement vault reference|
revocationReason|Revocation reason|
#Health
healthFreshnessSeconds|Health observation freshness|U:seconds:1–86400
@Model routing policy|AI access & budget|17|routing-policy|300:106613|300:107423
@OWN
#Routing
primaryModelRef|Primary model revision *|R
fallbackModelRefs|Ordered fallback model revisions|L
requiredCapabilities|Required model capabilities|L
fallbackTrigger|Fallback condition|O:availability-before-dispatch, bounded-read-retry, no-fallback
#Limits
timeoutSeconds|Provider timeout|U:seconds:1–3600
retryMaxAttempts|Maximum attempts|U:attempts:1–10
maxConcurrency|Maximum concurrency|U:calls:1–1000
tokenBudget|Call token ceiling|U:tokens:1–2000000
budget|Call cost ceiling|U:USD:0–1000000
#Circuit
circuitFailureThreshold|Circuit failure threshold|U:failures:1–1000
circuitOpenSeconds|Circuit open duration|U:seconds:1–86400
#Budget
requireReservation|Require budget reservation|
@Budget and reservation policy|AI access & budget|15|budget-policy|300:107024|300:107834
@OWN
#Budget
currency|Currency|O:USD
monthlyCeiling|Monthly ceiling|U:USD:0–1000000
perRunCeiling|Per-run ceiling|U:USD:0–1000000
perTaskCeiling|Per-task ceiling|U:USD:0–1000000
maxConcurrency|Maximum concurrent calls|U:calls:1–1000
#Reservations
reservationTtlSeconds|Reservation TTL|U:seconds:1–86400
#Policy
exhaustionPolicy|Budget exhausted behavior|O:block, pause-await-human
requireReconciliation|Reconcile unknown charge before reuse|
#Alerts
alertRecipients|Budget alert identity references|L
warningPercent|Warning threshold|U:percent:1–100
@Workflow definition policy|Workflow & planning|19|workflow-policy|300:108233|300:109148
@OWN
#Definition
templateRef|Source template revision|
objective|Workflow objective *|R
#Contract
inputSchema|Workflow input schema|J
outputSchema|Workflow output schema|J
#Inputs
specificationPins|Specification revision pins|P
resourcePins|Resource revision pins|P
memoryPins|Memory revision pins|P
#Approval
reviewPolicyRef|Approval policy revision *|R
approverRefs|Eligible approver references|L
#Runtime
failurePolicy|Task failure policy|O:pause, cancel-dependent, continue-independent
maxConcurrency|Parallel task ceiling|U:tasks:1–1000
timeoutSeconds|Workflow deadline|U:seconds:1–604800
budget|Run cost ceiling|U:USD:0–1000000
#Lifecycle
retentionPolicyRef|Retention policy revision|
@Task execution contract|Workflow & planning|24|task-policy|300:108672|300:109587
@OWN
#Identity
workflowRef|Workflow revision reference *|R
taskId|Task identity *|R
#Assignment
agentRef|Exact agent revision *|R
#Inputs
dependencyTaskIds|Dependency task IDs|L
inputBindings|Dependency output bindings|J
#Output
outputSchema|Output JSON schema|J
acceptanceCaseIds|Mandatory acceptance IDs|L
#Approval
humanCheckpoint|Require human checkpoint|
checkpointApprovers|Eligible approver references|L
checkpointInstructions|Checkpoint instructions|
#Runtime
sandboxTemplateRef|Sandbox template revision|
leasePaths|Exclusive writer paths|L
#Limits
timeoutSeconds|Attempt timeout|U:seconds:1–86400
retryMaxAttempts|Maximum attempts|U:attempts:1–20
retryBackoffSeconds|Initial retry delay|U:seconds:0–3600
maxConcurrency|Maximum concurrency|U:workers:1–1000
tokenBudget|Token budget|U:tokens:1–2000000
budget|Cost ceiling|U:USD:0–1000000
currency|Budget currency|O:USD
@Run admission request|Runs & activity|15|run-admission|300:110063|300:110870
@OWN
#Inputs
approvedPlanRef|Approved plan revision *|R
manifestRef|Exact input manifest *|R
policyRevision|Policy revision *|R
#Source
repositoryRef|Repository reference|
baseCommitOid|Base Git commit OID|
#Runtime
sandboxTemplateRef|Sandbox template revision *|R
requestedLeasePaths|Requested writer paths|L
#Limits
maxConcurrency|Parallel attempts|U:attempts:1–1000
budget|Run cost ceiling|U:USD:0–1000000
#Review
reason|Admission reason *|R
@Human checkpoint decision|Runs & activity|14|checkpoint-decision|300:110478|300:111285
@OWN
#Identity
runId|Run identity *|R
taskId|Task identity *|R
attempt|Attempt number|U:attempts:1–1000000
checkpointId|Checkpoint identity *|R
#Evidence
outputRevision|Reviewed output revision *|R
evidenceIds|Evidence identities|L
#Review
decision|Decision|O:approve, reject, request-changes
reason|Decision rationale *|R
independenceAcknowledged|Acknowledge reviewer independence|
@Retry / resume request|Runs & activity|15|run-recovery|301:8269|301:109228
@OWN
#Identity
runId|Run identity *|R
taskId|Task identity|
attempt|Original attempt|U:attempts:1–1000000
#Recovery
action|Recovery action|O:retry-task, resume-run, restore-snapshot, reconcile-only
snapshotRef|Immutable snapshot reference|
originalOperationId|Original unresolved operation ID|
#Inputs
expectedPolicyRevision|Expected policy revision *|R
expectedInputManifest|Expected input manifest *|R
#Review
reason|Recovery rationale *|R
cleanupVerified|Require service-verified prior cleanup|
@Cancel and cleanup request|Runs & activity|15|run-cancel|301:8683|301:109634
@OWN
#Identity
runId|Run identity *|R
expectedAttempt|Expected attempt|U:attempts:1–1000000
taskId|Task identity|
#Review
cancelScope|Cancellation scope|O:task, run
reason|Cancellation rationale *|R
#Cleanup
artifactPolicy|Retained evidence policy|O:retain-for-audit, policy-reference
retentionPolicyRef|Retention policy revision|
cleanupDeadlineSeconds|Cleanup deadline|U:seconds:1–86400
requireFenceVerification|Require writer fence verification|
requireCleanupVerification|Require cleanup verification before release|
@Delivery review|Reviews & delivery|16|delivery-review|301:110031|301:110862
@OWN
#Identity
runId|Run identity *|R
repositoryRef|Repository reference *|R
#Revisions
baseCommitOid|Base Git commit OID *|R
headCommitOid|Reviewed head Git commit OID *|R
#Review
riskLevel|Risk level|O:low, medium, high, critical
policyRevision|Review policy revision *|R
reviewerRefs|Eligible independent reviewers|L
decision|Review decision|O:approve, reject, request-changes
reason|Decision rationale *|R
#Evidence
requiredCheckIds|Required check IDs|L
evidenceIds|Security and combined-test evidence IDs|L
@Pull request and merge request|Reviews & delivery|16|pull-request|301:110437|301:111268
@OWN
#Identity
repositoryRef|Repository reference *|R
#Pull request
title|Pull request title *|R
body|Pull request description *|R
#Revisions
baseRef|Target base branch *|R
headRef|Source branch *|R
expectedHeadOid|Expected head Git commit OID *|R
#Merge
mergeMethod|Requested merge method|O:merge, squash, rebase
deleteBranchAfterMerge|Request branch cleanup after verified merge|
#Checks
requiredCheckIds|Required check IDs|L
reviewerRefs|Required reviewer identities|L
#Recovery
originalOperationId|Original operation for reconciliation|
@Post-merge acceptance|Reviews & delivery|17|acceptance-review|301:111693|301:112498
@OWN
#Identity
deliveryId|Delivery identity *|R
repositoryRef|Repository reference *|R
#Revisions
mergedCommitOid|Actual merged Git commit OID *|R
#Case
caseId|Acceptance case identity *|R
setup|Executed setup *|R
oracle|Independent business oracle *|R
#Evidence
result|Observed result|O:not-run, passed, failed, unknown
evidenceIds|Evidence identities|L
environmentRef|Executed environment reference|
executedAt|Execution timestamp|T
#Recovery
failureReason|Failure / unknown reason|
correctiveActionRef|Corrective action reference|
@Membership invitation|People & access|12|member-invitation|301:112115|301:112920
@OWN
#Identity
email|Recipient email *|R
#Access
roleRef|Role revision reference *|R
invitationScope|Membership scope reference *|R
requireVerifiedIdentity|Require verified recipient identity|
#Lifecycle
expiresAt|Invitation expiry|T
replacementInviteRef|Invitation being superseded|
#Review
message|Invitation message|
@Role and grant policy|People & access|15|role-policy|301:113303|301:114104
@OWN
#Definition
roleKey|Stable role key *|R
purpose|Role purpose *|R
#Grants
permissions|Allowed permission codes|L
deniedPermissions|Denied permission codes|L
scopeRestrictions|Scope restrictions|L
inheritance|Grant inheritance|O:inherit, override
#Session
requireMfa|Require MFA|
sessionMaxAgeSeconds|Maximum session age|U:seconds:60–2592000
#Separation
eligibleReviewerRoles|Eligible review roles|L
separationOfDuties|Separation of duties constraints|J
@Access revocation request|People & access|13|offboarding|301:113705|301:114506
@OWN
#Identity
subjectRef|Subject identity *|R
#Impact
membershipIds|Membership identities|L
sessionIds|Sessions to revoke|L
transferOwnerRef|Replacement owner identity|
activeRunPolicy|Active run policy|O:pause-and-review, cancel-with-cleanup, retain-until-approved
#Review
reason|Revocation rationale *|R
#Lifecycle
effectiveAt|Requested effective time|T
#Session
revokeObserverSessions|Revoke observer sessions too|
@Organization|Organization & projects|15|organization|302:9922|302:112553
@OWN
#Identity
slug|Organization slug *|R
legalName|Legal entity name|
#Contact
billingEmail|Billing email|
#Locale
timezone|IANA timezone *|R
locale|Locale|
#Policy
dataRegion|Data region *|R
retentionPolicyRef|Retention policy revision *|R
defaultPolicyRef|Default policy revision|
#Access
allowedEmailDomains|Allowed email domains|L
requireMfa|Require MFA|
@Workspace|Organization & projects|14|workspace|302:10344|302:112967
@OWN
#Identity
organizationRef|Parent organization identity *|R
slug|Workspace slug *|R
#Access
visibility|Membership visibility|O:members-only, restricted
#Policy
defaultPolicyRef|Default policy revision|
defaultAgentRef|Default agent revision|
defaultWorkflowRef|Default workflow revision|
inheritance|Parent policy behavior|O:inherit, override
#Knowledge
memoryBankRef|Memory bank reference|
#Lifecycle
retentionPolicyRef|Retention policy revision|
@Project onboarding|Organization & projects|18|project|302:113375|302:114224
@OWN
#Identity
workspaceRef|Parent workspace identity *|R
slug|Project slug *|R
#Source
projectMode|Project mode|O:existing-repository, greenfield
repositoryRef|Repository connection reference|
defaultBranch|Default branch|
#Policy
policyRef|Effective policy revision *|R
#Readiness
modelResourceRef|Model resource revision|
sandboxTemplateRef|Sandbox template revision|
defaultAgentRef|Default agent revision|
defaultWorkflowRef|Default workflow revision|
#Inputs
requiredSpecificationPins|Required specifications|P
#Deployment
environment|Target environment|O:development, staging, production
#Lifecycle
retentionPolicyRef|Retention policy revision|
@Archive / transfer / deletion request|Organization & projects|14|scope-lifecycle|302:113824|302:114673
@OWN
#Identity
objectRef|Target object identity *|R
#Lifecycle
action|Requested lifecycle action|O:archive, restore, transfer, request-erasure
#Impact
destinationScope|Transfer destination scope|
newOwnerRef|New owner identity|
dependencyIds|Impacted dependency identities|L
retentionPolicyRef|Retention policy revision|
legalHoldRef|Legal hold reference|
#Review
reason|Lifecycle change rationale *|R
acknowledgeImpact|Acknowledge reviewed impact|
@Scoped configuration override|Configuration & policy|15|policy-override|302:115073|302:115904
@OWN
#Scope
scope|Target scope reference *|R
#Inheritance
parentPolicyRef|Parent policy revision|
inheritance|Inheritance behavior|O:inherit, override
#Policy
policy|Policy document|J
overrideKeys|Deliberate overrides|J
#Impact
impactObjectIds|Affected objects|L
activeRunPolicy|Policy for existing runs|O:retain-pinned, pause-and-review, supersede-with-approval
#Lifecycle
effectiveFrom|Requested effective time|T
#Recovery
rollbackRevisionRef|Rollback revision|
#Review
requireReview|Require impact approval|
@Runtime capability policy|Configuration & policy|16|runtime-policy|302:115496|302:116327
@OWN
#Runtime
environment|Target environment|O:cloud, desktop, self-host
sandboxRuntime|Sandbox runtime|O:gvisor
#Compatibility
requiredCapabilities|Required runtime capabilities|L
workerVersionRange|Supported worker version range|
desktopVersionRange|Supported desktop version range|
#Limits
maxConcurrentSandboxes|Concurrent sandbox ceiling|U:sandboxes:1–1000
maxLogBytes|Retained log byte ceiling|U:bytes:1–1000000000
maxArtifactBytes|Artifact byte ceiling|U:bytes:1–1000000000
maxPtySessions|PTY session ceiling|U:sessions:0–100
#Safety
allowedDomains|Network allowlist|L
#Lifecycle
retentionPolicyRef|Retention policy revision|
@Anchored discussion|Collaboration|15|comment-thread|302:117504|302:116735
@OWN
#Anchor
documentId|Document identity *|R
documentRevision|Document revision|U:revisions:1–1000000000
anchorId|Stable anchor identity *|R
lineStart|Start line|U:lines:1–10000000
lineEnd|End line|U:lines:1–10000000
#Discussion
comment|Comment body *|R
assigneeRefs|Assignee identities|L
mentionRefs|Mention identities|L
#Review
resolution|Requested thread disposition|O:open, resolve, reopen
reviewRef|Related review identity|
@Durable collaboration cut request|Collaboration|13|collaboration-cut|302:117889|302:117120
@OWN
#Identity
roomId|Collaboration room identity *|R
branchId|Document branch identity *|R
roomEpoch|Expected room epoch|U:epochs:0–1000000000
#Durability
durableAckRef|Durable acknowledgment reference *|R
stateVector|Expected state vector|J
#Inputs
documentPins|Exact document revisions|P
manifestHash|Expected manifest SHA-256 *|R
#Review
reason|Cut rationale *|R
@Subscription and seats request|Usage, billing & data|14|entitlement-request|303:11594|303:115860
@OWN
#Identity
billingAccountRef|Billing account identity *|R
#Plan
planVersionRef|Plan version identity *|R
seatCount|Requested seats|U:seats:1–1000000
billingInterval|Billing interval|O:monthly, yearly
currency|Currency|O:USD
#Quota
concurrentRunLimit|Requested concurrent run quota|U:runs:1–100000
storageGiB|Requested storage quota|U:GiB:1–1000000
#Lifecycle
effectiveAt|Requested effective time|T
#Review
reason|Change rationale *|R
@Billing reconciliation request|Usage, billing & data|14|billing-reconciliation|303:12004|303:116262
@OWN
#Identity
billingAccountRef|Billing account identity *|R
originalOperationId|Original operation identity *|R
#Ledger
reservationId|Reservation identity|
usageId|Measured usage identity|
settlementId|Settlement identity|
invoiceId|Invoice identity|
currency|Expected currency|O:USD
expectedAmount|Expected amount|U:USD:0–1000000
#Review
reason|Reconciliation rationale *|R
@Data export / erasure request|Usage, billing & data|14|data-lifecycle|303:116645|303:117480
@OWN
#Request
action|Requested action|O:export, request-erasure
#Selection
datasetTypes|Dataset types|L
rangeStart|Range start|T
rangeEnd|Range end|T
#Export
format|Requested export format|O:json, csv
#Retention
retentionPolicyRef|Retention policy revision *|R
legalHoldRef|Legal hold identity|
#Review
reason|Request rationale *|R
acknowledgeRetentionExceptions|Acknowledge retention exceptions|
@Desktop device binding|Desktop & runtime|17|device-binding|303:117048|303:117883
@OWN
#Identity
deviceId|Device identity *|R
deviceName|Device display name *|R
#Scope
projectRef|Project identity *|R
#Repository
localRepositoryPath|Local repository path *|R
remoteRepositoryRef|Remote repository identity|
#Sync
syncMode|Sync behavior|O:manual, review-before-upload
#Access
requestedCapabilities|Requested device capabilities|L
allowLocalExecution|Request local execution|
allowPty|Request PTY access|
#Compatibility
minimumCompanionVersion|Minimum companion version|
#Lifecycle
pairingExpiresAt|Pairing expiry|T
retentionPolicyRef|Local retention policy|
@Companion update request|Desktop & runtime|15|desktop-update|303:118315|303:119152
@OWN
#Identity
deviceId|Device identity *|R
#Compatibility
channel|Update channel|O:stable, enterprise
platform|Target platform *|R
#Versions
currentVersion|Current version *|R
targetVersion|Target version *|R
#Integrity
packageDigest|Package SHA-256 *|R
signatureRef|Verification signature reference *|R
#Recovery
rollbackVersion|Rollback version|
requireBackup|Require local state backup|
#Review
reason|Update rationale|
@Telemetry query|Operations observer|19|telemetry-query|303:118726|303:119563
@OWN
#Scope
observerScope|Authorized observer scope intent *|R
environmentRef|Environment identity *|R
#Query
signal|Signal type|O:trace, metric, log, profile
rangeStart|Range start|T
rangeEnd|Range end|T
query|Query expression *|R
#Filters
serviceNames|Service filters|L
severityLevels|Severity filters|L
traceId|Exact trace identity|
runId|Run correlation identity|
#Quality
unit|Expected unit *|R
freshnessSeconds|Maximum observation age|U:seconds:1–86400
samplingIntervalSeconds|Sampling interval|U:seconds:1–3600
#Limits
maxResults|Result limit|U:results:1–500
@Diagnostic export request|Operations observer|17|diagnostic-export|303:119989|303:120819
@OWN
#Scope
environmentRef|Environment identity *|R
#Selection
signalTypes|Signal types|L
rangeStart|Range start|T
rangeEnd|Range end|T
serviceNames|Service filters|L
traceIds|Trace identities|L
#Export
format|Export format|O:json, otlp, pprof
#Access
audience|Export audience|O:observer-approved-public
redactSensitiveFields|Require service-side redaction|
#Lifecycle
expiresAt|Download expiry|T
#Handoff
incidentRef|Incident identity|
purpose|Diagnostic purpose *|R
@Incident and operations handoff|Connection & receipts|18|incident-handoff|303:120414|303:121244
@OWN
assignedOperatorRef|Operator identity|
#Incident
severity|Severity|O:critical, high, medium, low
summary|Observed symptom *|R
observedAt|Observation time|T
environmentRef|Environment identity *|R
impact|Observed impact|
#Correlation
runId|Run identity|
taskId|Task identity|
originalOperationId|Original operation identity|
traceId|Trace identity|
#Evidence
evidenceIds|Evidence identities|L
#Recovery
attemptedRecovery|Recovery already attempted|
runbookRef|Runbook revision|
"""
HINTS = {'R': 'Required for complete validation', 'L': 'One value per line. Duplicate entries are rejected.',
         'J': 'Structured JSON. Local validation does not prove service acceptance.',
         'P': 'Exact saved references: id, kind, rev and SHA-256 hash. Repin explicitly after a revision changes.',
         'H': 'HTTPS without embedded credentials. Localhost HTTP is development only.',
         'V': 'Reference only, e.g. vault://team/provider. Secret values must be entered through an authorized service credential command.',
         'T': 'ISO 8601 with an explicit timezone, e.g. 2026-10-03T09:00:00Z.'}
OWN = [('targetScope', 'Intended organization / workspace / project scope *', 'R'), ('ownerRef', 'Owner identity reference *', 'R'),
       ('description', 'Description', ''), ('labels', 'Labels', 'L'), ('changeReason', 'Change reason', '')]
FIGMA_MODULE_ROUTE = dict(NAV_ROUTE, **{'Agents': 'agents'})


def inventory():
    rows = []
    for line in INVENTORY_TXT.strip().splitlines():
        vid, title, s, d, l, comp, st, note = line.split('|')
        rows.append({'view_id': vid, 'title': title, 'surface': SURFACES[s], 'surface_code': s,
                     'figma_dark': None if d == '-' else d, 'figma_light': None if l == '-' else l,
                     'journeys': JOURNEYS[s], 'components': f'{COMP[comp[0]]} · {comp[1:]} component masters · CSV',
                     'presence_status': STATUS[st], 'notes': NOTES[note]})
    return rows


def def_oracle():
    types, cur, grp = [], None, None
    for line in DEF_TXT.strip().splitlines():
        if line.startswith('@OWN'):
            grp = {'group': 'Ownership', 'fields': [dict(zip(('key', 'label', 'hint'), f)) for f in OWN]}
            cur['groups'].append(grp)
        elif line.startswith('@'):
            title, mod, n, schema, d, l = line[1:].split('|')
            cur = {'title': title, 'figma_module': mod, 'route': FIGMA_MODULE_ROUTE[mod], 'field_count': int(n),
                   'schema_label': schema, 'figma_dark': d, 'figma_light': l, 'groups': []}
            types.append(cur)
        elif line.startswith('#'):
            grp = {'group': line[1:], 'fields': []}
            cur['groups'].append(grp)
        else:
            key, label, hint = line.split('|')
            grp['fields'].append({'key': key, 'label': label, 'hint': hint})
    for t in types:
        for g in t['groups']:
            for f in g['fields']:
                h = f['hint']
                f['required'] = f['label'].endswith(' *')
                if h.startswith('U:'):
                    _, unit, rng = h.split(':', 2)
                    f['hint_text'] = f'Unit: {unit} · Range: {rng}'
                elif h.startswith('O:'):
                    f['hint_text'] = 'Options: ' + h[2:].replace(', ', ' · ')
                else:
                    f['hint_text'] = HINTS.get(h, '')
        t['counted_fields'] = sum(len(g['fields']) for g in t['groups'])
    return types


def write():
    inv = inventory()
    assert len(inv) == 210, len(inv)
    assert len({r['view_id'] for r in inv}) == 210
    defs = def_oracle()
    assert len(defs) == 49, len(defs)
    bad = [(t['title'], t['field_count'], t['counted_fields']) for t in defs if t['field_count'] != t['counted_fields']]
    assert not bad, bad
    out = os.path.join(ROOT, 'evidence', 'figma')
    os.makedirs(out, exist_ok=True)
    meta = {'file_key': FILE_KEY, 'read_at': '2026-10-05', 'method': 'Figma MCP use_figma (Plugin API, read-only scripts)',
            'pages': [{'id': i, 'name': n} for i, n in PAGES]}
    with open(os.path.join(out, 'planned-inventory-210.json'), 'w') as f:
        json.dump(dict(meta, source_node='342:5', header='210 planned views · 130 routes / 80 states', rows=inv), f, indent=1, ensure_ascii=False)
    with open(os.path.join(out, 'planned-inventory-210.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(inv[0].keys()))
        w.writeheader()
        w.writerows(inv)
    with open(os.path.join(out, 'definition-field-oracle-49.json'), 'w') as f:
        json.dump(dict(meta, source='01/02 Current UI "<type> · unified fields" frames', types=defs), f, indent=1, ensure_ascii=False)
    frames = {'module': {r: {'dark': d, 'light': l, 'dark_name': f'Atlas/Dark/{r}', 'light_name': f'Atlas/Light/{r}'} for r, (d, l) in MODULE_FRAMES.items()},
              'state': {k: {'dark': v[0], 'light': v[1], 'title': v[2], 'owner_route': v[3]} for k, v in STATE_FRAMES.items()},
              'definition_state': {k: {'dark': v[0], 'light': v[1]} for k, v in DEF_STATE_FRAMES.items()},
              'nav': NAV, 'shell': SHELL, 'module_expect': MODULE_EXPECT, 'service_tab_routes': SERVICE_TAB_ROUTES}
    with open(os.path.join(out, 'current-ui-frames.json'), 'w') as f:
        json.dump(dict(meta, **frames), f, indent=1, ensure_ascii=False)
    # Harness copy (oracle fixed before execution).
    hd = os.path.join(ROOT, 'harness', 'data')
    os.makedirs(hd, exist_ok=True)
    with open(os.path.join(hd, 'figma-oracle.json'), 'w') as f:
        json.dump({'file_key': FILE_KEY, 'nav': NAV, 'nav_route': NAV_ROUTE, 'shell': SHELL, 'module_expect': MODULE_EXPECT,
                   'service_tab_routes': SERVICE_TAB_ROUTES, 'module_frames': MODULE_FRAMES,
                   'definitions': [{k: t[k] for k in ('title', 'figma_module', 'route', 'field_count', 'schema_label', 'figma_dark', 'groups')} for t in defs]},
                  f, indent=1, ensure_ascii=False)
    from collections import Counter
    return {'inventory': len(inv), 'presence': Counter(r['presence_status'] for r in inv), 'definitions': len(defs),
            'fields': sum(t['field_count'] for t in defs)}


if __name__ == '__main__':
    print(write())
