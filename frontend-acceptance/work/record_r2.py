"""Populate tests.json / findings.json for run 2 (2026-10-05) from the raw results in ../runs/.
Deterministic and re-runnable. Expected values were fixed in the harness scripts before execution."""
import json, os
import tests, findings

for p in (tests.PATH, findings.PATH):
    if os.path.exists(p):
        os.remove(p)

RUNS = os.path.join(os.path.dirname(tests.HERE), 'evidence', 'runs')
R = lambda *p: json.load(open(os.path.join(RUNS, *p)))
ROUTES = ['home', 'specifications', 'code', 'agents', 'resources', 'memory', 'workflow', 'execution', 'governance', 'gateway',
          'collaboration', 'configuration', 'identity', 'tenancy', 'saas', 'desktop', 'observer', 'connection']
QUOTA = ('BLOCKED_CLOUDFLARE_BROWSER_QUOTA: Cloudflare Browser Rendering (the only remote browser available to this run) returned '
         '"2001 Rate limit exceeded" from 2026-10-05T07:27Z onwards (Workers Free plan: 10 browser-minutes/day, resets next UTC day); '
         'no other path reaches workers.dev from the sandbox (proxy 403) and GitHub Actions is unavailable (Claude GitHub App not installed on the repo).')
NO_TRUSTED = ('BLOCKED_NO_TRUSTED_INPUT: Browser Rendering REST exposes no input API; only synthetic DOM events are possible, which cannot PASS '
              'focus/keyboard/IME/Monaco cases (v2 invariant 19). Built-in Browser pane is not available in this cloud session.')
NO_INPUT = lambda f: f'BLOCKED_INPUT_MISSING: {f} not provided in this session (only the master prompt was uploaded; no handover zip).'
T0 = '2026-10-05T07:0'

# ---------------- CF preflight ----------------
rv = R('R2-001-phase0', 'release-verify-browser.json')['runs']
tests.add(case_id='CF-PRE-001', gate='FE-01', requirement_ref='v2 §6.1 root 200/MIME', input_mode='http-in-browser',
          viewport='1440x900', steps='GET / from page context (fetch, cache:no-store)', expected='200 + Content-Type text/html',
          actual='200 text/html; cache-control public, max-age=0, must-revalidate; zstd', result='PASS', evidence_ids='EV-CF-501', run_at='2026-10-05T07:01:48Z')
tests.add(case_id='CF-PRE-002', gate='FE-01', requirement_ref='v2 §4.1 step 2 / §6.1', input_mode='http-in-browser', viewport='1280x800',
          steps='Fetch /release-manifest.json; for each of its payloads fetch bytes (no-store) and compute SHA-256 with crypto.subtle; compare with manifest sha256 + sizeBytes',
          expected='120 payloads, all HTTP 200, SHA-256 and size equal to manifest',
          actual='count=120 ok=120 mismatches=0 size_mismatches=0 total=19,291,874 B; manifest bytes sha256 0bf5b0288ac6ca988130961b8da55d18637a07dbf9a3d09ca97d5e1e4c09edd3',
          result='PASS', evidence_ids='EV-CF-501,EV-CF-502', run_at='2026-10-05T07:04:33Z')
tests.add(case_id='CF-PRE-003', gate='FE-01', requirement_ref='v2 §6.1 MIME theo đuôi', input_mode='http-in-browser', viewport='1280x800',
          steps='Group Content-Type of the 120 payload responses by extension', expected='js→javascript, css→text/css, ttf→font/ttf, woff2→font/woff2, txt→text/plain, html→text/html',
          actual='js: application/javascript ×110 (incl. 6 *.worker-*.js); css: text/css ×4; ttf: font/ttf ×2; woff2: font/woff2 ×1; txt: text/plain ×2; html: text/html ×1',
          result='PASS', evidence_ids='EV-CF-501', run_at='2026-10-05T07:04:33Z')
tests.add(case_id='CF-PRE-004', gate='FE-01', requirement_ref='v2 §6.1 asset không tồn tại', input_mode='http-in-browser', viewport='1440x900',
          steps='GET /assets/__atlas_probe_missing__.js and .css', expected='404, body is not the HTML shell',
          actual='js 404 0 B; css 404 0 B; no shell (assets not_found_handling=none)', result='PASS', evidence_ids='EV-CF-501', run_at='2026-10-05T07:01:48Z')
tests.add(case_id='CF-PRE-005', gate='FE-04', requirement_ref='v2 §6.1 headers; FE-04 "6 worker (… MIME, CSP)"', input_mode='http-in-browser', viewport='1440x900',
          steps='Read response headers of GET / (document) and a hashed asset', expected='CSP, X-Content-Type-Options: nosniff, Referrer-Policy, frame protection (XFO or CSP frame-ancestors), Permissions-Policy, HSTS, COOP present',
          actual='none present; document headers = alt-svc, cache-control, cf-cache-status, cf-ray, content-encoding, content-type, date, nel, report-to, server', result='FAIL',
          evidence_ids='EV-CF-501', reason='Retest of FND-002: still reproduces on the same deployment', run_at='2026-10-05T07:01:48Z')
tests.add(case_id='CF-PRE-006', gate='FE-05', requirement_ref='v2 §6.1 cache-control', input_mode='http-in-browser', viewport='1280x800',
          steps='Read Cache-Control of the 110 fingerprinted /assets/*-<hash>.* responses and of index.html',
          expected='fingerprinted assets: max-age>=31536000 + immutable; index.html revalidated',
          actual='all 120 payloads incl. fingerprinted assets: "public, max-age=0, must-revalidate" (Workers static-assets default) + weak ETag on 119; index.html revalidated (OK)',
          result='FAIL', evidence_ids='EV-CF-501,EV-STD-501', reason='Retest of FND-003: still reproduces', run_at='2026-10-05T07:04:33Z')
tests.add(case_id='CF-PRE-007', gate='FE-01', requirement_ref='v2 §6.1 deep link (path-style)', input_mode='http-in-browser', viewport='1440x900',
          steps='GET /home, /connection, /__atlas_probe_missing__', expected='N/A for hash router; recorded only', actual='404 0 B for all three; index.html 200',
          result='NOT_APPLICABLE', evidence_ids='EV-CF-501,EV-RT-501', reason='Router is hash-based (bundle gt(): route = location.hash before "?"); assets not_found_handling=none; path-style URLs are outside the routing contract (v2 §4 table)',
          run_at='2026-10-05T07:01:48Z')

# ---------------- Routes ----------------
dl = R('R2-003-routes', 'deeplink-refresh-history.json')
direct = {**dl['batch1']['direct'], **dl['batch2']['direct']}
reload_ = {**dl['batch1']['reload'], **dl['batch2']['reload']}
okd = sum(v[0] for v in direct.values()); okr = sum(v[0] for v in reload_.values())
tests.add(case_id='CF-PRE-008', gate='FE-01', requirement_ref='v2 §6.1 deep link + refresh; FE-01 direct URL/refresh', input_mode='synthetic-DOM', viewport='1280x800',
          steps='For each of 18 module routes: fresh same-origin iframe at /#<route>; wait for main h1; location.reload(); wait again',
          expected='main h1 equals the h1 seen via in-app navigation (R2-002) both after direct load and after reload; nav aria-current = route',
          actual=f'direct {okd}/18, reload {okr}/18, aria-current matched 18/18, runtime errors 0', result='PASS' if okd == okr == 18 else 'FAIL', evidence_ids='EV-RT-502', run_at='2026-10-05T07:13:00Z')
h = dl['batch2']
tests.add(case_id='FE01-ROUTE-001', gate='FE-01', requirement_ref='FE-01 Back/Forward', input_mode='synthetic-DOM', viewport='1280x800',
          steps='#home → #specifications → #code; history.back() ×2; history.forward()', expected='#specifications/Specifications → #home/Build with a clear trail. → #specifications/Specifications',
          actual=json.dumps(h['history']), result='PASS' if h['history_pass'] else 'FAIL', evidence_ids='EV-RT-502', run_at='2026-10-05T07:13:00Z')
tests.add(case_id='FE01-ROUTE-002', gate='FE-01', requirement_ref='FE-01 query/hash; v2 §6.1 "#route?param= phải được reload-test"', input_mode='synthetic-DOM', viewport='1280x800',
          steps='Load /#agents?authority=definitions&atlasProbe=1, reload; load /#agents?authority=service', expected='route Agents, hash (incl. query) preserved after reload, authority param selects tab',
          actual=json.dumps(h['query']), result='PASS', evidence_ids='EV-RT-502', run_at='2026-10-05T07:13:00Z')
tests.add(case_id='FE01-ROUTE-003', gate='FE-01', requirement_ref='FE-01 hash đúng (unknown view recovery)', input_mode='synthetic-DOM', viewport='1280x800',
          steps='Load /#atlas-unknown-route', expected='explicit not-found state with a way back; no service fallback; no crash',
          actual=json.dumps(h['unknown']), result='PASS', evidence_ids='EV-RT-502', run_at='2026-10-05T07:13:00Z')
tests.add(case_id='FE01-ROUTE-004', gate='FE-03', requirement_ref='WCAG 2.4.3 focus order after view change', input_mode='synthetic-DOM', viewport='1280x800',
          steps='#home → set location.hash=#memory; read document.activeElement', expected='focus moves to main region or view heading (trusted keyboard confirmation required)',
          actual='activeElement = MAIN#main (programmatic) — observed only', result='NOT_RUN', evidence_ids='EV-RT-502', reason=NO_TRUSTED, run_at='2026-10-05T07:13:00Z')
disc = R('R2-002-discover', 'discover-1440x900-dark.json')
tests.add(case_id='FE01-TITLE-001', gate='FE-03', requirement_ref='WCAG 2.2 SC 2.4.2 Page Titled (Level A)', input_mode='synthetic-DOM', viewport='1440x900',
          steps='Navigate the 18 module routes; read document.title after each', expected='title describes the current view (differs per module)',
          actual='"Atlas · Workspace" on all 18 routes; bundle contains no document.title assignment', result='FAIL', evidence_ids='EV-RT-501,EV-RT-503', run_at='2026-10-05T07:06:00Z')
tests.add(case_id='FE01-RUNTIME-001', gate='FE-04', requirement_ref='v2 §2 không suppress console error', input_mode='synthetic-DOM', viewport='1440x900',
          steps='Capture window error / unhandledrejection / console.error while crawling 18 routes (and during all FE02 batches)', expected='0 runtime errors',
          actual='0 errors in discovery, deep-link and 5 FE02 viewport batches (≈200 route renders)', result='PASS', evidence_ids='EV-RT-501,EV-RT-502,EV-RESP-501,EV-RESP-502,EV-RESP-503,EV-RESP-504,EV-RESP-505', run_at='2026-10-05T07:26:00Z')

# ---------------- FE02 responsive ----------------
VPS = [('320x800', 'EV-RESP-501', 'vp320x800.json'), ('375x812', 'EV-RESP-502', 'vp375x812.json'), ('768x1024', 'EV-RESP-503', 'vp768x1024.json'),
       ('1280x800', 'EV-RESP-504', 'vp1280x800.json'), ('1440x900', 'EV-RESP-505', 'vp1440x900.json')]
total_dirty = 0
for vp, ev, fn in VPS:
    d = R('R2-004-fe02', fn)['out']
    rows = d.get('rows') or d.get('rows_reconstructed_from_summary')
    reflow = sum(1 for v in rows.values() if v[0] or v[1])
    unnamed = sum(1 for v in rows.values() if v[2])
    small = sum(1 for v in rows.values() if v[3])
    contrast = sum(1 for v in rows.values() if v[6])
    h1bad = sum(1 for v in rows.values() if v[4] != 1)
    dirty = sum(1 for v in rows.values() if v[0] or v[1] or v[2] or v[3] or v[6] or v[4] != 1)
    total_dirty += dirty
    tests.add(case_id=f'FE02-AUTO-216-{vp.split("x")[0]}', gate='FE-02', requirement_ref='v2 §6.2; WCAG 1.4.10, 2.5.8, 1.4.3, 4.1.2 (automated subset)', input_mode='synthetic-DOM',
              viewport=vp, theme='dark+light', steps='Probe validation in same-origin srcdoc iframe; then 18 routes × {dark, light} (theme via header button click), wait for h1 + DOM settle, run detector',
              expected='probe flags all 6 seeded defects; every route×theme: page overflowX=0, offscreen controls=0, unnamed controls=0, undersized targets without spacing=0, exactly one h1 in main, contrast failures=0',
              actual=f"probe valid={d['probe']['valid']}; combos=36 dirty={dirty} (reflow={reflow}, unnamed={unnamed}, small_target={small}, contrast={contrast}, h1≠1={h1bad}); samples={json.dumps(d['samples']['small'][:1]) if small else '[]'}",
              result='PASS' if dirty == 0 and d['probe']['valid'] else 'FAIL', evidence_ids=ev, run_at='2026-10-05T07:2' + {'320': '0', '375': '1', '768': '2', '1280': '5', '1440': '6'}[vp.split('x')[0]] + ':00Z')
tests.add(case_id='FE02-AUTO-216-1920', gate='FE-02', requirement_ref='v2 §6.2', input_mode='synthetic-DOM', viewport='1920x1080', theme='dark+light',
          steps='Same as other FE02-AUTO-216 viewports', expected='as FE02-AUTO-216-*', actual='not executed (request refused: 2001 Rate limit exceeded)', result='BLOCKED', reason=QUOTA, run_at='2026-10-05T07:27:30Z')
tests.add(case_id='FE02-AUTO-216', gate='FE-02', requirement_ref='v2 §6.2 baseline 18 route × 6 viewport × 2 theme', input_mode='synthetic-DOM', viewport='6 widths', theme='dark+light',
          steps='Aggregate of FE02-AUTO-216-{320,375,768,1280,1440,1920}', expected='216/216 combos clean with validated detector',
          actual=f'180/216 measured; {180 - total_dirty} clean; {total_dirty} flagged (320/375 light: breadcrumb "Workspace" 64×18 within 12 px of "Navigation" button); 36 not run (1920)',
          result='FAIL', evidence_ids=','.join(v[1] for v in VPS), reason='FAIL from measured combos; 1920 BLOCKED (quota)', run_at='2026-10-05T07:27:30Z')

tests.add(case_id='A11Y-TARGET-001', gate='FE-03', requirement_ref='WCAG 2.2 SC 2.5.8 Target Size (Minimum), AA', input_mode='synthetic-DOM', viewport='320x800,375x812', theme='light',
          steps='From FE02-AUTO-216-320/375 detector: undersized targets whose 24 px circle intersects another target', expected='0 undersized targets without spacing exception',
          actual='breadcrumb link "Workspace" 64x18 within 12 px of header button "Navigation" on all 18 routes in light theme (dark: 0); 768/1280/1440: 0',
          result='FAIL', evidence_ids='EV-RESP-501,EV-RESP-502', run_at='2026-10-05T07:21:00Z')

# ---------------- Blocked / not-run backlog (exact IDs) ----------------
def blocked(cid, gate, req, steps, expected, reason, result='BLOCKED', vp='', mode='n/a'):
    tests.add(case_id=cid, gate=gate, requirement_ref=req, input_mode=mode, viewport=vp, steps=steps, expected=expected, actual='not executed', result=result, reason=reason, run_at='2026-10-05T07:40:00Z')

blocked('A11Y-AXE-001', 'FE-03', 'WCAG 2.2 A/AA automated (axe-core 4.10.2) dark theme, 18 routes', 'Inject axe-core from cdnjs; run wcag2a/2aa/21aa/22aa tags per route', '0 violations (needs-review items triaged)', QUOTA, vp='1440x900', mode='synthetic-DOM')
blocked('A11Y-AXE-002', 'FE-03', 'axe light theme 18 routes + connected state + open dialog', 'as A11Y-AXE-001 in light theme, with FX-SERVICE connected and a dialog open', '0 violations', QUOTA, vp='1440x900', mode='synthetic-DOM')
blocked('FE03-KBD-001', 'FE-03', 'WCAG 2.1.1/2.4.3/2.4.7; APG Tree, Dialog (Modal), Combobox, Tabs', 'Trusted keyboard: skip link, shell nav, ⌘K search combobox, tree arrows, tabs arrows/Home/End, nested dialogs (only top Escape, inert background, focus return)', 'All operable by keyboard per APG', NO_TRUSTED, vp='1440x900', mode='trusted-input')
blocked('FE03-AT-001', 'FE-03', 'AT thật NVDA+Firefox/Chrome, VoiceOver+Safari', 'Manual script in Accessibility.md', 'Name/role/state/announcements correct', 'NOT_RUN_AT: no screen reader / real device available in this cloud session', result='NOT_RUN', mode='trusted-input')
blocked('FE03-MOTION-001', 'FE-03', 'prefers-reduced-motion, forced-colors, text-spacing (WCAG 1.4.12)', 'emulateMediaFeatures + text-spacing bookmarklet styles per route', 'no loss of content/function', QUOTA + ' Also no emulateMediaFeatures in REST API.', mode='synthetic-DOM')
blocked('FE02-ZOOM-001', 'FE-02', 'WCAG 1.4.4 / 1.4.10 at 200%/400% browser zoom', 'Real browser zoom (not CSS) on 18 routes', 'no loss of content/function', NO_TRUSTED, mode='trusted-input')
blocked('FE02-STATE-001', 'FE-02', 'state-sensitive layouts (dialog, error, empty, loading, populated, long/multiline labels)', 'Drive each state via FX-SERVICE + local data, run detector at 6 widths', 'no overflow/clipping', QUOTA, mode='synthetic-DOM')
blocked('FE02-COARSE-001', 'FE-02', 'coarse pointer / landscape / short viewport / breakpoint resize', 'hasTouch+isMobile, 812x375 landscape, 1280x500, resize across breakpoints', 'no loss of essential actions', QUOTA, mode='synthetic-DOM')
blocked('FE02-TARGET-001', 'FE-03', 'WCAG 2.5.8 root cause of FND-018 (light-only breadcrumb/Navigation spacing)', 'Measure rects of breadcrumb link and Navigation button in dark vs light at 320/375', 'spacing ≥ 24 px circle rule in both themes', QUOTA, vp='320x800', mode='synthetic-DOM')
blocked('FE02-WALK-001', 'FE-02', 'walkthrough desktop + mobile with screenshots', 'Screenshot every route after render at 375 and 1440 (dark/light)', 'visual parity with Figma frames', QUOTA)
blocked('FE04-WORKER-001', 'FE-04', '6 workers init→message→cancel→terminate, MIME, CSP', 'Open Code/Specifications editors, observe editor/json/css/html/ts/semantic workers', 'workers start, respond, terminate; served as JS; allowed by CSP', NO_TRUSTED + ' ' + QUOTA, mode='trusted-input')
blocked('FE04-IDB-001', 'FE-04', 'IndexedDB fresh/reload/quota/denied/malformed/migration', 'Isolated origin profile; seed malformed records; simulate quota', 'graceful recovery, no data loss', QUOTA)
blocked('FE04-TAB-001', 'FE-04', '2 tabs, dirty draft close (ide-state-dirty-tab), storage events, offline', 'Two contexts on same profile', 'conflict surfaced, no silent overwrite', 'BLOCKED: Browser Rendering REST is single-page per request (no shared profile across calls). ' + QUOTA)
blocked('FE04-XENGINE-001', 'FE-04', 'cross-engine Firefox + WebKit (+Chrome/Safari/Edge)', 'Run FE02/FE01 suites on Gecko and WebKit', 'parity', 'NOT_RUN: only Chromium available (Browser Rendering). Harness for Playwright firefox/webkit is ready in harness/ + .github/workflows but cannot be pushed (Claude GitHub App not installed).', result='NOT_RUN')
blocked('CODE-008', 'FE-04', 'Go to definition / Find references / F12 (trusted keys)', 'Import fixture source, place caret, press F12/Shift+F12', 'navigates to oracle locations', NO_TRUSTED, mode='trusted-input')
blocked('SPEC-RETEST-001', 'FE-04', 'Specifications persistence/race/2-tab (SPEC-*)', 'v2 §6.4', 'oracle SHA-256 equal', NO_TRUSTED + ' ' + QUOTA, mode='trusted-input')
blocked('DEF-RETEST-FND-004', 'FE-01', 'FND-004 retest: 3/49 definition types fail with default name containing "/"', 'For each Definition type in each module select, Create local definition with default name', 'all types create successfully', NO_INPUT('Atlas-Field-Dictionary.csv / work/schema_oracle.json') + ' ' + QUOTA)
blocked('FX-SERVICE-001', 'FE-06', 'v2 §6.3 harness: connect, sections, double activation, stages, 4xx/5xx/netfail/timeout/mismatch→Unknown, reconcile, 401/expiry disconnect', 'Same-origin /harness-blank + fetch wrapper + real bundle; Connection → https://fixture.atlas.test', 'per v2 §6.3 semantics', QUOTA, mode='synthetic-DOM')
blocked('FX-SERVICE-FND-005', 'FE-06', 'FND-005 retest: stale toast after 401 / session expiry', 'Connect fixture; force 401 on next GET; observe toast region', 'stale success toast removed or superseded', QUOTA, mode='synthetic-DOM')
blocked('FX-BRANCH-001', 'FE-06', 'expired/revoked mid-flow, stale revision 409, offline/reconnect, role projection, reverse-order, retry/resume/cancel race, Observer redaction', 'Extend FX-SERVICE scenarios per module', 'per v2 §9 P-B FE-06', QUOTA, mode='synthetic-DOM')
blocked('FX-EXEC-001', 'FE-06', 'Execution field-level parity + FND-006 4xx definitive decision', 'needs approved DTO', 'per DTO', 'SPEC_UNRESOLVED: atlas-ui/v1 DTO not approved (Connection page itself states "Service adapter contract is proposed")')
blocked('PERF-007', 'FE-05', 'FCP/LCP/CLS ≥10 cold + ≥10 warm; mobile profile CPU 4×, 1.6/0.75 Mbps, 150 ms RTT', 'Fresh sessions for cold; iframe reloads for warm; PerformanceObserver buffered', 'p75 LCP ≤ 2500 ms, CLS ≤ 0.1, FCP ≤ 1800 ms (web-vitals thresholds)', QUOTA + ' Throttling needs CDP (not exposed by REST).')
blocked('PERF-INP-001', 'FE-05', 'INP ≥30 interactions (route, tab, filter, tree expand, action ack)', 'trusted clicks/keys with Event Timing', 'p75 INP ≤ 200 ms', NO_TRUSTED + ' Event Timing ignores synthetic events.', mode='trusted-input')
blocked('PERF-006', 'FE-05', 'import cost vs library size', 'v2 §6.6', 'within locked budget', QUOTA)
blocked('PERF-008', 'FE-05', '30 open–close cycles editor/route (workers, listeners, heap)', 'v2 §6.6', 'no growth beyond budget', QUOTA + ' ' + NO_TRUSTED)
blocked('PERF-009', 'FE-05', 'typing/scroll 1k/10k/100k-line files', 'v2 §6.6', 'within budget', NO_TRUSTED)
blocked('PERF-WORKLOAD-001', 'FE-05', 'Code 10,000 files; Observation 10,000 rows; Execution 100 tasks + 10,000 logs; Graph 1,000 nodes', 'synthetic workload via app import + FX-SERVICE', 'within budget + cleanup', QUOTA)
blocked('FE01-210-001', 'FE-01', 'per canonical view_id parity (route/field/action/state/stress/dead control)', 'v2 §9 P-C', '210 rows with case evidence', NO_INPUT('Atlas-Screen-Inventory.csv, Atlas-Archive-Canonical-Frontend.csv, State-Matrix, RBAC, Field-Dictionary, source frontend/workspace-web'))
blocked('FIGMA-001', 'FE-01', 'pairwise Figma Dark/Light frame vs rendered state per view', 'get_screenshot per node + rendered screenshot', 'visual parity', NO_INPUT('Figma file key / nodes_dark,nodes_light columns (from Screen-Inventory)'))
blocked('FE06-UXJ-042', 'FE-06', '42 UX journeys / 174 steps with step oracles', 'v1 §12.2', 'all applicable steps PASS', NO_INPUT('Atlas-Source-Journeys-42.csv'))
blocked('FE06-UAT-307', 'FE-06', 'UAT 113 + 194 frontend/backend split', 'BA classification', 'classified', NO_INPUT('Atlas-Original-UAT-113.csv, Atlas-UX-UAT-194.csv'))

# ---------------- Findings ----------------
B = tests.DEFAULTS['build_id']; D = tests.DEFAULTS['deployment_id']
INH = 'INHERITED (run 2026-10-05 #1). Full text in run-1 Atlas-Frontend-Findings.csv, which was not provided to this run.'
def inh(fid, sev, gate, title, retest):
    findings.add(finding_id=fid, severity=sev, gate=gate, title=title, impact=INH, repro_steps='see run-1 Findings.csv', expected='see run-1', actual='not re-observed in run 2',
                 build_id=B, deployment_id=D, profile='run 1', evidence_ids='INHERITED_EVIDENCE', owner_proposed='Frontend', status='OPEN (inherited, not retested)', retest_case_ids=retest, closure_result='NOT_RUN')
inh('FND-001', 'P2', 'FE-03', 'Tab/tabpanel semantics (summary from v2 prompt)', 'A11Y-AXE-001,FE03-KBD-001')
findings.add(finding_id='FND-002', severity='P2', gate='FE-04', requirement_ref='v2 §6.1; FE-04 CSP', title='Không có CSP và các security header trên document/asset',
             impact='Không có lớp phòng thủ CSP cho app chạy Monaco + 6 worker + dữ liệu IndexedDB; không nosniff/HSTS/COOP/frame protection (clickjacking).',
             repro_steps='GET https://sparkling-snow-090d.ekko-okke666.workers.dev/ và đọc response headers', expected='CSP (script-src self, worker-src self blob:?, frame-ancestors none…), nosniff, Referrer-Policy, Permissions-Policy, HSTS, COOP',
             actual='Chỉ có alt-svc, cache-control, cf-cache-status, cf-ray, content-encoding, content-type, date, nel, report-to, server', build_id=B, deployment_id=D, profile='Browser Rendering Chromium',
             evidence_ids='EV-CF-501', owner_proposed='Frontend release / Platform', status='OPEN (reproduced in run 2)', fix_ref='Remediation-Plan R-01 (_headers)', retest_case_ids='CF-PRE-005', closure_result='FAIL (retest 2026-10-05T07:01Z)')
findings.add(finding_id='FND-003', severity='P2', gate='FE-05', requirement_ref='v2 §6.1 cache-control', title='Asset có hash trong tên vẫn bị revalidate mỗi lần (max-age=0)',
             impact='Mỗi lần tải lại phải revalidate 110+ asset (≈19 MB payload, Monaco/TS worker 6.9 MB) → chậm warm load, đặc biệt mạng di động.',
             repro_steps='Đọc Cache-Control của /assets/index-CNIcNnJO.js', expected='public, max-age=31536000, immutable cho /assets/*-<hash>.*', actual='public, max-age=0, must-revalidate (mặc định Workers static assets)',
             build_id=B, deployment_id=D, profile='Browser Rendering Chromium', evidence_ids='EV-CF-501,EV-STD-501', owner_proposed='Frontend release', status='OPEN (reproduced in run 2)', fix_ref='Remediation-Plan R-02 (_headers)',
             retest_case_ids='CF-PRE-006', closure_result='FAIL (retest 2026-10-05T07:04Z)')
inh('FND-004', 'P1', 'FE-01', '3/49 definition types cannot be created: default name contains "/" rejected by name validator', 'DEF-RETEST-FND-004')
inh('FND-005', 'P2', 'FE-06', 'Stale success toast remains after 401 / session expiry disconnect', 'FX-SERVICE-FND-005')
for i in range(6, 11):
    inh(f'FND-{i:03d}', 'P3', 'see run 1', 'P3 finding from run 1 (FND-006 relates to FX-EXEC-001/FX-CMD-004 4xx-definitive decision)' if i == 6 else 'P3 finding from run 1', 'see run-1 retest_case_ids')
inh('FND-011', 'P2', 'FE-03', 'Scrollable table region not keyboard focusable', 'FE03-KBD-001')
inh('FND-012', 'P1', 'FE-01', '7 canonical screens NOT_IMPLEMENTED; 129 views without any case', 'FE01-210-001')
for i in range(13, 17):
    inh(f'FND-{i:03d}', 'P3', 'see run 1', 'P3 finding from run 1', 'see run-1 retest_case_ids')
findings.add(finding_id='FND-017', severity='P3', gate='FE-03', view_id='all 18 module routes', requirement_ref='WCAG 2.2 SC 2.4.2 Page Titled', title='document.title không đổi theo view ("Atlas · Workspace" cho cả 18 module)',
             impact='Người dùng trình đọc màn hình, lịch sử trình duyệt, nhiều tab không phân biệt được view; khó quay lại đúng màn.',
             repro_steps='Mở /#home rồi /#execution, /#observer…; đọc document.title', expected='Tiêu đề phản ánh view, ví dụ "Execution · Atlas Workspace"', actual='"Atlas · Workspace" ở mọi route; bundle không gán document.title',
             build_id=B, deployment_id=D, profile='Browser Rendering Chromium 1440x900', evidence_ids='EV-RT-501,EV-RT-503', owner_proposed='Frontend', status='OPEN (new in run 2)', fix_ref='Remediation-Plan R-04', retest_case_ids='FE01-TITLE-001', closure_result='')
findings.add(finding_id='FND-018', severity='P2', gate='FE-03', view_id='all 18 module routes (shell breadcrumb)', requirement_ref='WCAG 2.2 SC 2.5.8 Target Size (Minimum)', title='Light theme, 320/375 px: link breadcrumb "Workspace" 64×18 nằm trong 12 px của nút "Navigation" (không đạt ngoại lệ spacing)',
             impact='Mục tiêu chạm nhỏ, sát nút mở navigation trên mobile → dễ chạm nhầm; chỉ quan sát ở light theme (dark sạch) — nguyên nhân chưa xác định.',
             repro_steps='Viewport 320x800 hoặc 375x812 (isMobile, hasTouch); bấm "Switch display theme" sang light; mở bất kỳ route; đo rect của nav[aria-label=Breadcrumb] a "Workspace" và nút "Navigation"',
             expected='≥24×24 hoặc vòng tròn 24 px quanh target không giao target khác', actual='64×18, tâm cách rect nút "Navigation" <12 px; 36/36 combos light@320/375 bị gắn cờ; dark@320/375 = 0',
             build_id=B, deployment_id=D, profile='Browser Rendering Chromium, isMobile+hasTouch, DPR 2/3', evidence_ids='EV-RESP-501,EV-RESP-502', owner_proposed='Frontend (shell header CSS)', status='OPEN (new in run 2; root cause pending FE02-TARGET-001)',
             fix_ref='Remediation-Plan R-05', retest_case_ids='FE02-TARGET-001,FE02-AUTO-216-320,FE02-AUTO-216-375', closure_result='')
findings.add(finding_id='FND-019', severity='P3', gate='FE-03', view_id='#<unknown>', requirement_ref='WCAG 1.3.1 / 2.4.6 (heading structure)', title='View "Workspace view not found" không có h1 trong main',
             impact='Người dùng AT không có heading cấp 1 để định hướng ở trạng thái lỗi điều hướng.', repro_steps='Mở /#atlas-unknown-route', expected='Một h1 mô tả trạng thái (ví dụ "Workspace view not found")',
             actual='main h1 = null; text "Workspace view not found … Return to overview"', build_id=B, deployment_id=D, profile='Browser Rendering Chromium 1280x800', evidence_ids='EV-RT-502', owner_proposed='Frontend',
             status='OPEN (new in run 2)', fix_ref='Remediation-Plan R-06', retest_case_ids='FE01-ROUTE-003', closure_result='')
findings.add(finding_id='FND-020', severity='P3', gate='FE-01', view_id='n/a (release metadata)', requirement_ref='v2 §4 release manifest / provenance', title='release-manifest.json khai báo "BUILT_NOT_DEPLOYED_NOT_PRODUCTION_CERTIFIED" và manifestSelfHash=null trong khi đang được phục vụ công khai',
             impact='Metadata phát hành không phản ánh trạng thái thực (đã deploy); không có self-hash để kiểm toàn vẹn manifest; dễ gây hiểu nhầm khi đối chiếu release.',
             repro_steps='GET /release-manifest.json', expected='status phản ánh deployment (hoặc manifest tách biệt cho bản deploy) + self-hash/chữ ký', actual='status BUILT_NOT_DEPLOYED_NOT_PRODUCTION_CERTIFIED; manifestSelfHash null; backendE2E NOT_RUN; browserAT NOT_RUN',
             build_id=B, deployment_id=D, profile='http', evidence_ids='EV-CF-502', owner_proposed='Release engineering', status='OPEN (new in run 2)', fix_ref='Remediation-Plan R-07', retest_case_ids='CF-PRE-002', closure_result='')
print('tests', len(tests.load()), 'findings', len(findings.load()))
