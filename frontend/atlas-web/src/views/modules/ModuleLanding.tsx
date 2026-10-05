import type { ModuleRoute } from '../../data/types';
import { nav } from '../../data/catalog';
import { PageHeader } from '../../components/ui';
import { usePageMeta } from '../../shell/page-meta';
import { ProvenanceBanner } from '../shared';
import { ModuleDefinitions, ModuleViews } from './common';

/** Fallback module landing: purpose, provenance, every planned view and the module's definition types. */
export default function ModuleLanding({ module }: { module: ModuleRoute }) {
  const m = nav.modules[module];
  usePageMeta(m.title, [{ label: m.label }]);
  return (
    <div className="page">
      <PageHeader eyebrow={m.label} title={m.title} purpose={m.purpose} />
      <ProvenanceBanner />
      <div className="split">
        <ModuleViews module={module} />
        <ModuleDefinitions module={module} />
      </div>
    </div>
  );
}
