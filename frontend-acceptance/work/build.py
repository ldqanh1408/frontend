"""Build all run-2 deliverables from the ledgers. Run from frontend-acceptance/work/:  python3 build.py"""
import csv, json, os, zipfile, datetime, hashlib
from collections import Counter, defaultdict

import tests, findings, coverage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)            # frontend-acceptance/
REPO = os.path.dirname(ROOT)
P = lambda *a: os.path.join(ROOT, *a)
NOW = '2026-10-05T08:55Z'

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
    'FE-01': ('120/120 payload khớp manifest (Cloudflare browser + GitHub runner); 18/18 route deep link/reload/query/route lạ PASS trên Chromium 141, Firefox 142, WebKit 26',
              '210 view_id không liệt kê được (thiếu Screen-Inventory/Archive CSV, spec, source); FND-004/FND-012 chưa retest; Figma thiếu page per-view'),
    'FE-02': ('216/216 tổ hợp route×viewport×theme trên Chromium + Firefox/WebKit ở 5 width; 768–1920 sạch mọi engine; 72 ảnh chụp',
              'FAIL: FND-018 (breadcrumb nằm dưới header cố định sau khi đổi view — Chromium/WebKit, 320/375/1440); state/zoom/coarse chưa script'),
    'FE-03': ('axe-core 0 vi phạm (18 route, dark+light, mặc định); bàn phím thật PASS: skip link, Tab order + focus visible, Ctrl+K combobox, 2 dialog modal, drawer mobile, focus sau đổi view',
              'FAIL: FND-001 (tab↔tabpanel), FND-021 (mất focus khi Arrow trên tablist workspace), FND-017 (title), FND-018 (target bị che); AT NOT_RUN; axe connected/dialog NOT_RUN'),
    'FE-04': ('0 lỗi runtime; 6 worker phục vụ MIME đúng; routing đồng nhất 3 engine',
              'FAIL: không CSP/security headers (FND-002); worker lifecycle, IndexedDB, 2 tab, Monaco/F12 chưa script'),
    'FE-05': ('LCP p75 cold 168 ms / warm 80 ms / mobile throttled 1236 ms; CLS≈0; INP 40 ms (72 ms CPU 4×) — đạt budget khoá trước',
              'FAIL: asset băm max-age=0 (FND-003); heap +18,7%/30 chu kỳ vượt budget giả định (FND-022); workload lớn chưa chạy'),
    'FE-06': ('FX-SERVICE (fixture có nhãn, click thật): 14/16 PASS — 1 POST khi double-click, stage đúng, 4xx/5xx/mạng/timeout/mismatch ⇒ Unknown, 401/hết phiên ⇒ disconnect, observer không gửi lệnh',
              'FAIL: FND-005 (toast thành công cũ còn sau 401/hết phiên); 42 journey + UAT BLOCKED (thiếu CSV); FX-EXEC-001 SPEC_UNRESOLVED'),
}

RUN_HISTORY = [
    ('R2-001…004', '2026-10-05 06:58–07:27Z', 'Cloudflare Browser Rendering (headless Chromium, UA Chrome/119), synthetic-DOM', 'Phase 0b metadata, hash 120 payload, header/MIME/cache, discovery, deep link/reload/history, FE02 320–1440', 'Hết quota Free 10 phút/ngày lúc 07:27Z'),
    ('R3-001 (run 37280321117)', '07:54–08:05Z', 'GitHub Actions, Playwright 1.56.1: Chromium 141 / Firefox 142 / WebKit 26', 'mirror, discovery, axe dark/light, FE02 1920 + Firefox/WebKit 320/1920', 'Bị huỷ; bước commit vẫn chạy và đẩy bản mirror plaintext (đã gỡ khỏi cây ở 41948df). Deeplink script cũ treo (lỗi harness)'),
    ('run 37281392041', '08:05–08:23Z', 'như trên', 'keyboard/perf/screenshots', 'Kết quả mất do xung đột commit (đã sửa workflow); chạy lại ở R3-003'),
    ('R3-002 (run 37282601201)', '08:24–08:29Z', 'như trên', 'mirror (redirect fixed), deeplink 3 engine, FE02 Firefox/WebKit 375/768/1440, FX-SERVICE 14 kịch bản, layout hit-test', 'OK'),
    ('R3-003 (run 37284006443)', '08:30–08:35Z', 'như trên, trusted input + CDP', 'keyboard 3 engine, perf (cold/warm/mobile, INP, heap), 72 screenshots', 'Keyboard: 4 lỗi harness (đã sửa, không tính FAIL)'),
    ('R3-004 (run 37285038578)', '08:40–08:42Z', 'như trên', 'keyboard 3 engine (harness đã sửa), INP ≥30 tương tác, heap 30/60/90 chu kỳ', 'OK'),
]


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
        'run_id': 'R2+R3-2026-10-05', 'prompt': 'Atlas-Frontend-Acceptance-Master-Prompt-v2 (handover edition)', 'mode': 'MODE_FRESH',
        'mode_reason': 'No handover package (Atlas-Frontend-Acceptance.zip) or ledger in this session ⇒ MODE_FRESH per v2 §0.2. Deployment identity re-verified identical to run 1 (MATCH). Run-1 facts quoted in the prompt are labelled INHERITED_EVIDENCE.',
        'resumed_from': None, 'generated_at': NOW, 'audit_mode': 'AUDIT_ONLY',
        'target': {'provider': 'Cloudflare', 'primary_url': URL, 'url_class': 'PRIMARY_ACCEPTANCE_URL = WORKER_URL', 'worker': 'sparkling-snow-090d',
                   'worker_deployment_id': DEPLOY, 'worker_version_id': VERSION, 'pages_deployment': 'none', 'custom_domains': [], 'routes': [],
                   'identity_vs_run1': 'MATCH', 'account_id': '[REDACTED]'},
        'release': {'manifest_format': 'atlas-static-release/v1', 'createdAt': '2026-10-04T10:09:42.397Z', 'payloads': 120, 'remote_hash_matches': '120/120 (Cloudflare browser 07:04Z; GitHub runner 08:24Z)',
                    'manifest_bytes_sha256': '0bf5b0288ac6ca988130961b8da55d18637a07dbf9a3d09ca97d5e1e4c09edd3', 'manifest_status_field': 'BUILT_NOT_DEPLOYED_NOT_PRODUCTION_CERTIFIED'},
        'source': {'revision': None, 'reason': 'source frontend/workspace-web not provided'}, 'local_build': None, 'local_remote_equivalence': 'UNVERIFIED',
        'inputs_present': ['Atlas-Frontend-Acceptance-Master-Prompt-v2.md', 'Figma file 0md9BEFI1rU0aRAvf98TWO (pages 00 · Start here, 03 · Design system only)'],
        'inputs_unreadable': ['https://chatgpt.com/share/6ac35844-… (chatgpt.com blocked by the egress proxy)'],
        'inputs_missing': ['Atlas-Frontend-Acceptance.zip (run-1 handover)', 'Atlas-Frontend-UI-Readiness.{md,json}', 'Atlas-Archive-Canonical-Frontend.csv', 'Atlas-Screen-Inventory.csv',
                           'Atlas-State-Matrix.csv', 'Atlas-Lifecycle-State-Table.csv', 'Atlas-RBAC-Matrix.csv', 'Atlas-Field-Dictionary.csv', 'schema sources',
                           'Atlas-Source-Journeys-42.csv', 'Atlas-Original-UAT-113.csv', 'Atlas-UX-UAT-194.csv', 'Atlas-UIUX-Hardening.md', 'Atlas-E2E-Delivery.md',
                           'build/test logs', 'source frontend/workspace-web', 'AGENTS.md', 'Figma per-view pages (01/02 · Current UI)', 'v1 prompt (attachment.txt)'],
        'run_history': [dict(zip(['run', 'time', 'environment', 'scope', 'note'], r)) for r in RUN_HISTORY],
        'scripts_note': 'Run-1 scripts were not available, so tests.py / findings.py / coverage.py / build.py were rewritten with the same names and §8.2 schemas; record_r2.py and record_r3.py rebuild the ledgers from evidence.',
        'id_policy': 'Case IDs reuse run-1 names where the check is the same; engine variants are suffixed -FIREFOX/-WEBKIT, runner-side HTTP variants -GH. Findings continue at FND-017. Evidence IDs: 501+ (Cloudflare run), 601+ (GitHub Actions runs).',
        'capability_matrix': [
            {'capability': 'Cloudflare plugin read', 'status': 'AVAILABLE', 'limitation': 'GET only by policy', 'affected_cases': []},
            {'capability': 'Cloudflare Browser Rendering', 'status': 'USED, then quota-exhausted', 'limitation': 'headless Chromium, one page per request, ≤60 s, Workers Free 10 browser-min/day (exhausted 07:27Z)', 'affected_cases': []},
            {'capability': 'GitHub Actions + Playwright 1.56.1', 'status': 'AVAILABLE (from 07:53Z, after the Claude GitHub App became usable)', 'limitation': 'public repo: results are public; mirror committed encrypted only', 'affected_cases': []},
            {'capability': 'Trusted input', 'status': 'AVAILABLE (Playwright/CDP on GitHub Actions)', 'limitation': 'headless; no OS-level input', 'affected_cases': []},
            {'capability': 'Engines', 'status': 'Chromium 141.0.7390.37, Firefox 142.0.1, WebKit 26.0 (Playwright builds)', 'limitation': 'not branded Chrome/Safari/Edge', 'affected_cases': ['FE04-XENGINE-001']},
            {'capability': 'Performance traces / throttling', 'status': 'AVAILABLE (CDP: CPU 4×, 1.6/0.75 Mbps, 150 ms RTT; HeapProfiler)', 'limitation': 'GitHub runner hardware, not a real phone', 'affected_cases': ['PERF-007']},
            {'capability': 'Screenshots', 'status': 'AVAILABLE (72 JPEG committed)', 'limitation': 'viewport only', 'affected_cases': []},
            {'capability': 'Built-in Browser pane', 'status': 'UNAVAILABLE', 'limitation': 'cloud session without linked device', 'affected_cases': []},
            {'capability': 'Screen readers (NVDA/VoiceOver/TalkBack/iOS)', 'status': 'UNAVAILABLE', 'limitation': '', 'affected_cases': ['FE03-AT-001']},
            {'capability': 'Real devices', 'status': 'UNAVAILABLE', 'limitation': 'emulation only', 'affected_cases': ['FE02-COARSE-001']},
            {'capability': 'Figma MCP', 'status': 'AVAILABLE', 'limitation': 'file lacks per-view pages', 'affected_cases': ['FIGMA-001']},
            {'capability': 'Standards fetch', 'status': 'PARTIAL', 'limitation': 'w3.org / web.dev / chatgpt.com blocked; official editor sources read from raw.githubusercontent.com', 'affected_cases': []},
        ],
        'denominators': {'canonical_views': cov, 'tests': dict(counts, total=len(trows)), 'exclusions': []},
        'gates': gates, 'verdict': verdict,
        'synthetic_data': 'No user browser profile was touched. Cloudflare and GitHub Actions browsers are ephemeral; state written there: theme pref and the labelled fixture journal (IndexedDB) inside throw-away profiles. No production data written; no real service contacted (fixture origin https://fixture.atlas.test answered in-page).',
        'incidents': ['The cancelled CI run 37280321117 committed a plaintext byte mirror of the public release payload (work/release-mirror/) to the public branch; it was untracked in commit 41948df but remains in git history. Bytes are identical to what workers.dev serves publicly.'],
        'harness_defects_corrected': ['deeplink.js iframe reuse (hash-only src change fires no load) — fixed', 'runner hash check did not follow /index.html 307 — fixed', 'keyboard: end-of-tab-sequence counted as hidden, reopen started inside main, tablist remount, drawer read from wrong element — fixed in R3-004; R3-003 keyboard FAILs superseded'],
        'git': 'All commits pushed to origin/claude/sharp-thompson-5tff91.',
    }
    with open(P('Atlas-Frontend-Acceptance-Manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)

    L = []
    a = L.append
    a('# Atlas Frontend Production Acceptance — Báo cáo (run 2 + run 3, 2026-10-05)\n')
    a('```text\nFRONTEND ACCEPTANCE TARGET\n\nProvider: Cloudflare\nPrimary URL: ' + URL + '\nWorker deployment: ' + DEPLOY + ' (version ' + VERSION + ')\n'
      'Pages deployment: none\nSource revision: UNVERIFIED\nLocal build: UNVERIFIED\nRemote/local equivalence: UNVERIFIED\n\nVERDICT:\n' + verdict + '\n```\n')
    a('Phạm vi: 210 canonical view (denominator theo v2; **0/210 liệt kê được** vì thiếu inventory) · 18 module route · Chromium 141 / Firefox 142 / WebKit 26 (Playwright, GitHub Actions) + Chromium của Cloudflare Browser Rendering · AUDIT_ONLY. Backend không được chứng nhận.\n')
    nf = Counter(r['severity'] for r in frows if not r['status'].startswith('OPEN (inherited'))
    a(f"**Tóm tắt.** Deployment không đổi so với run 1; 120/120 payload khớp manifest. Routing, dialog, combobox, skip link, drawer mobile và hiệu năng tải trang đạt. "
      f"Verdict **{verdict}**: FE-02/03/04/05/06 có requirement bắt buộc FAIL — FND-018 (breadcrumb bị header che sau khi đổi view), FND-001 + FND-021 (tabs), FND-017 (title), FND-002 (CSP), FND-003 (cache), FND-022 (heap, budget giả định), FND-005 (toast cũ sau 401/hết phiên). "
      f"FE-01 INCOMPLETE vì thiếu inventory/spec/source. Không có P0; P1 chỉ có FND-004 và FND-012 (kế thừa, chưa retest được).\n")
    a('## 1. Sáu gate\n')
    a('| Gate | Kết quả | Có bằng chứng | Còn chặn / FAIL |\n|---|---|---|---|')
    for g in GATES:
        c = Counter(r['result'] for r in by_gate[g])
        a(f"| {g} {GATE_NAME[g]} | **{gates[g]}** | {GATE_NOTES[g][0]} — case: {sum(c.values())} (PASS {c['PASS']}, FAIL {c['FAIL']}, BLOCKED {c['BLOCKED']}, NOT_RUN {c['NOT_RUN']}, N/A {c['NOT_APPLICABLE']}) | {GATE_NOTES[g][1]} |")
    a('\n## 2. Implementation (210 canonical view)\n')
    a('| Trạng thái | Run 2+3 (OBSERVED) | Run 1 (INHERITED, chưa xác minh lại) |\n|---|---|---|')
    for k in ['COMPLETE', 'PARTIAL', 'NOT_IMPLEMENTED', 'UNVERIFIED']:
        a(f"| {k} | {cov['implementation_status'][k]} | {cov['inherited_run1'][k]} |")
    a('\nKhông view_id nào được suy ra từ tiêu đề/route (invariant 20). `Screen-Coverage.csv` giữ header với 0 hàng; `Route-Coverage.csv` (PROPOSED_EXTENSION) ghi 18 module route. Figma cho biết thiết kế có "184 Current views… 210 planned views" nhưng file không chứa page per-view.\n')
    a('## 3. Test denominator\n')
    a(f"| Total | PASS | FAIL | NOT_RUN | BLOCKED | NOT_APPLICABLE | Exclusions |\n|---|---|---|---|---|---|---|\n| {len(trows)} | {counts['PASS']} | {counts['FAIL']} | {counts['NOT_RUN']} | {counts['BLOCKED']} | {counts['NOT_APPLICABLE']} | 0 |\n")
    a('Mỗi biến thể engine là một case riêng (`-FIREFOX`, `-WEBKIT`); case tổng hợp (FE02-AUTO-216, FE03-KBD-001, FX-SERVICE-001, PERF-007, PERF-INP-001, FE04-XENGINE-001) được tính thêm. Không dùng % để bù gate.\n')
    a('## 4. Findings\n')
    a('| ID | Sev | Gate | Tiêu đề | Trạng thái | Retest |\n|---|---|---|---|---|---|')
    for r in frows:
        a(f"| {r['finding_id']} | {r['severity']} | {r['gate']} | {r['title']} | {r['status']} | {r['retest_case_ids']} |")
    a('\n**Top P0/P1**: không có P0. P1 kế thừa chưa retest: FND-004 (kỳ vọng 49/49 definition type tạo được; cần Field-Dictionary + schema_oracle), FND-012 (kỳ vọng mỗi view có case; cần inventory/spec/source). P2 mới/được xác nhận trong run 3: FND-018, FND-021, FND-001, FND-005.\n')
    a('## 5. Specifications / Code Intelligence / Agent Lifecycle\n')
    a('| Mảng | Đã chứng minh | Thiếu / chưa kiểm |\n|---|---|---|')
    a('| Specifications | Route render, deep link/reload 3 engine, tablist "Document inspector" theo APG (arrow/Home/End/roving) | FND-001/FND-021 (tabs); import/persistence/race/2-tab (SPEC-RETEST-001), Monaco gõ phím, tree (thư viện rỗng) chưa script |')
    a('| Code intelligence | Route render, 0 lỗi runtime | F12/references (CODE-008), 6 worker lifecycle (FE04-WORKER-001) chưa script — cần source snapshot mẫu |')
    a('| Agent lifecycle / service modules | FX-SERVICE trên #agents: 1 POST/double-click kèm Idempotency-Key + CSRF + If-Match; stage Received/Accepted/Rejected/Effective; mọi lỗi sau gửi ⇒ Unknown "do not resend"; journal ghi operation ID + evidence; observer không gửi lệnh | FND-005; 14 module còn lại chỉ đi qua cùng component ServiceModule (chưa chạy từng module); DTO chưa duyệt (FX-EXEC-001) |')
    a('\n## 6. Môi trường thực tế\n')
    a('| Lượt | Thời gian (UTC) | Môi trường | Phạm vi | Ghi chú |\n|---|---|---|---|---|')
    for r in RUN_HISTORY:
        a('| ' + ' | '.join(r) + ' |')
    a('\n- AT thật: không có (FE03-AT-001 NOT_RUN_AT; kịch bản thủ công ở Accessibility.md). Thiết bị thật: không có (emulation). Browser pane: không có.')
    a('- Kết quả của Cloudflare Browser Rendering và GitHub Actions được ghi thành case riêng (`-GH`, `-FIREFOX`, `-WEBKIT`); số liệu run 1 chỉ được trích dẫn với nhãn INHERITED.\n')
    a('## 7. Backend boundary\n')
    a('Xem `Atlas-Frontend-Backend-Dependencies.md`. DTO `atlas-ui/v1` vẫn "proposed"; FX-SERVICE chỉ chứng minh hành vi frontend với fixture có nhãn, không chứng minh service thật. 4xx-definitive (FND-006) SPEC_UNRESOLVED.\n')
    a('## 8. Deliverables\n')
    for f_ in ['Atlas-Frontend-Acceptance-Report.md / .html', 'Atlas-Frontend-Acceptance-Manifest.json', 'Atlas-Frontend-Screen-Coverage.csv (header, 0 hàng)', 'Atlas-Frontend-Route-Coverage.csv',
               'Atlas-Frontend-Test-Results.csv', 'Atlas-Frontend-Findings.csv', 'Atlas-Frontend-Journey-Results.csv (header)', 'Atlas-Frontend-UAT-Classification.csv (header)',
               'Atlas-Frontend-Accessibility.md', 'Atlas-Frontend-Performance.json / .md', 'Atlas-Frontend-Backend-Dependencies.md', 'Atlas-Frontend-Remediation-Plan.md',
               'Atlas-Frontend-Cloudflare-Deployment.md', 'evidence/ (runs R2-*, R3-*, 72 screenshots, standards, figma) + evidence-index.json (mọi path đã assert)', 'work/ (ledgers + scripts)',
               'harness/ (Browser Rendering scripts + Playwright suites + workflow)']:
        a(f'- {f_}')
    a('\n## 9. Exact remaining cases\n')
    a('| Case | Gate | Kết quả | Expected | Evidence | Lý do / cách nghiệm thu tiếp |\n|---|---|---|---|---|---|')
    for r in trows:
        if r['result'] in ('BLOCKED', 'NOT_RUN'):
            a(f"| {r['case_id']} | {r['gate']} | {r['result']} | {r['expected'][:160]} | {r['evidence_ids'] or '—'} | {r['reason'][:260]} |")
    a('\n## 10. Giới hạn và sự cố\n')
    a('- Không có source ⇒ không có COMPLETE; local/remote equivalence UNVERIFIED (chỉ chứng minh remote == manifest).')
    a('- Detector/axe chạy ở trạng thái mặc định và trạng thái kết nối fixture trên #agents; không suy ra cho 210 view.')
    a('- Harness có lỗi ở một số lượt (deeplink cũ, hash runner không theo redirect, 4 kiểm tra bàn phím ở R3-003); tất cả đã sửa và chạy lại, kết quả lỗi harness không được tính FAIL.')
    a('- Sự cố: run CI bị huỷ đã commit bản mirror plaintext của payload công khai lên branch public; đã gỡ khỏi cây (41948df) nhưng còn trong lịch sử git. Muốn xoá hẳn cần force-push (chưa làm, chờ chủ repo quyết định).')
    a('- Link ChatGPT người dùng gửi không đọc được (chatgpt.com bị proxy chặn).')
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
            dirs[:] = [d for d in dirs if d not in ('node_modules', '__pycache__', 'release-mirror', 'release-mirror.enc')]
            for fn in files:
                full = os.path.join(base, fn)
                z.write(full, os.path.join('frontend-acceptance', os.path.relpath(full, ROOT)))
        wf = os.path.join(REPO, '.github', 'workflows', 'atlas-acceptance.yml')
        z.write(wf, '.github/workflows/atlas-acceptance.yml')


if __name__ == '__main__':
    main()
