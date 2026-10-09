import { startTransition, useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import type { EditorLanguage } from './editor-language';
import type { CollaborationTarget } from '../data/collaboration';
export { languageFor, type EditorLanguage } from './editor-language';

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
export interface EditorHandle { goToLine: (line: number) => void; focus: () => void; getValue: () => string }

function updateTheme() {
  const style = getComputedStyle(document.documentElement);
  const color = (name: string) => style.getPropertyValue(`--color-${name}`).trim();
  const dark = document.documentElement.dataset.theme !== 'light';
  monaco.editor.defineTheme('atlas', { base: dark ? 'vs-dark' : 'vs', inherit: false, rules: [
    { token: '', foreground: color('text').replace('#', '') },
    { token: 'comment', foreground: color('secondary').replace('#', '') },
    { token: 'keyword', foreground: color('info').replace('#', '') },
    { token: 'type', foreground: color('purple').replace('#', '') },
    { token: 'string', foreground: color('success').replace('#', '') },
    { token: 'number', foreground: color('warning').replace('#', '') },
    { token: 'tag', foreground: color('info').replace('#', '') },
    { token: 'invalid', foreground: color('danger').replace('#', '') },
  ], colors: {
    'editor.background': color('bg'), 'editor.foreground': color('text'),
    'editorLineNumber.foreground': color('muted'), 'editorLineNumber.activeForeground': color('text'),
    'editorCursor.foreground': color('accent'), 'editor.selectionBackground': color('accent-soft'),
    'editor.lineHighlightBackground': color('raised'), 'editorWidget.background': color('panel'),
  } });
  monaco.editor.setTheme('atlas');
}
const languageId = (language: EditorLanguage) => language === 'text' ? 'plaintext' : language === 'tsx' ? 'typescript' : language === 'jsx' ? 'javascript' : language;

/** Monaco owns the model while mounted. Only resetKey replaces its document; React updates follow typing. */
export function CodeEditor({ value, onChange, language = 'text', readOnly = false, label, onSave, handleRef, minHeight = 420, describedBy, resetKey, collaboration }: {
  value: string; onChange?: (v: string) => void; language?: EditorLanguage; readOnly?: boolean; label: string; onSave?: () => void;
  handleRef?: React.RefObject<EditorHandle | null>; minHeight?: number; describedBy?: string; resetKey?: unknown; collaboration?: CollaborationTarget;
}) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const callbacks = useRef({ onChange, onSave });
  callbacks.current = { onChange, onSave };
  const [collabStatus, setCollabStatus] = useState<string | null>(null);
  useEffect(() => {
    updateTheme();
    const model = monaco.editor.createModel(value, languageId(language));
    const view = monaco.editor.create(host.current!, {
      model, theme: 'atlas', readOnly: readOnly || Boolean(collaboration), ariaLabel: label, automaticLayout: true,
      accessibilitySupport: 'on', minimap: { enabled: false }, wordWrap: 'on', scrollBeyondLastLine: false,
      fontFamily: 'JetBrains Mono, monospace', fontSize: 13, lineHeight: 22, padding: { top: 12 },
      tabSize: 2, renderLineHighlight: 'line', stickyScroll: { enabled: false },
      wordBasedSuggestions: 'off', quickSuggestions: false,
      folding: true, fixedOverflowWidgets: false, contextmenu: true,
    });
    editor.current = view;
    const change = model.onDidChangeContent(() => { const text = model.getValue(); startTransition(() => callbacks.current.onChange?.(text)); });
    view.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => callbacks.current.onSave?.());
    view.addCommand(monaco.KeyMod.WinCtrl | monaco.KeyCode.KeyS, () => callbacks.current.onSave?.());
    const theme = new MutationObserver(updateTheme);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (describedBy) view.getDomNode()?.querySelector('textarea')?.setAttribute('aria-describedby', describedBy);
    if (handleRef) handleRef.current = {
      focus: () => view.focus(), getValue: () => model.getValue(),
      goToLine: (line) => { const n = Math.max(1, Math.min(model.getLineCount(), line)); view.setPosition({ lineNumber: n, column: 1 }); view.revealLineInCenter(n); view.focus(); },
    };
    return () => { theme.disconnect(); change.dispose(); if (handleRef) handleRef.current = null; editor.current = null; view.dispose(); model.dispose(); };
  }, []); // The editor is deliberately not controlled by React's value prop.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const model = editor.current?.getModel();
    if (model && model.getValue() !== value) model.setValue(value);
  }, [resetKey]);
  useEffect(() => { const model = editor.current?.getModel(); if (model) monaco.editor.setModelLanguage(model, languageId(language)); }, [language]);
  useEffect(() => { editor.current?.updateOptions({ readOnly: readOnly || Boolean(collaboration), ariaLabel: label }); }, [readOnly, label, collaboration?.documentId, collaboration?.branchId]);
  useEffect(() => {
    const view = editor.current;
    if (!collaboration || !view || readOnly) { setCollabStatus(null); return; }
    let disposed = false;
    let stop: (() => void) | undefined;
    setCollabStatus('Joining authorized document…');
    void import('../data/collaboration').then(({ bindCollaborativeEditor }) => {
      if (disposed) return;
      stop = bindCollaborativeEditor(view, collaboration, status => { if (!disposed) setCollabStatus(status); });
    }).catch(() => { if (!disposed) setCollabStatus('Collaboration unavailable. Device draft remains local.'); });
    return () => { disposed = true; stop?.(); };
  }, [collaboration?.documentId, collaboration?.branchId, readOnly]);
  return <div className="stack-8"><div ref={host} className="editor-host" data-editor="monaco" style={{ height: `max(${minHeight}px, min(70vh, 900px))` }} />{collabStatus && <p className="caption" role="status">{collabStatus}</p>}</div>;
}
