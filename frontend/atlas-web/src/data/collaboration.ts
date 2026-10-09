import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import type { editor } from 'monaco-editor/esm/vs/editor/editor.api.js';
import { app, capability } from './app-store';
import { streamUrl } from './stream';
export interface CollaborationTarget { documentId: string; branchId: string }

export function bindCollaborativeEditor(view: editor.IStandaloneCodeEditor, target: CollaborationTarget, status: (s: string) => void): () => void {
  const session = app.get().session;
  const endpoint = session?.collaboration;
  const model = view.getModel();
  const gate = capability('collab:edit_realtime');
  if (!session || !endpoint || !model || !gate.ok || session.audience !== 'workspace' || endpoint.protocol !== 'y-websocket' || endpoint.grant !== 'collab:edit_realtime') {
    status(gate.ok ? 'Not observed — no authorized collaboration endpoint.' : gate.reason); return () => {};
  }
  const url = streamUrl(endpoint.href, session);
  if (!target.documentId || !target.branchId || typeof endpoint.roomPrefix !== 'string' || !endpoint.roomPrefix) throw new Error('An immutable scoped collaboration room is required.');
  const room = [endpoint.roomPrefix, session.scope.label, target.branchId, target.documentId].map(encodeURIComponent).join(':');
  const doc = new Y.Doc();
  // No client seeding of the shared document: the server owns initial state and revision.
  const provider = new WebsocketProvider(url, room, doc, { connect: false, disableBc: true, shouldReconnect: () => false });
  let binding: MonacoBinding | null = null;
  let closed = false;
  view.updateOptions({ readOnly: true });
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (closed) return; closed = true; clearTimeout(expiry); off(); window.removeEventListener('pagehide', stop);
    binding?.destroy(); provider.destroy(); doc.destroy(); view.updateOptions({ readOnly: true });
  };
  const off = app.subscribe(() => { if (app.get().session !== session || !capability('collab:edit_realtime').ok) { status('Collaboration ended — session or grants changed.'); stop(); } });
  provider.on('sync', synced => {
    if (!synced || closed || app.get().session !== session || !capability('collab:edit_realtime').ok) return;
    if (!binding) binding = new MonacoBinding(doc.getText('content'), model, new Set([view]), provider.awareness);
    provider.awareness.setLocalStateField('user', { id: session.actor.id, name: session.actor.name });
    view.updateOptions({ readOnly: false });
    status('Synced · shared document (server snapshot acknowledgement is separate)');
  });
  provider.on('status', ({ status: value }) => { if (!closed && value !== 'connected') { view.updateOptions({ readOnly: true }); status(value === 'connecting' ? 'Joining authorized document…' : 'Collaboration disconnected. Export changes before leaving.'); } });
  if (session.expiresAt) expiry = setTimeout(() => { status('Collaboration ended — session expired.'); stop(); }, Math.max(0, Math.min(2 ** 31 - 1, Date.parse(session.expiresAt) - Date.now())));
  window.addEventListener('pagehide', stop);
  provider.connect();
  return stop;
}
