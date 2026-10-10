import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Badge, Banner, Button, EmptyState, KeyValue, PageHeader, Panel } from '../../components/ui';
import { Dialog } from '../../components/overlays';
import { capability, toast, useApp } from '../../data/app-store';
import { hasServiceCsrfToken, ServiceError} from '../../data/service';
import {
  createSshConnection, getSshConnectionTest, listSshAgentBindings, listSshConnections, replaceSshAgentBindings,
  revokeSshConnection, rotateSshCredential, splitLines, startSshConnectionTest, updateSshConnection,
  validateBinding, validateSshConnection, VAULT_REFERENCE_PATTERN, formatSshHostPort, normalizeSshHost,
  type SshAgentBinding, type SshAgentBindingInput, type SshAgentPermission, type SshConnection,
  type SshConnectionFormValues, type SshConnectionInput, type SshConnectionTest,
} from '../../data/ssh';
import { usePageMeta } from '../../shell/page-meta';
import { ProvenanceBanner } from '../shared';
import { useCapability } from '../../data/app-store';

const PERMISSIONS: { id: SshAgentPermission; label: string; description: string }[] = [
  { id: 'connect', label: 'Connect', description: 'Open an SSH session; no command execution is implied.' },
  { id: 'exec', label: 'Execute allowlisted commands', description: 'Requires an explicit command allowlist.' },
  { id: 'sftp_read', label: 'Read through SFTP', description: 'Limited to the allowed absolute paths.' },
  { id: 'sftp_write', label: 'Write through SFTP', description: 'High impact; limited to the allowed absolute paths.' },
];
const BLANK: SshConnectionFormValues = {
  name: '', host: '', port: '22', username: '', authMethod: 'private_key', credentialReference: '', hostKeyFingerprints: '',
};
const UUID = 'e.g. 4a3f4b17-0df2-4fe2-9f01-4a0e8d2da020';

function Field({ id, label, required, hint, error, children }: {
  id: string; label: string; required?: boolean; hint?: string; error?: string; children: ReactNode;
}) {
  return <div className="field">
    <label className="field-label" htmlFor={id}>{label}{required && <span className="req" aria-hidden="true"> *</span>}</label>
    {children}
    <small className={error ? 'field-error' : 'field-hint'} id={`${id}-hint`} role={error ? 'alert' : undefined}>{error ?? hint}</small>
  </div>;
}

function toValues(c?: SshConnection): SshConnectionFormValues {
  if (!c) return { ...BLANK };
  return { name: c.name, host: c.host, port: String(c.port), username: c.username, authMethod: c.authMethod, credentialReference: '', hostKeyFingerprints: c.hostKeyFingerprints.join('\n') };
}
function toInput(v: SshConnectionFormValues): SshConnectionInput {
  return {
    name: v.name.trim(), host: normalizeSshHost(v.host), port: Number(v.port), username: v.username.trim(), authMethod: v.authMethod,
    credentialReference: v.credentialReference.trim(), hostKeyFingerprints: splitLines(v.hostKeyFingerprints),
  };
}
function toPatch(v: SshConnectionFormValues) {
  return { name: v.name.trim(), host: normalizeSshHost(v.host), port: Number(v.port), username: v.username.trim(), hostKeyFingerprints: splitLines(v.hostKeyFingerprints) };
}
function errorText(e: unknown): string { return e instanceof Error ? e.message : 'The SSH request could not be completed.'; }
function uncertain(e: unknown): boolean { return !(e instanceof ServiceError) || e.kind === 'network' || e.kind === 'timeout' || e.kind === 'protocol' || (e.kind === 'http' && (e.status ?? 0) >= 500); }
function timestamp(value?: string | null): string { return value ? new Date(value).toLocaleString() : 'Not observed'; }
function authMethodLabel(method: SshConnectionFormValues['authMethod']): string {
  if (method === 'password') return 'Password';
  if (method === 'ssh_certificate') return 'SSH certificate';
  return 'Private key';
}
function statusTone(status: string): string {
  if (status === 'ready' || status === 'succeeded' || status === 'active') return 'success';
  if (status === 'degraded' || status === 'unverified' || status === 'queued' || status === 'running') return 'warning';
  if (status === 'revoked' || status === 'failed') return 'danger';
  return 'neutral';
}

export default function SSHConnectionsPage() {
  usePageMeta('SSH connections', [{ label: 'Resources', to: '/resources' }, { label: 'SSH connections' }]);
  const connectionState = useApp((s) => s.connection);
  const session = useApp((s) => s.session);
  const workspaceId = session?.scope.workspace ?? null;
  const canView = useCapability('ssh_connection:view', 'view SSH connections');
  const canCreate = capability('ssh_connection:create', 'create an SSH connection');
  const canUpdate = capability('ssh_connection:update', 'update SSH connection metadata');
  const canTest = capability('ssh_connection:test', 'test an SSH connection');
  const canRotate = capability('ssh_connection:rotate_credential', 'rotate the Vault credential reference');
  const canBind = capability('ssh_connection:bind_agent', 'change Agent access bindings');
  const canRevoke = capability('ssh_connection:revoke', 'revoke an SSH connection');
  const csrfReason = hasServiceCsrfToken() ? '' : 'The connected service did not provide a CSRF token; write actions are blocked.';
  const workspaceReason = workspaceId ? '' : 'The authorized session did not expose a Workspace ID. No Workspace is inferred from a label.';
  const [items, setItems] = useState<SshConnection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [bindingOpen, setBindingOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [form, setForm] = useState<SshConnectionFormValues>({ ...BLANK });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof SshConnectionFormValues, string>>>({});
  const [formBusy, setFormBusy] = useState(false);
  const [rotateRef, setRotateRef] = useState('');
  const [rotateAuthMethod, setRotateAuthMethod] = useState<SshConnectionFormValues['authMethod']>('private_key');
  const [rotateReason, setRotateReason] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [testResult, setTestResult] = useState<SshConnectionTest | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [bindings, setBindings] = useState<SshAgentBinding[]>([]);
  const [bindingsLoading, setBindingsLoading] = useState(false);
  const [bindingsError, setBindingsError] = useState<string | null>(null);
  const [removedBindingIds, setRemovedBindingIds] = useState<string[]>([]);
  const [bindingDraft, setBindingDraft] = useState<SshAgentBindingInput>({ projectId: '', agentRoleId: '', permissions: ['connect'], commandAllowlist: [], pathAllowlist: [] });
  const [commandAllowlist, setCommandAllowlist] = useState('');
  const [pathAllowlist, setPathAllowlist] = useState('');
  const [bindingErrors, setBindingErrors] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<{ title: string; state: 'Effective' | 'Accepted' | 'Rejected' | 'Unknown'; message: string; operationId?: string; auditEntryIds?: string[] } | null>(null);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);
  const listRequestId = useRef(0);
  const scopeKey = session ? `${session.serviceUrl}|${session.audience}|${session.scope.org ?? ''}|${workspaceId ?? ''}` : '';
  const previousScopeKey = useRef(scopeKey);
  const bindingRequestId = useRef(0);
  const selectedIdRef = useRef(selectedId);
  const scopeKeyRef = useRef(scopeKey);
  // Keep async callbacks tied to the committed scope/selection, not values from when they started.
  useLayoutEffect(() => { selectedIdRef.current = selectedId; scopeKeyRef.current = scopeKey; }, [selectedId, scopeKey]);
  const mutationGate = (grant: { ok: boolean; reason: string }) => grant.ok ? (workspaceReason || csrfReason || '') : grant.reason;

  const loadConnections = useCallback(async (search = '', cursor: string | null = null, append = false) => {
    const requestId = ++listRequestId.current;
    if (!canView.ok || !workspaceId) {
      setItems([]); setSelectedId(null); setTestResult(null); setNextCursor(null); setListError(null); setLoading(false); setLoadingMore(false);
      return;
    }
    if (append) setLoadingMore(true); else { setLoading(true); setLoadingMore(false); setNextCursor(null); }
    setListError(null);
    try {
      const page = await listSshConnections(workspaceId, search, cursor);
      // Ignore a slow response from a prior Workspace/scope or an older search request.
      if (requestId !== listRequestId.current) return;
      setItems((current) => {
        if (!append) return page.items;
        const merged = new Map(current.map((item) => [item.id, item]));
        for (const item of page.items) merged.set(item.id, item);
        return [...merged.values()];
      });
      setSelectedId((current) => current && (append || page.items.some((x) => x.id === current)) ? current : page.items[0]?.id ?? null);
      setNextCursor(page.nextCursor);
    } catch (e) {
      if (requestId === listRequestId.current) {
        setListError(errorText(e));
        if (!append) { setItems([]); setSelectedId(null); setTestResult(null); setNextCursor(null); }
      }
    } finally {
      if (requestId === listRequestId.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [canView.ok, workspaceId]);

  useEffect(() => {
    if (previousScopeKey.current === scopeKey) return;
    previousScopeKey.current = scopeKey;
    // Clear data immediately at a scope boundary so a stale host/credential reference is never shown cross-Workspace.
    setItems([]); setSelectedId(null); setTestResult(null); setNextCursor(null); setBindings([]); setBindingsError(null); setRemovedBindingIds([]); setBindingOpen(false); setBindingsLoading(false); setListError(null); setLoading(false); setLoadingMore(false);
    setCreateOpen(false); setEditOpen(false); setRotateOpen(false); setRevokeOpen(false); setForm({ ...BLANK }); setFormErrors({}); setRotateRef(''); setRotateReason(''); setRevokeReason(''); setBindingDraft({ projectId: '', agentRoleId: '', permissions: ['connect'], commandAllowlist: [], pathAllowlist: [] }); setCommandAllowlist(''); setPathAllowlist(''); setBindingErrors([]);
    setReceipt(null);
    listRequestId.current += 1;
    bindingRequestId.current += 1;
  }, [scopeKey]);
  useEffect(() => { void loadConnections(''); return () => { listRequestId.current += 1; }; }, [loadConnections, scopeKey]);
  useEffect(() => { setTestResult(null); }, [selectedId]);
  useEffect(() => {
    if (selected?.lastTest?.id && !testResult && canView.ok) {
      let live = true;
      void getSshConnectionTest(selected.lastTest.id).then((result) => { if (live) setTestResult(result); }).catch(() => { /* list summary remains visible; full result is not inferred */ });
      return () => { live = false; };
    }
    return undefined;
  }, [selected?.id, selected?.lastTest?.id, canView.ok, testResult]);

  useEffect(() => {
    if (!testResult || (testResult.status !== 'queued' && testResult.status !== 'running') || !canView.ok) return undefined;
    let live = true;
    const poll = async () => {
      try {
        const latest = await getSshConnectionTest(testResult.id);
        if (!live || selectedIdRef.current !== latest.connectionId) return;
        setTestResult(latest);
        if (latest.status === 'succeeded' || latest.status === 'failed') await loadConnections();
      } catch {
        // Keep the last known test state visible; a poll failure is not a failed SSH test.
      }
    };
    const timer = window.setInterval(() => { void poll(); }, 2500);
    return () => { live = false; window.clearInterval(timer); };
  }, [testResult?.id, testResult?.status, canView.ok, loadConnections]);

  const refreshTest = async () => {
    if (!testResult) return;
    const requestedConnectionId = testResult.connectionId;
    const actionScopeKey = scopeKeyRef.current;
    setTestBusy(true);
    try {
      const latest = await getSshConnectionTest(testResult.id);
      if (scopeKeyRef.current !== actionScopeKey || selectedIdRef.current !== requestedConnectionId) return;
      setTestResult(latest);
      if (latest.status === 'succeeded' || latest.status === 'failed') await loadConnections();
    } catch (e) { if (scopeKeyRef.current !== actionScopeKey) return; setReceipt({ title: 'Refresh SSH test', state: 'Unknown', message: errorText(e) }); }
    finally { setTestBusy(false); }
  };

  const beginCreate = () => { setForm({ ...BLANK }); setFormErrors({}); setCreateOpen(true); };
  const beginEdit = () => { if (!selected) return; setForm(toValues(selected)); setFormErrors({}); setEditOpen(true); };

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    const actionScopeKey = scopeKeyRef.current;
    const errors = validateSshConnection(form, 'create'); setFormErrors(errors);
    if (Object.keys(errors).length || !workspaceId || mutationGate(canCreate)) return;
    setFormBusy(true); setReceipt(null);
    try {
      const result = await createSshConnection(workspaceId, toInput(form));
      if (scopeKeyRef.current !== actionScopeKey) return;
      setCreateOpen(false); setItems((curr) => [result.item, ...curr.filter((c) => c.id !== result.item.id)]); setSelectedId(result.item.id);
      setReceipt({ title: 'Create SSH connection', state: 'Effective', message: 'The backend returned a connection record and audit receipt. This does not mean SSH auth succeeded; run Test connection.', operationId: result.operationId, auditEntryIds: [result.auditEntryId] });
      toast({ tone: 'success', title: 'SSH connection created', body: `${result.item.name} · audit receipt returned by the backend`, kind: 'operation' });
      await loadConnections();
    } catch (e) {
      if (scopeKeyRef.current !== actionScopeKey) return;
      setReceipt({ title: 'Create SSH connection', state: uncertain(e) ? 'Unknown' : 'Rejected', message: `${errorText(e)} ${uncertain(e) ? 'The outcome is not confirmed. Refresh the list before retrying; no automatic resend was performed.' : 'The backend did not accept the request.'}` });
    } finally { setFormBusy(false); }
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault(); if (!selected) return;
    const actionScopeKey = scopeKeyRef.current;
    const errors = validateSshConnection(form, 'edit'); setFormErrors(errors);
    if (Object.keys(errors).length || mutationGate(canUpdate)) return;
    setFormBusy(true); setReceipt(null);
    try {
      const result = await updateSshConnection(selected, toPatch(form));
      if (scopeKeyRef.current !== actionScopeKey) return;
      setEditOpen(false); setItems((curr) => curr.map((c) => c.id === result.item.id ? result.item : c));
      setReceipt({ title: 'Update SSH connection', state: 'Effective', message: 'The backend returned the updated version and audit receipt. Re-test if host, username or trusted host key changed.', operationId: result.operationId, auditEntryIds: [result.auditEntryId] });
    } catch (e) {
      if (scopeKeyRef.current !== actionScopeKey) return;
      setReceipt({ title: 'Update SSH connection', state: uncertain(e) ? 'Unknown' : 'Rejected', message: `${errorText(e)} ${uncertain(e) ? 'Refresh the record before retrying; no automatic resend was performed.' : ''}` });
    } finally { setFormBusy(false); }
  };

  const runTest = async () => {
    if (!selected || mutationGate(canTest)) return;
    const testedConnectionId = selected.id;
    const actionScopeKey = scopeKeyRef.current;
    setTestBusy(true); setReceipt(null);
    try {
      const result = await startSshConnectionTest(testedConnectionId);
      if (scopeKeyRef.current !== actionScopeKey) return;
      if (selectedIdRef.current === testedConnectionId) setTestResult(result.item);
      setReceipt({ title: 'Test SSH connection', state: 'Accepted', message: 'The backend accepted a test job. Review its typed result; acceptance is not a successful SSH test.', operationId: result.operationId, auditEntryIds: [...new Set([result.auditEntryId, ...(result.item.auditEntryIds ?? [])])] });
      toast({ tone: 'info', title: 'SSH test requested', body: `Test ${result.item.id} · refresh the result for the outcome`, kind: 'operation' });
      await loadConnections();
    } catch (e) {
      if (scopeKeyRef.current !== actionScopeKey) return;
      setReceipt({ title: 'Test SSH connection', state: uncertain(e) ? 'Unknown' : 'Rejected', message: `${errorText(e)} ${uncertain(e) ? 'The test may have been queued. Refresh the selected connection before requesting another test.' : ''}` });
    } finally { setTestBusy(false); }
  };

  const submitRotation = async (event: FormEvent) => {
    event.preventDefault(); if (!selected) return;
    const actionScopeKey = scopeKeyRef.current;
    const ref = rotateRef.trim(); const reason = rotateReason.trim();
    if (!VAULT_REFERENCE_PATTERN.test(ref) || ref.split('/').includes('..') || !reason || reason.length > 500) return;
    if (mutationGate(canRotate)) return;
    setFormBusy(true); setReceipt(null);
    try {
      const result = await rotateSshCredential(selected.id, ref, rotateAuthMethod, reason);
      if (scopeKeyRef.current !== actionScopeKey) return;
      setRotateOpen(false); setRotateRef(''); setRotateReason('');
      setItems((curr) => curr.map((c) => c.id === result.item.id ? result.item : c));
      setTestResult(null);
      setReceipt({ title: 'Rotate Vault reference', state: 'Effective', message: 'The connection now points to the replacement Vault reference. Re-test before assigning new work to Agents.', operationId: result.operationId, auditEntryIds: [result.auditEntryId] });
    } catch (e) {
      if (scopeKeyRef.current !== actionScopeKey) return;
      setReceipt({ title: 'Rotate Vault reference', state: uncertain(e) ? 'Unknown' : 'Rejected', message: `${errorText(e)} ${uncertain(e) ? 'Do not rotate again until the connection is refreshed and the outcome is reconciled.' : ''}` });
    } finally { setFormBusy(false); }
  };

  const runRevoke = async (event: FormEvent) => {
    event.preventDefault(); if (!selected) return;
    const actionScopeKey = scopeKeyRef.current;
    const reason = revokeReason.trim(); if (!reason || reason.length > 500 || mutationGate(canRevoke)) return;
    setFormBusy(true); setReceipt(null);
    try {
      const result = await revokeSshConnection(selected.id, reason);
      if (scopeKeyRef.current !== actionScopeKey) return;
      setRevokeOpen(false); setRevokeReason(''); setItems((curr) => curr.map((c) => c.id === result.item.id ? result.item : c));
      setReceipt({ title: 'Revoke SSH connection', state: 'Effective', message: 'The backend returned a revoked connection and audit receipt. Vault secret deletion is separate and was not requested.', operationId: result.operationId, auditEntryIds: [result.auditEntryId] });
    } catch (e) {
      if (scopeKeyRef.current !== actionScopeKey) return;
      setReceipt({ title: 'Revoke SSH connection', state: uncertain(e) ? 'Unknown' : 'Rejected', message: `${errorText(e)} ${uncertain(e) ? 'Refresh the connection state before retrying.' : ''}` });
    } finally { setFormBusy(false); }
  };

  const openBindings = async () => {
    // Reading existing bindings uses the read grant; write authorization is checked when saving.
    if (!selected || !canView.ok) return;
    const requestId = ++bindingRequestId.current;
    const connectionId = selected.id;
    const requestedScopeKey = scopeKeyRef.current;
    setBindingOpen(true); setBindingsLoading(true); setBindingsError(null); setBindingErrors([]); setRemovedBindingIds([]);
    setBindingDraft({ projectId: '', agentRoleId: '', permissions: ['connect'], commandAllowlist: [], pathAllowlist: [] }); setCommandAllowlist(''); setPathAllowlist('');
    try {
      const next = await listSshAgentBindings(connectionId);
      if (requestId === bindingRequestId.current && scopeKeyRef.current === requestedScopeKey && selectedIdRef.current === connectionId) setBindings(next);
    } catch (e) {
      if (requestId === bindingRequestId.current && scopeKeyRef.current === requestedScopeKey && selectedIdRef.current === connectionId) { setBindingsError(errorText(e)); setBindings([]); }
    } finally { if (requestId === bindingRequestId.current) setBindingsLoading(false); }
  };

  const togglePermission = (permission: SshAgentPermission, checked: boolean) => setBindingDraft((old) => ({
    ...old,
    permissions: checked ? [...old.permissions.filter((p) => p !== permission), permission] : old.permissions.filter((p) => p !== permission),
  }));
  const saveBindings = async (event: FormEvent) => {
    event.preventDefault(); if (!selected) return;
    const actionScopeKey = scopeKeyRef.current;
    const connectionId = selected.id;
    const hasDraft = Boolean(bindingDraft.projectId.trim() || bindingDraft.agentRoleId.trim() || commandAllowlist.trim() || pathAllowlist.trim() || bindingDraft.permissions.length !== 1 || bindingDraft.permissions[0] !== 'connect');
    const draft = { ...bindingDraft, commandAllowlist: splitLines(commandAllowlist), pathAllowlist: splitLines(pathAllowlist) };
    const errors = hasDraft ? validateBinding(draft) : [];
    setBindingErrors(errors);
    if (errors.length || (!hasDraft && removedBindingIds.length === 0) || mutationGate(canBind)) return;
    const existing = bindings.filter((b) => b.status === 'active' && !removedBindingIds.includes(b.id)).map((b) => ({
      projectId: b.projectId, agentRoleId: b.agentRoleId, permissions: b.permissions, commandAllowlist: b.commandAllowlist ?? [], pathAllowlist: b.pathAllowlist ?? [],
    }));
    if (hasDraft && selected.status !== 'ready') {
      setBindingErrors(['New Agent bindings require a connection status of ready. Test or repair the connection first; existing bindings can still be removed.']);
      return;
    }
    const desired = hasDraft ? [...existing, draft] : existing;
    setFormBusy(true); setReceipt(null);
    try {
      const result = await replaceSshAgentBindings(connectionId, desired);
      if (scopeKeyRef.current !== actionScopeKey || selectedIdRef.current !== connectionId) return;
      setBindings(result.items); setRemovedBindingIds([]); setBindingOpen(false);
      setReceipt({ title: 'Update Agent bindings', state: 'Effective', message: 'The backend replaced the binding set atomically and returned audit receipts. Each run must still be authorized at execution time.', operationId: result.operationId, auditEntryIds: result.auditEntryIds });
    } catch (e) {
      if (scopeKeyRef.current !== actionScopeKey || selectedIdRef.current !== connectionId) return;
      setReceipt({ title: 'Update Agent bindings', state: uncertain(e) ? 'Unknown' : 'Rejected', message: `${errorText(e)} ${uncertain(e) ? 'Refresh bindings before retrying; the write outcome is unknown.' : ''}` });
    } finally { setFormBusy(false); }
  };

  const showWorkspaceBlock = connectionState === 'connected' && !workspaceId;

  return <div className="page">
    <PageHeader title="SSH connections" purpose="Register remote infrastructure at Workspace scope, keep credentials in Vault, verify host identity and grant Agents only the operations they need."
      actions={<>
        <Button icon="refresh" onClick={() => void loadConnections(query)} blocked={!canView.ok ? canView.reason : workspaceReason || undefined}>Refresh</Button>
        <Button icon="plus" variant="primary" onClick={beginCreate} blocked={mutationGate(canCreate) || undefined}>New connection</Button>
      </>} />
    <ProvenanceBanner detail="Backend SSH routes are defined in the draft contract. No SSH session is opened by this browser; test and Agent execution must run server-side." />
    {showWorkspaceBlock && <Banner tone="warning" title="Workspace scope is incomplete">The connected session provides a scope label but no explicit workspaceId. Atlas will not derive an identifier from that label; update the backend session DTO to provide scopeIds.workspaceId.</Banner>}
    {!canView.ok && <Banner tone="info" title="SSH records are not available in this session">{canView.reason} Connect a Workspace session and request the explicit SSH view grant before listing these records.</Banner>}
    {listError && <Banner tone="danger" title="Could not load SSH connections" role="alert">{listError}</Banner>}
    <div className="split-wide ssh-layout">
      <Panel title="Workspace connections" actions={<span className="caption">{items.length} observed</span>}>
        <div className="panel-pad stack-12">
          <form className="row" onSubmit={(e) => { e.preventDefault(); void loadConnections(query, null, false); }}>
            <input className="input" type="search" aria-label="Search SSH connections" placeholder="Search by name, host or username" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Button type="submit" blocked={!canView.ok ? canView.reason : workspaceReason || undefined}>Search</Button>
          </form>
          {loading && <p className="caption" role="status">Loading authorized SSH records…</p>}
          {loadingMore && <p className="caption" role="status">Loading more SSH connections…</p>}
          {!loading && canView.ok && workspaceId && !listError && items.length === 0 && <EmptyState icon="terminal" title="No SSH connections returned">The backend has not returned any SSH connections for this Workspace. A local draft is not a usable remote connection.</EmptyState>}
          {!canView.ok || !workspaceId ? <p className="caption">Connection records are not loaded until the authorized Workspace scope is known.</p> : null}
          {items.length > 0 && <div className="ssh-record-list" role="list" aria-label="SSH connections">
            {items.map((item) => <button key={item.id} type="button" className="ssh-record" aria-selected={selected?.id === item.id} onClick={() => setSelectedId(item.id)}>
              <span className="row-between"><strong>{item.name}</strong><Badge tone={statusTone(item.status)}>{item.status}</Badge></span>
              <span className="mono">{item.username}@{formatSshHostPort(item.host, item.port)}</span>
              <span className="caption">{authMethodLabel(item.authMethod)} via Vault · updated {timestamp(item.updatedAt)}</span>
            </button>)}
          </div>}
          {nextCursor && <div className="row"><Button icon="chevrons-down" onClick={() => void loadConnections(query, nextCursor, true)} disabled={loadingMore} blocked={!canView.ok ? canView.reason : undefined}>{loadingMore ? 'Loading…' : 'Load more'}</Button></div>}
        </div>
      </Panel>
      <div className="stack-16">
        <Panel title={selected ? selected.name : 'Connection details'} actions={selected ? <Badge tone={statusTone(selected.status)}>{selected.status}</Badge> : undefined}>
          {!selected ? <EmptyState icon="mouse-pointer-click" title="Select a connection">Connection metadata, host-key verification, test results, Agent access and operation receipts appear here.</EmptyState> : <>
            <div className="panel-pad stack-12">
              <KeyValue items={[
                ['Host', <span className="mono" key="host">{formatSshHostPort(selected.host, selected.port)}</span>],
                ['Remote user', selected.username], ['Authentication', authMethodLabel(selected.authMethod)],
                ['Vault reference (not the secret)', <span className="mono break" key="ref">{selected.credentialReference}</span>],
                ['Trusted host keys', <span className="stack" key="keys">{selected.hostKeyFingerprints.map((fingerprint) => <span className="mono break" key={fingerprint}>{fingerprint}</span>)}</span>],
                ['Version', selected.version], ['Last updated', timestamp(selected.updatedAt)], ['Last test', selected.lastTest ? `${selected.lastTest.status} · ${timestamp(selected.lastTest.finishedAt)}` : 'Not observed'],
              ]} />
              <div className="row ssh-actions">
                <Button icon="pencil" onClick={beginEdit} blocked={mutationGate(canUpdate) || (selected.status === 'revoked' ? 'A revoked connection is immutable.' : '') || undefined}>Edit metadata</Button>
                <Button icon="plug" variant="primary" onClick={() => void runTest()} blocked={mutationGate(canTest) || (selected.status === 'revoked' ? 'A revoked connection cannot be tested.' : '') || undefined}>{testBusy ? 'Testing…' : 'Test connection'}</Button>
                <Button icon="users" onClick={() => void openBindings()} blocked={!canView.ok ? canView.reason : workspaceReason || undefined}>Agent access</Button>
              </div>
              <div className="row ssh-actions">
                <Button icon="key-round" onClick={() => { setRotateRef(''); setRotateAuthMethod(selected.authMethod); setRotateReason(''); setRotateOpen(true); }} blocked={mutationGate(canRotate) || (selected.status === 'revoked' ? 'A revoked connection cannot rotate credentials.' : '') || undefined}>Rotate Vault reference</Button>
                <Button icon="shield-ban" variant="danger" onClick={() => { setRevokeReason(''); setRevokeOpen(true); }} blocked={mutationGate(canRevoke) || (selected.status === 'revoked' ? 'This connection is already revoked.' : '') || undefined}>Revoke</Button>
              </div>
              {selected.status === 'unverified' && <Banner tone="warning" title="Not verified">Do not bind this connection to an Agent until a backend test confirms the SSH host key and authentication.</Banner>}
              {selected.status === 'degraded' && <Banner tone="warning" title="Connection is degraded">The latest backend state does not indicate a ready connection. Re-test and check the sanitized failure code.</Banner>}
              {selected.status === 'revoked' && <Banner tone="danger" title="Connection revoked">New tests and Agent use must be denied by the backend. The Vault secret is not automatically deleted.</Banner>}
            </div>
          </>}
        </Panel>
        <Panel title="Backend SSH test" actions={testResult ? <Badge tone={statusTone(testResult.status)}>{testResult.status}</Badge> : undefined}>
          {!selected?.lastTest && !testResult ? <EmptyState icon="activity" title="No test result observed">Use Test connection to request a backend-side test. This browser never opens a TCP or SSH connection to the host.</EmptyState> : !testResult ? <div className="panel-pad stack-8"><p className="secondary">The connection has a test summary, but the full result has not been returned.</p><Button onClick={() => void loadConnections()} blocked={!canView.ok ? canView.reason : undefined}>Refresh summary</Button></div> : <div className="panel-pad stack-12">
            <KeyValue items={[
              ['Network reachable', testResult.result?.networkReachable === null || testResult.result?.networkReachable === undefined ? 'Not observed' : testResult.result.networkReachable ? 'Yes' : 'No'],
              ['Host key verified', testResult.result?.hostKeyVerified === null || testResult.result?.hostKeyVerified === undefined ? 'Not observed' : testResult.result.hostKeyVerified ? 'Yes' : 'No'],
              ['Authentication succeeded', testResult.result?.authenticationSucceeded === null || testResult.result?.authenticationSucceeded === undefined ? 'Not observed' : testResult.result.authenticationSucceeded ? 'Yes' : 'No'],
              ['Elapsed', testResult.result?.elapsedMs == null ? 'Not observed' : `${testResult.result.elapsedMs} ms`],
              ['Failure code', testResult.result?.failureCode ?? '—'], ['Requested', timestamp(testResult.requestedAt)], ['Finished', timestamp(testResult.finishedAt)],
            ]} />
            {testResult.result?.message && <Banner tone={testResult.status === 'failed' ? 'danger' : testResult.status === 'succeeded' ? 'success' : 'info'} title="Sanitized backend result">{testResult.result.message}</Banner>}
            <div className="row"><Button icon="refresh" onClick={() => void refreshTest()} disabled={testBusy} blocked={!canView.ok ? canView.reason : undefined}>{testBusy ? 'Refreshing…' : 'Refresh test result'}</Button></div>
            <p className="caption mono break">Test {testResult.id} · operation {testResult.operationId}</p>
            {(testResult.auditEntryIds ?? []).length > 0 && <p className="caption mono break">Audit {(testResult.auditEntryIds ?? []).join(' · ')}</p>}
          </div>}
        </Panel>
        <Panel title="Agent bindings" actions={<span className="caption">Least privilege · runtime re-authorization</span>}>
          <div className="panel-pad stack-12">
            <p className="secondary">A connection alone does not grant an Agent SSH access. Bind an exact Agent Role and Project, then allow only connect, allowlisted commands, or path-limited SFTP. The backend must re-check binding and scope for every run.</p>
            <Button icon="settings-2" onClick={() => void openBindings()} blocked={mutationGate(canView) || (!selected ? 'Select a connection first.' : '') || undefined}>View / manage bindings</Button>
          </div>
        </Panel>
      </div>
    </div>
    {receipt && <Panel title={receipt.title} actions={<Badge tone={statusTone(receipt.state)}>{receipt.state}</Badge>}>
      <div className="panel-pad stack-8"><p className="secondary">{receipt.message}</p>{receipt.operationId && <p className="caption mono break">Operation {receipt.operationId}</p>}{receipt.auditEntryIds?.length ? <p className="caption mono break">Audit {receipt.auditEntryIds.join(' · ')}</p> : null}</div>
    </Panel>}
    <Panel title="Credential and execution safety">
      <div className="panel-pad stack-8">
        <p className="secondary">Only the Vault reference is handled here. Private keys, passwords and passphrases must be provisioned into Vault through an authorized workflow; this form never accepts secret material.</p>
        <p className="secondary">Host-key fingerprints must come from a trusted infrastructure source. A first-seen host key is not automatically trusted. The backend must enforce egress/SSRF policy, validate key ownership, redact logs and audit every mutation and use.</p>
        <p className="caption">Workspace: {workspaceId ?? 'Not exposed by current session'} · Scope: {session?.scope.label ?? 'No session'}</p>
        <Link to="/connection" className="caption">Connection and session settings</Link>
      </div>
    </Panel>

    <Dialog open={createOpen} onOpenChange={(open) => !formBusy && setCreateOpen(open)} title="New SSH connection" description="Create metadata at Workspace scope. The backend does not receive a private key or password; only a Vault reference is sent." wide footer={<><Button onClick={() => setCreateOpen(false)} disabled={formBusy}>Cancel</Button><Button type="submit" form="ssh-create-form" variant="primary" disabled={formBusy} blocked={mutationGate(canCreate) || undefined}>{formBusy ? 'Creating…' : 'Create connection'}</Button></>}>
      <form id="ssh-create-form" onSubmit={submitCreate} className="stack-16" noValidate>
        <ConnectionFields values={form} errors={formErrors} create onChange={setForm} />
        {workspaceReason && <Banner tone="warning" title="Workspace ID missing">{workspaceReason}</Banner>}
        {csrfReason && <Banner tone="warning" title="Write token missing">{csrfReason}</Banner>}
      </form>
    </Dialog>

    <Dialog open={editOpen} onOpenChange={(open) => !formBusy && setEditOpen(open)} title="Edit SSH metadata" description="Credential material and Vault reference are changed only through the rotate-reference action." wide footer={<><Button onClick={() => setEditOpen(false)} disabled={formBusy}>Cancel</Button><Button type="submit" form="ssh-edit-form" variant="primary" disabled={formBusy} blocked={mutationGate(canUpdate) || undefined}>{formBusy ? 'Saving…' : 'Save changes'}</Button></>}>
      <form id="ssh-edit-form" onSubmit={submitEdit} className="stack-16" noValidate>
        <ConnectionFields values={form} errors={formErrors} create={false} onChange={setForm} />
        {selected && <Banner tone="info" title="Credential unchanged">Current reference: <span className="mono">{selected.credentialReference}</span>. To use a different secret, rotate the Vault reference separately.</Banner>}
      </form>
    </Dialog>

    <Dialog open={rotateOpen} onOpenChange={(open) => !formBusy && setRotateOpen(open)} title="Rotate Vault reference" description="Point the connection at a replacement Vault secret and select its credential type. Secret values are never entered into Atlas. Changing auth type requires an explicit audited rotation." footer={<><Button onClick={() => setRotateOpen(false)} disabled={formBusy}>Cancel</Button><Button type="submit" form="ssh-rotate-form" variant="primary" disabled={formBusy || !VAULT_REFERENCE_PATTERN.test(rotateRef.trim()) || rotateRef.trim().split('/').includes('..') || !rotateReason.trim()} blocked={mutationGate(canRotate) || undefined}>{formBusy ? 'Rotating…' : 'Rotate reference'}</Button></>}>
      <form id="ssh-rotate-form" className="stack-16" onSubmit={submitRotation} noValidate>
        <Field id="ssh-rotate-auth-method" label="Credential type" required hint="The backend must validate the secret payload type before switching the connection.">
          <select id="ssh-rotate-auth-method" className="select" value={rotateAuthMethod} onChange={(e) => setRotateAuthMethod(e.target.value as SshConnectionFormValues['authMethod'])}>
            <option value="private_key">SSH private key</option><option value="password">SSH password</option><option value="ssh_certificate">SSH certificate (private key + signed user certificate)</option>
          </select>
        </Field>
        <Field id="ssh-rotate-ref" label="Replacement Vault reference" required hint="Example: vault://workspace/infra/ssh/build-host-v2">
          <input id="ssh-rotate-ref" className="input mono" value={rotateRef} onChange={(e) => setRotateRef(e.target.value)} autoComplete="off" spellCheck={false} required />
        </Field>
        <Field id="ssh-rotate-reason" label="Reason" required hint="Recorded for audit. Do not put secret material in the reason.">
          <textarea id="ssh-rotate-reason" className="textarea" value={rotateReason} onChange={(e) => setRotateReason(e.target.value)} maxLength={500} required />
        </Field>
        {rotateRef && (!VAULT_REFERENCE_PATTERN.test(rotateRef.trim()) || rotateRef.trim().split('/').includes('..')) && <p className="field-error">Enter a valid Vault reference; never paste the secret itself.</p>}
      </form>
    </Dialog>

    <Dialog open={bindingOpen} onOpenChange={(open) => !formBusy && setBindingOpen(open)} title="Agent SSH access bindings" description="PUT replaces the full binding set atomically. Only modify bindings for the selected connection." wide footer={<><Button onClick={() => setBindingOpen(false)} disabled={formBusy}>Cancel</Button><Button type="submit" form="ssh-bindings-form" variant="primary" disabled={formBusy || bindingsLoading || Boolean(bindingsError) || (removedBindingIds.length === 0 && !bindingDraft.projectId.trim() && !bindingDraft.agentRoleId.trim() && !commandAllowlist.trim() && !pathAllowlist.trim())} blocked={mutationGate(canBind) || undefined}>{formBusy ? 'Saving…' : 'Save binding set'}</Button></>}>
      <form id="ssh-bindings-form" onSubmit={saveBindings} className="stack-16" noValidate>
        {bindingsLoading && <p className="caption" role="status">Loading binding set…</p>}
        {bindingsError && <Banner tone="danger" title="Could not load current bindings">{bindingsError} The current full binding set was not changed.</Banner>}
        {!bindingsLoading && !bindingsError && <>
          <div className="stack-8"><h3>Current bindings</h3>
            {bindings.filter((b) => b.status === 'active' && !removedBindingIds.includes(b.id)).length === 0 ? <p className="caption">No active binding will be retained unless you add one below.</p> : bindings.filter((b) => b.status === 'active' && !removedBindingIds.includes(b.id)).map((b) => <div className="ssh-binding-row" key={b.id}>
              <div className="stack-4"><strong className="mono">{b.agentRoleId}</strong><span className="caption">Project {b.projectId}</span><span className="caption">{b.permissions.join(', ')}</span>{b.commandAllowlist.length > 0 && <span className="caption">Commands: {b.commandAllowlist.join(' · ')}</span>}{b.pathAllowlist.length > 0 && <span className="caption">Paths: {b.pathAllowlist.join(' · ')}</span>}</div>
              <Button compact variant="danger" icon="minus-circle" onClick={() => setRemovedBindingIds((curr) => [...curr, b.id])} blocked={mutationGate(canBind) || undefined}>Remove</Button>
            </div>)}
            {removedBindingIds.length > 0 && <p className="caption">{removedBindingIds.length} binding(s) marked for removal. They will not be changed until Save binding set succeeds.</p>}
          </div>
          <div className="ssh-binding-editor stack-12">
            <h3>Add one Agent binding</h3>
            <div className="form-grid">
              <Field id="ssh-bind-project" label="Project ID" hint="Must belong to this same Workspace.">
                <input id="ssh-bind-project" className="input mono" placeholder={UUID} value={bindingDraft.projectId} onChange={(e) => setBindingDraft((d) => ({ ...d, projectId: e.target.value }))} />
              </Field>
              <Field id="ssh-bind-role" label="Agent Role ID" hint="Use the exact Agent Role ID from the workflow. The backend validates the full relationship.">
                <input id="ssh-bind-role" className="input mono" placeholder={UUID} value={bindingDraft.agentRoleId} onChange={(e) => setBindingDraft((d) => ({ ...d, agentRoleId: e.target.value }))} />
              </Field>
            </div>
            <fieldset className="field"><legend className="field-label">Permissions</legend><div className="ssh-permission-list">{PERMISSIONS.map((p) => <label className="ssh-permission" key={p.id}><input type="checkbox" checked={bindingDraft.permissions.includes(p.id)} onChange={(e) => togglePermission(p.id, e.target.checked)} /><span><strong>{p.label}</strong><small className="field-hint">{p.description}</small></span></label>)}</div></fieldset>
            {bindingDraft.permissions.includes('exec') && <Field id="ssh-bind-commands" label="Command allowlist" required hint="One exact command specification per line; backend must enforce without unsafe shell interpolation.">
              <textarea id="ssh-bind-commands" className="textarea code" value={commandAllowlist} onChange={(e) => setCommandAllowlist(e.target.value)} placeholder="/usr/bin/systemctl status my-service" />
            </Field>}
            {bindingDraft.permissions.some((p) => p === 'sftp_read' || p === 'sftp_write') && <Field id="ssh-bind-paths" label="Absolute SFTP path allowlist" required hint="One absolute root per line. Paths containing `..` are rejected.">
              <textarea id="ssh-bind-paths" className="textarea code" value={pathAllowlist} onChange={(e) => setPathAllowlist(e.target.value)} placeholder="/srv/app/logs" />
            </Field>}
            {bindingErrors.length > 0 && <Banner tone="danger" title="Binding is invalid">{bindingErrors.join(' ')}</Banner>}
          </div>
        </>}
      </form>
    </Dialog>

    <Dialog open={revokeOpen} onOpenChange={(open) => !formBusy && setRevokeOpen(open)} title="Revoke SSH connection" description="This should immediately block new SSH tests and Agent use. It does not delete the underlying Vault secret." footer={<><Button onClick={() => setRevokeOpen(false)} disabled={formBusy}>Cancel</Button><Button type="submit" form="ssh-revoke-form" variant="danger" disabled={formBusy || !revokeReason.trim()} blocked={mutationGate(canRevoke) || undefined}>{formBusy ? 'Revoking…' : 'Revoke connection'}</Button></>}>
      <form id="ssh-revoke-form" className="stack-16" onSubmit={runRevoke} noValidate>
        <Field id="ssh-revoke-reason" label="Revocation reason" required hint="Required for the audit record.">
          <textarea id="ssh-revoke-reason" className="textarea" value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} maxLength={500} required />
        </Field>
      </form>
    </Dialog>
  </div>;
}

function ConnectionFields({ values, errors, create, onChange }: {
  values: SshConnectionFormValues; errors: Partial<Record<keyof SshConnectionFormValues, string>>; create: boolean; onChange: (values: SshConnectionFormValues) => void;
}) {
  const set = (key: keyof SshConnectionFormValues, value: string) => onChange({ ...values, [key]: value });
  return <div className="stack-16">
    <div className="form-grid">
      <Field id="ssh-name" label="Connection name" required error={errors.name} hint="A recognisable name such as Production app host.">
        <input id="ssh-name" className="input" value={values.name} onChange={(e) => set('name', e.target.value)} maxLength={120} required aria-describedby="ssh-name-hint" aria-invalid={Boolean(errors.name)} />
      </Field>
      <Field id="ssh-host" label="Host" required error={errors.host} hint="DNS or IP only; for IPv6 enter the address with or without brackets. Do not include protocol, username, password or port.">
        <input id="ssh-host" className="input mono" value={values.host} onChange={(e) => set('host', e.target.value)} maxLength={253} required autoCapitalize="none" spellCheck={false} aria-describedby="ssh-host-hint" aria-invalid={Boolean(errors.host)} />
      </Field>
      <Field id="ssh-port" label="SSH port" required error={errors.port} hint="Default: 22. The backend enforces network egress policy.">
        <input id="ssh-port" className="input" type="number" min={1} max={65535} step={1} value={values.port} onChange={(e) => set('port', e.target.value)} required aria-describedby="ssh-port-hint" aria-invalid={Boolean(errors.port)} />
      </Field>
      <Field id="ssh-username" label="Remote username" required error={errors.username} hint="Use a dedicated least-privilege remote account, not root where avoidable.">
        <input id="ssh-username" className="input" value={values.username} onChange={(e) => set('username', e.target.value)} maxLength={128} required autoCapitalize="none" autoComplete="off" aria-describedby="ssh-username-hint" aria-invalid={Boolean(errors.username)} />
      </Field>
    </div>
    {create && <>
      <Field id="ssh-auth-method" label="Authentication method" required hint="Private key is preferred. Password auth is available only if backend policy allows it.">
        <select id="ssh-auth-method" className="select" value={values.authMethod} onChange={(e) => set('authMethod', e.target.value as SshConnectionFormValues['authMethod'])}>
          <option value="private_key">SSH private key in Vault</option><option value="password">SSH password in Vault</option><option value="ssh_certificate">SSH certificate (private key + signed user certificate in Vault)</option>
        </select>
      </Field>
      <Field id="ssh-credential-ref" label="Credential Vault reference" required error={errors.credentialReference} hint={values.authMethod === 'private_key' ? 'Vault secret contains the SSH private key and optional passphrase; never paste the key here.' : values.authMethod === 'password' ? 'Vault secret contains the remote account password; never paste the password here.' : 'Vault secret contains the SSH private key, signed user certificate and optional passphrase; backend validates principal and validity.'}>
        <input id="ssh-credential-ref" className="input mono" value={values.credentialReference} onChange={(e) => set('credentialReference', e.target.value)} autoComplete="off" spellCheck={false} required aria-describedby="ssh-credential-ref-hint" aria-invalid={Boolean(errors.credentialReference)} placeholder="vault://workspace/infra/ssh/build-host" />
      </Field>
    </>}
    <Field id="ssh-host-fingerprint" label="Trusted SSH host-key fingerprint(s)" required error={errors.hostKeyFingerprints} hint="One OpenSSH SHA256 fingerprint per line from a trusted infrastructure inventory. First-seen keys are not trusted automatically.">
      <textarea id="ssh-host-fingerprint" className="textarea code" value={values.hostKeyFingerprints} onChange={(e) => set('hostKeyFingerprints', e.target.value)} required aria-describedby="ssh-host-fingerprint-hint" aria-invalid={Boolean(errors.hostKeyFingerprints)} placeholder="SHA256:..........................................." />
    </Field>
  </div>;
}
