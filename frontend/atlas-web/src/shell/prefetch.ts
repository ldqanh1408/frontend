import type { ModuleRoute } from '../data/types';
import { DRAFT_MODULES } from '../data/module-specs';

const pending = new Set<string>();
/** Warm only route code, never service data or the editor worker, on deliberate navigation intent. */
export function prefetchModule(module: ModuleRoute) {
  if (pending.has(module) || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
  pending.add(module);
  const load = module === 'home' ? () => import('../views/Overview')
    : module === 'specifications' ? () => import('../views/specs/SpecificationsPage')
    : module === 'code' ? () => import('../views/code/CodePage')
    : module === 'workflow' ? () => import('../views/workflow/WorkflowPage')
    : module === 'execution' ? () => import('../views/execution/ExecutionPage')
    : module === 'connection' ? () => import('../views/modules/ConnectionPage')
    : DRAFT_MODULES[module] ? () => import('../views/modules/DraftModulePage')
    : () => import('../views/modules/ServiceModulePage');
  void load().catch(() => pending.delete(module));
}
