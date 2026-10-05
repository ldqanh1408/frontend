"""Build all run-2 deliverables from the ledgers. Run from frontend-acceptance/work/:  python3 build.py"""
import csv, json, os, zipfile, datetime, hashlib
from collections import Counter, defaultdict

import tests, findings, coverage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)            # frontend-acceptance/
REPO = os.path.dirname(ROOT)
P = lambda *a: os.path.join(ROOT, *a)
NOW = '2026-10-05T07:45Z'

DEPLOY = 'bd44cfc0-1219-40d9-9c1a-b1b7fe84d085'
VERSION = 'a8b5bc3a-63c9-4996-84e5-e8bc117775d3'
URL = 'https://sparkling-snow-090d.ekko-okke666.workers.dev'
GATES = ['FE-01', 'FE-02', 'FE-03', 'FE-04', 'FE-05', 'FE-06']
GATE_NAME = {'FE-01': 'Functional parity & routing', 'FE-02': 'Responsive', 'FE-03': 'Accessibility', 'FE-04': 'Runtime / workers / storage',
             'FE-05': 'Performance', 'FE-06': 'Journeys & fixtures / UAT'}

# ------------------------------------------------------------------ evidence index
EVIDENCE = [
    ('EV-CF-501', 'evidence/runs/R2-001-phase0/release-verify-browser.json', '2026-10-05T07:04:33Z', 'CF-PRE-001,CF-PRE-002,CF-PRE-003,CF-PRE-004,CF-PRE-005,CF-PRE-006,CF-PRE-007', 'http-in-browser hash table + headers', '1280x800 / 1440x900'),
    ('EV-CF-502', 'evidence/cloudflare/release-manifest.observed.json', '2026-10-05T07:02:30Z', 'CF-PRE-002', 'release manifest (re-serialised copy; raw bytes sha256 0bf5b028…edd3)', 'n/a'),
    ('EV-CF-503', 'evidence/runs/R2-001-phase0/cloudflare-metadata.json', '2026-10-05T06:58:00Z', 'Phase0b', 'Cloudflare API metadata (GET, redacted)', 'n/a'),
    ('EV-RT-501', 'evidence/runs/R2-002-discover/discover-1440x900-dark.json', '2026-10-05T07:06:00Z', 'FE01-TITLE-001,FE01-RUNTIME-001,CF-PRE-007', 'route crawl (structure, storage, errors)', '1440x900 dark'),
    ('EV-RT-502', 'evidence/runs/R2-003-routes/deeplink-refresh-history.json', '2026-10-05T07:13:00Z', 'CF-PRE-008,FE01-ROUTE-001,FE01-ROUTE-002,FE01-ROUTE-003,FE01-ROUTE-004', 'deep link / reload / history / query / unknown route', '1280x800'),
    ('EV-RT-503', 'evidence/runs/R2-002-discover/bundle-extract.md', '2026-10-05T07:09:00Z', 'FE01-TITLE-001', 'bundle snippets (router, theme, connection)', 'n/a'),
    ('EV-RESP-501', 'evidence/runs/R2-004-fe02/vp320x800.json', '2026-10-05T07:19:00Z', 'FE02-AUTO-216-320,A11Y-TARGET-001', 'detector results + probe validation', '320x800 mobile dpr2'),
    ('EV-RESP-502', 'evidence/runs/R2-004-fe02/vp375x812.json', '2026-10-05T07:21:00Z', 'FE02-AUTO-216-375,A11Y-TARGET-001', 'detector results + probe validation', '375x812 mobile dpr3'),
    ('EV-RESP-503', 'evidence/runs/R2-004-fe02/vp768x1024.json', '2026-10-05T07:22:00Z', 'FE02-AUTO-216-768', 'detector results + probe validation', '768x1024 touch dpr2'),
    ('EV-RESP-504', 'evidence/runs/R2-004-fe02/vp1280x800.json', '2026-10-05T07:25:00Z', 'FE02-AUTO-216-1280', 'detector results + probe validation', '1280x800'),
    ('EV-RESP-505', 'evidence/runs/R2-004-fe02/vp1440x900.json', '2026-10-05T07:26:00Z', 'FE02-AUTO-216-1440', 'detector results + probe validation', '1440x900'),
    ('EV-STD-501', 'evidence/standards/standards-index.json', '2026-10-05T07:30:00Z', 'all (oracles)', 'standards read (URL + sha256)', 'n/a'),
    ('EV-HAR-501', 'harness/remote/detector.js', '2026-10-05T07:21:00Z', 'FE02-AUTO-216-*', 'injected detector source (method evidence)', 'n/a'),
    ('EV-HAR-502', 'harness/remote/fe02.js', '2026-10-05T07:21:00Z', 'FE02-AUTO-216-*', 'injected FE02 batch source', 'n/a'),
    ('EV-HAR-503', 'harness/remote/deeplink.js', '2026-10-05T07:12:00Z', 'CF-PRE-008,FE01-ROUTE-*', 'injected routing script source (iframe reuse bug fixed in executed version: fresh iframe per route)', 'n/a'),
    ('EV-HAR-504', 'harness/remote/release_verify.js', '2026-10-05T07:01:00Z', 'CF-PRE-001..006', 'injected release verification source', 'n/a'),
]


def all_evidence():
    extra = []
    f = os.path.join(HERE, 'evidence-r3.json')
    if os.path.exists(f):
        extra = [tuple(x) for x in json.load(open(f))]
    figma = P('evidence/figma/start-here-metadata.md')
    if os.path.exists(figma):
        extra.append(('EV-FIG-501', 'evidence/figma/start-here-metadata.md', '2026-10-05T08:00:00Z', 'FIGMA-001', 'Figma file metadata (MCP get_metadata)', 'n/a'))
    return EVIDENCE + extra


def build_evidence_index():
    idx = []
    for eid, path, ts, cases, etype, vp in all_evidence():
        full = P(path)
        assert os.path.exists(full), f'evidence path missing: {path}'
        idx.append({'evidence_id': eid, 'path': path, 'sha256': hashlib.sha256(open(full, 'rb').read()).hexdigest(), 'timestamp': ts,
                    'case_ids': cases, 'view_ids': 'route-level (18 module routes); canonical view_ids unavailable',
                    'build': 'atlas-static-release/v1@2026-10-04T10:09:42.397Z', 'deployment': f'{DEPLOY} / {VERSION}', 'fixture': 'none',
                    'browser': ('Cloudflare Browser Rendering headless Chromium (UA Chrome/119)' if eid in ('EV-CF-501', 'EV-RT-501', 'EV-RT-502', 'EV-RESP-501', 'EV-RESP-502', 'EV-RESP-503', 'EV-RESP-504', 'EV-RESP-505')
                                else ('GitHub Actions Playwright 1.56.1 (Chromium 141 / Firefox 142 / WebKit 26)' if int(eid.rsplit('-', 1)[1]) >= 600 else 'n/a')),
                    'viewport_profile': vp, 'evidence_type': etype, 'label': 'OBSERVED_THIS_RUN'})
    # every evidence id referenced by tests/findings must exist
    known = {e['evidence_id'] for e in idx}
    for r in tests.load():
        for e in filter(None, r['evidence_ids'].split(',')):
            assert e in known, f"{r['case_id']} references unknown evidence {e}"
    for r in findings.load():
        for e in filter(None, r['evidence_ids'].split(',')):
            assert e in known or e == 'INHERITED_EVIDENCE', f"{r['finding_id']} references unknown evidence {e}"
    with open(P('evidence-index.json'), 'w') as f:
        json.dump(idx, f, indent=1, ensure_ascii=False)
    return idx


def write_csv(path, cols, rows):
    with open(path, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, '') for c in cols})


def gate_status(trows):
    res = Counter(r['result'] for r in trows)
    if res['FAIL']:
        return 'FAIL'
    if res['BLOCKED'] or res['NOT_RUN'] or not trows:
        return 'INCOMPLETE'
    return 'PASS'


GATE_NOTES = {
    'FE-01': ('18/18 route: deep link, refresh, Back/Forward, query, route lạ PASS; 120/120 payload khớp manifest',
              '210 view_id không liệt kê được (thiếu Screen-Inventory/Archive CSV, spec, source); FND-004/FND-012 chưa retest; Figma chưa so'),
    'FE-02': ('180/216 tổ hợp route×viewport×theme đo được; 144 sạch',
              'FAIL: light@320/375 target size (FND-018); 1920 + state/zoom/coarse/walkthrough BLOCKED (quota, không trusted input)'),
    'FE-03': ('Detector tự động: 0 lỗi contrast/tên/heading ở 180 tổ hợp',
              'FAIL: FND-017 (2.4.2), FND-018 (2.5.8); axe, bàn phím, AT BLOCKED/NOT_RUN'),
    'FE-04': ('0 lỗi runtime ở ≈200 lần render; 6 worker phục vụ MIME đúng',
              'FAIL: không CSP/security headers (FND-002); worker lifecycle, IndexedDB, 2 tab, cross-engine BLOCKED/NOT_RUN'),
    'FE-05': ('Budget khoá trước (web-vitals); dữ kiện payload tĩnh',
              'FAIL: asset băm max-age=0 (FND-003); không có số đo LCP/INP/CLS (quota, không CDP/trusted input)'),
    'FE-06': ('Không có case chạy được', 'FX-SERVICE + 42 journey + UAT BLOCKED (quota; thiếu Journeys/UAT CSV; DTO chưa duyệt)'),
}


def main():
    trows = sorted(tests.load(), key=lambda r: r['case_id'])
    frows = findings.load()
    cov = coverage.build()
    idx = build_evidence_index()

    write_csv(P('Atlas-Frontend-Test-Results.csv'), tests.COLS, trows)
    write_csv(P('Atlas-Frontend-Findings.csv'), findings.COLS, frows)
    write_csv(P('Atlas-Frontend-Journey-Results.csv'), ['journey_id', 'step_id', 'title', 'actor', 'fixture_id', 'view_ids', 'expected', 'actual', 'result', 'evidence_ids', 'reason', 'run_at'], [])
    write_csv(P('Atlas-Frontend-UAT-Classification.csv'), ['uat_id', 'source_file', 'title', 'frontend_scope', 'backend_scope', 'classification', 'basis', 'classified_by', 'status'], [])

    by_gate = defaultdict(list)
    for r in trows:
        by_gate[r['gate']].append(r)
    gates = {g: gate_status(by_gate[g]) for g in GATES}
    if any(v == 'FAIL' for v in gates.values()):
        verdict = 'NO_GO_FRONTEND'
    elif any(v == 'INCOMPLETE' for v in gates.values()):
        verdict = 'INCOMPLETE_EVIDENCE'
    else:
        verdict = 'GO_FRONTEND / FE_ACCEPTANCE_PASS_BACKEND_PENDING'
    counts = Counter(r['result'] for r in trows)

    manifest = {
        'run_id': 'R2-2026-10-05', 'prompt': 'Atlas-Frontend-Acceptance-Master-Prompt-v2 (handover edition)', 'mode': 'MODE_FRESH',
        'mode_reason': 'No handover package (Atlas-Frontend-Acceptance.zip) or ledger in this session ⇒ MODE_FRESH per v2 §0.2. Deployment identity re-verified identical to run 1 (MATCH), so run-1 evidence would be reusable if supplied; it was not. Run-1 facts quoted in the prompt are labelled INHERITED_EVIDENCE.',
        'resumed_from': None, 'generated_at': NOW, 'audit_mode': 'AUDIT_ONLY',
        'target': {'provider': 'Cloudflare', 'primary_url': URL, 'url_class': 'PRIMARY_ACCEPTANCE_URL = WORKER_URL', 'worker': 'sparkling-snow-090d',
                   'worker_deployment_id': DEPLOY, 'worker_version_id': VERSION, 'pages_deployment': 'none', 'custom_domains': [], 'routes': [],
                   'identity_vs_run1': 'MATCH', 'account_id': '[REDACTED]'},
        'release': {'manifest_format': 'atlas-static-release/v1', 'createdAt': '2026-10-04T10:09:42.397Z', 'payloads': 120, 'remote_hash_matches': 120,
                    'manifest_bytes_sha256': '0bf5b0288ac6ca988130961b8da55d18637a07dbf9a3d09ca97d5e1e4c09edd3', 'manifest_status_field': 'BUILT_NOT_DEPLOYED_NOT_PRODUCTION_CERTIFIED'},
        'source': {'revision': None, 'reason': 'source frontend/workspace-web not provided'}, 'local_build': None, 'local_remote_equivalence': 'UNVERIFIED',
        'inputs_present': ['Atlas-Frontend-Acceptance-Master-Prompt-v2.md'],
        'inputs_missing': ['Atlas-Frontend-Acceptance.zip (run-1 handover: deliverables, evidence/, evidence-index.json, work/tests.json, findings.json, tests.py, findings.py, coverage.py, build.py, schema_oracle.json)',
                           'Atlas-Frontend-UI-Readiness.md', 'Atlas-Frontend-UI-Readiness.json', 'Atlas-Archive-Canonical-Frontend.csv', 'Atlas-Screen-Inventory.csv',
                           'Atlas-State-Matrix.csv', 'Atlas-Lifecycle-State-Table.csv', 'Atlas-RBAC-Matrix.csv', 'Atlas-Field-Dictionary.csv', 'schema sources',
                           'Atlas-Source-Journeys-42.csv', 'Atlas-Original-UAT-113.csv', 'Atlas-UX-UAT-194.csv', 'Atlas-UIUX-Hardening.md', 'Atlas-E2E-Delivery.md',
                           'build/test logs', 'source frontend/workspace-web (package.json, lockfile, router, adapters, components, tests, build/Wrangler config)', 'AGENTS.md', 'Figma file key / node IDs', 'v1 prompt (attachment.txt)'],
        'scripts_note': 'Run-1 scripts were not available, so tests.py / findings.py / coverage.py / build.py were rewritten for run 2 with the same names and §8.2 schemas.',
        'id_policy': 'Case IDs reuse run-1 names where the check is the same (CF-PRE-00x, FE02-AUTO-216, PERF-00x, FE03-KBD-001, A11Y-AXE-00x…). Findings continue at FND-017. Evidence IDs start at 501 per area to avoid collision with unknown run-1 maxima.',
        'capability_matrix': [
            {'capability': 'Cloudflare plugin read', 'status': 'AVAILABLE', 'limitation': 'GET only by policy', 'affected_cases': []},
            {'capability': 'Browser automation', 'status': 'PARTIAL', 'limitation': 'Cloudflare Browser Rendering REST /content + addScriptTag (headless Chromium, real version undisclosed, UA Chrome/119); one page per request; ≤60 s per call; Workers Free quota exhausted at 07:27Z (2001 Rate limit exceeded)', 'affected_cases': ['FE02-AUTO-216-1920', 'A11Y-AXE-001', 'A11Y-AXE-002', 'FX-SERVICE-001', 'PERF-007', 'FE02-STATE-001', 'FE02-COARSE-001', 'FE02-TARGET-001']},
            {'capability': 'Built-in Browser pane (mcp__remote-devices__Claude_Browser__*)', 'status': 'UNAVAILABLE', 'limitation': 'cloud session without linked device', 'affected_cases': ['all trusted-input cases']},
            {'capability': 'Sandbox → workers.dev', 'status': 'UNAVAILABLE', 'limitation': 'egress proxy CONNECT 403', 'affected_cases': []},
            {'capability': 'GitHub Actions Playwright harness', 'status': 'BLOCKED', 'limitation': 'git push / MCP write 403: Claude GitHub App not installed on ldqanh1408/hehe', 'affected_cases': ['FE04-XENGINE-001', 'FE03-KBD-001', 'PERF-007', 'PERF-INP-001']},
            {'capability': 'Trusted input', 'status': 'UNAVAILABLE', 'limitation': 'REST has no input API', 'affected_cases': ['FE03-KBD-001', 'FE01-ROUTE-004', 'CODE-008', 'PERF-INP-001', 'PERF-009', 'FE02-ZOOM-001']},
            {'capability': 'Screenshots', 'status': 'NOT_CAPTURED', 'limitation': 'endpoint exists but binary transfer via tool output is impractical and quota-limited', 'affected_cases': ['FE02-WALK-001', 'FIGMA-001']},
            {'capability': 'Network/console', 'status': 'PARTIAL', 'limitation': 'window error/unhandledrejection/console.error hooks + fetch response headers; no HAR', 'affected_cases': []},
            {'capability': 'Performance traces', 'status': 'UNAVAILABLE', 'limitation': 'no CDP (no throttling, no trace)', 'affected_cases': ['PERF-007', 'PERF-008']},
            {'capability': 'IndexedDB inspect', 'status': 'PARTIAL', 'limitation': 'indexedDB.databases() only (atlas-device-workspace-v10@2)', 'affected_cases': ['FE04-IDB-001']},
            {'capability': 'Quota/offline simulation', 'status': 'UNAVAILABLE', 'limitation': '', 'affected_cases': ['FE04-IDB-001', 'FX-BRANCH-001']},
            {'capability': 'Cross-tab', 'status': 'UNAVAILABLE', 'limitation': 'single page per request', 'affected_cases': ['FE04-TAB-001']},
            {'capability': 'Engines', 'status': 'Chromium only (Cloudflare-hosted)', 'limitation': 'no Firefox/WebKit/Safari/Edge/branded Chrome', 'affected_cases': ['FE04-XENGINE-001']},
            {'capability': 'Screen readers (NVDA/VoiceOver/TalkBack/iOS)', 'status': 'UNAVAILABLE', 'limitation': '', 'affected_cases': ['FE03-AT-001']},
            {'capability': 'Real devices', 'status': 'UNAVAILABLE', 'limitation': '', 'affected_cases': ['FE02-COARSE-001']},
            {'capability': 'Emulation', 'status': 'AVAILABLE', 'limitation': 'viewport width/height/DPR/isMobile/hasTouch; no emulateMediaFeatures', 'affected_cases': ['FE03-MOTION-001']},
            {'capability': 'Local Chromium (sandbox Playwright 1.56.1)', 'status': 'AVAILABLE (cannot reach target)', 'limitation': 'used only to validate the detector on a synthetic probe page', 'affected_cases': []},
            {'capability': 'Figma MCP', 'status': 'AVAILABLE but unused', 'limitation': 'no file key / node IDs (inventory missing)', 'affected_cases': ['FIGMA-001']},
            {'capability': 'Standards fetch', 'status': 'PARTIAL', 'limitation': 'w3.org / web.dev blocked; official editor sources read from raw.githubusercontent.com', 'affected_cases': []},
        ],
        'denominators': {'canonical_views': cov, 'tests': dict(counts, total=len(trows)), 'exclusions': []},
        'gates': gates, 'verdict': verdict,
        'synthetic_data': 'No user browser profile was touched. Remote Browser Rendering sessions are ephemeral; the only state written there was the theme preference (IndexedDB pref) during FE02 batches. No production data written.',
        'git': 'Commits are local to the session container; push to origin was refused (403, GitHub App not installed).',
    }
    with open(P('Atlas-Frontend-Acceptance-Manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)

    # ------------------------------------------------------------------ report
    L = []
    a = L.append
    a('# Atlas Frontend Production Acceptance — Báo cáo run 2 (2026-10-05)\n')
    a('```text\nFRONTEND ACCEPTANCE TARGET\n\nProvider: Cloudflare\nPrimary URL: ' + URL + '\nWorker deployment: ' + DEPLOY + ' (version ' + VERSION + ')\n'
      'Pages deployment: none\nSource revision: UNVERIFIED\nLocal build: UNVERIFIED\nRemote/local equivalence: UNVERIFIED\n\nVERDICT:\n' + verdict + '\n```\n')
    a(f'Phạm vi: 210 canonical view (denominator theo v2; **0/210 liệt kê được** vì thiếu inventory) · 18 module route quan sát được · Chromium (Cloudflare Browser Rendering) only · AUDIT_ONLY. Backend không được chứng nhận.\n')
    a('**Tóm tắt.** Deployment không đổi so với run 1 và 120/120 payload khớp manifest. Routing hash ổn định (deep link, refresh, Back/Forward, query, route lạ). '
      'Verdict là **NO_GO_FRONTEND** vì bốn gate có requirement bắt buộc FAIL: FE-02 và FE-03 (FND-018 target size ở light theme 320/375 px; FE-03 thêm FND-017 tiêu đề trang), FE-04 (FND-002 không CSP), FE-05 (FND-003 cache). FE-01 và FE-06 INCOMPLETE. '
      'Phần lớn case còn lại BLOCKED vì (1) gói bàn giao + CSV + source không có trong phiên, (2) quota Browser Rendering hết lúc 07:27Z, (3) không có trusted input/AT/engine khác.\n')
    a('## 1. Sáu gate\n')
    a('| Gate | Kết quả | Coverage / bằng chứng | Blocker |\n|---|---|---|---|')
    for g in GATES:
        c = Counter(r['result'] for r in by_gate[g])
        a(f"| {g} {GATE_NAME[g]} | **{gates[g]}** | {GATE_NOTES[g][0]} — case: {sum(c.values())} (PASS {c['PASS']}, FAIL {c['FAIL']}, BLOCKED {c['BLOCKED']}, NOT_RUN {c['NOT_RUN']}, N/A {c['NOT_APPLICABLE']}) | {GATE_NOTES[g][1]} |")
    a('\n## 2. Implementation (210 canonical view)\n')
    a('| Trạng thái | Run 2 (OBSERVED) | Run 1 (INHERITED, chưa xác minh lại) |\n|---|---|---|')
    for k in ['COMPLETE', 'PARTIAL', 'NOT_IMPLEMENTED', 'UNVERIFIED']:
        a(f"| {k} | {cov['implementation_status'][k]} | {cov['inherited_run1'][k]} |")
    a('\nKhông có view_id nào được suy ra từ tiêu đề/route (invariant 20). `Atlas-Frontend-Screen-Coverage.csv` giữ đúng header với 0 hàng; '
      '`Atlas-Frontend-Route-Coverage.csv` (PROPOSED_EXTENSION) ghi 18 module route quan sát được.\n')
    a('## 3. Test denominator\n')
    a(f"| Total | PASS | FAIL | NOT_RUN | BLOCKED | NOT_APPLICABLE | Exclusions |\n|---|---|---|---|---|---|---|\n| {len(trows)} | {counts['PASS']} | {counts['FAIL']} | {counts['NOT_RUN']} | {counts['BLOCKED']} | {counts['NOT_APPLICABLE']} | 0 |\n")
    a('Không dùng % tổng hợp để bù gate. Case PASS dựa trên expected cố định trước khi chạy (oracle: h1 thu từ đường điều hướng độc lập, SHA-256 của manifest, văn bản WCAG SC).\n')
    a('## 4. Findings\n')
    a('| ID | Sev | Gate | Tiêu đề | Trạng thái | Retest |\n|---|---|---|---|---|---|')
    for r in frows:
        a(f"| {r['finding_id']} | {r['severity']} | {r['gate']} | {r['title']} | {r['status']} | {r['retest_case_ids']} |")
    a('\n**Top P0/P1**: không có P0. P1 kế thừa (chưa retest được): FND-004 (3/49 definition type không tạo được — kỳ vọng 49/49; retest `DEF-RETEST-FND-004` cần Field-Dictionary + schema_oracle), '
      'FND-012 (7 màn NOT_IMPLEMENTED + 129 view chưa có case — kỳ vọng mỗi view có case; retest `FE01-210-001` cần inventory/spec/source). Không có P1 mới trong run 2.\n')
    a('## 5. Specifications / Code Intelligence / Agent Lifecycle\n')
    a('| Mảng | Đã chứng minh (run 2) | Thiếu / chưa kiểm |\n|---|---|---|')
    a('| Specifications | Route `#specifications` render (tree Library, tablist IDE/Definitions/Service records, Outline/Details/Properties/Acceptance), deep link/refresh, 0 lỗi runtime, responsive mặc định | Import/persistence/race/2-tab (SPEC-*), Monaco gõ phím thật — BLOCKED |')
    a('| Code intelligence | Route `#code` render (Repository files tree, Symbols/Locations/Search/Diagnostics/Coverage tabs) | Go to definition/F12 (CODE-008), 6 worker lifecycle (FE04-WORKER-001) — BLOCKED |')
    a('| Agent lifecycle / service modules | 15 module dịch vụ render khung Definitions + Service records + action theo module; trạng thái "Service connection required" khi chưa kết nối | FX-SERVICE stages/Unknown/reconcile/401 (FX-SERVICE-001, FND-005 retest) — BLOCKED; DTO chưa duyệt |')
    a('\n## 6. Môi trường thực tế (run 2)\n')
    a('- **Browser**: Cloudflare Browser Rendering `/content` (headless Chromium, UA "Chrome/119", phiên bản thật không công bố, `visibilityState=visible`). Input: `synthetic-DOM` (location/history API, `.click()` cho nút theme).')
    a('- **Viewport**: 320×800 (mobile, DPR 2), 375×812 (mobile, DPR 3), 768×1024 (touch, DPR 2), 1280×800, 1440×900 — emulation, không thiết bị thật. 1920×1080 BLOCKED.')
    a('- **AT**: không có. **Perf profile**: không có (không CDP). **Engines khác**: không có.')
    a('- **Cloudflare**: plugin GET cho metadata; Browser Rendering cho truy cập browser (không đổi cấu hình).')
    a('- **Kế thừa**: mọi số liệu run 1 trong báo cáo được gắn nhãn INHERITED và không gộp với kết quả run 2.\n')
    a('## 7. Backend boundary\n')
    a('Xem `Atlas-Frontend-Backend-Dependencies.md`: DTO `atlas-ui/v1` vẫn "proposed" (UI tự ghi), 4xx-definitive (FND-006) SPEC_UNRESOLVED, permissions/receipt/provider/UAT live NOT_RUN. Không tính vào PASS/FAIL frontend.\n')
    a('## 8. Deliverables\n')
    for f_ in ['Atlas-Frontend-Acceptance-Report.md / .html', 'Atlas-Frontend-Acceptance-Manifest.json', 'Atlas-Frontend-Screen-Coverage.csv (header, 0 hàng)', 'Atlas-Frontend-Route-Coverage.csv',
               'Atlas-Frontend-Test-Results.csv', 'Atlas-Frontend-Findings.csv', 'Atlas-Frontend-Journey-Results.csv (header)', 'Atlas-Frontend-UAT-Classification.csv (header)',
               'Atlas-Frontend-Accessibility.md', 'Atlas-Frontend-Performance.json / .md', 'Atlas-Frontend-Backend-Dependencies.md', 'Atlas-Frontend-Remediation-Plan.md',
               'Atlas-Frontend-Cloudflare-Deployment.md', 'evidence/ + evidence-index.json (mọi path đã assert tồn tại)', 'work/ (tests.json, findings.json, tests.py, findings.py, coverage.py, build.py, record_r2.py)',
               'harness/ (script inject Browser Rendering + harness Playwright/GitHub Actions sẵn sàng chạy)']:
        a(f'- {f_}')
    a('\n## 9. Exact remaining cases\n')
    a('| Case | Gate | Expected | Evidence hiện có | Blocker | Cách nghiệm thu tiếp |\n|---|---|---|---|---|---|')
    how = {
        'BLOCKED_CLOUDFLARE_BROWSER_QUOTA': 'Chạy lại script trong harness/remote sau 00:00 UTC, hoặc workflow GitHub Actions',
        'BLOCKED_NO_TRUSTED_INPUT': 'Workflow Playwright (trusted CDP input) hoặc pane Browser hiển thị',
        'BLOCKED_INPUT_MISSING': 'Cung cấp file đầu vào/gói run 1',
        'NOT_RUN_AT': 'Kịch bản thủ công trong Accessibility.md §3',
        'SPEC_UNRESOLVED': 'Quyết định spec/DTO từ chủ sản phẩm',
        'NOT_RUN: only Chromium': 'Workflow Playwright firefox/webkit',
        'BLOCKED: Browser Rendering REST is single-page': 'Workflow Playwright (2 context)',
    }
    for r in trows:
        if r['result'] in ('BLOCKED', 'NOT_RUN'):
            key = next((k for k in how if r['reason'].startswith(k)), None)
            blocker = r['reason'].split(':')[0]
            a(f"| {r['case_id']} | {r['gate']} | {r['expected']} | {r['evidence_ids'] or '—'} | {blocker} | {how.get(key, 'xem reason trong Test-Results.csv')} |")
    a('\n## 10. Giới hạn\n')
    a('- Không có source ⇒ không có implementation_status COMPLETE nào; local/remote equivalence UNVERIFIED.')
    a('- Detector tự động chỉ phủ trạng thái mặc định (chưa kết nối) của 18 route; không suy ra cho 210 view.')
    a('- Theme chuyển bằng `.click()` tổng hợp: hợp lệ cho đo render, không phải bằng chứng bàn phím.')
    a('- FND-018 chỉ xuất hiện ở light theme; nguyên nhân chưa xác định (FE02-TARGET-001).')
    a('- Push lên GitHub bị từ chối (Claude GitHub App chưa cài) ⇒ commit chỉ nằm trong container; gói zip được gửi trực tiếp.')
    a(f'\n_Generated {NOW} từ work/tests.json + work/findings.json bằng work/build.py._\n')
    md = '\n'.join(L)
    with open(P('Atlas-Frontend-Acceptance-Report.md'), 'w') as f:
        f.write(md)
    write_html(md)
    make_zip()
    print(json.dumps({'gates': gates, 'verdict': verdict, 'tests': dict(counts), 'findings': len(frows), 'evidence': len(idx)}, indent=1))


CSS = """
:root{--bg:#ffffff;--fg:#1d2433;--muted:#5b6475;--line:#d9dee7;--card:#f5f7fa;--fail:#b42318;--pass:#067647;--warn:#b54708;--accent:#2f5bd3}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0f141c;--fg:#e6e9ef;--muted:#9aa4b5;--line:#2a3342;--card:#161d28;--fail:#f97066;--pass:#47cd89;--warn:#fdb022;--accent:#84a9ff}}
:root[data-theme="dark"]{--bg:#0f141c;--fg:#e6e9ef;--muted:#9aa4b5;--line:#2a3342;--card:#161d28;--fail:#f97066;--pass:#47cd89;--warn:#fdb022;--accent:#84a9ff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:1180px;margin:0 auto;padding:24px 16px 64px}h1{font-size:1.6rem;line-height:1.25}h2{margin-top:2.2rem;border-bottom:1px solid var(--line);padding-bottom:.3rem}
pre{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px;overflow:auto}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em}
.table-wrap{overflow-x:auto;margin:12px 0;border:1px solid var(--line);border-radius:8px}table{border-collapse:collapse;width:100%;font-size:.86rem}
th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{background:var(--card);position:sticky;top:0}
td strong{white-space:nowrap}.FAIL{color:var(--fail);font-weight:700}.PASS{color:var(--pass);font-weight:700}.INCOMPLETE,.BLOCKED{color:var(--warn);font-weight:700}
a{color:var(--accent)}
"""


def write_html(md):
    import markdown, re
    body = markdown.markdown(md, extensions=['tables', 'fenced_code'])
    body = body.replace('<table>', '<div class="table-wrap"><table>').replace('</table>', '</table></div>')
    body = re.sub(r'<strong>(FAIL|PASS|INCOMPLETE)</strong>', r'<strong class="\1">\1</strong>', body)
    html = ('<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Atlas Frontend Acceptance</title><style>' + CSS + '</style></head><body><main>' + body + '</main></body></html>')
    with open(P('Atlas-Frontend-Acceptance-Report.html'), 'w') as f:
        f.write(html)


def make_zip():
    dist = os.path.join(REPO, 'dist')
    os.makedirs(dist, exist_ok=True)
    zp = os.path.join(dist, 'Atlas-Frontend-Acceptance.zip')
    with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
        for base, dirs, files in os.walk(ROOT):
            dirs[:] = [d for d in dirs if d not in ('node_modules', '__pycache__')]
            for fn in files:
                full = os.path.join(base, fn)
                z.write(full, os.path.join('frontend-acceptance', os.path.relpath(full, ROOT)))
        wf = os.path.join(REPO, '.github', 'workflows', 'atlas-acceptance.yml')
        z.write(wf, '.github/workflows/atlas-acceptance.yml')


if __name__ == '__main__':
    main()
