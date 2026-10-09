import { lazy, Suspense, type ComponentProps } from 'react';
import type { CodeEditor as EditorComponent } from './CodeEditor';
import { Skeleton } from './ui';
const Editor = lazy(() => import('./CodeEditor').then(m => ({ default: m.CodeEditor })));

export function LazyCodeEditor(props: ComponentProps<typeof EditorComponent>) {
  return <Suspense fallback={<div className="editor-host editor-loading" style={{ height: `max(${props.minHeight ?? 420}px, min(70vh, 900px))` }}><Skeleton label="Loading editor" /></div>}><Editor {...props} /></Suspense>;
}
