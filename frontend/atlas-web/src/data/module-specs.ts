import type { ModuleRoute } from './types';

/**
 * Service-module structure from the Figma "Current UI" frames (01/02 · Current UI · Dark/Light). Labels are verbatim from
 * the frames; `sourceAction` links a control to Atlas-Source-Actions-55 for authorization, preconditions and recovery.
 */
export interface ServiceModuleSpec {
  lifecycle: string[] | null; lifecycleIds: string[];
  links: { label: string; to: ModuleRoute }[];
  actions: { label: string; sourceAction?: string }[];
  tabs: string[];
}

export const SERVICE_MODULES: Partial<Record<ModuleRoute, ServiceModuleSpec>> = {
  collaboration: {
    lifecycle: ['Disconnected', 'Joining', 'Syncing', 'Durable ACK', 'Offline', 'Epoch changed', 'Conflict'], lifecycleIds: ['LC-28'],
    links: [{ label: 'Document IDE', to: 'specifications' }, { label: 'Review inbox', to: 'governance' }],
    actions: [{ label: 'Join room' }, { label: 'Reconnect' }, { label: 'Resolve conflict' }, { label: 'Comment' }, { label: 'Request freeze barrier', sourceAction: 'UXA-004' }],
    tabs: ['Room', 'Acknowledgements', 'Presence', 'Comments'],
  },
  execution: {
    lifecycle: null, lifecycleIds: ['LC-17', 'LC-18', 'LC-19', 'LC-21', 'LC-22', 'LC-27'],
    links: [{ label: 'Agent definition', to: 'agents' }, { label: 'Plan', to: 'workflow' }, { label: 'Delivery acceptance', to: 'governance' }, { label: 'Operations', to: 'observer' }],
    actions: [
      { label: 'Admit run', sourceAction: 'UXA-031' }, { label: 'Pause', sourceAction: 'UXA-032' }, { label: 'Resume', sourceAction: 'UXA-033' },
      { label: 'Cancel', sourceAction: 'UXA-035' }, { label: 'Approve', sourceAction: 'UXA-036' }, { label: 'Reject', sourceAction: 'UXA-036' },
      { label: 'Retry task', sourceAction: 'UXA-034' }, { label: 'Restore snapshot', sourceAction: 'UXA-038' }, { label: 'Reconcile' }, { label: 'Inspect cleanup', sourceAction: 'UXA-039' },
    ],
    tabs: ['Tasks', 'Agent activity', 'Tools', 'Logs & PTY'],
  },
  governance: {
    lifecycle: null, lifecycleIds: ['LC-23', 'LC-24', 'LC-25', 'LC-26', 'LC-36'],
    links: [{ label: 'Run evidence', to: 'execution' }, { label: 'Requirement source', to: 'specifications' }, { label: 'Repository', to: 'code' }],
    actions: [
      { label: 'Run preflight', sourceAction: 'UXA-040' }, { label: 'Request review', sourceAction: 'UXA-041' }, { label: 'Approve', sourceAction: 'UXA-041' },
      { label: 'Reject', sourceAction: 'UXA-041' }, { label: 'Create PR', sourceAction: 'UXA-042' }, { label: 'Reconcile PR', sourceAction: 'UXA-042' },
      { label: 'Merge', sourceAction: 'UXA-044' }, { label: 'Verify acceptance', sourceAction: 'UXA-045' }, { label: 'Close delivery', sourceAction: 'UXA-045' },
      { label: 'Corrective action' }, { label: 'Export evidence' },
    ],
    tabs: ['Preflight', 'Reviewer eligibility', 'Requirements', 'PR & CI'],
  },
  gateway: {
    lifecycle: null, lifecycleIds: ['LC-13', 'LC-14'],
    links: [{ label: 'Agent readiness', to: 'agents' }, { label: 'Run admission', to: 'execution' }, { label: 'Billing', to: 'saas' }],
    actions: [
      { label: 'Add credential', sourceAction: 'UXA-025' }, { label: 'Test provider' }, { label: 'Set routing' }, { label: 'Reserve budget', sourceAction: 'UXA-026' },
      { label: 'Rotate credential', sourceAction: 'UXA-025' }, { label: 'Revoke credential', sourceAction: 'UXA-025' }, { label: 'Reconcile usage', sourceAction: 'UXA-026' },
    ],
    tabs: ['Provider', 'Credential references', 'Routing', 'Health'],
  },
  identity: {
    lifecycle: ['Invited', 'Active', 'Suspended', 'Revoked'], lifecycleIds: ['LC-33', 'LC-34'],
    links: [{ label: 'Organization settings', to: 'tenancy' }, { label: 'Separate observer session', to: 'observer' }],
    actions: [{ label: 'Invite member', sourceAction: 'UXA-047' }, { label: 'Change role', sourceAction: 'UXA-048' }, { label: 'Revoke sessions' }, { label: 'Offboard', sourceAction: 'UXA-048' }],
    tabs: ['Membership', 'Effective permissions', 'Sessions', 'Audit'],
  },
  tenancy: {
    lifecycle: ['Draft', 'Onboarding', 'Ready', 'Archived', 'Deletion pending'], lifecycleIds: ['LC-35'],
    links: [{ label: 'Provider access', to: 'gateway' }, { label: 'Policies', to: 'configuration' }],
    actions: [{ label: 'Create project' }, { label: 'Transfer ownership', sourceAction: 'UXA-050' }, { label: 'Archive', sourceAction: 'UXA-050' }, { label: 'Request deletion', sourceAction: 'UXA-050' }],
    tabs: ['Readiness', 'Scope', 'Impact'],
  },
  saas: {
    lifecycle: null, lifecycleIds: ['LC-30', 'LC-38'],
    links: [{ label: 'Spend reservations', to: 'gateway' }, { label: 'Membership', to: 'identity' }, { label: 'Audit evidence', to: 'governance' }],
    actions: [
      { label: 'Manage seats', sourceAction: 'UXA-051' }, { label: 'Change entitlement', sourceAction: 'UXA-051' }, { label: 'Reconcile invoice' },
      { label: 'Request data export', sourceAction: 'UXA-052' }, { label: 'Set retention', sourceAction: 'UXA-052' }, { label: 'Request erasure', sourceAction: 'UXA-052' },
    ],
    tabs: ['Seats & quotas', 'Usage', 'Reservations', 'Invoices'],
  },
  desktop: {
    lifecycle: null, lifecycleIds: ['LC-31'],
    links: [{ label: 'Local source import', to: 'code' }, { label: 'Runtime policy', to: 'configuration' }, { label: 'Runs', to: 'execution' }],
    actions: [
      { label: 'Pair device' }, { label: 'Check runtime', sourceAction: 'UXA-054' }, { label: 'Open terminal', sourceAction: 'UXA-054' }, { label: 'Schedule run', sourceAction: 'UXA-054' },
      { label: 'Check updates', sourceAction: 'UXA-055' }, { label: 'Apply update', sourceAction: 'UXA-055' }, { label: 'Revoke device', sourceAction: 'UXA-055' },
    ],
    tabs: ['Device session', 'Repositories', 'Runtime & PTY', 'Scheduling'],
  },
  observer: {
    lifecycle: ['Disconnected', 'Receiving', 'Partial', 'Stale', 'Incident', 'Recovery pending', 'Observed'], lifecycleIds: ['LC-32', 'LC-37'],
    links: [{ label: 'Workspace runs', to: 'execution' }, { label: 'Policy capabilities', to: 'configuration' }],
    actions: [
      { label: 'Refresh telemetry' }, { label: 'Inspect trace' }, { label: 'Export diagnostics', sourceAction: 'UXA-053' }, { label: 'Check readiness' },
      { label: 'Request recovery' }, { label: 'Acknowledge incident' },
    ],
    tabs: ['Metrics', 'Traces', 'Logs', 'Profiles'],
  },
};

/**
 * Device-draft modules (Figma Atlas/<Theme>/agents|resources|memory|configuration): catalog of device drafts plus a definition
 * workbench with Figma's tabs. Each tab lists the schema groups/fields it shows; fields not claimed by any tab go to the first.
 */
export interface DraftTab { label: string; kind?: 'fields' | 'readiness' | 'versions' | 'consumers'; groups?: string[]; fields?: string[] }
export interface DraftModuleSpec {
  newLabel: string; schemas: string[]; note: string; lifecycleIds: string[]; tabs: DraftTab[];
  readiness: { label: string; status: string }[];
}
export const DRAFT_MODULES: Partial<Record<ModuleRoute, DraftModuleSpec>> = {
  agents: {
    newLabel: 'New agent', schemas: ['agent'], note: 'Publishing and runnable readiness require service receipts.', lifecycleIds: ['LC-07', 'LC-10'],
    tabs: [
      { label: 'Instructions', groups: ['Instructions', 'Ownership', 'Output'] },
      { label: 'Model', groups: ['Model', 'Limits'] },
      { label: 'Tools', fields: ['tools'] },
      { label: 'Resources', fields: ['resourcePins', 'skillPins', 'rulePins', 'pluginPins', 'hookPins', 'sidecarPins'] },
      { label: 'Memory', fields: ['memoryPins'] },
      { label: 'Guardrails', groups: ['Safety'] },
      { label: 'Readiness', kind: 'readiness' },
      { label: 'Versions', kind: 'versions', groups: ['Release'] },
    ],
    readiness: [{ label: 'Provider / model', status: 'Not observed' }, { label: 'Runtime / budget', status: 'Capability report required' }],
  },
  resources: {
    newLabel: 'New resource',
    schemas: ['model-resource', 'mcp-resource', 'tool-resource', 'sandbox-resource', 'skill-resource', 'rule-resource', 'plugin-resource', 'hook-resource', 'sidecar-resource'],
    note: 'Discovery does not allow execution. Compatibility and health must be observed.', lifecycleIds: ['LC-08', 'LC-09'],
    tabs: [{ label: 'Definition' }, { label: 'Readiness', kind: 'readiness' }, { label: 'Versions', kind: 'versions' }, { label: 'Consumers', kind: 'consumers' }],
    readiness: [{ label: 'Compatibility', status: 'Not observed' }, { label: 'Health', status: 'Not observed' }],
  },
  memory: {
    newLabel: 'New memory', schemas: ['memory', 'memory-policy', 'context-package'], note: 'Publishing and runnable readiness require service receipts.', lifecycleIds: ['LC-11', 'LC-12'],
    tabs: [
      { label: 'Definition', groups: ['Ownership', 'Policy', 'Lifecycle', 'Advanced'] },
      { label: 'Content', groups: ['Content', 'Context', 'Retrieval', 'Selection', 'Limits', 'Destination'] },
      { label: 'Lineage', groups: ['Provenance', 'Lineage'] },
      { label: 'Context package', kind: 'consumers' },
      { label: 'Readiness', kind: 'readiness' },
      { label: 'Versions', kind: 'versions' },
    ],
    readiness: [{ label: 'Index / retrieval', status: 'Not observed' }, { label: 'Curation review', status: 'Not observed' }],
  },
  configuration: {
    newLabel: 'New policy draft', schemas: ['policy-override', 'runtime-policy'], note: 'A local draft does not change effective organization policy.', lifecycleIds: ['LC-29'],
    tabs: [{ label: 'Definition' }, { label: 'Readiness', kind: 'readiness' }, { label: 'Versions', kind: 'versions' }, { label: 'Consumers', kind: 'consumers' }],
    readiness: [{ label: 'Effective policy', status: 'Unchanged by local drafts' }, { label: 'Runtime capabilities', status: 'Not observed' }],
  },
};
