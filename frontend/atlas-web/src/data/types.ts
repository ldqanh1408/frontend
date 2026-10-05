// Shapes of the generated design data (tools/import-design.mjs). Keep in sync with the importer.
export type ModuleRoute =
  | 'home' | 'specifications' | 'code' | 'agents' | 'resources' | 'workflow' | 'execution' | 'governance' | 'memory' | 'gateway'
  | 'collaboration' | 'configuration' | 'identity' | 'tenancy' | 'saas' | 'desktop' | 'observer' | 'connection';

export interface ModuleMeta {
  route: ModuleRoute; label: string; icon: string; title: string; purpose: string; controls: string[];
  figma: { dark: string; light: string }; kind: 'service' | 'drafts' | ModuleRoute;
}
export interface NavData { groups: { label: string; routes: ModuleRoute[] }[]; modules: Record<ModuleRoute, ModuleMeta> }

export interface RouteEntry { id: string; route: string; title: string; module: ModuleRoute; surface: 'workspace' | 'observer'; bare: boolean; kind: 'route' | 'state'; presence: string | null }

export interface ViewEntry extends RouteEntry {
  slug: string; navModule: ModuleRoute; defaultScene: string; scenes: string[]; states: string[]; journeys: string[]; ux: string[];
  packages: string[]; uat: string[]; routeProposal: string; figmaCurrent: { dark: string; light: string } | null;
  stateBinding: Record<string, 'dedicated' | 'shared'>;
}

export interface SceneAction { label: string; prodLabel: string; target: string | null; style: 'Primary' | 'Secondary' | 'Quiet' | 'Danger' | string }
export interface Scene {
  id: string; key: string; j: string; title: string; entity: string; state: string; prodState: string; actor: string; kind: string; reviewOnly: boolean;
  /** Neutral wording without fixture identifiers, used outside the review build. */
  prodTitle: string; prodEntity: string; prodCopy: string;
  planned: string[]; schema: string | null; copy: string; fields: { label: string; hint: string; value: unknown }[];
  actions: SceneAction[]; disabled: { label: string; prodLabel: string; reason: string; prodReason: string }[]; receipt: { stage: string; operation: string; note: string } | null;
  pins: string[]; rows: { label: string; prodLabel: string; detail: string; status: string; target: string | null; sample: boolean }[]; lifecycle: string[]; uat: string[];
  ux: string[]; packages: string[]; lifecycleStates: unknown; selectedTask: unknown; patternKey: string | null; fieldError: unknown;
  blockedBy: string[]; figma: { dark: string | null; light: string | null };
}
export interface SceneIndexEntry { key: string; j: string; title: string; prodTitle: string; state: string; prodState: string; kind: string; planned: string[]; reviewOnly: boolean }

export type FieldControl = 'text' | 'textarea' | 'list' | 'number' | 'pins' | 'json' | 'boolean' | 'select' | 'datetime';
export interface FieldSpec {
  key: string; label: string; required: boolean; control: FieldControl; type: string | string[]; format: string | null; hint: string;
  unit: string | null; enum: string[] | null; minimum: number | null; maximum: number | null; minLength: number | null; maxLength: number | null;
  pattern: string | null; maxItems: number | null; uniqueItems: boolean; itemConstraints: Record<string, unknown> | null; default?: unknown; nullable: boolean;
}
export interface SchemaSpec {
  id: string; title: string; route: ModuleRoute; figmaModule: string; fieldCount: number; purpose: string; actions: string[];
  figma: { dark: string; light: string }; groups: { group: string; fields: FieldSpec[] }[];
}
export interface Lifecycle {
  id: string; module: string; entity: string; chain: string; enabled: string; disabled: string; reason: string; evidence: string;
  recovery: string; invalidation: string; retirement: string; states: { name: string; figma: { dark: string; light: string } }[];
}
export interface SourceAction {
  id: string; control: string; module: string; label: string; placement: string; authorization: string; preconditions: string; blockers: string;
  ackRule: string; oracle: string; recovery: string; feedback: string;
}
export interface JourneyStep { step_id: string; journey_id: string; ux_ref: string; actor: string; action: string; oracle: string; recovery: string }
export interface JourneysData { design: { id: string; name: string; flow: string; recovery: string }[]; ux: Record<string, { id: string; actor: string; steps: JourneyStep[] }> }
