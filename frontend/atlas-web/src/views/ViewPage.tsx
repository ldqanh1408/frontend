import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { loadSceneIndex, loadScene, loadViews, nav, routeById } from '../data/catalog';
import { useAsync } from '../lib/hooks';
import { usePageMeta } from '../shell/page-meta';
import { Spinner, Banner } from '../components/ui';
import { SceneRenderer } from './scene/SceneRenderer';
import { resolveAction } from './scene/model';
import { modulePath } from '../shell/Sidebar';
import type { Scene, SceneIndexEntry, ViewEntry } from '../data/types';

/** One of the 210 planned views. Renders the view's current scene (default, or ?state=<scene id> for a sub-state). */
export default function ViewPage({ viewId, bare = false }: { viewId: string; bare?: boolean }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const stateId = params.get('state');
  const r = routeById.get(viewId)!;
  const mod = nav.modules[r.module];
  const { data, error } = useAsync(async () => {
    const [views, index] = await Promise.all([loadViews(), loadSceneIndex()]);
    const view = views.get(viewId)!;
    const sceneId = stateId && index[stateId] ? stateId : view.defaultScene;
    const scene = await loadScene(sceneId);
    return { view, index, scene };
  }, [viewId, stateId]);
  usePageMeta(r.title, bare ? [] : [{ label: mod?.label ?? r.module, to: modulePath(r.module) }, { label: r.title }]);
  const actions = useMemo(() => {
    if (!data?.scene) return [];
    return data.scene.actions.map((a) => resolveAction(a, data.view, data.index, (id) => routeById.get(id)?.route, data.scene!.disabled));
  }, [data]);
  if (error) return <div className="page"><Banner tone="danger" title="This view could not be loaded" role="alert">{error}</Banner></div>;
  if (!data?.scene) return <div className="page"><Spinner label="Loading view" /></div>;
  const onAction = (to: string, kind: string) => {
    if (kind === 'scene') {
      const next = new URLSearchParams(params);
      if (to === data.view.defaultScene) next.delete('state'); else next.set('state', to);
      setParams(next);
    } else navigate(to);
  };
  return (
    <SceneRenderer
      scene={data.scene as Scene} view={data.view as ViewEntry} index={data.index as Record<string, SceneIndexEntry>}
      actions={actions} onAction={onAction} bare={bare} isDefault={!stateId || stateId === data.view.defaultScene}
      onReset={() => { const next = new URLSearchParams(params); next.delete('state'); setParams(next); }}
    />
  );
}
