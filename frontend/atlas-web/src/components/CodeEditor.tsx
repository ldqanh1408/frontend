import { startTransition, useEffect, useRef } from 'react';
import { EditorState, Compartment, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { syntaxHighlighting, HighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { markdown } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';

export type EditorLanguage = 'markdown' | 'javascript' | 'typescript' | 'jsx' | 'tsx' | 'json' | 'css' | 'html' | 'text';

export function languageFor(path: string): EditorLanguage {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return ({ md: 'markdown', markdown: 'markdown', mdx: 'markdown', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx', ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'tsx', json: 'json', css: 'css', scss: 'css', html: 'html', htm: 'html', vue: 'html', svelte: 'html' } as Record<string, EditorLanguage>)[ext] ?? 'text';
}

function lang(l: EditorLanguage): Extension {
  switch (l) {
    case 'markdown': return markdown();
    case 'javascript': return javascript();
    case 'jsx': return javascript({ jsx: true });
    case 'typescript': return javascript({ typescript: true });
    case 'tsx': return javascript({ typescript: true, jsx: true });
    case 'json': return javascript();
    case 'css': return css();
    case 'html': return html();
    default: return [];
  }
}

// Colors come from the design tokens so both themes follow "Atlas / v8 Color".
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword], color: 'var(--color-purple)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--color-success)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--color-warning)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--color-muted)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.variableName)], color: 'var(--color-info)' },
  { tag: [t.typeName, t.className, t.tagName], color: 'var(--color-accent)' },
  { tag: t.heading, color: 'var(--color-text)', fontWeight: '600' },
  { tag: [t.link, t.url], color: 'var(--color-accent)', textDecoration: 'underline' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: '600' },
  { tag: t.quote, color: 'var(--color-secondary)' },
]);
const theme = EditorView.theme({
  '&': { backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' },
  '.cm-content': { caretColor: 'var(--color-accent)', fontFamily: 'var(--font-mono)' },
  '.cm-gutters': { backgroundColor: 'var(--color-panel)', color: 'var(--color-muted)', borderRight: '1px solid var(--color-border)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--color-raised) 60%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--color-raised)', color: 'var(--color-text)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--color-accent-soft) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--color-accent)' },
  '.cm-searchMatch': { backgroundColor: 'var(--color-warning-soft)', outline: '1px solid var(--color-warning)' },
  '.cm-panels': { backgroundColor: 'var(--color-panel)', color: 'var(--color-text)', borderColor: 'var(--color-border)' },
  '.cm-panel input, .cm-panel button': { font: 'var(--text-caption)' },
});

/** Read-only stays focusable (keyboard scrolling, selection, search) but rejects edits. */
const readOnlyExt = (ro: boolean): Extension => [EditorState.readOnly.of(ro), EditorView.contentAttributes.of({ 'aria-readonly': String(ro) })];

export interface EditorHandle { goToLine: (line: number) => void; focus: () => void; getValue: () => string }

/**
 * CodeMirror 6 editor. While mounted the editor owns its document (typing never races React renders); `value` is loaded
 * at mount and again only when `resetKey` changes (file switch, restore, discard). Tab indents; Escape then Tab leaves.
 */
export function CodeEditor({ value, onChange, language = 'text', readOnly = false, label, onSave, handleRef, minHeight = 420, describedBy, resetKey }: {
  value: string; onChange?: (v: string) => void; language?: EditorLanguage; readOnly?: boolean; label: string; onSave?: () => void;
  handleRef?: React.RefObject<EditorHandle | null>; minHeight?: number; describedBy?: string; resetKey?: unknown;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cbs = useRef({ onChange, onSave });
  cbs.current = { onChange, onSave };
  const langC = useRef(new Compartment());
  const roC = useRef(new Compartment());
  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(), highlightActiveLineGutter(), history(), drawSelection(), indentOnInput(), bracketMatching(), highlightActiveLine(), highlightSelectionMatches(),
          syntaxHighlighting(highlight), theme, EditorView.lineWrapping,
          keymap.of([{ key: 'Mod-s', preventDefault: true, run: () => { cbs.current.onSave?.(); return true; } }, ...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
          langC.current.of(lang(language)), roC.current.of(readOnlyExt(readOnly)),
          EditorView.contentAttributes.of({ 'aria-label': label, tabindex: '0', ...(describedBy ? { 'aria-describedby': describedBy } : {}), 'aria-multiline': 'true' }),
          // Non-urgent: React state follows the editor without blocking typing (and without long synchronous update chains).
          EditorView.updateListener.of((u) => { if (u.docChanged) { const doc = u.state.doc.toString(); startTransition(() => cbs.current.onChange?.(doc)); } }),
        ],
      }),
    });
    view.current = v;
    return () => { v.destroy(); view.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { view.current?.dispatch({ effects: langC.current.reconfigure(lang(language)) }); }, [language]);
  useEffect(() => { view.current?.dispatch({ effects: roC.current.reconfigure(readOnlyExt(readOnly)) }); }, [readOnly]);
  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      goToLine: (line) => {
        const v = view.current;
        if (!v) return;
        const l = v.state.doc.line(Math.min(Math.max(1, line), v.state.doc.lines));
        v.dispatch({ selection: { anchor: l.from }, effects: EditorView.scrollIntoView(l.from, { y: 'center' }) });
        v.focus();
      },
      focus: () => view.current?.focus(),
      getValue: () => view.current?.state.doc.toString() ?? value,
    };
  }, [handleRef]);
  // Fixed height with an internal scroller: jumping to a line never scrolls the page header out of view.
  return <div ref={host} className="editor-host" style={{ height: `max(${minHeight}px, min(70vh, 900px))` }} />;
}
