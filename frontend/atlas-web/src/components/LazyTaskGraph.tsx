import { lazy, Suspense, type ComponentProps } from 'react';
import { Skeleton } from './ui';
import type TaskGraphComponent from './TaskGraph';
const Graph = lazy(() => import('./TaskGraph'));
export function LazyTaskGraph(props: ComponentProps<typeof TaskGraphComponent>) { return <Suspense fallback={<div className="task-flow"><Skeleton label="Loading task graph" /></div>}><Graph {...props} /></Suspense>; }
