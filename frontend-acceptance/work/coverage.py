"""Coverage classification (v2 §6.7) — run 4: canonical denominator = Figma Planned inventory (210 rows, node 342:5).

Per view the deployed evidence is joined through two independent, non-title keys:
  (a) Figma "Current Dark/Light nodes" of the inventory row → Current UI frame → deployed hash route
      (module frames "Atlas/<Theme>/<route>", state frames' owner route, unified-fields frames' module route);
  (b) the deployed bundle's own schema registry (evidence/cloudflare/schema-registry.observed.json: 49 authoring schemas, each
      listing the planned view slugs it serves), verified at runtime by DEF-NAV/DEF-CREATE/DEF-FIELDS (R4-002).
implementation_status rules (no view_id is inferred from a title, invariant 20):
  * Figma presence "Review scope" → UNVERIFIED (Figma: consolidation proposed, removal/out-of-scope NOT confirmed).
  * otherwise, (a) or (b) present → PARTIAL. Never COMPLETE: Figma itself classifies its best rows as "Present · visual — not
    code-ready", every route fails design parity (FIGMA-PARITY-*) and service outcomes are BLOCKED_BACKEND.
  * otherwise → UNVERIFIED, never NOT_IMPLEMENTED: Figma marks the first 130 rows as routes and the last 80 as states. A state
    only renders inside its route under a service condition (run data, revoked grant, stale index…) that cannot be produced
    without an authorized service or seeded fixture, so its absence is not provable. For the 11 route rows without (a)/(b) the
    deployed UI exposes service-gated entry controls for the same intent (e.g. "Sign in", "History & attribution", "Output
    artifacts", "Lease & writer fencing", "Open terminal/logs" — see figma-parity.json corpus), so absence is not provable either.
"""
import csv, json, os
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SC_COLS = ['view_id', 'title', 'module', 'owner_route', 'actual_route', 'canonical_spec_ids', 'source_component', 'required_fields',
           'required_actions', 'applicable_states', 'implementation_status', 'functional_result', 'responsive_result',
           'accessibility_result', 'runtime_result', 'performance_result', 'journey_ids', 'finding_ids', 'evidence_ids', 'limitations']
CANONICAL_DENOMINATOR = 210
FND004 = {'run-recovery', 'scope-lifecycle', 'data-lifecycle'}
SURFACE_ROUTE = {'ide': 'identity', 'ten': 'tenancy', 'gw': 'gateway', 'ag': 'agents', 'mem': 'memory', 'cfg': 'configuration', 'code': 'code',
                 'ex': 'execution', 'sp': 'specifications', 'gov': 'governance', 'wf': 'workflow', 'sh': 'home', 'col': 'collaboration', 'obs': 'observer'}
ROUTES = ['home', 'specifications', 'code', 'agents', 'resources', 'memory', 'workflow', 'execution', 'governance', 'gateway', 'collaboration',
          'configuration', 'identity', 'tenancy', 'saas', 'desktop', 'observer', 'connection']
# Local (no service) conditions that a seeded fixture could reach; everything else needs a service condition.
LOCAL_RUNNABLE = {'history', 'spec-diff', 'ide-state-source-loading', 'ide-state-source-failed', 'ide-state-source-empty', 'ide-state-binary-file',
                  'ide-state-large-file', 'ide-state-offline-draft', 'ide-state-dirty-tab', 'ide-state-stale-index', 'ide-state-partial-index', 'state-offline-draft'}
CMD = 'Generic command-stage display (Received/Accepted/Unknown + "Reconcile this operation; do not resend") verified with the labelled fixture on the shared ServiceModule (FX-SVC-RECEIVED/ACCEPTED/NETFAILAFTERSEND); execution-specific state not observed.'
ENTRY = {'login': 'Deployed entry: "Sign in" in #identity / #observer service records (service-gated); Figma sign-in screen GAP/J01/sign-in not observable without service.',
         'auth-help': 'Deployed: generic Help dialog only; sign-in help belongs to the service-gated sign-in flow.',
         'obs-login': 'Deployed entry: "Sign in" in #observer service records (service-gated).',
         'history': 'Deployed: "History & attribution", "Compare refs" (#code); "History / compare" in definition editors; specification branch history not exercised.',
         'spec-diff': 'Deployed: "Compare refs"/"diff" (#code), "History / compare"; specification change view not exercised.',
         'terminal': 'Deployed entry: "Open terminal/logs" (#execution), "open PTY" (#desktop) — service-gated.',
         'artifacts': 'Deployed panel: "Output artifacts" tab, "download artifact" (#execution service records) — service-gated.',
         'locks': 'Deployed panel: "Lease & writer fencing" tab, "force fence with authority" (#execution) — service-gated.',
         'artifact-handoff': 'Deployed control: "accept handoff" (#execution) — service-gated.',
         'signature-history': 'No deployed control observed for signature history in captured corpus; gate signatures are service data.',
         'obs-audit': 'Deployed: "Filter audit" (#governance), "Inspect audit trail" (#collaboration), "Audit provenance" (#identity) — service-gated.'}
for _k in ('execution-command-requested', 'execution-command-accepted', 'execution-command-approve-gate-requested', 'execution-command-cancel-requested',
           'execution-command-resume-requested', 'execution-command-retry-requested', 'state-pr-unknown'):
    ENTRY[_k] = CMD
R_PARITY = 'evidence/runs/R4-001-figma/figma_parity/figma-parity.json'
R_DEF = 'evidence/runs/R4-002-def-fix/definitions/definitions.json'


def J(rel):
    p = os.path.join(ROOT, rel)
    return json.load(open(p)) if os.path.exists(p) else None


def frame_routes():
    fr = J('evidence/figma/current-ui-frames.json')
    m = {}
    for route, v in fr['module'].items():
        m[v['dark']] = ('module', route, v['dark_name'])
    for sid, v in fr['state'].items():
        m[v['dark']] = ('state', v['owner_route'], f'Atlas/Dark/States/{sid}')
    for t in J('evidence/figma/definition-field-oracle-49.json')['types']:
        m.setdefault(t['figma_dark'], ('definition', t['route'], f"{t['title']} · unified fields"))
    return m


def build_rows():
    inv = J('evidence/figma/planned-inventory-210.json')['rows']
    reg = J('evidence/cloudflare/schema-registry.observed.json')['schemas']
    oracle = {t['schema_label']: t for t in J('evidence/figma/definition-field-oracle-49.json')['types']}
    defs = {t['schema']: t for t in (J(R_DEF) or {'types': []})['types'] if not t.get('engine')}
    par = (J(R_PARITY) or {'routes': {}})['routes']
    fmap = frame_routes()
    rows = []
    for idx, r in enumerate(inv):
        slug = r['view_id'].split('/', 1)[1]
        schemas = [s for s in reg if slug in s['views']]
        fr = fmap.get(r['figma_dark']) if r['figma_dark'] else None
        owner = fr[1] if fr else (schemas[0]['module'] if schemas else SURFACE_ROUTE[r['surface_code']])
        routes = []
        if fr:
            routes.append('#' + fr[1])
        routes += [f"#{s['module']}?authority=definitions&schema={s['id']}" for s in schemas]
        def_ok = [s['id'] for s in schemas if (defs.get(s['id']) or {}).get('editor', {}).get('fields') and not (defs[s['id']].get('diffs') or [])]
        def_bad = [s['id'] for s in schemas if s['id'] in FND004]
        kind = 'route' if idx < 130 else 'state'
        if r['presence_status'] == 'Review scope':
            status = 'UNVERIFIED'
        elif fr or schemas:
            status = 'PARTIAL'
        else:
            status = 'UNVERIFIED'
        if status == 'UNVERIFIED' and not (fr or schemas) and r['presence_status'] != 'Review scope':
            func = 'NOT_RUN' if slug in LOCAL_RUNNABLE else 'BLOCKED'
        elif def_bad:
            func = 'FAIL'
        elif schemas and len(def_ok) == len(schemas):
            func = 'PASS'
        elif status == 'UNVERIFIED':
            func = 'NOT_RUN'
        else:
            func = 'BLOCKED'
        impl = bool(fr or schemas)
        p = par.get(f'dark:{owner}') if fr and fr[0] == 'module' else par.get(f'dark:{owner}')
        parity_note = ''
        if p:
            miss = sum(1 for c in p['controls'] if c['result'] in ('MISSING', 'SIMILAR'))
            parity_note = f"Design parity #{owner} vs Figma {p['figma_frame']}: FAIL (h1 \"{p['h1']}\" vs Figma \"{p['figma_title']}\"; purpose {p['purpose_result']}; {miss}/{len(p['controls'])} Figma controls missing)."
        fnd = []
        if not impl:
            fnd.append('FND-012')
        if def_bad:
            fnd.append('FND-004')
        if impl:
            fnd += ['FND-023', 'FND-024', 'FND-025', 'FND-017', 'FND-018']
        ev = ['EV-FIG-705', 'EV-FIG-707'] + (['EV-DEF-701'] if schemas else []) + (['EV-FIG-701'] if impl else [])
        lim = [f"Figma presence: {r['presence_status']} — {r['notes'][:150]}"]
        if not impl and r['presence_status'] != 'Review scope':
            why = ('local condition (seeded source/document) not yet scripted' if slug in LOCAL_RUNNABLE else 'needs an authorized service or seeded fixture condition (BLOCKED_BACKEND)')
            lim.append(f'{kind}: no Figma Current frame and no deployed schema mapping; absence NOT proven — {why}. ' + ENTRY.get(slug, '') + ' Target design: Figma 05/06 Gap closure, 07 Prototype flows.')
        if schemas:
            lim.append('Authoring: ' + '; '.join(f"{s['id']} ({oracle[s['id']]['field_count']} fields, Figma {oracle[s['id']]['figma_dark']}) " +
                                                  ('create FAIL (FND-004)' if s['id'] in FND004 else ('create+field contract PASS' if s['id'] in def_ok else 'not verified')) for s in schemas))
            lim.append('functional_result covers the frontend authoring scope only; service outcomes BLOCKED_BACKEND (atlas-ui/v1 proposed).')
        if parity_note:
            lim.append(parity_note)
        if impl:
            lim.append('Responsive/a11y/runtime/perf are route-level results of the owner route (FE02-AUTO-216, FE01-TITLE-001, FE02-SCROLL-001, A11Y-AXE-001, FE01-RUNTIME-001, PERF-007).')
        rows.append({
            'view_id': r['view_id'], 'title': r['title'], 'module': r['surface'], 'owner_route': '#' + owner, 'actual_route': ' | '.join(routes) or '—',
            'canonical_spec_ids': ', '.join([s['id'] for s in schemas] + sorted({u for s in schemas for u in s['ux']})),
            'source_component': (f"Figma {fr[2]} ({r['figma_dark']} / {r['figma_light']})" if fr else 'Figma: no Current frame') + ' · source code not provided',
            'required_fields': '; '.join(f"{s['id']}: {oracle[s['id']]['field_count']} fields" for s in schemas),
            'required_actions': '; '.join(f"{s['id']}: Create local definition, save revision" for s in schemas) or ('Figma module controls (see FIGMA-PARITY-' + owner.upper() + ')' if impl else ''),
            'applicable_states': r['components'],
            'implementation_status': status, 'functional_result': func,
            'responsive_result': 'FAIL' if impl else 'NOT_RUN', 'accessibility_result': 'FAIL' if impl else 'NOT_RUN',
            'runtime_result': 'PASS' if impl else 'NOT_RUN', 'performance_result': 'PASS' if impl else 'NOT_RUN',
            'journey_ids': r['journeys'], 'finding_ids': ','.join(fnd), 'evidence_ids': ','.join(ev), 'limitations': ' | '.join(lim),
        })
    return rows


def build():
    rows = build_rows()
    with open(os.path.join(ROOT, 'Atlas-Frontend-Screen-Coverage.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=SC_COLS)
        w.writeheader()
        w.writerows(rows)
    # Route-level proxy kept (PROPOSED_EXTENSION) for continuity with run 2/3.
    par = (J(R_PARITY) or {'routes': {}})['routes']
    route_cols = ['route_id'] + SC_COLS[1:]
    rr = []
    for rid in ROUTES:
        p = par.get(f'dark:{rid}') or {}
        rr.append({'route_id': f'ROUTE:{rid}', 'title': p.get('h1') or rid, 'module': rid, 'actual_route': f'#{rid}',
                   'source_component': f"Figma Atlas/Dark/{rid} ({p.get('figma_frame', '')})", 'implementation_status': 'PARTIAL',
                   'functional_result': 'BLOCKED', 'responsive_result': 'FAIL', 'accessibility_result': 'FAIL', 'runtime_result': 'PASS', 'performance_result': 'PASS',
                   'finding_ids': 'FND-017,FND-018,FND-023,FND-024,FND-025', 'evidence_ids': 'EV-FIG-701,EV-RT-501,EV-RESP-501',
                   'limitations': (f"Figma title \"{p.get('figma_title')}\" vs deployed \"{p.get('h1')}\" ({p.get('title_result')}); purpose {p.get('purpose_result')}; "
                                   f"Figma controls missing {sum(1 for c in p.get('controls', []) if c['result'] in ('MISSING', 'SIMILAR'))}/{len(p.get('controls', []))}") if p else ''})
    with open(os.path.join(ROOT, 'Atlas-Frontend-Route-Coverage.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=route_cols)
        w.writeheader()
        w.writerows(rr)
    st = Counter(r['implementation_status'] for r in rows)
    summary = {
        'canonical_denominator': CANONICAL_DENOMINATOR, 'canonical_rows_resolved': len(rows), 'source': 'Figma 04 · E2E Model / Planned inventory (342:5)',
        'implementation_status': {k: st.get(k, 0) for k in ['COMPLETE', 'PARTIAL', 'NOT_IMPLEMENTED', 'UNVERIFIED']},
        'functional_result': dict(Counter(r['functional_result'] for r in rows)),
        'figma_presence': dict(Counter(json.loads(json.dumps(x))['presence_status'] for x in J('evidence/figma/planned-inventory-210.json')['rows'])),
        'implementation_status_basis': __doc__.split('implementation_status rules')[1].strip()[:900],
        'inherited_run1': {'COMPLETE': 0, 'PARTIAL': 74, 'NOT_IMPLEMENTED': 7, 'UNVERIFIED': 129, 'label': 'INHERITED_EVIDENCE (v2 prompt §6.7), superseded by run 4'},
        'routes_observed': len(ROUTES),
        'views_with_schema': sum(1 for r in rows if r['canonical_spec_ids']),
        'views_with_figma_frame': sum(1 for r in rows if not r['source_component'].startswith('Figma: no')),
    }
    with open(os.path.join(HERE, 'coverage-summary.json'), 'w') as f:
        json.dump(summary, f, indent=1, ensure_ascii=False)
    return summary


if __name__ == '__main__':
    print(json.dumps(build(), indent=1, ensure_ascii=False))
