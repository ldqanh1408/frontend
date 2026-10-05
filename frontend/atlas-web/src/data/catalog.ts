import navJson from '../generated/nav.json';
import routesJson from '../generated/routes.json';
import type { JourneysData, Lifecycle, NavData, RouteEntry, Scene, SceneIndexEntry, SchemaSpec, SourceAction, ViewEntry } from './types';

/** Small, eagerly loaded design data (navigation + route table). Everything else is fetched lazily per area. */
export const nav = navJson as unknown as NavData;
export const routes = routesJson as unknown as RouteEntry[];
export const routeById = new Map(routes.map((r) => [r.id, r]));

const memo = <T,>(load: () => Promise<T>) => {
  let p: Promise<T> | null = null;
  return () => (p ??= load().catch((e) => { p = null; throw e; }));
};

export const loadViews = memo(async () => {
  const list = (await import('../generated/views.json')).default as unknown as ViewEntry[];
  return new Map(list.map((v) => [v.id, v]));
});
export const loadSceneIndex = memo(async () => (await import('../generated/scene-index.json')).default as unknown as Record<string, SceneIndexEntry>);
export const loadSchemas = memo(async () => {
  const list = (await import('../generated/schemas.json')).default as unknown as SchemaSpec[];
  return { list, byId: new Map(list.map((s) => [s.id, s])) };
});
export const loadLifecycles = memo(async () => (await import('../generated/lifecycles.json')).default as unknown as Record<string, Lifecycle>);
export const loadSourceActions = memo(async () => (await import('../generated/source-actions.json')).default as unknown as SourceAction[]);
export const loadJourneys = memo(async () => (await import('../generated/journeys.json')).default as unknown as JourneysData);

const sceneFiles = import.meta.glob('../generated/scenes/*.json', { import: 'default' });
const sceneCache = new Map<string, Promise<Map<string, Scene>>>();
export function loadJourneyScenes(journey: string): Promise<Map<string, Scene>> {
  let p = sceneCache.get(journey);
  if (!p) {
    const loader = sceneFiles[`../generated/scenes/${journey}.json`];
    if (!loader) return Promise.reject(new Error(`No scene data for journey ${journey}`));
    p = (loader() as Promise<Scene[]>).then((list) => new Map(list.map((s) => [s.id, s])));
    sceneCache.set(journey, p);
  }
  return p;
}
export async function loadScene(id: string): Promise<Scene | undefined> {
  const journey = id.split(':')[1];
  return (await loadJourneyScenes(journey)).get(id);
}

export function moduleOf(route: string) {
  return nav.modules[route as keyof typeof nav.modules];
}
