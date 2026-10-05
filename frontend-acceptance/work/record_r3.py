"""Ingest run 3 (GitHub Actions, Playwright) results from ../evidence/runs/R3-001-xengine into the ledgers.
Run after record_r2.py (it rebuilds from scratch):  python3 record_r2.py && python3 record_r3.py && python3 build.py
Expected values were fixed in the suites before execution; this script only maps observations to results."""
import glob, json, os
import tests, findings

ROOT = os.path.dirname(tests.HERE)
RUN = os.path.join(ROOT, 'evidence', 'runs', 'R3-001-xengine')
REL = lambda p: os.path.relpath(p, ROOT)
EVID = []  # (evidence_id, path, timestamp, case_ids, type, viewport) appended for build.py
GH = 'GitHub Actions ubuntu-latest, Playwright 1.56.1'


def ev(eid, path, cases, etype, vp='n/a', ts=None):
    EVID.append((eid, REL(path), ts or summary.get('finished_at', ''), cases, etype, vp))
    return eid


def J(*p):
    f = os.path.join(RUN, *p)
    return json.load(open(f)) if os.path.exists(f) else None


summary = J('summary.json') or {}
RUN_AT = summary.get('finished_at', '2026-10-05')
GH_RUN = summary.get('github_run_id', '?')
counter = {'KBD': 600, 'PERF': 600, 'XE': 600, 'SHOT': 600, 'CF': 600, 'A11Y': 600, 'FX': 600, 'RT': 600}


def nid(area):
    counter[area] += 1
    return f'EV-{area}-{counter[area]}'


def add(**kw):
    kw.setdefault('run_at', RUN_AT)
    kw.setdefault('browser_version', kw.pop('bv', GH))
    kw.setdefault('reason', '')
    if kw['result'] in ('BLOCKED', 'NOT_RUN', 'NOT_APPLICABLE') and not kw['reason']:
        kw['reason'] = 'see evidence'
    tests.add(**kw)


# ---------------- mirror (runner-side HTTP) ----------------
m = J('mirror', 'results.json')
if m:
    e = ev(nid('CF'), os.path.join(RUN, 'mirror', 'results.json'), 'CF-PRE-001..007 (runner)', 'HTTP checks from GitHub runner')
    for c in m['cases']:
        add(case_id=c['case_id'] + '-GH', gate=c['gate'], requirement_ref=c['requirement_ref'], input_mode='http', steps=f'Same check from GitHub Actions runner (Node fetch), run {GH_RUN}',
            expected=c['expected'], actual=c['actual'][:900], result=c['result'], evidence_ids=e, reason=c.get('reason', ''), bv='Node 22 fetch (no browser)')

# ---------------- keyboard (trusted) ----------------
kb = J('keyboard', 'keyboard-results.json')
if kb:
    for engine, data in kb.items():
        e = ev(nid('KBD'), os.path.join(RUN, 'keyboard', 'keyboard-results.json'), ','.join(c['case_id'] for c in data['checks']), f'trusted keyboard ({engine})', '1440x900 / 375x812')
        for c in data['checks']:
            cid = c['case_id'] + ('' if engine == 'chromium' else '-' + engine.upper())
            gate = 'FE-01' if c['case_id'].startswith('FE01') else 'FE-03'
            add(case_id=cid, gate=gate, requirement_ref='WCAG 2.2 2.1.1/2.4.1/2.4.3/2.4.7/2.4.11; WAI-ARIA APG (Tabs, Dialog Modal, Combobox)', input_mode='trusted-input',
                viewport='1440x900' if 'MOBILE' not in c['case_id'] else '375x812', steps=f'Playwright {engine} keyboard (see suite keyboard.mjs)', expected=c.get('expected', ''),
                actual=json.dumps(c.get('actual'), ensure_ascii=False)[:1500], result=c['result'], evidence_ids=e, reason=c.get('reason', ''), bv=f'{engine} {data.get("browserVersion", "")}')

# ---------------- perf ----------------
pf = J('perf', 'perf-results.json')
if pf:
    e = ev(nid('PERF'), os.path.join(RUN, 'perf', 'perf-results.json'), 'PERF-007,PERF-INP-001,PERF-008', 'performance samples', '1440x900 / 375x812 throttled')
    b = pf['budget']
    for k, label, vp in [('cold_desktop', 'PERF-007-COLD', '1440x900'), ('warm_desktop', 'PERF-007-WARM', '1440x900'), ('cold_mobile_throttled', 'PERF-007-MOBILE', '375x812 CPU4x 1.6/0.75Mbps 150ms')]:
        s = pf['PERF-007'][k]
        st = s['stats']; v = s['budget']
        add(case_id=label, gate='FE-05', requirement_ref='v2 §9 P-B PERF-007; web-vitals thresholds', input_mode='navigation', viewport=vp,
            steps=f"{st['lcp']['n']} runs, Playwright chromium, PerformanceObserver buffered", expected=f"p75 LCP <= {b['LCP_p75']} ms, FCP <= {b['FCP_p75']} ms, CLS <= {b['CLS_p75']}",
            actual=f"LCP p50/p75/p95 = {st['lcp']['p50']}/{st['lcp']['p75']}/{st['lcp']['p95']} ms; FCP {st['fcp']['p50']}/{st['fcp']['p75']}/{st['fcp']['p95']} ms; CLS p75 {st['cls']['p75']}; TTFB p75 {st['ttfb']['p75']} ms; load p75 {st['load']['p75']} ms",
            result='PASS' if all(v.values()) and st['lcp']['n'] >= 10 else 'FAIL', evidence_ids=e, bv=f"chromium {pf.get('browserVersion', '')}")
    for lab in ('desktop', 'cpu4x'):
        r = pf.get(f'PERF-INP-001-{lab}')
        if r:
            add(case_id=f'PERF-INP-001-{lab.upper()}', gate='FE-05', requirement_ref='INP (web-vitals) p75/p98 <= 200 ms; >=30 interactions', input_mode='trusted-input', viewport='1440x900',
                steps='nav clicks x18, tab clicks, theme toggles x4, typing in search; Event Timing durationThreshold 16 ms', expected=f"{r['interactions']} >= 30 interactions; INP <= {b['INP']} ms",
                actual=f"interactions={r['interactions']} reported(>=16ms)={r['reported']} p50/p75/p95={r['p50']}/{r['p75']}/{r['p95']} ms INP={r['inp']} ms slowest={json.dumps(r['slowest'][:3])}",
                result='PASS' if r['pass'] and r['interactions'] >= 30 else 'FAIL', evidence_ids=e, bv=f"chromium {pf.get('browserVersion', '')}")
    r = pf.get('PERF-008')
    if r:
        add(case_id='PERF-008', gate='FE-05', requirement_ref='30 open-close cycles; heap/listeners growth', input_mode='navigation', viewport='1440x900', steps='30 cycles of 5 routes; HeapProfiler.collectGarbage before/after',
            expected=f"heap growth <= {b['HEAP_GROWTH_PCT']}% and listeners not growing >10%", actual=json.dumps({k: r[k] for k in ('before', 'after', 'heapGrowthPct', 'workers')})[:900],
            result='PASS' if r['pass'] else 'FAIL', evidence_ids=e, reason=r.get('note', ''), bv=f"chromium {pf.get('browserVersion', '')}")

# ---------------- injected (cross-engine) ----------------
inj = sorted(glob.glob(os.path.join(RUN, 'injected', '*.json')))
for f in inj:
    if f.endswith('results.json'):
        continue
    d = json.load(open(f)); job = d['job']; engine = d['engine']; res = d.get('result') or {}; err = d.get('error')
    vp = f"{job.get('viewport', {}).get('width')}x{job.get('viewport', {}).get('height')}"
    bv = f"{engine} {d.get('browserVersion', '')}"
    script = job['script']
    if script == 'deeplink':
        e = ev(nid('XE'), f, 'FE04-XENGINE-001', f'deeplink {engine}', vp)
        dr = res.get('direct', {}); rl = res.get('reload', {})
        okd = sum(v[0] for v in dr.values()); okr = sum(v[0] for v in rl.values())
        add(case_id=f'FE04-XENGINE-ROUTES-{engine.upper()}', gate='FE-04', requirement_ref='FE-04 cross-engine; FE-01 direct/refresh/back/query', input_mode='synthetic-DOM', viewport=vp,
            steps='harness/remote/deeplink.js via Playwright', expected='18/18 direct + 18/18 reload + history + query + unknown view, 0 errors',
            actual=f"direct {okd}/{len(dr)} reload {okr}/{len(rl)} history_pass={res.get('history_pass')} errs={len(res.get('errs', []))} error={err}",
            result='PASS' if not err and okd == okr == 18 and res.get('history_pass') else ('BLOCKED' if err and not dr else 'FAIL'), evidence_ids=e, reason=err or '', bv=bv)
    elif script == 'fe02':
        e = ev(nid('XE'), f, f'FE02-AUTO-216-{vp.split("x")[0]}', f'fe02 {engine}', vp)
        rows = res.get('rows', {})
        dirty = {k: v for k, v in rows.items() if v[0] or v[1] or v[2] or v[3] or v[6] or v[4] != 1}
        cid = f'FE02-AUTO-216-{vp.split("x")[0]}-GH' + ('' if engine == 'chromium' else '-' + engine.upper())
        add(case_id=cid, gate='FE-02', requirement_ref='v2 §6.2 (automated subset)', input_mode='synthetic-DOM', viewport=vp, theme='dark+light',
            steps='harness/remote/detector.js + fe02.js via Playwright', expected='probe valid; 36/36 combos clean',
            actual=f"probe={res.get('probe', {}).get('valid')} combos={len(rows)} dirty={len(dirty)} samples={json.dumps(res.get('samples', {}), ensure_ascii=False)[:700]} errs={len(res.get('errs', []))} error={err}",
            result='BLOCKED' if (err and not rows) else ('PASS' if len(rows) == 36 and not dirty and res.get('probe', {}).get('valid') else 'FAIL'), evidence_ids=e, reason=err or '', bv=bv)
    elif script == 'axe':
        e = ev(nid('A11Y'), f, 'A11Y-AXE-001/002', f'axe {engine}', vp)
        theme = res.get('theme')
        rules = res.get('rules', {})
        add(case_id='A11Y-AXE-001' if job.get('tag') == 'dark' else 'A11Y-AXE-002', gate='FE-03', requirement_ref='axe-core 4.10.2 wcag2a/2aa/21a/21aa/22aa, 18 routes', input_mode='synthetic-DOM', viewport=vp, theme=theme or '',
            steps='harness/remote/axe.js via Playwright (default, not-connected state)', expected='0 violations',
            actual=f"theme={theme} routes={len(res.get('routes', {}))} violations={json.dumps({k: [v['impact'], len(v['routes']), v.get('sample')] for k, v in rules.items()})[:900]} error={err}",
            result='BLOCKED' if err and not res.get('routes') else ('PASS' if not rules and len(res.get('routes', {})) == 18 else 'FAIL'), evidence_ids=e,
            reason=(err or '') + (' Connected state and open dialogs not covered.' if job.get('tag') == 'light' else ''), bv=bv)
    elif script == 'fx_service':
        e = ev(nid('FX'), f, 'FX-SERVICE-001,FX-SERVICE-FND-005', 'fixture harness (draft)', vp)
        add(case_id='FX-SERVICE-001', gate='FE-06', requirement_ref='v2 §6.3 (fixture FX-SERVICE/atlas-ui-v1-fixture-r2; proposed contract)', input_mode='synthetic-DOM', viewport=vp, fixture_id='FX-SERVICE/atlas-ui-v1-fixture-r2',
            steps='harness/remote/fx_service.js on /harness-blank with the real bundle', expected='connect; service action visible; double activation => exactly 1 POST; stage shown; after 401 => disconnected and no stale success toast',
            actual=json.dumps({'steps': res.get('steps'), 'posts': len(res.get('posts', [])), 'errs': res.get('errs'), 'error': err}, ensure_ascii=False)[:1500],
            result='NOT_RUN', evidence_ids=e, reason='Draft fixture harness executed for exploration only; results reviewed manually before any PASS/FAIL (see report).', bv=bv)

# ---------------- screenshots ----------------
si = J('screenshots', 'screenshots-index.json')
if si:
    e = ev(nid('SHOT'), os.path.join(RUN, 'screenshots', 'screenshots-index.json'), 'FE02-WALK-001', 'screenshot index (72 JPEG)', '375x812 / 1440x900')
    shots = si['shots']
    add(case_id='FE02-WALK-001', gate='FE-02', requirement_ref='walkthrough desktop + mobile (visual evidence only)', input_mode='synthetic-DOM', viewport='375x812,1440x900', theme='dark+light',
        steps='Screenshot every route after h1 + DOM settle', expected='72 screenshots captured after correct render (h1 matched); visual review vs Figma pending',
        actual=f"captured={len(shots)} h1_mismatch={sum(1 for s in shots if not s['h1ok'])} errors={len(si['errors'])}", result='NOT_RUN',
        evidence_ids=e, reason='Screenshots captured as evidence; visual parity review against Figma frames not possible (per-view frames absent from the supplied Figma file).')

with open(os.path.join(tests.HERE, 'evidence-r3.json'), 'w') as f:
    json.dump(EVID, f, indent=1)
print('ingested', len(EVID), 'evidence entries; tests now', len(tests.load()))
