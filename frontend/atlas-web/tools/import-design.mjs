#!/usr/bin/env node
// Converts the Figma E2E design delivery (design-source/) into compact, typed-at-use JSON under src/generated/.
// Sources (all read-only copies):
//   Atlas-E2E-Delivery.zip (sha256 in design-source/SOURCE-ZIP.sha256): Atlas-Screen-Inventory, Atlas-View-Specifications,
//   Atlas-Field-Dictionary, Atlas-State-Matrix, Atlas-Lifecycle-State-Table, Atlas-Source-Actions-55, Atlas-Source-Journeys-42,
//   remaining-view-model (scene kinds/rows), ds-context (tokens).
//   Figma reads (file 0md9BEFI1rU0aRAvf98TWO): current-ui-frames (module titles/purposes/controls/nav), definition-field-oracle-49
//   (field groups/labels/hints), definition-actions-49 (purpose + lifecycle actions), planned-inventory-210, journey-trace-174.
// Re-run with `npm run import:design` whenever the design delivery changes; the output is committed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const APP = path.resolve(HERE, '..');
const SRC = path.join(APP, 'design-source');
const OUT = path.join(APP, 'src', 'generated');
const J = (f) => JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
const csv = (f) => parseCsv(fs.readFileSync(path.join(SRC, f), 'utf8'));
const pyList = (s) => {
  if (Array.isArray(s)) return s;
  if (!s) return [];
  try { return JSON.parse(String(s).replace(/'/g, '"')); } catch { return []; }
};

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

fs.mkdirSync(path.join(OUT, 'scenes'), { recursive: true });
const write = (name, data) => {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, JSON.stringify(data));
  return fs.statSync(p).size;
};

// ------------------------------------------------------------------ navigation (Figma 01/02 Current UI)
const frames = J('current-ui-frames.json');
const NAV_ROUTE = {
  'Overview': 'home', 'Specifications': 'specifications', 'Code intelligence': 'code', 'Agents': 'agents', 'Resources': 'resources',
  'Workflow & planning': 'workflow', 'Runs & activity': 'execution', 'Reviews & delivery': 'governance', 'Memory & context': 'memory',
  'AI access & budget': 'gateway', 'Collaboration': 'collaboration', 'Configuration & policy': 'configuration', 'People & access': 'identity',
  'Organization & projects': 'tenancy', 'Usage, billing & data': 'saas', 'Desktop & runtime': 'desktop', 'Operations observer': 'observer',
  'Connection & receipts': 'connection',
};
const ICON = { home: 'home', specifications: 'file-text', code: 'code', agents: 'bot', resources: 'boxes', workflow: 'workflow', execution: 'play-circle',
  governance: 'shield-check', memory: 'brain', gateway: 'key-round', collaboration: 'users', configuration: 'settings', identity: 'user-cog',
  tenancy: 'building-2', saas: 'receipt', desktop: 'monitor', observer: 'eye', connection: 'link' };
const modules = {};
for (const [route, ex] of Object.entries(frames.module_expect)) {
  const label = Object.entries(NAV_ROUTE).find(([, r]) => r === route)[0];
  modules[route] = {
    route, label, icon: ICON[route], title: ex.title, purpose: ex.purpose.replace(/…$/, ''), controls: ex.controls,
    figma: frames.module[route], kind: frames.service_tab_routes.includes(route) ? 'service' :
      (['agents', 'resources', 'memory', 'configuration'].includes(route) ? 'drafts' : route),
  };
}
// Full purpose lines that were truncated at 90 chars in the transcription (completed from the same Figma frames).
modules.desktop.purpose = 'Inspect device-bound sessions, local capabilities, runtime compatibility and update recovery.';
modules.observer.purpose = 'Inspect timestamped telemetry, drill into traces and coordinate diagnostics with a separate observer session.';
const nav = { groups: frames.nav.map(([g, items]) => ({ label: g, routes: items.map(i => NAV_ROUTE[i]) })), modules };

// ------------------------------------------------------------------ scenes (751)
const specs = J('Atlas-View-Specifications.json');
const model = Object.fromEntries(J('remaining-view-model.json').views.map(v => [v.key, v]));
const byKey = {};
for (const s of specs) (byKey[s.key] = byKey[s.key] || []).push(s);
const resolveTarget = (from, key) => {
  if (!key) return null;
  const cands = byKey[key];
  if (!cands) return null;
  return (cands.find(c => c.design_journey === from.design_journey) || cands.find(c => c.batch === from.batch) || cands[0]).id;
};
const inferKind = (s, m) => {
  if (m?.kind) return m.kind;
  const comps = s.components || [];
  if (comps.includes('Atlas/EditorTab') || comps.includes('Atlas/ExplorerRow')) return 'ide';
  if (s.receipt) return 'receipt';
  if (/confirm/i.test(s.key) || /confirm/i.test(s.state)) return 'confirm';
  if ((s.fields || []).length && !s.review_only) return 'form';
  if ((s.disabled_actions || []).length && /(revoked|denied|expired|wrong|conflict|unknown|failed|stale|empty|not-found|partial)/i.test(s.key)) return 'notice';
  return 'review';
};
// Design copy names fixture records (r-901, T-02, commit SHAs). Production builds must not present those as real data, so each
// scene also carries a neutral title/copy; the review build keeps the fixture text (labelled Illustrative).
const SAMPLE = /\b(?:[A-Z]{1,2}-\d{2,}|[a-z]{1,4}-\d{1,4}(?:@\d+)?|(?=[0-9a-f]*\d)[0-9a-f]{7,40}|[A-Z][a-z]+@\d+|#\d{2,}|fence \d+|seq \d+[–-]\d+|v\d+\.\d+\.\d+)\b|in this fixture|Fixture:/;
const SAMPLE_G = new RegExp(SAMPLE.source, 'g');
const hasSample = (t) => SAMPLE.test(t || '');
function neutralTitle(t, entity) {
  if (!hasSample(t)) return t;
  const out = t.replace(SAMPLE_G, '').replace(/\s*[·/]\s*(?=[·/]|$)/g, '').replace(/^\s*[·/]\s*/, '').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
  if (out.length < 3) return entity;
  const cap = out[0].toUpperCase() + out.slice(1);
  return /\s/.test(cap) ? cap : `${neutralTitle(entity, '')} · ${cap}`.replace(/^ · /, '');
}
const neutralCopy = (c, state) => (hasSample(c) ? `${state}. Exact identifiers, revisions and outcomes appear only when an authorized service returns them.` : c);
const humanize = (k) => { const w = String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').toLowerCase(); return w[0].toUpperCase() + w.slice(1); };
const neutralLabel = (l) => (hasSample(l) ? (l.replace(/\bPR-\d+/g, 'PR').replace(SAMPLE_G, '').replace(/\s{2,}/g, ' ').trim() || 'Inspect') : l);
const fieldLabel = (l) => (/^[a-z][A-Za-z0-9]*$/.test(l) ? humanize(l) : l);
// Some scene hints embed a JSON-schema fragment ("Optional · {\"type\":\"integer\",…}"): render it as readable constraints.
const TYPE_WORD = { integer: 'Whole number', number: 'Number', string: 'Text', boolean: 'Yes / No', array: 'List', object: 'Structured value' };
function fieldHint(h) {
  const bare = String(h).match(/^(integer|number|string|boolean|array|object)( · optional)?$/);
  if (bare) return `${TYPE_WORD[bare[1]]}${bare[2] ? ' · Optional' : ''}`;
  return String(h).replace(/\{[^{}]*"type"[^{}]*\}/g, (frag) => {
    try {
      const j = JSON.parse(frag);
      const n = (v) => Number(v).toLocaleString('en-US');
      const range = j.minimum !== undefined || j.maximum !== undefined ? ` ${j.minimum !== undefined ? n(j.minimum) : '−∞'}–${j.maximum !== undefined ? n(j.maximum) : '∞'}` : '';
      return `${j.type === 'integer' ? 'Whole number' : j.type === 'number' ? 'Number' : humanize(j.type)}${range}`;
    } catch { return frag; }
  });
}
const sceneIndex = {};
const perJourney = {};
for (const s of specs) {
  const m = model[s.key] && model[s.key].journey === s.design_journey ? model[s.key] : null;
  const scene = {
    id: s.id, key: s.key, j: s.design_journey, title: s.title, entity: s.entity, state: s.state, actor: s.actor,
    prodTitle: neutralTitle(s.title, s.entity), prodEntity: neutralTitle(s.entity, s.state), prodCopy: neutralCopy(s.copy || '', s.state),
    kind: inferKind(s, m), reviewOnly: !!s.review_only, planned: s.planned_views || [], schema: s.schema || m?.schema || null,
    copy: s.copy || '', fields: (s.fields || []).map(f => ({ label: fieldLabel(f.label || f.property || 'value'), hint: fieldHint(f.hint || (f.type ? `${f.type}${f.nullable ? ' · optional' : ''}` : '')), value: f.value ?? null })),
    actions: (s.actions || []).map(a => ({ label: a.label, prodLabel: neutralLabel(a.label), target: resolveTarget(s, a.target), style: a.style || 'Secondary' })),
    disabled: (s.disabled_actions || []).map(d => ({ label: d.label, prodLabel: neutralLabel(d.label), reason: d.reason, prodReason: neutralCopy(d.reason, 'Not available') })),
    receipt: s.receipt ? { stage: s.receipt[0], operation: s.receipt[1], note: s.receipt[2] } : null,
    pins: s.source_pins || m?.pins || [], rows: (m?.rows || []).map(r => ({ label: r[0], detail: r[1], status: r[2], target: resolveTarget(s, r[3]), sample: hasSample(r[0]) || hasSample(r[1]) })),
    lifecycle: s.lifecycle_refs || [], uat: s.uat || [], ux: s.ux_steps || [], packages: s.packages || [],
    lifecycleStates: m?.lifecycleStates || null, selectedTask: m?.selectedTask || null, patternKey: m?.patternKey || null,
    fieldError: m?.fieldError || null, blockedBy: s.blocked_by || [],
    figma: { dark: (s.node_ids || [])[0] || null, light: (s.node_ids || [])[1] || null },
  };
  sceneIndex[s.id] = { key: s.key, j: s.design_journey, title: s.title, prodTitle: scene.prodTitle, state: s.state, kind: scene.kind, planned: scene.planned, reviewOnly: scene.reviewOnly };
  (perJourney[s.design_journey] = perJourney[s.design_journey] || []).push(scene);
}
const sceneSizes = {};
for (const [jid, list] of Object.entries(perJourney)) sceneSizes[jid] = write(`scenes/${jid}.json`, list);

// ------------------------------------------------------------------ views (210)
const inv = J('Atlas-Screen-Inventory.json');
const planned = Object.fromEntries(J('planned-inventory-210.json').rows.map(r => [r.view_id, r]));
const sm = Object.fromEntries(J('Atlas-State-Matrix.json').map(r => [r.view_id, r]));
const frameRoute = {};
for (const [route, f] of Object.entries(frames.module)) frameRoute[f.dark] = route;
for (const [, f] of Object.entries(frames.state)) frameRoute[f.dark] = f.owner_route;
const oracle = J('definition-field-oracle-49.json').types;
for (const t of oracle) frameRoute[t.figma_dark] = frameRoute[t.figma_dark] || t.route;
const INV_MODULE_ROUTE = { shell: 'home', identity: 'identity', tenancy: 'tenancy', gateway: 'gateway', agents: 'agents', memory: 'memory',
  configuration: 'configuration', code: 'code', execution: 'execution', specifications: 'specifications', governance: 'governance',
  workflow: 'workflow', collaboration: 'collaboration', observer: 'observer' };
const ROUTE_OVERRIDE = { 'workspace/login': '/sign-in', 'workspace/auth-help': '/sign-in/help', 'workspace/invite': '/invitations',
  'observer/obs-login': '/observer/sign-in', 'workspace/overview': '/' };
const BARE = new Set(['workspace/login', 'workspace/auth-help', 'workspace/invite', 'workspace/invite-identity', 'workspace/state-wrong-account',
  'workspace/state-expired-invitation', 'observer/obs-login']);
const defaultNode = (vid) => {
  const d = (sm[vid] || {}).Default || '';
  const m = d.match(/DEDICATED: (\d+:\d+)/);
  return m ? m[1] : null;
};
// Inventory titles for state rows are slugs ("execution state empty"); present them as readable names.
const ACRONYM = { pr: 'PR', ci: 'CI', ai: 'AI', ide: 'IDE', pty: 'PTY', mcp: 'MCP', ast: 'AST', api: 'API', sso: 'SSO', ui: 'UI', id: 'ID', llm: 'LLM' };
function displayTitle(t) {
  if (/[A-Z]/.test(t)) return t;
  const words = t.replace(/[-_]+/g, ' ').replace(/\bt (\d+)\b/g, 'T-$1').split(/\s+/).filter(Boolean).map(w => ACRONYM[w] || w);
  if (!words.length) return t;
  words[0] = words[0][0].toUpperCase() + words[0].slice(1);
  return words.join(' ');
}
// View names derived from fixture records ("Execution agent T-03") are named by their state instead.
const viewTitle = (t, states) => (hasSample(t) ? `${t.replace(SAMPLE_G, '').replace(/\s{2,}/g, ' ').trim()}${states[0] ? ` · ${states[0]}` : ''}` : t);
const views = inv.map(r => {
  const p = planned[r.view_id] || {};
  const slug = r.view_id.split('/')[1];
  const navModule = (p.figma_dark && frameRoute[p.figma_dark]) || INV_MODULE_ROUTE[r.module] || 'home';
  const route = ROUTE_OVERRIDE[r.view_id] || (r.surface === 'observer' ? `/observer/${slug}` : `/${navModule}/${slug}`);
  const nativeIds = pyList(r.native_view_ids);
  const dn = defaultNode(r.view_id);
  const scenesOf = specs.filter(s => (s.planned_views || []).includes(r.view_id)).map(s => s.id);
  const def = specs.find(s => (s.node_ids || [])[0] === dn && (s.planned_views || []).includes(r.view_id))
    || specs.find(s => s.id === nativeIds[0]) || specs.find(s => s.id === scenesOf[0]);
  const states = sm[r.view_id] || {};
  return {
    id: r.view_id, slug, title: viewTitle(displayTitle(r.title), pyList(r.states)), surface: r.surface, module: r.module, navModule, route, bare: BARE.has(r.view_id),
    kind: Number(inv.indexOf(r)) < 130 ? 'route' : 'state',
    defaultScene: def ? def.id : null, scenes: [...new Set([...nativeIds, ...scenesOf])].filter(id => sceneIndex[id]),
    states: pyList(r.states), journeys: pyList(r.design_journeys), ux: String(r.ux_journeys || '').split(';').filter(Boolean),
    packages: String(r.packages || '').split(';').filter(Boolean), uat: String(r.uat || '').split(';').filter(Boolean),
    routeProposal: r.route_proposal, presence: p.presence_status || null,
    figmaCurrent: p.figma_dark ? { dark: p.figma_dark, light: p.figma_light } : null,
    stateBinding: Object.fromEntries(Object.entries(states).filter(([k]) => !['view_id', 'theme', 'binding_status'].includes(k))
      .map(([k, v]) => [k, String(v).startsWith('DEDICATED') ? 'dedicated' : 'shared'])),
  };
});
const routeDup = views.map(v => v.route).filter((r, i, a) => a.indexOf(r) !== i);
if (routeDup.length) throw new Error('duplicate routes ' + routeDup.join(','));

// ------------------------------------------------------------------ schemas (49 + preferences)
const dict = J('Atlas-Field-Dictionary.json');
const actions49 = J('definition-actions-49.json').types;
const top = {};
for (const f of dict) {
  if (f.property.includes('[]') || f.property.includes('.')) continue;
  (top[f.schema] = top[f.schema] || {})[f.property] = f;
}
const schemas = oracle.map(t => {
  const d = top[t.schema_label] || {};
  const groups = t.groups.map(g => ({
    group: g.group,
    fields: g.fields.map(f => {
      const df = d[f.key] || {};
      const type = Array.isArray(df.type) ? df.type : df.type || 'string';
      const c = df.constraints || {};
      let control = 'text';
      if (f.hint === 'P') control = 'pins';
      else if (f.hint === 'L' || (type === 'array' && !(c.items && c.items.type === 'object'))) control = 'list';
      else if (f.hint === 'J' || type === 'object' || Array.isArray(type)) control = 'json';
      else if (type === 'boolean') control = 'boolean';
      else if (c.enum) control = 'select';
      else if (type === 'integer' || type === 'number') control = 'number';
      else if (df.format === 'date-time' || f.hint === 'T') control = 'datetime';
      else if ((c.maxLength || 0) > 2000) control = 'textarea';
      const unit = f.hint.startsWith('U:') ? f.hint.split(':')[1] : null;
      return {
        key: f.key, label: f.label.replace(/ \*$/, ''), required: !!f.required, control, type, format: df.format === 'not specified' ? null : df.format || null,
        hint: f.hint_text || '', unit, enum: c.enum || null, minimum: c.minimum ?? null, maximum: c.maximum ?? null,
        minLength: c.minLength ?? null, maxLength: c.maxLength ?? null, pattern: c.pattern || null, maxItems: c.maxItems ?? null,
        uniqueItems: !!c.uniqueItems, itemConstraints: c.items || null,
        default: df.default_presence === 'explicit' ? df.default : undefined, nullable: !!df.nullable,
      };
    }),
  }));
  const a = actions49[t.title] || {};
  return { id: t.schema_label, title: t.title, route: t.route, figmaModule: t.figma_module, fieldCount: t.field_count, purpose: a.purpose || '',
    actions: a.actions || [], figma: { dark: t.figma_dark, light: t.figma_light }, groups };
});
const prefs = Object.values(top['account-preferences-presentation'] || {}).map(f => ({ key: f.property, label: f.title, type: f.type,
  enum: (f.constraints || {}).enum || null, default: f.default_presence === 'explicit' ? f.default : undefined }));

// ------------------------------------------------------------------ lifecycles, actions, journeys
const lc = J('Atlas-Lifecycle-State-Table.json');
const lifecycles = {};
for (const x of lc) {
  const l = lifecycles[x.lifecycle] = lifecycles[x.lifecycle] || { id: x.lifecycle, module: x.module, entity: x.entity, chain: x.source_chain,
    enabled: x.enabled_action, disabled: x.disabled_action, reason: x.visible_reason, evidence: x.required_evidence, recovery: x.recovery,
    invalidation: x.invalidation, retirement: x.retirement, states: [] };
  l.states.push({ name: x.normalized_ui_state, figma: { dark: x.ui_dark, light: x.ui_light } });
}
const srcActions = csv('Atlas-Source-Actions-55.csv').map(a => ({ id: a.id, control: a.command_or_control, module: a.module, label: a.visible_label,
  placement: a.placement, authorization: a.authorization_rule, preconditions: a.enabled_preconditions, blockers: a.disabled_blocker_reason_required,
  ackRule: a.ack_effect_ui_rule, oracle: a.terminal_success_oracle, recovery: a.unknown_failure_recovery, feedback: a.focus_feedback }));
const trace = J('journey-trace-174.json');
const journeys = { design: trace.design_v8_journeys, ux: {} };
for (const s of trace.steps) (journeys.ux[s.journey_id] = journeys.ux[s.journey_id] || { id: s.journey_id, actor: s.actor, steps: [] }).steps.push(s);

// ------------------------------------------------------------------ tokens (Figma variables: v8 color Dark/Light)
const ds = J('ds-context.json');
const hex = (c) => '#' + ['r', 'g', 'b'].map(k => Math.round(c[k] * 255).toString(16).padStart(2, '0')).join('');
const tokens = Object.fromEntries(ds.colors.map(c => [c.name.replace('color/', ''), { dark: hex(c.Dark), light: hex(c.Light) }]));

const sizes = {
  nav: write('nav.json', nav), views: write('views.json', views),
  routes: write('routes.json', views.map(v => ({ id: v.id, route: v.route, title: v.title, module: v.navModule, surface: v.surface, bare: v.bare, kind: v.kind, presence: v.presence }))), sceneIndex: write('scene-index.json', sceneIndex), schemas: write('schemas.json', schemas),
  preferences: write('preferences.json', prefs), lifecycles: write('lifecycles.json', lifecycles), actions: write('source-actions.json', srcActions),
  journeys: write('journeys.json', journeys), tokens: write('tokens.json', tokens), scenes: sceneSizes,
};
const manifest = {
  generatedFrom: fs.readFileSync(path.join(SRC, 'SOURCE-ZIP.sha256'), 'utf8').trim(), figmaFile: '0md9BEFI1rU0aRAvf98TWO',
  counts: { views: views.length, scenes: specs.length, schemas: schemas.length, fields: schemas.reduce((n, s) => n + s.groups.reduce((m, g) => m + g.fields.length, 0), 0),
    lifecycles: Object.keys(lifecycles).length, lifecycleStates: lc.length, sourceActions: srcActions.length, uxJourneys: Object.keys(journeys.ux).length,
    uxSteps: trace.steps.length, scenesWithoutTarget: specs.reduce((n, s) => n + (s.actions || []).filter(a => a.target && !resolveTarget(s, a.target)).length, 0) },
  sizes, sha: crypto.createHash('sha256').update(JSON.stringify([views, schemas])).digest('hex').slice(0, 16),
};
write('manifest.json', manifest);
console.log(JSON.stringify(manifest, null, 1));
