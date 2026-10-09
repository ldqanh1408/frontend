/** SRS v1.1 §7. Shared presentation of domain states; these never assert a service result. */
export const DOMAIN_STATES = {
  SpecDocument: ['Draft', 'In_Review', 'Conflicted', 'Merged', 'Locked', 'Submitted_To_AI', 'Implemented', 'Unlocked_Draft'],
  TaskDAG: ['Proposed', 'Plan_Approved', 'In_Progress', 'Completed', 'Paused', 'Failed', 'Rejected', 'Superseded'],
  SubTask: ['Pending', 'Ready', 'Waiting_Human_Checkpoint', 'Running', 'Completed', 'Failed_Paused', 'Blocked_Budget', 'Waiting_Lock', 'Revision_Required'],
  Lock: ['Unlocked', 'Locked', 'Released', 'Expired', 'Force_Released'],
  ApprovalGate: ['Initiated', 'Evaluated', 'Auto_Approved', 'Pending_Single_Sig', 'Pending_Multi_Sig', 'Approved', 'Rejected', 'Blocked_Missing_Role', 'Ready_For_PR'],
} as const;

const PRESENTATION: Record<string, { tone: string; icon: string; next: string }> = {
  draft: { tone: 'neutral', icon: 'edit', next: 'Finish and validate the draft.' },
  in_review: { tone: 'info', icon: 'eye', next: 'Review the exact document revision.' },
  conflicted: { tone: 'danger', icon: 'merge', next: 'Resolve conflicts before locking.' },
  merged: { tone: 'success', icon: 'merge', next: 'Inspect the merged revision before locking.' },
  unlocked_draft: { tone: 'neutral', icon: 'edit', next: 'Edit and review the unlocked draft before locking again.' },
  locked: { tone: 'accent', icon: 'lock', next: 'Submit to AI explicitly; locking does not generate a plan.' },
  submitted_to_ai: { tone: 'info', icon: 'send', next: 'Inspect the memory package and proposed plan.' },
  proposed: { tone: 'info', icon: 'workflow', next: 'Review and approve the plan before execution.' },
  plan_approved: { tone: 'success', icon: 'success', next: 'Confirm admission and current input revisions.' },
  pending: { tone: 'neutral', icon: 'clock', next: 'Wait for upstream dependencies to complete.' },
  ready: { tone: 'success', icon: 'play', next: 'Check the human gate and lock before starting.' },
  waiting_human_checkpoint: { tone: 'warning', icon: 'users', next: 'An authorized person must approve this checkpoint.' },
  running: { tone: 'info', icon: 'play', next: 'Inspect the current attempt and heartbeat.' },
  paused: { tone: 'warning', icon: 'pause', next: 'Inspect the safe checkpoint and current preconditions before resuming.' },
  in_progress: { tone: 'info', icon: 'play', next: 'Inspect active tasks and required checkpoints.' },
  completed: { tone: 'success', icon: 'success', next: 'Inspect durable artifacts and cleanup receipts.' },
  implemented: { tone: 'success', icon: 'success', next: 'Inspect post-merge drift verification.' },
  failed_paused: { tone: 'danger', icon: 'pause', next: 'Inspect the latest snapshot before retrying.' },
  failed: { tone: 'danger', icon: 'danger', next: 'Inspect the failed attempt before retrying.' },
  blocked_budget: { tone: 'warning', icon: 'gauge', next: 'Restore budget and inspect the safe checkpoint before resuming.' },
  waiting_lock: { tone: 'warning', icon: 'lock', next: 'Inspect the lock holder, heartbeat, TTL and queue.' },
  revision_required: { tone: 'warning', icon: 'edit', next: 'Revise the rejected change and obtain fresh review.' },
  blocked_missing_role: { tone: 'warning', icon: 'user-cog', next: 'Assign the missing independent reviewer before signing.' },
  pending_single_sig: { tone: 'warning', icon: 'shield', next: 'Obtain the required independent signature.' },
  pending_multi_sig: { tone: 'warning', icon: 'shield', next: 'Obtain distinct Tech Lead and Security Officer signatures.' },
  rejected: { tone: 'danger', icon: 'ban', next: 'Inspect the rejection; confirm lock release and sandbox cleanup.' },
  superseded: { tone: 'warning', icon: 'history', next: 'Open the replacement DAG. Do not resume this plan.' },
  expired: { tone: 'danger', icon: 'clock', next: 'Request a fresh authorized resource.' },
  force_released: { tone: 'warning', icon: 'lock', next: 'Inspect the lock release audit receipt.' },
  unlocked: { tone: 'neutral', icon: 'lock', next: 'Check the current revision before acquiring a lock.' },
  released: { tone: 'success', icon: 'lock', next: 'Inspect the release receipt before reacquiring a lock.' },
  initiated: { tone: 'info', icon: 'shield', next: 'Wait for risk evaluation of the current change.' },
  evaluated: { tone: 'info', icon: 'shield', next: 'Inspect all risk axes, veto reasons and required signatures.' },
  auto_approved: { tone: 'success', icon: 'shield', next: 'Inspect the policy evaluation and audit evidence.' },
  approved: { tone: 'success', icon: 'success', next: 'Verify the approved revision and independent signatures.' },
  ready_for_pr: { tone: 'success', icon: 'branch', next: 'Inspect the immutable PR input and CI requirements.' },
};
export function statePresentation(state: string) {
  const key = state.toLowerCase().replace(/[ -]+/g, '_');
  const value = PRESENTATION[key];
  return { label: state.replaceAll('_', ' '), tone: value?.tone ?? 'neutral', icon: value?.icon ?? 'info', next: value?.next ?? 'Inspect authoritative evidence before acting.' };
}
export function domainTone(state: string): string | undefined {
  return PRESENTATION[state.toLowerCase().replace(/[ -]+/g, '_')]?.tone;
}
