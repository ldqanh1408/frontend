import { uuid } from '../lib/ids';
import { workspaceApi } from './service';

export type SshAuthMethod = 'private_key' | 'password' | 'ssh_certificate';
export type SshConnectionStatus = 'unverified' | 'ready' | 'degraded' | 'revoked';
export type SshTestStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type SshAgentPermission = 'connect' | 'exec' | 'sftp_read' | 'sftp_write';

export interface SshConnectionTestSummary {
  id: string;
  status: SshTestStatus;
  finishedAt: string | null;
}
export interface SshConnection {
  id: string;
  orgId: string;
  workspaceId: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: SshAuthMethod;
  credentialReference: string;
  hostKeyFingerprints: string[];
  status: SshConnectionStatus;
  lastTest: SshConnectionTestSummary | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
}
export interface SshConnectionInput {
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: SshAuthMethod;
  credentialReference: string;
  hostKeyFingerprints: string[];
}
export type SshConnectionPatch = Pick<SshConnectionInput, 'name' | 'host' | 'port' | 'username' | 'hostKeyFingerprints'>;
export interface SshConnectionTest {
  id: string;
  connectionId: string;
  status: SshTestStatus;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  result: {
    networkReachable: boolean | null;
    hostKeyVerified: boolean | null;
    authenticationSucceeded: boolean | null;
    elapsedMs: number | null;
    failureCode: string | null;
    message: string | null;
  } | null;
  operationId: string;
  auditEntryIds: string[];
}
export interface SshAgentBindingInput {
  projectId: string;
  agentRoleId: string;
  permissions: SshAgentPermission[];
  commandAllowlist: string[];
  pathAllowlist: string[];
}
export interface SshAgentBinding extends SshAgentBindingInput {
  id: string;
  connectionId: string;
  status: 'active' | 'revoked';
  createdAt: string;
  createdBy: string;
}
export interface SshConnectionListPage { items: SshConnection[]; nextCursor: string | null }
export interface SshMutation<T> { item: T; operationId: string; auditEntryId: string }
export interface SshBindingMutation { items: SshAgentBinding[]; operationId: string; auditEntryIds: string[] }

export const VAULT_REFERENCE_PATTERN = /^vault:\/\/[A-Za-z0-9][A-Za-z0-9._~-]*(?:\/[A-Za-z0-9][A-Za-z0-9._~-]*)+$/;
export const HOST_KEY_FINGERPRINT_PATTERN = /^SHA256:[A-Za-z0-9+/]{43}=?$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface SshConnectionFormValues {
  name: string;
  host: string;
  port: string;
  username: string;
  authMethod: SshAuthMethod;
  credentialReference: string;
  hostKeyFingerprints: string;
}
export type SshFormErrors = Partial<Record<keyof SshConnectionFormValues, string>>;

/** Validation catches common mistakes only; reachability, host identity and auth must be verified by the backend. */
export function validateSshConnection(values: SshConnectionFormValues, mode: 'create' | 'edit'): SshFormErrors {
  const errors: SshFormErrors = {};
  const name = values.name.trim();
  const host = values.host.trim();
  const username = values.username.trim();
  if (!name) errors.name = 'Enter a connection name.';
  else if (name.length > 120) errors.name = 'Use at most 120 characters.';
  if (!host) errors.host = 'Enter a DNS hostname or IP address.';
  else if (host.length > 253) errors.host = 'Use at most 253 characters.';
  else if (/\s|\/|@|#|\?|:\/\//.test(host) || host.includes('://')) errors.host = 'Enter only the host (no protocol, path, username or password).';
  else if (/^\d+(?:\.\d+){3}$/.test(host) && !isIPv4(host)) errors.host = 'Enter a valid IPv4 address; each octet must be from 0 to 255.';
  else if (!isHostLike(host)) errors.host = 'Enter a valid hostname, IPv4 or IPv6 address.';
  const port = Number(values.port);
  if (!values.port.trim() || !Number.isInteger(port) || port < 1 || port > 65535) errors.port = 'Port must be a whole number from 1 to 65535.';
  if (!username) errors.username = 'Enter the remote SSH username.';
  else if (username.length > 128 || /[\u0000-\u001f\u007f]/.test(username)) errors.username = 'Use at most 128 characters without control characters.';
  const fingerprints = splitLines(values.hostKeyFingerprints);
  if (fingerprints.length === 0) errors.hostKeyFingerprints = 'Add at least one trusted SHA256 host-key fingerprint.';
  else if (fingerprints.some((f) => !HOST_KEY_FINGERPRINT_PATTERN.test(f))) errors.hostKeyFingerprints = 'Each line must be an OpenSSH SHA256 fingerprint, for example SHA256:<43-character-base64-digest>.';
  else if (new Set(fingerprints).size !== fingerprints.length) errors.hostKeyFingerprints = 'Remove duplicate fingerprints.';
  if (mode === 'create' || values.credentialReference.trim()) {
    const ref = values.credentialReference.trim();
    if (!ref) errors.credentialReference = 'Enter a Vault reference; raw credentials are never entered here.';
    else if (!VAULT_REFERENCE_PATTERN.test(ref) || ref.split('/').some((part) => part === '.' || part === '..') || ref.includes('\\')) errors.credentialReference = 'Use a scoped Vault reference like vault://workspace/infra/ssh/build-host. Do not paste the secret itself.';
  }
  return errors;
}

export function isValidUuid(value: string): boolean { return UUID_PATTERN.test(value.trim()); }
export function splitLines(value: string): string[] { return value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean); }

/** Store an IPv6 literal without URL-style brackets; brackets are only used when formatting host:port. */
export function normalizeSshHost(value: string): string {
  const host = value.trim();
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

export function formatSshHostPort(host: string, port: number): string {
  const normalized = normalizeSshHost(host);
  return `${normalized.includes(':') ? `[${normalized}]` : normalized}:${port}`;
}

function isHostLike(raw: string): boolean {
  const startsBracket = raw.startsWith('[');
  const endsBracket = raw.endsWith(']');
  if (startsBracket || endsBracket) {
    // Brackets are notation for an IPv6 literal in host:port displays, not a valid wrapper for DNS names.
    return startsBracket && endsBracket && isIPv6(raw.slice(1, -1));
  }
  const host = raw;
  if (isIPv4(host) || isIPv6(host)) return true;
  if (host.length > 253 || host.endsWith('.')) return host.length <= 254 && host.slice(0, -1).split('.').every(validDnsLabel);
  return host.split('.').every(validDnsLabel);
}
function validDnsLabel(label: string): boolean {
  return label.length >= 1 && label.length <= 63 && /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label);
}
function isIPv4(host: string): boolean {
  const parts = host.split('.');
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
function isIPv6(host: string): boolean {
  // URL implements IPv6 parsing without requiring a Node-only networking module.
  if (!host.includes(':') || !/^[0-9a-f:.]+$/i.test(host)) return false;
  try { return new URL(`http://[${host}]/`).hostname.length > 0; } catch { return false; }
}

export function validateBinding(binding: SshAgentBindingInput): string[] {
  const errors: string[] = [];
  if (!isValidUuid(binding.projectId)) errors.push('Project ID must be a UUID.');
  if (!isValidUuid(binding.agentRoleId)) errors.push('Agent Role ID must be a UUID.');
  if (!binding.permissions.length) errors.push('Choose at least one permission.');
  if (new Set(binding.permissions).size !== binding.permissions.length) errors.push('Remove duplicate permissions.');
  if (new Set(binding.commandAllowlist.map((x) => x.trim())).size !== binding.commandAllowlist.length) errors.push('Remove duplicate command allowlist entries.');
  if (new Set(binding.pathAllowlist.map((x) => x.trim())).size !== binding.pathAllowlist.length) errors.push('Remove duplicate SFTP path allowlist entries.');
  if (binding.permissions.some((p) => p !== 'connect') && !binding.permissions.includes('connect')) errors.push('Every Agent binding must include Connect; it is the base capability for SSH operations.');
  if (binding.permissions.includes('exec')) {
    if (!binding.commandAllowlist.length) errors.push('Execution requires at least one command in the allowlist.');
    if (binding.commandAllowlist.length > 50) errors.push('Use at most 50 command allowlist entries.');
  }
  if (binding.permissions.some((p) => p === 'sftp_read' || p === 'sftp_write')) {
    if (!binding.pathAllowlist.length) errors.push('SFTP access requires at least one allowed absolute path.');
    if (binding.pathAllowlist.length > 50) errors.push('Use at most 50 SFTP path allowlist entries.');
  }
  if (binding.pathAllowlist.some((path) => !path.startsWith('/') || path === '/' || path.length > 1000 || path.split('/').some((part) => part === '..' || part === '.') || path.includes('//') || path.endsWith('/') || path.includes('\\') || /[\u0000-\u001f\u007f]/.test(path))) {
    errors.push('Each SFTP path must be a narrow, normalized absolute path (not `/`), without `.`/`..` segments, duplicate/trailing separators, backslashes or control characters.');
  }
  if (binding.commandAllowlist.some((cmd) => !cmd.trim() || cmd.length > 500 || !cmd.trim().startsWith('/') || /[\u0000-\u001f\u007f]/.test(cmd) || /[;&|`$<>]/.test(cmd))) {
    errors.push('Commands must start with an absolute executable path, be at most 500 characters and contain no control characters or shell operators. The backend must still execute an argv array without invoking a shell.');
  }
  // A no-shell argv invocation can still execute arbitrary code if the allowlisted executable is itself a shell/interpreter.
  const commandLauncher = /^\/(?:bin|usr\/bin)\/(?:sh|bash|dash|zsh|fish|csh|tcsh)(?:\s|$)/i;
  const inlineInterpreter = /^\/(?:usr\/)?bin\/(?:python(?:[0-9]+(?:\.[0-9]+)?)?|node|perl|ruby|php)(?:\s+.*\s)?\s+(?:-c|-e|--command|--eval)(?:\s|$)/i;
  if (binding.commandAllowlist.some((cmd) => commandLauncher.test(cmd.trim()) || inlineInterpreter.test(cmd.trim()))) {
    errors.push('Do not allow shell launchers or interpreter inline-code flags in the command allowlist. Prefer a narrowly scoped executable with fixed arguments.');
  }
  return errors;
}

function encoded(id: string) { return encodeURIComponent(id); }
function root(workspaceId: string) { return `/api/workspace/workspaces/${encoded(workspaceId)}/ssh-connections`; }

export async function listSshConnections(workspaceId: string, query = '', cursor: string | null = null): Promise<SshConnectionListPage> {
  const params = new URLSearchParams({ limit: '100' });
  if (query.trim()) params.set('q', query.trim());
  if (cursor) params.set('cursor', cursor);
  const data = await workspaceApi<SshConnectionListPage>(`${root(workspaceId)}?${params.toString()}`);
  if (!data || !Array.isArray(data.items)) throw new Error('SSH list response did not contain an items array.');
  if (data.nextCursor !== null && data.nextCursor !== undefined && typeof data.nextCursor !== 'string') throw new Error('SSH list response contained an invalid pagination cursor.');
  return { items: data.items, nextCursor: data.nextCursor ?? null };
}
export async function createSshConnection(workspaceId: string, input: SshConnectionInput): Promise<SshMutation<SshConnection>> {
  return workspaceApi(root(workspaceId), { method: 'POST', body: input, idempotencyKey: uuid() });
}
export async function getSshConnection(connectionId: string): Promise<SshConnection> {
  const data = await workspaceApi<{ item: SshConnection }>(`/api/workspace/ssh-connections/${encoded(connectionId)}`);
  return data.item;
}
export async function updateSshConnection(connection: SshConnection, patch: SshConnectionPatch): Promise<SshMutation<SshConnection>> {
  return workspaceApi(`/api/workspace/ssh-connections/${encoded(connection.id)}`, { method: 'PATCH', body: patch, ifMatch: connection.version });
}
export async function startSshConnectionTest(connectionId: string): Promise<SshMutation<SshConnectionTest>> {
  return workspaceApi(`/api/workspace/ssh-connections/${encoded(connectionId)}/test`, { method: 'POST', body: {}, idempotencyKey: uuid() });
}
export async function getSshConnectionTest(testId: string): Promise<SshConnectionTest> {
  const data = await workspaceApi<{ item: SshConnectionTest }>(`/api/workspace/ssh-connection-tests/${encoded(testId)}`);
  return data.item;
}
export async function rotateSshCredential(connectionId: string, credentialReference: string, authMethod: SshAuthMethod, reason: string): Promise<SshMutation<SshConnection>> {
  return workspaceApi(`/api/workspace/ssh-connections/${encoded(connectionId)}/credential-rotations`, {
    method: 'POST', body: { credentialReference: credentialReference.trim(), authMethod, reason: reason.trim() }, idempotencyKey: uuid(),
  });
}
export async function listSshAgentBindings(connectionId: string): Promise<SshAgentBinding[]> {
  const data = await workspaceApi<{ items: SshAgentBinding[] }>(`/api/workspace/ssh-connections/${encoded(connectionId)}/agent-bindings`);
  if (!data || !Array.isArray(data.items)) throw new Error('Agent binding response did not contain an items array.');
  return data.items;
}
export async function replaceSshAgentBindings(connectionId: string, bindings: SshAgentBindingInput[]): Promise<SshBindingMutation> {
  return workspaceApi(`/api/workspace/ssh-connections/${encoded(connectionId)}/agent-bindings`, {
    method: 'PUT', body: { bindings }, idempotencyKey: uuid(),
  });
}
export async function revokeSshConnection(connectionId: string, reason: string): Promise<SshMutation<SshConnection>> {
  return workspaceApi(`/api/workspace/ssh-connections/${encoded(connectionId)}/revoke`, {
    method: 'POST', body: { reason: reason.trim() }, idempotencyKey: uuid(),
  });
}
