import { capability } from './app-store';

/** SRS v1.1 §3.1: presentation labels are not role checks. */
export const ACTION_PERMISSIONS = {
  'Lock': 'spec:lock', 'Lock specification': 'spec:lock', 'Submit to AI': 'spec:submit_to_ai', 'Unlock': 'spec:unlock',
  'Approve plan': 'dag:plan_approve', 'Review checkpoint': 'dag:milestone_approve', 'Approve checkpoint': 'dag:milestone_approve',
  'Pause': 'agent:control', 'Resume': 'agent:control', 'Retry': 'agent:control', 'Retry failed': 'agent:control', 'Retry task': 'agent:control', 'Cancel run': 'agent:control',
  'Force release': 'lock:force_release', 'Approve medium risk': 'gov:approve_medium', 'Sign high risk': 'gov:approve_high',
  'Promote': 'workspace:memory_manage', 'Export telemetry': 'obs:export_telemetry',
} as const;
export function actionPermission(label: string): string | undefined {
  return Object.entries(ACTION_PERMISSIONS).find(([key]) => key.toLowerCase() === label.toLowerCase())?.[1];
}
export function permissionReason(label: string): string | undefined {
  const grant = actionPermission(label);
  if (!grant) return undefined;
  const gate = capability(grant, label);
  return gate.ok ? undefined : gate.reason;
}
/** Prototype destinations never constitute a command contract, even if their state names omit "Requested". */
export function requiresServiceAction(label: string): boolean {
  return !!actionPermission(label) || /^(lock\b|freeze\b|unlock\b|submit\b|approve\b|reject\b|publish\b|promote\b|activate\b|admit\b|pause\b|resume\b|cancel (?:run|task)\b|retry (?:failed|task|run)\b|force release\b|send\b|sign\b|merge\b|apply\b|generate\b|save\b|archive\b|create\b|delete\b|discard\b|restore\b|revoke\b)/i.test(label);
}
