import type { Scene, SceneIndexEntry, ViewEntry } from '../../data/types';

const EFFECT_STATE = /\b(requested|request sent|pending|accepted|received|effective|unknown|submitted|validating|sending|in progress|queued|created|sent|revoked readback|applied)\b/i;

/** A transition whose destination is an acknowledgement/outcome state is a service effect, not navigation. */
export function isEffect(target: SceneIndexEntry | undefined): boolean {
  if (!target) return true;
  return target.kind === 'receipt' || EFFECT_STATE.test(target.state);
}

export interface ResolvedAction {
  label: string; style: string; kind: 'scene' | 'view' | 'effect' | 'none';
  to?: string; reason?: string;
}

/** Map a scene action to an in-view state change, a cross-view navigation, or a gated service effect. */
export function resolveAction(
  a: Scene['actions'][number], view: ViewEntry, index: Record<string, SceneIndexEntry>, routeOf: (viewId: string) => string | undefined, disabled: Scene['disabled'],
): ResolvedAction {
  const label = __ATLAS_REVIEW__ ? a.label : a.prodLabel;
  const blocked = disabled.find((d) => d.label === a.label);
  if (blocked) return { label, style: a.style, kind: 'none', reason: __ATLAS_REVIEW__ ? blocked.reason : blocked.prodReason };
  if (!a.target) return { label, style: a.style, kind: 'none', reason: 'Requires an approved service command and a current grant; no destination is available without a service session.' };
  const t = index[a.target];
  if (!__ATLAS_REVIEW__ && isEffect(t)) {
    return { label, style: a.style, kind: 'effect', reason: 'Requires an authorized service session. Connect a service to send this request; Atlas never shows an outcome it has not received.' };
  }
  if (view.scenes.includes(a.target)) return { label, style: a.style, kind: 'scene', to: a.target };
  const owner = t?.planned?.[0];
  const r = owner ? routeOf(owner) : undefined;
  if (r) return { label, style: a.style, kind: 'view', to: `${r}?state=${encodeURIComponent(a.target)}` };
  return { label, style: a.style, kind: 'scene', to: a.target };
}
