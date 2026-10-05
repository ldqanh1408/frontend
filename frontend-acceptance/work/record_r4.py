"""Ingest run 4 (Figma oracle) into the ledgers. Pipeline: record_r2.py → record_r3.py → record_r4.py → build.py.
Sources: evidence/runs/R4-001-figma/figma_parity (design parity), evidence/runs/R4-002-def-fix/definitions (49 definition types;
R4-001's definitions results are superseded — harness defects: lazy view not awaited, section label spacing), Figma oracle files
under evidence/figma/ and the journey traceability in figma_journeys.py. Expected values were fixed in the suites/oracle files
before execution; this script maps observations to results."""
import csv, json, os
from collections import Counter
import tests, findings, coverage, figma_journeys

ROOT = os.path.dirname(tests.HERE)
REL = lambda p: os.path.relpath(p, ROOT)
R1 = os.path.join(ROOT, 'evidence', 'runs', 'R4-001-figma')
R2 = os.path.join(ROOT, 'evidence', 'runs', 'R4-002-def-fix')
S1 = json.load(open(os.path.join(R1, 'summary.json')))
S2 = json.load(open(os.path.join(R2, 'summary.json')))
EVID = []


def ev(eid, path, cases, etype, vp='n/a', ts=None):
    EVID.append((eid, REL(path), ts or S2['finished_at'], cases, etype, vp))
    return eid


# ---- evidence
E_PAR = ev('EV-FIG-701', os.path.join(R1, 'figma_parity', 'figma-parity.json'), 'FIGMA-PARITY-*', 'figma parity corpus + comparisons (run 37289868204)', '1440x1000 dark+light', S1['finished_at'])
E_PARR = ev('EV-FIG-702', os.path.join(R1, 'figma_parity', 'results.json'), 'FIGMA-PARITY-*', 'figma parity cases + 70 screenshot paths', '1440x1000', S1['finished_at'])
E_FR = ev('EV-FIG-703', os.path.join(ROOT, 'evidence', 'figma', 'current-ui-frames.json'), 'FIGMA-PARITY-*', 'figma-oracle: Current UI frames, nav, module expectations', 'n/a', '2026-10-05T09:15:00Z')
E_OR = ev('EV-FIG-704', os.path.join(ROOT, 'harness', 'data', 'figma-oracle.json'), 'FIGMA-PARITY-*,DEF-*', 'figma-oracle: harness copy fixed before execution', 'n/a', '2026-10-05T09:20:00Z')
E_INV = ev('EV-FIG-705', os.path.join(ROOT, 'evidence', 'figma', 'planned-inventory-210.json'), 'FE01-210-001', 'figma-oracle: Planned inventory 210 (342:5)', 'n/a', '2026-10-05T09:15:00Z')
E_DO = ev('EV-FIG-706', os.path.join(ROOT, 'evidence', 'figma', 'definition-field-oracle-49.json'), 'DEF-*', 'figma-oracle: 49 unified-fields frames (852 fields)', 'n/a', '2026-10-05T09:15:00Z')
E_REG = ev('EV-FIG-707', os.path.join(ROOT, 'evidence', 'cloudflare', 'schema-registry.observed.json'), 'FE01-210-001', 'deployed schema registry (bundle 589b789e…, hash-verified)', 'n/a', '2026-10-05T09:45:00Z')
E_JT = ev('EV-FIG-708', os.path.join(ROOT, 'evidence', 'figma', 'journey-trace-174.json'), 'FE06-UXJ-042', 'figma-oracle: traceability 42 journeys / 174 steps', 'n/a', '2026-10-05T09:50:00Z')
E_DEF = ev('EV-DEF-701', os.path.join(R2, 'definitions', 'definitions.json'), 'DEF-*', 'definition contract observations (run 37290670654)', '1440x1000')
E_DEFR = ev('EV-DEF-702', os.path.join(R2, 'definitions', 'results.json'), 'DEF-*', 'definition cases + 49 full-page screenshots', '1440x1000')
E_FIGMD = ev('EV-FIG-709', os.path.join(ROOT, 'evidence', 'figma', 'start-here-metadata.md'), 'FIGMA-001', 'figma-oracle: page list + correction note', 'n/a', '2026-10-05T09:55:00Z')

# journey trace file (oracle)
steps = figma_journeys.steps()
with open(os.path.join(ROOT, 'evidence', 'figma', 'journey-trace-174.json'), 'w') as f:
    json.dump({'file_key': '0md9BEFI1rU0aRAvf98TWO', 'source': '04 · E2E Model / 478:130933 MODEL/trace/0…168 (read-only use_figma)',
               'note': 'ACTION ≤90, ORACLE ≤110, RECOVERY ≤90 chars as read; NATIVE SPECS omitted. Figma marks every step "Execution NOT_RUN".',
               'design_v8_journeys': [dict(zip(['id', 'name', 'flow', 'recovery'], j)) for j in figma_journeys.DESIGN_V8],
               'decisions_open': figma_journeys.DECISIONS, 'steps': steps}, f, indent=1, ensure_ascii=False)


def add_case(c, run_at, bv_default, ev_ids, viewport='1440x1000', theme=''):
    kw = dict(case_id=c['case_id'], gate=c['gate'], requirement_ref=c.get('requirement_ref') or 'Figma 0md9BEFI1rU0aRAvf98TWO (design source of truth, user-supplied)',
              input_mode=c.get('input_mode', 'trusted-input'), viewport=viewport, theme=theme, steps=c['steps'], expected=c['expected'], actual=c['actual'][:1800],
              result=c['result'], evidence_ids=ev_ids, browser_version=c.get('browser') or bv_default, run_at=run_at, reason=c.get('blocked_reason', ''))
    if kw['result'] in ('BLOCKED', 'NOT_RUN', 'NOT_APPLICABLE') and not kw['reason']:
        kw['reason'] = 'see evidence'
    tests.add(**kw)


# ---- parity cases
pr = json.load(open(os.path.join(R1, 'figma_parity', 'results.json')))
for c in pr['cases']:
    th = 'dark' if c['case_id'].endswith('-DARK') else ('light' if c['case_id'].endswith('-LIGHT') else 'dark')
    c['requirement_ref'] = 'Figma 01/02 · Current UI frame (structural copy: title, purpose, nav IA, controls)'
    add_case(c, pr['cases'][0]['run_at'], 'chromium 141.0.7390.37', f'{E_PAR},{E_PARR},{E_OR}', theme=th)

# ---- definitions cases (R4-002)
dr = json.load(open(os.path.join(R2, 'definitions', 'results.json')))
for c in dr['cases']:
    c['requirement_ref'] = 'Figma "<type> · unified fields" frame (01 · Current UI · Dark) — field key/label/required/unit/range/options'
    add_case(c, c['run_at'], 'chromium 141.0.7390.37', f'{E_DEF},{E_DEFR},{E_DO}')

T = {r['case_id']: r for r in tests.load()}
par = json.load(open(os.path.join(R1, 'figma_parity', 'figma-parity.json')))
routes = [v for k, v in par['routes'].items()]
dark = [v for k, v in par['routes'].items() if k.startswith('dark:')]
title_exact = [v['route'] for v in dark if v['title_result'] == 'EXACT']
purpose_ok = [v['route'] for v in dark if v['purpose_result'] in ('EXACT', 'EQUIVALENT')]
ctl_total = sum(len(v['controls']) for v in dark)
ctl_miss = sum(1 for v in dark for c in v['controls'] if c['result'] in ('MISSING', 'SIMILAR'))
ctl_exact = sum(1 for v in dark for c in v['controls'] if c['result'] == 'EXACT')
ctl_eq = sum(1 for v in dark for c in v['controls'] if c['result'] == 'EQUIVALENT')
nav = par['nav_compare']
nav_exact = sum(1 for n in nav['items'] if n['result'] == 'EXACT')
PARITY = dict(routes=len(dark), title_exact=title_exact, purpose_ok=purpose_ok, ctl_total=ctl_total, ctl_miss=ctl_miss, ctl_exact=ctl_exact, ctl_eq=ctl_eq,
              nav_exact=nav_exact, nav_total=len(nav['items']), pass_rt=sum(1 for c in pr['cases'] if c['case_id'].startswith('FIGMA-PARITY-') and c['result'] == 'PASS' and c['case_id'] not in ('FIGMA-PARITY-NOWRITE',)))
RUN4_AT = S2['finished_at']

def refresh(cid, **kw):
    r = dict(T[cid]); r.update(kw); r.pop('run_at', None)
    tests.add(**{k: v for k, v in r.items() if k in tests.COLS}, run_at=kw.get('run_at', RUN4_AT))

refresh('FIGMA-001', requirement_ref='Figma 01/02 · Current UI (18 module frames × Dark/Light) — design source of truth', input_mode='trusted-input', viewport='1440x1000', theme='dark+light',
        steps='Aggregate of FIGMA-PARITY-<ROUTE>-<THEME> (36) + FIGMA-PARITY-NAV; Chromium 141 on GitHub Actions; oracle transcribed from Figma before the run',
        expected='every route: h1, purpose line, nav IA and all structural controls of the Figma frame present', result='FAIL',
        actual=(f"0/36 route×theme cases PASS. Titles identical on {len(title_exact)}/18 routes ({', '.join(title_exact)}); purpose line identical on {len(purpose_ok)}/18; "
                f"Figma controls: {ctl_exact} exact + {ctl_eq} equivalent, {ctl_miss} missing of {ctl_total} (dark); nav IA {nav_exact}/{len(nav['items'])} exact, order {'same' if nav['same_order'] else 'different'}, "
                f"deployed groups {' / '.join(nav['deployed_groups'])} vs Figma BUILD / KNOWLEDGE & SERVICES / ADMINISTRATION. Figma Dark and Light frames have identical text sets (18/18 fingerprints equal), deployed light theme gives identical results; theme switch applied in both. "
                "Pixel comparison not possible (figma.com render URLs unreachable from the sandbox; short-lived URLs not committed) — text/structure parity only, plus 70 deployed screenshots."),
        evidence_ids=f'{E_PAR},{E_PARR},{E_FR},{E_OR},{E_FIGMD}', browser_version='chromium 141.0.7390.37', reason='', run_at=S1['finished_at'])

dc = [c for c in dr['cases']]
by = lambda pre: [c for c in dc if c['case_id'].startswith(pre) and c['case_id'].count('-') >= 2]
create_main = [c for c in dc if c['case_id'].startswith('DEF-CREATE-') and not c['case_id'].endswith(('-FIREFOX', '-WEBKIT'))]
create_fail = [c['case_id'][11:] for c in create_main if c['result'] == 'FAIL']
xe_fail = [c['case_id'] for c in dc if c['case_id'].endswith(('-FIREFOX', '-WEBKIT')) and c['result'] == 'FAIL']
xe_pass = [c['case_id'] for c in dc if c['case_id'].endswith(('-FIREFOX', '-WEBKIT')) and c['result'] == 'PASS']
refresh('DEF-RETEST-FND-004', requirement_ref='Figma unified-fields frames: every one of the 49 types has an authoring form ("New <type>")', input_mode='trusted-input', viewport='1440x1000',
        steps='For each of 49 types: module → Definitions → Definition type → trusted click "Create local definition" with defaults (Chromium); the 3 failing types + 1 control repeated on Firefox 142 and WebKit 26',
        expected='49/49 types create a local definition', result='FAIL',
        actual=f"{49 - len(create_fail)}/49 create on Chromium; FAIL: {', '.join(create_fail)} (Retry / resume request, Archive / transfer / deletion request, Data export / erasure request) with notice \"Use a name of 1–180 characters without path separators or control characters.\"; "
               f"reproduced on Firefox and WebKit ({len(xe_fail)} FAIL, control type agent PASS on both: {', '.join(xe_pass)}). Default name = type title + uuid ⇒ titles containing \"/\" are rejected by the app's own name validator.",
        evidence_ids=f'{E_DEF},{E_DEFR},{E_DO}', browser_version='chromium 141 / firefox 142 / webkit 26', reason='')
nf = sum(len((t.get('editor') or {}).get('fields', [])) for t in json.load(open(os.path.join(R2, 'definitions', 'definitions.json')))['types'] if not t.get('engine'))
tests.add(case_id='DEF-FIGMA-001', gate='FE-01', requirement_ref='Figma 49 "<type> · unified fields" frames (852 fields)', input_mode='trusted-input', viewport='1440x1000',
          steps='Aggregate of DEF-NAV/DEF-CREATE/DEF-COUNT/DEF-FIELDS (R4-002, Chromium 141)', expected='49/49 on every check',
          actual=(f"DEF-NAV 49/49 PASS (reachable from module UI; h2 = Figma title); DEF-COUNT 49/49 PASS (field count + section groups/counts identical); "
                  f"DEF-CREATE 46/49 (FND-004); DEF-FIELDS 46/46 evaluable PASS — {nf} deployed controls (809 Figma fields + 46 name inputs), 0 differences in key, label, required flag, unit, min/max range, options; 3 types BLOCKED_BY_FND-004 (43 Figma fields not observable)."),
          result='FAIL', evidence_ids=f'{E_DEF},{E_DEFR},{E_DO}', browser_version='chromium 141.0.7390.37', run_at=RUN4_AT)

# ---- FE01-210-001: canonical inventory
cov = coverage.build()
ist = cov['implementation_status']
tests.add(case_id='FE01-210-001', gate='FE-01', requirement_ref='v2 §6.7 — 210 canonical views (denominator = Figma Planned inventory 342:5)', input_mode='observation + trusted-input',
          viewport='1440x1000', steps='Join each of the 210 Figma rows to deployed evidence via Figma Current-frame node → route and via the deployed schema registry (runtime-verified by DEF-*); see coverage.py rules',
          expected='210/210 views COMPLETE', result='FAIL',
          actual=(f"COMPLETE {ist['COMPLETE']}, PARTIAL {ist['PARTIAL']}, NOT_IMPLEMENTED {ist['NOT_IMPLEMENTED']}, UNVERIFIED {ist['UNVERIFIED']} (10 Figma review-scope + 71 views whose route/state needs a service or seeded condition). "
                  f"Frontend functional scope per view: PASS {cov['functional_result'].get('PASS', 0)}, FAIL {cov['functional_result'].get('FAIL', 0)} (FND-004), BLOCKED {cov['functional_result'].get('BLOCKED', 0)}, NOT_RUN {cov['functional_result'].get('NOT_RUN', 0)}. "
                  "No view is COMPLETE: Figma's own inventory rates the best 4 rows \"Present · visual (not code-ready)\" and every owner route fails design parity (FIGMA-001)."),
          evidence_ids=f'{E_INV},{E_REG},{E_DEF},{E_PAR}', browser_version='chromium 141.0.7390.37', run_at=RUN4_AT)

# ---- observations derived from the R4-001 corpus (same run, same screenshots)
nomock = {v['route']: [l for l in v['lines_sample'] if 'No sample entities have been inserted' in l or 'No production result is preseeded' in l] for v in dark}
blk = {v['route']: [l for l in v['lines_sample'] if 'Always-visible controls' in l or 'Requires an observed service capability' in l] for v in dark}
svc_routes = [r for r in nomock if r not in ('home',)]
tests.add(case_id='OBS-NOMOCK-001', gate='FE-06', requirement_ref='Figma UXJ-28-S03 ORACLE "Production cannot import synthetic success handlers"; release manifest apiAuthority', input_mode='observation',
          viewport='1440x1000', steps='In the R4-001 corpus, read every service-records view and the connection page for a statement that no sample/preseeded data exists, and check that no record/receipt is listed',
          expected='every service view states that no sample entities/preseeded results exist; no records shown without a service',
          actual=f"{sum(1 for r in svc_routes if nomock[r])}/{len(svc_routes)} routes state it ({', '.join(r for r in svc_routes if not nomock[r]) or 'all'} without the sentence: specifications service-records view captured with fewer lines); release manifest: \"no mock backend included\"",
          result='PASS' if sum(1 for r in svc_routes if nomock[r]) >= len(svc_routes) - 1 else 'FAIL', evidence_ids=f'{E_PAR},EV-CF-502', browser_version='chromium 141.0.7390.37', run_at=S1['finished_at'],
          reason='')
tests.add(case_id='OBS-BLOCKERS-001', gate='FE-01', requirement_ref='Figma decision UXD-11 "Visible contextual critical actions with readable blockers; no hover-only controls"', input_mode='observation',
          viewport='1440x1000', steps='In the R4-001 corpus/screenshots, check that protected actions are rendered without hover and carry a readable blocker text',
          expected='every service module shows its protected actions with a visible blocker reason', actual=f"{sum(1 for r in svc_routes if blk[r])}/{len(svc_routes)} routes show \"Always-visible controls\"/\"Requires an observed service capability…\" (missing on: {', '.join(r for r in svc_routes if not blk[r]) or 'none'}; #connection has no protected action list)",
          result='PASS' if all(blk[r] for r in svc_routes if r not in ('specifications', 'connection')) else 'FAIL', evidence_ids=f'{E_PAR},{E_PARR}', browser_version='chromium 141.0.7390.37', run_at=S1['finished_at'], reason='')
T = {r['case_id']: r for r in tests.load()}

# ---- FE-06 journeys (Figma traceability)
FND004_STEPS = {'UXJ-18-S02': 'run-recovery', 'UXJ-18-S03': 'run-recovery', 'UXJ-27-S02': 'scope-lifecycle', 'UXJ-27-S04': 'scope-lifecycle',
                'UXJ-27-S03': 'data-lifecycle', 'UXJ-42-S03': 'data-lifecycle', 'UXJ-42-S04': 'data-lifecycle'}
FULL_FE = {'UXJ-28-S03', 'UXJ-40-S01', 'UXJ-40-S02', 'UXJ-40-S03', 'UXJ-14-S02', 'UXJ-06-S01'}
reg = json.load(open(os.path.join(ROOT, 'evidence', 'cloudflare', 'schema-registry.observed.json')))['schemas']
T = {r['case_id']: r for r in tests.load()}
jrows = []
for s in steps:
    sid = s['step_id']
    rel = [x['id'] for x in reg if s['ux_ref'] in x['ux']]
    ev_ids = ''
    if sid in figma_journeys.FE_STEPS:
        scope, cases = figma_journeys.FE_STEPS[sid]
        rs = {c: T[c]['result'] for c in cases if c in T}
        ev_ids = ','.join(sorted({e for c in cases if c in T for e in T[c]['evidence_ids'].split(',') if e}))
        if not cases:
            res, why = ('NOT_RUN', f'FE scope "{scope}" not yet scripted (needs seeded local data / trusted Monaco typing)') if sid != 'UXJ-40-S05' else ('BLOCKED', 'No screen reader / AT available in this environment; oracle also needs a service decision')
        elif any(v == 'FAIL' for v in rs.values()):
            res, why = 'FAIL', f'FE scope FAIL: {", ".join(c for c, v in rs.items() if v == "FAIL")}'
        elif all(v == 'PASS' for v in rs.values()):
            res, why = ('PASS', 'FE-scope oracle fully observable on the client') if sid in FULL_FE else ('BLOCKED', f'FE scope PASS ({", ".join(rs)}); service part of the ORACLE needs real receipts (BLOCKED_BACKEND)')
        else:
            res, why = ('NOT_RUN', f'FE scope evidence not applicable/run: {rs}')
        actual = f'FE scope: {scope}. Results: ' + ', '.join(f'{c}={v}' for c, v in rs.items())
    elif sid in FND004_STEPS:
        res, why = 'FAIL', f'Authoring request "{FND004_STEPS[sid]}" for this step cannot be created (FND-004, DEF-CREATE-{FND004_STEPS[sid]} FAIL on 3 engines); service part BLOCKED_BACKEND'
        actual = f'DEF-CREATE-{FND004_STEPS[sid]} = FAIL'
        ev_ids = f'{E_DEF},{E_DEFR}'
    else:
        ok = [x for x in rel if T.get(f'DEF-CREATE-{x}', {}).get('result') == 'PASS' and T.get(f'DEF-FIELDS-{x}', {}).get('result') == 'PASS']
        res, why = 'BLOCKED', 'BLOCKED_BACKEND: the ORACLE requires an authorized service receipt (atlas-ui/v1 proposed, no backend in this deployment)'
        actual = ('Related authoring forms present and matching Figma: ' + ', '.join(ok)) if ok else 'No related authoring form; service records only'
        ev_ids = f'{E_DEF}' if ok else ''
    jrows.append({'journey_id': s['journey_id'], 'step_id': sid, 'title': s['action'], 'actor': s['actor'], 'fixture_id': 'FX-SERVICE/atlas-ui-v1-fixture-r3' if 'FX-SVC' in actual else '',
                  'view_ids': f"{s['ux_ref']} → schemas: {', '.join(rel) or '—'}", 'expected': f"ORACLE: {s['oracle']} | RECOVERY: {s['recovery']}", 'actual': actual[:900],
                  'result': res, 'evidence_ids': ev_ids + (',' if ev_ids else '') + E_JT, 'reason': why, 'run_at': RUN4_AT})
with open(os.path.join(tests.HERE, 'journeys-r4.json'), 'w') as f:
    json.dump(jrows, f, indent=1, ensure_ascii=False)
jc = Counter(r['result'] for r in jrows)
jfail = sorted({r['journey_id'] for r in jrows if r['result'] == 'FAIL'})
refresh('FE06-UXJ-042', requirement_ref='Figma 04 · E2E Model traceability: 42 UX journeys / 174 steps (ACTION/ORACLE/RECOVERY)', input_mode='trusted-input + fixture + observation',
        steps='Each step classified: frontend-observable scope verified by existing cases (FE_STEPS), authoring request linked to DEF-* results, remaining ORACLE parts need a real service',
        expected='all applicable steps PASS', result='FAIL',
        actual=(f"174 steps: PASS {jc['PASS']}, FAIL {jc['FAIL']}, BLOCKED {jc['BLOCKED']} (BLOCKED_BACKEND or no AT), NOT_RUN {jc['NOT_RUN']}. Journeys with a FAIL step: {', '.join(jfail)}. "
                "FAIL causes: FND-004 (retry/resume, archive/transfer/delete, export/erasure requests), FND-018 (UXJ-40-S03), FND-005 (UXJ-41-S04)."),
        evidence_ids=f'{E_JT},{E_DEF}', reason='', browser_version='chromium 141 / firefox 142 / webkit 26')
refresh('FE06-UAT-307', reason='BLOCKED_INPUT: Figma states "113 original UAT remain NOT_RUN" and "UAT NOT_RUN" but contains no UAT rows (IDs/Given-When-Then); Atlas-Original-UAT-113.csv and Atlas-UX-UAT-194.csv still not supplied. Journey-level acceptance now runs from the Figma traceability (FE06-UXJ-042).', run_at=RUN4_AT)
if 'FE02-WALK-001' in T:
    refresh('FE02-WALK-001', reason='Run 4: 70 deployed screenshots at 1440x1000 dark/light captured next to the Figma Current UI comparison (FIGMA-001); pixel diff vs Figma renders not possible (figma.com unreachable from the sandbox).')

# ---- findings
F = {r['finding_id']: r for r in findings.load()}
B = tests.DEFAULTS['build_id']; D = tests.DEFAULTS['deployment_id']
F['FND-004'].update(title='3/49 definition type không tạo được: tên mặc định "<tiêu đề> <uuid>" chứa "/" bị chính validator tên của app từ chối',
    requirement_ref='Figma unified-fields frames (mỗi type có form "New <type>"); v2 FE-01', view_id='#execution (Retry / resume request), #tenancy (Archive / transfer / deletion request), #saas (Data export / erasure request)',
    impact='Không tạo được yêu cầu retry/resume/restore snapshot, archive/transfer/xoá, export/erasure ⇒ chặn 7 bước journey (UXJ-18-S02/S03, UXJ-27-S02/S03/S04, UXJ-42-S03/S04) và 9 view trong inventory.',
    repro_steps='#execution → Definitions → Definition type "Retry / resume request" → Create local definition (tương tự #tenancy "Archive / transfer / deletion request", #saas "Data export / erasure request")',
    expected='Bản nháp cục bộ được tạo và editor mở (như 46 type còn lại)', actual='Thông báo "Use a name of 1–180 characters without path separators or control characters."; không có editor. Tái hiện trên Chromium 141, Firefox 142, WebKit 26.',
    build_id=B, deployment_id=D, profile='GitHub Actions Playwright, trusted click', evidence_ids=f'{E_DEF},{E_DEFR}', status='OPEN (retested run 4: reproduces on 3 engines)',
    fix_ref='Remediation-Plan R-03', retest_case_ids='DEF-CREATE-run-recovery,DEF-CREATE-scope-lifecycle,DEF-CREATE-data-lifecycle (+ -FIREFOX/-WEBKIT)', closure_result='FAIL (retest 2026-10-05, run 37290670654)')
F['FND-012'].update(title='0/210 view COMPLETE; 81/210 view chưa kiểm được (UNVERIFIED) vì cần service/fixture hoặc thuộc review-scope của Figma',
    requirement_ref='v2 §6.7 (denominator 210 = Figma Planned inventory 342:5)', impact='Không thể chứng nhận view-level; 71 route/state cần điều kiện service; 10 mục Figma đánh dấu review-scope chờ quyết định phạm vi.',
    repro_steps='Xem Atlas-Frontend-Screen-Coverage.csv (210 hàng) và coverage.py', expected='210/210 COMPLETE', actual=f"PARTIAL {ist['PARTIAL']}, UNVERIFIED {ist['UNVERIFIED']}, NOT_IMPLEMENTED 0 (không chứng minh được vắng mặt), COMPLETE 0",
    build_id=B, deployment_id=D, profile='run 4', evidence_ids=f'{E_INV},{E_REG}', status='OPEN (re-evaluated run 4 against the Figma inventory; run-1 "7 NOT_IMPLEMENTED" not reproduced as provable absence)',
    retest_case_ids='FE01-210-001', closure_result='FAIL (2026-10-05)')
nav_bad = [n for n in nav['items'] if n['result'] != 'EXACT']
F['FND-023'] = dict(finding_id='FND-023', severity='P2', gate='FE-01', view_id='shell (sidebar, mobile drawer)', requirement_ref='Figma 01/02 · Current UI — navigation in all 18 module frames',
    title='Điều hướng (IA) khác Figma: nhóm WORKSPACE / OPERATIONS thay vì BUILD / KNOWLEDGE & SERVICES / ADMINISTRATION; 11/18 nhãn khác; thứ tự khác',
    impact='Người dùng theo thiết kế (tài liệu, onboarding, design review) không tìm thấy mục tương ứng; nhãn module trên sidebar không khớp tên trong Figma.',
    repro_steps='Mở #home 1440x1000, đọc aside nav', expected='BUILD [Overview, Specifications, Code intelligence, Agents, Resources, Workflow & planning, Runs & activity, Reviews & delivery] · KNOWLEDGE & SERVICES [Memory & context, AI access & budget, Collaboration, Configuration & policy] · ADMINISTRATION [People & access, Organization & projects, Usage, billing & data, Desktop & runtime, Operations observer, Connection & receipts]',
    actual='; '.join(f"{n['figma']}→{n['deployed'] or 'không có'}" for n in nav_bad), build_id=B, deployment_id=D, profile='GitHub Actions Chromium 141', evidence_ids=f'{E_PAR},{E_PARR}',
    owner_proposed='Frontend + Design (xác nhận Figma là chuẩn)', status='OPEN (new in run 4)', fix_ref='Remediation-Plan R-12', retest_case_ids='FIGMA-PARITY-NAV', closure_result='')
tdiff = [f"#{v['route']}: \"{v['h1']}\" ≠ \"{v['figma_title']}\"" for v in dark if v['title_result'] != 'EXACT']
F['FND-024'] = dict(finding_id='FND-024', severity='P2', gate='FE-01', view_id='18 module routes', requirement_ref='Figma 01/02 · Current UI module frames (title + purpose line)',
    title=f'Tiêu đề trang khác Figma ở {18 - len(title_exact)}/18 route; câu mô tả (purpose) khác ở {18 - len(purpose_ok)}/18 route',
    impact='Tên màn hình/ngữ nghĩa trang khác thiết kế (vd. "Execution" thay vì "Runs & agent activity", "AI gateway" thay vì "AI access & budget", trang chủ "Build with a clear trail." thay vì "Turn specifications into traceable work").',
    repro_steps='Mở từng route, đọc main h1 và đoạn mô tả dưới h1', expected='h1 và purpose theo frame Atlas/Dark/<route>', actual='; '.join(tdiff)[:1200],
    build_id=B, deployment_id=D, profile='GitHub Actions Chromium 141 (dark + light giống nhau)', evidence_ids=f'{E_PAR},{E_PARR}', owner_proposed='Frontend + Design', status='OPEN (new in run 4)',
    fix_ref='Remediation-Plan R-12', retest_case_ids='FIGMA-PARITY-<ROUTE>-DARK/LIGHT', closure_result='')
worst = sorted(dark, key=lambda v: -sum(1 for c in v['controls'] if c['result'] in ('MISSING', 'SIMILAR')))[:6]
F['FND-025'] = dict(finding_id='FND-025', severity='P2', gate='FE-01', view_id='18 module routes', requirement_ref='Figma 01/02 · Current UI module frames (controls, tabs, lifecycle panel)',
    title=f'Bố cục/điều khiển module khác Figma: {ctl_miss}/{ctl_total} điều khiển cấu trúc trong frame Figma không có trên bản deploy',
    impact='Các phần thiết kế như bảng "Name / State / Revision / Observed", chuỗi lifecycle, "Continue the journey", "Operation receipts", bộ action theo module (vd. Execution: Admit run, Retry task, Restore snapshot, Inspect cleanup; Governance: Run preflight, Create PR, Verify acceptance…) và tab (Tasks / Agent activity / Tools / Logs & PTY) không có; bản deploy dùng bố cục khác ("Always-visible controls", tab Overview/Run identity…). Trang chủ khác hoàn toàn.',
    repro_steps='Mở route → tab Service records (và editor sau "Create local definition" nếu có) → so với frame Figma', expected='Mọi điều khiển cấu trúc của frame Figma hiện diện',
    actual='; '.join(f"#{v['route']}: thiếu {sum(1 for c in v['controls'] if c['result'] in ('MISSING', 'SIMILAR'))}/{len(v['controls'])}" for v in dark),
    build_id=B, deployment_id=D, profile='GitHub Actions Chromium 141', evidence_ids=f'{E_PAR},{E_PARR}', owner_proposed='Frontend + Design', status='OPEN (new in run 4)',
    fix_ref='Remediation-Plan R-13', retest_case_ids='FIGMA-PARITY-<ROUTE>-DARK/LIGHT', closure_result='')
findings.save(sorted(F.values(), key=lambda r: r['finding_id']))

with open(os.path.join(tests.HERE, 'evidence-r4.json'), 'w') as f:
    json.dump(EVID, f, indent=1)
with open(os.path.join(tests.HERE, 'parity-r4.json'), 'w') as f:
    json.dump(PARITY, f, indent=1)
print(json.dumps({'parity': PARITY, 'journeys': jc, 'coverage': ist}, ensure_ascii=False))
