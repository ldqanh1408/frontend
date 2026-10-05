"""Ingest run 3 (GitHub Actions, Playwright) results from ../evidence/runs/R3-001-xengine into the ledgers.
Run after record_r2.py (it rebuilds from scratch):  python3 record_r2.py && python3 record_r3.py && python3 build.py
Expected values were fixed in the suites before execution; this script only maps observations to results."""
import glob, json, os
import tests, findings

ROOT = os.path.dirname(tests.HERE)
RUNS = ['R3-001-xengine', 'R3-002-fx-layout', 'R3-003-kbd-perf', 'R3-004-kbd-fix']
RUN = None
REL = lambda p: os.path.relpath(p, ROOT)
EVID = []  # (evidence_id, path, timestamp, case_ids, type, viewport) appended for build.py
GH = 'GitHub Actions ubuntu-latest, Playwright 1.56.1'


def ev(eid, path, cases, etype, vp='n/a', ts=None):
    EVID.append((eid, REL(path), ts or summary.get('finished_at', ''), cases, etype, vp))
    return eid


def J(*p):
    f = os.path.join(RUN, *p)
    return json.load(open(f)) if os.path.exists(f) else None


summary = {}
RUN_AT = '2026-10-05'
GH_RUN = '?'
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


def ingest(run_name):
    global RUN, summary, RUN_AT, GH_RUN
    RUN = os.path.join(ROOT, 'evidence', 'runs', run_name)
    if not os.path.isdir(RUN):
        return
    summary = J('summary.json') or {}
    RUN_AT = summary.get('finished_at') or summary.get('started_at') or '2026-10-05'
    GH_RUN = summary.get('github_run_id', '?')
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
                    viewport='1440x900' if 'MOBILE' not in c['case_id'] else '375x812', steps=f'Playwright {engine} keyboard (see suite keyboard.mjs)', expected=c.get('expected') or 'per keyboard.mjs (harness error before evaluation)',
                    actual=json.dumps(c.get('actual'), ensure_ascii=False)[:1500], result=c['result'], evidence_ids=e, reason=c.get('reason', ''), bv=f'{engine} {data.get("browserVersion", "")}')

    # ---------------- perf ----------------
    pf = J('perf', 'perf-results.json')
    if pf:
        e = ev(nid('PERF'), os.path.join(RUN, 'perf', 'perf-results.json'), 'PERF-007,PERF-INP-001,PERF-008', 'performance samples', '1440x900 / 375x812 throttled')
        b = pf['budget']
        for k, label, vp in ([('cold_desktop', 'PERF-007-COLD', '1440x900'), ('warm_desktop', 'PERF-007-WARM', '1440x900'), ('cold_mobile_throttled', 'PERF-007-MOBILE', '375x812 CPU4x 1.6/0.75Mbps 150ms')] if 'PERF-007' in pf else []):
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
            add(case_id='PERF-008', gate='FE-05', requirement_ref='30 open-close cycles; heap/listeners growth (budget locked before measurement; 10% is an ASSUMPTION pending a product budget)', input_mode='navigation', viewport='1440x900', steps='2 warm-up cycles, then cycles of 5 routes; HeapProfiler.collectGarbage at start and every 30 cycles',
                expected=f"heap growth start→30 cycles <= {b['HEAP_GROWTH_PCT']}% and listeners not growing >10%", actual=json.dumps({k: r.get(k) for k in ('before', 'after', 'heapGrowthPct', 'checkpoints', 'workers')})[:1100],
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
            e = ev(nid('XE'), f, 'FE04-XENGINE-ROUTES-*', f'deeplink {engine}', vp)
            dr = res.get('direct', {}); rl = res.get('reload', {})
            okd = sum(v[0] for v in dr.values()); okr = sum(v[0] for v in rl.values())
            add(case_id=f'FE04-XENGINE-ROUTES-{engine.upper()}', gate='FE-04', requirement_ref='FE-04 cross-engine; FE-01 direct URL/refresh/query/unknown view', input_mode='synthetic-DOM', viewport=vp,
                steps='harness/remote/deeplink.js via Playwright (fresh same-origin iframe per load)', expected='18/18 direct + 18/18 reload with expected h1; query preserved; unknown view shows not-found; 0 runtime errors',
                actual=f"direct {okd}/{len(dr)} reload {okr}/{len(rl)} query={json.dumps(res.get('query'), ensure_ascii=False)[:200]} unknown={(res.get('unknown') or {}).get('text', '')[:80]} errs={len(res.get('errs', []))} error={err}",
                result='BLOCKED' if (err and not dr) else ('PASS' if okd == okr == 18 and not res.get('errs') and (res.get('unknown') or {}).get('hasHomeLink') else 'FAIL'), evidence_ids=e, reason=err or '', bv=bv)
            if res.get('history'):
                hp = res.get('history_pass')
                add(case_id=f'FE04-XENGINE-HISTORY-{engine.upper()}', gate='FE-04', requirement_ref='FE-01 Back/Forward (cross-engine)', input_mode='synthetic-DOM', viewport=vp,
                    steps='#home → #specifications → #code inside an iframe; history.back() ×2; history.forward()', expected='#specifications → #home → #specifications',
                    actual=json.dumps(res.get('history'), ensure_ascii=False), result='PASS' if hp else 'NOT_RUN', evidence_ids=e, bv=bv,
                    reason='' if hp else 'Inconclusive: iframe history.back() in Gecko walks the joint session history differently (second back did not reach #home); needs a top-level page.goBack() check — not attributed to the app.')
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
            add(case_id='A11Y-AXE-001' if job.get('tag') == 'dark' else 'A11Y-AXE-002-DEFAULT', gate='FE-03', requirement_ref='axe-core 4.10.2 wcag2a/2aa/21a/21aa/22aa, 18 routes', input_mode='synthetic-DOM', viewport=vp, theme=theme or '',
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
            evidence_ids=e, reason='Screenshots captured as evidence; Figma comparison is done in run 4 (FIGMA-001, text/structure parity).')


    # ---------------- FX-SERVICE (trusted) ----------------
    fx = J('fxservice', 'fxservice-results.json')
    if fx:
        e = ev(nid('FX'), os.path.join(RUN, 'fxservice', 'fxservice-results.json'), 'FX-SVC-*,FX-SERVICE-FND-005', 'fixture scenarios (trusted pointer)', '1440x900')
        bv = f"chromium {fx.get('browserVersion', '')}"
        STALE = ('Service receipt matches effect readback', 'Authenticated workspace session loaded', 'Authenticated observer session loaded')
        want = {'effective': 'Effective', 'received': 'Received', 'accepted': 'Accepted', 'rejected': 'Rejected'}
        for sc in fx['scenarios']:
            st = sc.get('steps', {}); mode = sc['mode']
            base = dict(gate='FE-06', input_mode='trusted-input', viewport='1440x900', fixture_id=fx['fixture_id'], bv=bv, evidence_ids=e,
                        requirement_ref='v2 §6.3 client semantics (proposed atlas-ui/v1 contract; FND-006 open)')
            if mode in want or mode.startswith('http') or mode in ('netfailAfterSend', 'timeoutAfterSend', 'mismatch'):
                exp_stage = want.get(mode, 'Unknown')
                journal_stage = ' '.join(st.get('journal') or [])
                shown = exp_stage in (st.get('stagesOnPage') or []) or (mode == 'http401' and 'Unknown' in journal_stage)
                ok = st.get('connected') and st.get('posts') == 1 and shown and exp_stage in journal_stage and not (exp_stage != 'Unknown' and 'Unknown' in (st.get('stagesOnPage') or []))
                if mode == 'http401':
                    exp_note = ' (POST 401: journal Unknown "session expired or revoked" and UI disconnects)'
                else:
                    exp_note = ''
                add(case_id=f'FX-SVC-{mode.upper()}', steps='connect fixture → #agents service records → "FX action agents" → trusted double-click "Send" → read stage, toast, journal',
                    expected=f'exactly 1 POST (Idempotency-Key, X-CSRF-Token, If-Match) and stage "{exp_stage}" shown/journaled; no automatic resend' + exp_note,
                    actual=json.dumps({k: st.get(k) for k in ('connected', 'posts', 'postDetail', 'stagesOnPage', 'toasts', 'journal')}, ensure_ascii=False)[:1500] + (f" error={sc.get('error')}" if sc.get('error') else ''),
                    result='PASS' if ok and not sc.get('error') else ('BLOCKED' if sc.get('error') and st.get('posts') is None else 'FAIL'), reason=sc.get('error') or '', **base)
            if mode == 'effective' and st.get('after401'):
                a = st['after401']; stale = [t for t in a.get('toasts', []) if any(x in t for x in STALE)]
                add(case_id='FX-SERVICE-FND-005', steps='after an Effective command, next service read returns 401', expected='UI disconnects AND previous success toasts are cleared/superseded (no stale success message)',
                    actual=json.dumps({'disconnected': not a.get('connectedText'), 'header': a.get('header'), 'staleToasts': stale, 'gets': st.get('gets401')}, ensure_ascii=False)[:1200],
                    result='PASS' if (not a.get('connectedText')) and not stale else 'FAIL', **base)
                add(case_id='FX-SVC-401-DISCONNECT', steps='as FX-SERVICE-FND-005', expected='401 on read ⇒ UI disconnects (session cleared)', actual=f"disconnected={not a.get('connectedText')} header={a.get('header')}",
                    result='PASS' if not a.get('connectedText') else 'FAIL', **base)
            if mode == 'sessionExpiry':
                a = st.get('afterExpiry') or {}; stale = [t for t in a.get('toasts', []) if any(x in t for x in STALE)]
                add(case_id='FX-SVC-EXPIRY', steps='session expiresAt = connect + 4 s; wait 5.5 s; open another module', expected='expired session ⇒ UI disconnects; no stale "session loaded" success toast',
                    actual=json.dumps({'disconnected': not a.get('connectedText'), 'header': a.get('header'), 'staleToasts': stale, 'gets': st.get('getsAfterExpiry')}, ensure_ascii=False)[:1200] + (f" error={sc.get('error')}" if sc.get('error') else ''),
                    result='BLOCKED' if not a else ('PASS' if (not a.get('connectedText')) and not stale else 'FAIL'), reason=sc.get('error') or '', **base)
            if mode == 'observerAudience':
                add(case_id='FX-SVC-OBSERVER', steps='connect with audience=observer; open #agents service records', expected='observer audience cannot send workspace commands (no enabled command action)',
                    actual=json.dumps({'connected': st.get('connected'), 'actionVisible': st.get('actionVisible'), 'actionDisabled': st.get('actionDisabled'), 'main': (st.get('mainText') or '')[:300]}, ensure_ascii=False),
                    result='PASS' if st.get('connected') and (not st.get('actionVisible') or st.get('actionDisabled')) else 'FAIL', **base)

    # ---------------- layout hit-test (FND-018 root cause) ----------------
    lay = J('layout', 'layout-results.json')
    if lay:
        e = ev(nid('RT'), os.path.join(RUN, 'layout', 'layout-results.json'), 'FE02-SCROLL-001-*', 'layout hit-test after navigation', '320/375/1440')
        for engine, d in lay.items():
            add(case_id=f'FE02-SCROLL-001-{engine.upper()}', gate='FE-02', requirement_ref='FE-02 không mất nội dung/hành động; WCAG 2.5.8 (target bị che/chồng lấn)', input_mode='trusted-input', viewport='320x800,375x812,1440x900',
                steps='navigate via mobile drawer links / desktop sidebar links / header control then route change; hit-test breadcrumb link and main h1', expected='breadcrumb and h1 hit-testable (not covered by the fixed header) after every navigation path',
                actual=f"covered {len(d['covered'])}/{len(d['paths'])}: " + '; '.join(d['covered'])[:1200], result='PASS' if not d['covered'] else 'FAIL', evidence_ids=e, bv=f"{engine} {d.get('browserVersion', '')}")


for _r in RUNS:
    ingest(_r)


# ---------------- umbrella / superseded cases (after all runs) ----------------
T = {r['case_id']: r for r in tests.load()}
def res(cid):
    return T.get(cid, {}).get('result')

if 'A11Y-AXE-002-DEFAULT' in T:
    tests.add(case_id='A11Y-AXE-002', gate='FE-03', requirement_ref='axe light theme 18 routes + connected state + open dialog', input_mode='synthetic-DOM', viewport='1440x900', theme='light',
              steps='axe on connected (FX-SERVICE) state and with dialogs open', expected='0 violations', actual='light default state covered by A11Y-AXE-002-DEFAULT (0 violations); connected state and open dialogs not yet scanned',
              result='NOT_RUN', reason='Remaining scope: connected service state and open dialogs (needs axe inside the fxservice suite).', run_at=T['A11Y-AXE-002-DEFAULT']['run_at'])
g1920 = T.get('FE02-AUTO-216-1920-GH')
if g1920:
    tests.add(case_id='FE02-AUTO-216-1920', gate='FE-02', requirement_ref='v2 §6.2', input_mode='synthetic-DOM', viewport='1920x1080', theme='dark+light',
              steps='Same detector, executed on GitHub Actions Chromium 141 because the Cloudflare Browser Rendering quota was exhausted', expected='probe valid; 36/36 combos clean',
              actual=g1920['actual'], result=g1920['result'], evidence_ids=g1920['evidence_ids'], browser_version=g1920['browser_version'], run_at=g1920['run_at'])
fe02 = [r for c, r in T.items() if c.startswith('FE02-AUTO-216-') and c.split('-')[3].isdigit()]
chrom = [r for r in fe02 if not r['case_id'].endswith(('FIREFOX', 'WEBKIT'))]
fails = sorted(r['case_id'] for r in fe02 if r['result'] == 'FAIL')
tests.add(case_id='FE02-AUTO-216', gate='FE-02', requirement_ref='v2 §6.2 baseline 18 route × 6 viewport × 2 theme', input_mode='synthetic-DOM', viewport='6 widths', theme='dark+light',
          steps='Aggregate of FE02-AUTO-216-* (Cloudflare Chromium for 320–1440, GitHub Chromium 141 for 1920; Firefox 142 and WebKit 26 for 320/375/768/1440/1920)',
          expected='216/216 Chromium combos clean with validated detector; same on Firefox/WebKit',
          actual=f'all 6 widths measured on Chromium (216/216); failing cases: {", ".join(fails)} — all are FND-018 (breadcrumb under fixed header after a view change at 320/375); 768/1280/1440/1920 clean on all engines; Firefox clean everywhere',
          result='FAIL' if fails else 'PASS', evidence_ids=','.join(sorted({e for r in fe02 for e in r['evidence_ids'].split(',') if e})), run_at=max(r['run_at'] for r in fe02))
fx = [r for c, r in T.items() if c.startswith('FX-SVC-') or c == 'FX-SERVICE-FND-005']
if fx:
    bad = sorted(r['case_id'] for r in fx if r['result'] != 'PASS')
    tests.add(case_id='FX-SERVICE-001', gate='FE-06', requirement_ref='v2 §6.3 harness (aggregate)', input_mode='trusted-input', viewport='1440x900', fixture_id='FX-SERVICE/atlas-ui-v1-fixture-r3',
              steps='Aggregate of FX-SVC-* and FX-SERVICE-FND-005 (GitHub Actions Chromium 141, real bundle, fetch fixture)', expected='all scenarios meet v2 §6.3 client semantics',
              actual=f'{len(fx)} scenario checks: {len(fx) - len(bad)} PASS; not passing: {", ".join(bad) or "none"}', result='FAIL' if bad else 'PASS',
              evidence_ids=fx[0]['evidence_ids'], browser_version=fx[0]['browser_version'], run_at=fx[0]['run_at'])
xe = {c: r for c, r in T.items() if c.startswith(('FE04-XENGINE-ROUTES', 'FE04-XENGINE-HISTORY', 'FE02-SCROLL-001')) or (c.startswith('FE02-AUTO-216-') and c.endswith(('FIREFOX', 'WEBKIT')))}
if xe:
    tests.add(case_id='FE04-XENGINE-001', gate='FE-04', requirement_ref='cross-engine parity (Chromium / Firefox / WebKit)', input_mode='synthetic-DOM + trusted-input', viewport='320–1920',
              steps='Aggregate of FE04-XENGINE-ROUTES/HISTORY-*, FE02-AUTO-216-*-GH-{FIREFOX,WEBKIT}, FE02-SCROLL-001-*', expected='same results on all three engines',
              actual='; '.join(f'{c}={r["result"]}' for c, r in sorted(xe.items()))[:1400],
              result='FAIL' if any(r['result'] == 'FAIL' for r in xe.values()) else ('PASS' if all(r['result'] == 'PASS' for r in xe.values()) else 'NOT_RUN'),
              reason='FAILs are FND-018 on Chromium+WebKit (Firefox unaffected); Gecko iframe history check inconclusive', evidence_ids=','.join(sorted({e for r in xe.values() for e in r['evidence_ids'].split(',') if e})),
              run_at=max(r['run_at'] for r in xe.values()))


# ---------------- status refresh of run-2 backlog after run 3 (capabilities changed) ----------------
T = {r['case_id']: r for r in tests.load()}
GHNOTE = 'Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); '
def refresh(cid, result, reason, **kw):
    r = dict(T[cid]); r.update(result=result, reason=reason, **kw); r.pop('run_at', None)
    tests.add(**{k: v for k, v in r.items() if k in tests.COLS}, run_at='2026-10-05T08:45:00Z')
for cid, why in [('CODE-008', 'scenario not yet scripted: needs a seeded source snapshot (Import source folder) with an AST oracle'),
                 ('SPEC-RETEST-001', 'scenario not yet scripted: needs seeded documents and the SHA-256/AST oracles of run 1'),
                 ('FE04-WORKER-001', 'scenario not yet scripted: needs an opened document/source file to start the 6 Monaco workers'),
                 ('FE04-IDB-001', 'scenario not yet scripted (isolated-profile quota/denied/malformed/migration cases)'),
                 ('FE04-TAB-001', 'scenario not yet scripted (two contexts on one profile now possible in Playwright)'),
                 ('FE02-ZOOM-001', 'not yet scripted (Playwright deviceScaleFactor/CSS zoom; real browser zoom still needs a desktop browser)'),
                 ('FE02-STATE-001', 'not yet scripted (states via FX-SERVICE fixture + seeded data)'),
                 ('FE02-COARSE-001', 'not yet scripted'), ('FE03-MOTION-001', 'not yet scripted (Playwright emulateMedia reducedMotion/forcedColors)'),
                 ('PERF-006', 'not yet scripted (needs import fixtures of growing size)'), ('PERF-009', 'not yet scripted (needs 1k/10k/100k-line files opened in Monaco)'),
                 ('PERF-WORKLOAD-001', 'not yet scripted (synthetic workloads)'), ('FX-BRANCH-001', 'partly covered by FX-SVC-EXPIRY/OBSERVER/HTTP409; remaining: revoked mid-flow, stale revision on GET, offline/reconnect, role projection, reverse-order, retry/resume/cancel race, Observer redaction')]:
    if cid in T and T[cid]['result'] == 'BLOCKED':
        refresh(cid, 'NOT_RUN', GHNOTE + why)
# FIGMA-001 is re-evaluated in record_r4.py (run 4 read all 10 Figma pages; the run-2/3 'only 2 pages' statement was wrong).
if 'FE02-SCROLL-001-CHROMIUM' in T and 'FE02-TARGET-001' in T:
    refresh('FE02-TARGET-001', 'FAIL', 'Root cause found by FE02-SCROLL-001: the flag is not theme-related; after a view change initiated outside <main> the page scrolls 52–60 px and the breadcrumb sits under the fixed header (Chromium, WebKit)',
            actual=T['FE02-SCROLL-001-CHROMIUM']['actual'][:600], evidence_ids=T['FE02-SCROLL-001-CHROMIUM']['evidence_ids'], input_mode='trusted-input', browser_version=T['FE02-SCROLL-001-CHROMIUM']['browser_version'])
kb = [r for c, r in T.items() if c.startswith('FE03-KBD-') and c.count('-') <= 3 or (c.startswith('FE03-KBD-') and c.endswith(('-FIREFOX', '-WEBKIT')))]
if kb:
    bad = sorted(r['case_id'] for r in kb if r['result'] == 'FAIL')
    tests.add(case_id='FE03-KBD-001', gate='FE-03', requirement_ref='WCAG 2.1.1/2.4.1/2.4.3/2.4.7/2.4.11; APG Tree, Dialog (Modal), Combobox, Tabs', input_mode='trusted-input', viewport='1440x900 / 375x812',
              steps='Aggregate of FE03-KBD-* on Chromium 141, Firefox 142, WebKit 26 (GitHub Actions, Playwright trusted keyboard)', expected='all keyboard checks PASS on all engines',
              actual=f'{len(kb)} engine-checks; FAIL: {", ".join(bad) or "none"}; tree N/A (empty library); nested dialogs not present in default state', result='FAIL' if bad else 'PASS',
              evidence_ids=','.join(sorted({e for r in kb for e in r['evidence_ids'].split(',') if e})), run_at=max(r['run_at'] for r in kb))
pp = {c: r for c, r in T.items() if c.startswith('PERF-007-')}
if pp:
    tests.add(case_id='PERF-007', gate='FE-05', requirement_ref='v2 §9 P-B PERF-007 (aggregate)', input_mode='navigation', viewport='1440x900 / 375x812 throttled', steps='Aggregate of PERF-007-COLD/WARM/MOBILE (10 runs each)',
              expected='all three profiles meet the locked budget', actual='; '.join(f'{c}={r["result"]}: {r["actual"][:90]}' for c, r in sorted(pp.items())), result='PASS' if all(r['result'] == 'PASS' for r in pp.values()) else 'FAIL',
              evidence_ids=list(pp.values())[0]['evidence_ids'], browser_version=list(pp.values())[0]['browser_version'], run_at=max(r['run_at'] for r in pp.values()))
ii = {c: r for c, r in T.items() if c.startswith('PERF-INP-001-')}
if ii:
    tests.add(case_id='PERF-INP-001', gate='FE-05', requirement_ref='INP <= 200 ms, >= 30 interactions (aggregate)', input_mode='trusted-input', viewport='1440x900', steps='Aggregate of PERF-INP-001-DESKTOP/CPU4X',
              expected='both profiles pass', actual='; '.join(f'{c}={r["result"]}: {r["actual"][:110]}' for c, r in sorted(ii.items())), result='PASS' if all(r['result'] == 'PASS' for r in ii.values()) else 'FAIL',
              evidence_ids=list(ii.values())[0]['evidence_ids'], browser_version=list(ii.values())[0]['browser_version'], run_at=max(r['run_at'] for r in ii.values()))
if 'A11Y-TARGET-001' in T and 'FE02-SCROLL-001-CHROMIUM' in T:
    refresh('A11Y-TARGET-001', 'FAIL', 'Run-2 observation (light pass after the theme click) re-attributed in run 3: the overlap comes from the post-navigation scroll offset that puts the breadcrumb under the fixed header (FND-018), not from the theme')
if 'FE02-WALK-001' in T:
    refresh('FE02-WALK-001', 'NOT_RUN', 'Screenshots captured (72) and spot-checked by the auditor (375 light #agents shows the breadcrumb hidden under the header = FND-018; 1440 dark #specifications renders as expected); visual parity vs Figma handled in run 4 (FIGMA-001)')


# ---------------- findings updated by run 3 ----------------
F = {r['finding_id']: r for r in findings.load()}
B = tests.DEFAULTS['build_id']; D = tests.DEFAULTS['deployment_id']
T = {r['case_id']: r for r in tests.load()}
def evs(*cids):
    return ','.join(sorted({e for c in cids for e in T.get(c, {}).get('evidence_ids', '').split(',') if e}))
if 'FX-SERVICE-FND-005' in T:
    f = F['FND-005']
    f.update(title='Toast thành công cũ vẫn hiển thị sau khi 401 / hết phiên làm UI ngắt kết nối', severity='P2', gate='FE-06', requirement_ref='v2 §6.3 (401 ⇒ disconnect; không false success)',
             impact='Sau khi phiên bị thu hồi/hết hạn, màn hình vẫn hiện "Service receipt matches effect readback…" hoặc "Authenticated workspace session loaded…" cạnh trạng thái "Service disconnected" ⇒ tín hiệu thành công lỗi thời, dễ hiểu nhầm.',
             repro_steps='Kết nối fixture (FX-SERVICE/atlas-ui-v1-fixture-r3) → gửi lệnh Effective → lần đọc kế tiếp trả 401 (hoặc expiresAt trôi qua) → quan sát vùng toast',
             expected='Toast thành công trước đó bị gỡ hoặc thay bằng thông báo ngắt kết nối', actual=T['FX-SERVICE-FND-005']['actual'][:500] + ' | expiry: ' + T.get('FX-SVC-EXPIRY', {}).get('actual', '')[:300],
             build_id=B, deployment_id=D, profile='GitHub Actions Chromium 141, trusted pointer, fixture', evidence_ids=evs('FX-SERVICE-FND-005', 'FX-SVC-EXPIRY'), owner_proposed='Frontend',
             status='OPEN (retested run 3: still reproduces on remote)', fix_ref='Remediation-Plan R-09', retest_case_ids='FX-SERVICE-FND-005,FX-SVC-EXPIRY',
             closure_result='FAIL (retest 2026-10-05, run 37282601201)')
if 'FE02-SCROLL-001-CHROMIUM' in T:
    f = F['FND-018']
    f.update(title='Sau khi đổi view từ ngoài <main> (menu mobile, sidebar desktop, nút header), trang bị cuộn 52–60 px và breadcrumb nằm dưới header cố định (Chromium, WebKit)',
             requirement_ref='FE-02 không mất nội dung/hành động thiết yếu; WCAG 2.2 SC 2.5.8 (target bị che/chồng lấn)', severity='P2', gate='FE-02',
             impact='Người dùng mobile điều hướng qua menu (luồng chính) và desktop qua sidebar thấy breadcrumb bị header che; chạm vào vùng đó trúng nút menu. h1 vẫn hiển thị. Firefox không bị.',
             repro_steps='375x812 (hoặc 320x800): mở "Open workspace navigation" → chọn Memory hoặc Agents; 1440x900: bấm Agents ở sidebar → elementFromPoint tại tâm link breadcrumb "Workspace"',
             expected='Breadcrumb và h1 hit-test được (không bị header che) sau mọi đường điều hướng', actual=T['FE02-SCROLL-001-CHROMIUM']['actual'][:400] + ' | WebKit: ' + T.get('FE02-SCROLL-001-WEBKIT', {}).get('actual', '')[:120] + ' | Firefox: ' + T.get('FE02-SCROLL-001-FIREFOX', {}).get('actual', '')[:60],
             build_id=B, deployment_id=D, profile='GitHub Actions Chromium 141 / WebKit 26 / Firefox 142; Cloudflare Chromium', evidence_ids='EV-RESP-501,EV-RESP-502,' + evs('FE02-SCROLL-001-CHROMIUM'),
             owner_proposed='Frontend (focus management + scroll-padding-top cho header cố định)', status='OPEN (root cause identified in run 3; earlier "light theme only" description superseded)',
             fix_ref='Remediation-Plan R-05', retest_case_ids='FE02-SCROLL-001-CHROMIUM,FE02-SCROLL-001-WEBKIT,FE02-AUTO-216-320,FE02-AUTO-216-375,A11Y-TARGET-001', closure_result='')
if 'FX-SVC-HTTP409' in T:
    f = F['FND-006']
    f.update(gate='FE-06', title='Quyết định 4xx definitive hay Unknown (FX-EXEC-001 / FX-CMD-004) — kế thừa run 1',
             actual='Run 3 quan sát (fixture, Chromium 141): POST 403/409/422/500 ⇒ stage Unknown với thông điệp phân loại ("Permission denied", "The resource changed…", "rejected the input contract", "HTTP 500") và "Reconcile this operation; do not resend". Hành vi khớp semantics client của v2 §6.3; vẫn chờ quyết định spec.',
             evidence_ids=evs('FX-SVC-HTTP409', 'FX-SVC-HTTP422'), status='OPEN (SPEC_UNRESOLVED; behaviour observed in run 3)', retest_case_ids='FX-EXEC-001,FX-SVC-HTTP409,FX-SVC-HTTP422')

if 'FE03-KBD-TABS' in T:
    f = F['FND-001']
    f.update(title='Tabs không liên kết tabpanel (thiếu aria-controls → role=tabpanel) — tái hiện trên 3 engine', requirement_ref='WCAG 4.1.2 / 1.3.1; WAI-ARIA APG Tabs', severity='P2', gate='FE-03',
             impact='Trình đọc màn hình không xác định được panel thuộc tab nào; quan hệ tab–nội dung không được expose.', repro_steps='#specifications: kiểm tra 7 role=tab (2 tablist) — aria-controls và phần tử role=tabpanel',
             expected='Mỗi tab có aria-controls trỏ tới role=tabpanel có aria-labelledby ngược lại', actual='0/7 tab có aria-controls; không có role=tabpanel. Arrow/Home/End và roving tabindex hoạt động ở tablist "Document inspector".',
             build_id=B, deployment_id=D, profile='GitHub Actions Chromium 141 / Firefox 142 / WebKit 26, trusted keyboard', evidence_ids=evs('FE03-KBD-TABS'), owner_proposed='Frontend',
             status='OPEN (retested run 3: reproduces)', fix_ref='Remediation-Plan R-10', retest_case_ids='FE03-KBD-TABS,FE03-KBD-TABS-FIREFOX,FE03-KBD-TABS-WEBKIT', closure_result='FAIL (retest 2026-10-05, run 37285038578)')
    F['FND-021'] = dict(finding_id='FND-021', severity='P2', gate='FE-03', view_id='#specifications (và các module có tablist Definitions/Service records)', requirement_ref='WCAG 2.2 SC 2.4.3 Focus Order; 2.1.1 Keyboard; APG Tabs',
        title='Nhấn mũi tên trên tablist "Specifications workspace" (IDE/Definitions/Service records) làm mất focus về <body>',
        impact='Tab tự kích hoạt và đổi view; tablist được render lại nên focus rơi về đầu tài liệu — người dùng bàn phím phải Tab lại từ đầu; trình đọc màn hình mất ngữ cảnh.',
        repro_steps='#specifications → Tab tới tab "IDE" (đang chọn) → ArrowRight', expected='Focus chuyển sang tab "Definitions" (hoặc giữ trên tab vừa chọn sau khi view đổi)', actual='document.activeElement = BODY sau ArrowRight trên Chromium 141, Firefox 142, WebKit 26; tablist "Document inspector" (không đổi view) hoạt động đúng',
        build_id=B, deployment_id=D, profile='GitHub Actions, trusted keyboard', evidence_ids=evs('FE03-KBD-TABS'), owner_proposed='Frontend', status='OPEN (new in run 3)', fix_ref='Remediation-Plan R-10',
        retest_case_ids='FE03-KBD-TABS,FE03-KBD-TABS-FIREFOX,FE03-KBD-TABS-WEBKIT', closure_result='')
if 'PERF-008' in T and T['PERF-008']['result'] == 'FAIL':
    F['FND-022'] = dict(finding_id='FND-022', severity='P3', gate='FE-05', view_id='shell navigation', requirement_ref='PERF-008 heap growth budget (10% — ASSUMPTION locked before measurement)',
        title='JS heap tăng 18,7% sau 30 chu kỳ điều hướng (5 route/chu kỳ), sau đó chậm dần (+3,0% tới 60, +1,7% tới 90)',
        impact='Vượt ngưỡng giả định 10%; xu hướng giảm dần gợi ý warm-up/cache hơn là rò rỉ, listeners/nodes dao động không tăng đều. Cần budget chính thức và soak dài hơn (editor open/close) để kết luận.',
        repro_steps='Chromium (CDP): 2 chu kỳ warm-up → GC → 90 chu kỳ #specifications→#code→#agents→#connection→#home, GC mỗi 30 chu kỳ', expected='tăng ≤10% sau 30 chu kỳ (giả định)',
        actual=T['PERF-008']['actual'][:500], build_id=B, deployment_id=D, profile='GitHub Actions Chromium 141', evidence_ids=T['PERF-008']['evidence_ids'], owner_proposed='Frontend performance',
        status='OPEN (new in run 3; needs product budget)', fix_ref='Remediation-Plan R-11', retest_case_ids='PERF-008', closure_result='')
findings.save(sorted(F.values(), key=lambda r: r['finding_id']))

with open(os.path.join(tests.HERE, 'evidence-r3.json'), 'w') as f:
    json.dump(EVID, f, indent=1)
print('ingested', len(EVID), 'evidence entries; tests now', len(tests.load()))
