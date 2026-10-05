"""Build all run-2 deliverables from the ledgers. Run from frontend-acceptance/work/:  python3 build.py"""
import csv, json, os, zipfile, datetime, hashlib
from collections import Counter, defaultdict

import tests, findings, coverage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)            # frontend-acceptance/
REPO = os.path.dirname(ROOT)
P = lambda *a: os.path.join(ROOT, *a)
NOW = '2026-10-05T10:05Z'

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
    for name in ('evidence-r3.json', 'evidence-r4.json'):
        f = os.path.join(HERE, name)
        if os.path.exists(f):
            extra += [tuple(x) for x in json.load(open(f))]
    return EVIDENCE + extra


def build_evidence_index():
    idx = []
    for eid, path, ts, cases, etype, vp in all_evidence():
        full = P(path)
        assert os.path.exists(full), f'evidence path missing: {path}'
        idx.append({'evidence_id': eid, 'path': path, 'sha256': hashlib.sha256(open(full, 'rb').read()).hexdigest(), 'timestamp': ts,
                    'case_ids': cases, 'view_ids': 'see Atlas-Frontend-Screen-Coverage.csv (210 Figma views) / case view_id',
                    'build': 'atlas-static-release/v1@2026-10-04T10:09:42.397Z', 'deployment': f'{DEPLOY} / {VERSION}', 'fixture': 'none',
                    'browser': ('n/a (Figma MCP use_figma read-only / static read of hash-verified bundle)' if etype.startswith(('figma-oracle', 'deployed schema registry')) else
                                'Cloudflare Browser Rendering headless Chromium (UA Chrome/119)' if eid in ('EV-CF-501', 'EV-RT-501', 'EV-RT-502', 'EV-RESP-501', 'EV-RESP-502', 'EV-RESP-503', 'EV-RESP-504', 'EV-RESP-505')
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
    'FE-01': ('120/120 payload khớp manifest; 18/18 route deep link/reload 3 engine; 49/49 definition type tới được và đúng tiêu đề Figma; 49/49 số field + nhóm section khớp Figma; 46/46 type mở được khớp Figma đến từng field (855 control, 0 khác biệt); 210/210 view Figma đã ánh xạ',
              'FAIL: FND-004 (3/49 type không tạo được, 3 engine); thiết kế lệch Figma — FND-023 (IA điều hướng), FND-024 (tiêu đề 13/18, mô tả 18/18), FND-025 (273/421 điều khiển Figma không có); 0/210 view COMPLETE, 81 UNVERIFIED (FND-012)'),
    'FE-02': ('216/216 tổ hợp route×viewport×theme trên Chromium + Firefox/WebKit ở 5 width; 768–1920 sạch mọi engine; 72 ảnh chụp',
              'FAIL: FND-018 (breadcrumb nằm dưới header cố định sau khi đổi view — Chromium/WebKit, 320/375/1440); state/zoom/coarse chưa script'),
    'FE-03': ('axe-core 0 vi phạm (18 route, dark+light, mặc định); bàn phím thật PASS: skip link, Tab order + focus visible, Ctrl+K combobox, 2 dialog modal, drawer mobile, focus sau đổi view',
              'FAIL: FND-001 (tab↔tabpanel), FND-021 (mất focus khi Arrow trên tablist workspace), FND-017 (title), FND-018 (target bị che); AT NOT_RUN; axe connected/dialog NOT_RUN'),
    'FE-04': ('0 lỗi runtime; 6 worker phục vụ MIME đúng; routing đồng nhất 3 engine',
              'FAIL: không CSP/security headers (FND-002); worker lifecycle, IndexedDB, 2 tab, Monaco/F12 chưa script'),
    'FE-05': ('LCP p75 cold 168 ms / warm 80 ms / mobile throttled 1236 ms; CLS≈0; INP 40 ms (72 ms CPU 4×) — đạt budget khoá trước',
              'FAIL: asset băm max-age=0 (FND-003); heap +18,7%/30 chu kỳ vượt budget giả định (FND-022); workload lớn chưa chạy'),
    'FE-06': ('FX-SERVICE (fixture có nhãn, click thật): 14/16 PASS — 1 POST khi double-click, stage đúng, 4xx/5xx/mạng/timeout/mismatch ⇒ Unknown, 401/hết phiên ⇒ disconnect, observer không gửi lệnh',
              'FAIL: FND-005; journey Figma (42/174 bước): 1 PASS, 9 FAIL (FND-004 ×7, FND-018, FND-005), 160 BLOCKED (cần service thật / AT), 4 NOT_RUN; UAT 113+194 BLOCKED (Figma không chứa dòng UAT); FX-EXEC-001 SPEC_UNRESOLVED'),
}

RUN_HISTORY = [
    ('R2-001…004', '2026-10-05 06:58–07:27Z', 'Cloudflare Browser Rendering (headless Chromium, UA Chrome/119), synthetic-DOM', 'Phase 0b metadata, hash 120 payload, header/MIME/cache, discovery, deep link/reload/history, FE02 320–1440', 'Hết quota Free 10 phút/ngày lúc 07:27Z'),
    ('R3-001 (run 37280321117)', '07:54–08:05Z', 'GitHub Actions, Playwright 1.56.1: Chromium 141 / Firefox 142 / WebKit 26', 'mirror, discovery, axe dark/light, FE02 1920 + Firefox/WebKit 320/1920', 'Bị huỷ; bước commit vẫn chạy và đẩy bản mirror plaintext (đã gỡ khỏi cây ở 41948df). Deeplink script cũ treo (lỗi harness)'),
    ('run 37281392041', '08:05–08:23Z', 'như trên', 'keyboard/perf/screenshots', 'Kết quả mất do xung đột commit (đã sửa workflow); chạy lại ở R3-003'),
    ('R3-002 (run 37282601201)', '08:24–08:29Z', 'như trên', 'mirror (redirect fixed), deeplink 3 engine, FE02 Firefox/WebKit 375/768/1440, FX-SERVICE 14 kịch bản, layout hit-test', 'OK'),
    ('R3-003 (run 37284006443)', '08:30–08:35Z', 'như trên, trusted input + CDP', 'keyboard 3 engine, perf (cold/warm/mobile, INP, heap), 72 screenshots', 'Keyboard: 4 lỗi harness (đã sửa, không tính FAIL)'),
    ('R3-004 (run 37285038578)', '08:40–08:42Z', 'như trên', 'keyboard 3 engine (harness đã sửa), INP ≥30 tương tác, heap 30/60/90 chu kỳ', 'OK'),
    ('Figma read (run 4)', '09:00–09:55Z', 'Figma MCP use_figma (Plugin API, chỉ đọc)', '10 page; Planned inventory 210; 18+18 frame module; 49 frame unified fields (852 field); journey register, decision register, traceability 174 bước', 'Sửa kết luận sai "chỉ có 2 page" của run 2–3'),
    ('R4-001 (run 37289868204)', '09:25–09:28Z', 'GitHub Actions, Chromium 141, click thật', 'Figma parity 18 route × dark/light (+70 ảnh); definitions 49 type', 'Definitions: 2 lỗi harness (view lazy-load chưa đợi; khoảng trắng nhãn section) — kết quả definitions bị thay bằng R4-002, không tính FAIL'),
    ('R4-002 (run 37290670654)', '09:33–09:36Z', 'GitHub Actions, Chromium 141 + Firefox 142 + WebKit 26', 'definitions 49 type (harness đã sửa) + FND-004 trên Firefox/WebKit', 'OK'),
]


def main():
    trows = sorted(tests.load(), key=lambda r: r['case_id'])
    frows = findings.load()
    cov = coverage.build()
    idx = build_evidence_index()

    write_csv(P('Atlas-Frontend-Test-Results.csv'), tests.COLS, trows)
    write_csv(P('Atlas-Frontend-Findings.csv'), findings.COLS, frows)
    jrows = json.load(open(os.path.join(HERE, 'journeys-r4.json'))) if os.path.exists(os.path.join(HERE, 'journeys-r4.json')) else []
    for r in jrows:
        for e in filter(None, r['evidence_ids'].split(',')):
            assert e in {x['evidence_id'] for x in idx}, f"{r['step_id']} references unknown evidence {e}"
    write_csv(P('Atlas-Frontend-Journey-Results.csv'), ['journey_id', 'step_id', 'title', 'actor', 'fixture_id', 'view_ids', 'expected', 'actual', 'result', 'evidence_ids', 'reason', 'run_at'], jrows)
    par = json.load(open(os.path.join(HERE, 'parity-r4.json')))
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
        'run_id': 'R2+R3+R4-2026-10-05', 'prompt': 'Atlas-Frontend-Acceptance-Master-Prompt-v2 (handover edition)', 'mode': 'MODE_FRESH',
        'mode_reason': 'No handover package (Atlas-Frontend-Acceptance.zip) or ledger in this session ⇒ MODE_FRESH per v2 §0.2. Deployment identity re-verified identical to run 1 (MATCH). Run-1 facts quoted in the prompt are labelled INHERITED_EVIDENCE.',
        'resumed_from': None, 'generated_at': NOW, 'audit_mode': 'AUDIT_ONLY',
        'target': {'provider': 'Cloudflare', 'primary_url': URL, 'url_class': 'PRIMARY_ACCEPTANCE_URL = WORKER_URL', 'worker': 'sparkling-snow-090d',
                   'worker_deployment_id': DEPLOY, 'worker_version_id': VERSION, 'pages_deployment': 'none', 'custom_domains': [], 'routes': [],
                   'identity_vs_run1': 'MATCH', 'account_id': '[REDACTED]'},
        'release': {'manifest_format': 'atlas-static-release/v1', 'createdAt': '2026-10-04T10:09:42.397Z', 'payloads': 120, 'remote_hash_matches': '120/120 (Cloudflare browser 07:04Z; GitHub runner 08:24Z)',
                    'manifest_bytes_sha256': '0bf5b0288ac6ca988130961b8da55d18637a07dbf9a3d09ca97d5e1e4c09edd3', 'manifest_status_field': 'BUILT_NOT_DEPLOYED_NOT_PRODUCTION_CERTIFIED'},
        'source': {'revision': None, 'reason': 'source frontend/workspace-web not provided'}, 'local_build': None, 'local_remote_equivalence': 'UNVERIFIED',
        'inputs_present': ['Atlas-Frontend-Acceptance-Master-Prompt-v2.md', 'Figma file 0md9BEFI1rU0aRAvf98TWO — 10 pages (00 Start here, 01/02 Current UI Dark/Light, 03 Design system, 04 E2E Model, 05/06 Gap closure, 07 Prototype flows, 08 Dev handoff, 90 Archive); used as design source of truth for the 210-view inventory, Current UI parity, 49 field contracts, 42 journeys / 174 steps and the decision register'],
        'input_corrections': ['Runs 2–3 reported that the Figma file had only 2 pages; wrong — get_metadata lists only loaded pages. Run 4 read all 10 pages through the Plugin API and re-evaluated FIGMA-001, FE01-210-001, DEF-RETEST-FND-004 and FE06-UXJ-042.'],
        'inputs_unreadable': ['https://chatgpt.com/share/6ac35844-… (chatgpt.com blocked by the egress proxy)'],
        'inputs_missing': ['Atlas-Frontend-Acceptance.zip (run-1 handover)', 'Atlas-Frontend-UI-Readiness.{md,json}', 'Atlas-Archive-Canonical-Frontend.csv', 'Atlas-Screen-Inventory.csv',
                           'Atlas-State-Matrix.csv', 'Atlas-Lifecycle-State-Table.csv', 'Atlas-RBAC-Matrix.csv', 'Atlas-Field-Dictionary.csv', 'schema sources',
                           'Atlas-Source-Journeys-42.csv (superseded by Figma traceability)', 'Atlas-Original-UAT-113.csv', 'Atlas-UX-UAT-194.csv', 'Atlas-UIUX-Hardening.md', 'Atlas-E2E-Delivery.md',
                           'build/test logs', 'source frontend/workspace-web', 'AGENTS.md', 'v1 prompt (attachment.txt)'],
        'inputs_note': 'Atlas-Screen-Inventory.csv / Atlas-Field-Dictionary.csv are replaced by the Figma Planned inventory (342:5) and the 49 unified-fields frames.',
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
            {'capability': 'Figma MCP', 'status': 'AVAILABLE (use_figma Plugin API read-only; all 10 pages)', 'limitation': 'get_metadata lists only loaded pages (cause of the run-2/3 error); frame renders not downloadable from the sandbox (figma.com blocked) ⇒ text/structure parity, no pixel diff', 'affected_cases': ['FIGMA-001']},
            {'capability': 'Standards fetch', 'status': 'PARTIAL', 'limitation': 'w3.org / web.dev / chatgpt.com blocked; official editor sources read from raw.githubusercontent.com', 'affected_cases': []},
        ],
        'denominators': {'canonical_views': cov, 'tests': dict(counts, total=len(trows)), 'exclusions': []},
        'gates': gates, 'verdict': verdict,
        'synthetic_data': 'No user browser profile was touched. Cloudflare and GitHub Actions browsers are ephemeral; state written there: theme pref and the labelled fixture journal (IndexedDB) inside throw-away profiles. No production data written; no real service contacted (fixture origin https://fixture.atlas.test answered in-page).',
        'incidents': ['The cancelled CI run 37280321117 committed a plaintext byte mirror of the public release payload (work/release-mirror/) to the public branch; it was untracked in commit 41948df but remains in git history. Bytes are identical to what workers.dev serves publicly.'],
        'harness_defects_corrected': ['R4-001 definitions: lazily loaded Definitions view not awaited (9 false DEF-NAV FAIL) and section label/count spacing (49 false DEF-COUNT FAIL) — fixed, superseded by R4-002', 'deeplink.js iframe reuse (hash-only src change fires no load) — fixed', 'runner hash check did not follow /index.html 307 — fixed', 'keyboard: end-of-tab-sequence counted as hidden, reopen started inside main, tablist remount, drawer read from wrong element — fixed in R3-004; R3-003 keyboard FAILs superseded'],
        'git': 'All commits pushed to origin/claude/sharp-thompson-5tff91.',
    }
    with open(P('Atlas-Frontend-Acceptance-Manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)

    L = []
    a = L.append
    T = {r['case_id']: r for r in trows}
    ist = cov['implementation_status']; fr = cov['functional_result']
    jc = Counter(r['result'] for r in jrows)
    a('# Atlas Frontend Production Acceptance — Báo cáo (run 2 + 3 + 4, 2026-10-05)\n')
    a('```text\nFRONTEND ACCEPTANCE TARGET\n\nProvider: Cloudflare\nPrimary URL: ' + URL + '\nWorker deployment: ' + DEPLOY + ' (version ' + VERSION + ')\n'
      'Pages deployment: none\nSource revision: UNVERIFIED\nLocal build: UNVERIFIED\nRemote/local equivalence: UNVERIFIED\n\nVERDICT:\n' + verdict + '\n```\n')
    a('Phạm vi: **210 view theo Planned inventory của Figma** (file `0md9BEFI1rU0aRAvf98TWO`, node 342:5) · 18 module route · 49 definition type · 42 journey / 174 bước (traceability Figma) · '
      'Chromium 141 / Firefox 142 / WebKit 26 (Playwright, GitHub Actions) + Chromium của Cloudflare Browser Rendering · AUDIT_ONLY. Backend không được chứng nhận.\n')
    a('> **Đính chính:** run 2–3 ghi "file Figma chỉ có 2 page" — sai. `get_metadata` chỉ liệt kê page đã tải; Plugin API cho thấy đủ 10 page. Run 4 dùng Figma làm chuẩn cho inventory 210 view, '
      'so sánh Current UI, field contract 49 type và 174 bước journey. Xem `evidence/figma/start-here-metadata.md`.\n')
    a('## 0. Đã nghiệm thu được gì (run 4, theo Figma)\n')
    a('| Hạng mục | Kết quả trên bản deploy | Case |\n|---|---|---|')
    a(f"| Definition type tới được từ UI module, tiêu đề đúng Figma | **49/49 PASS** | DEF-NAV-* |")
    a(f"| Số field + nhóm section (tên, thứ tự, số lượng) đúng Figma | **49/49 PASS** | DEF-COUNT-* |")
    a(f"| Field contract đúng Figma (key, nhãn, bắt buộc, đơn vị, min/max, option) | **46/46 type mở được PASS — 855 control, 0 khác biệt**; 3 type BLOCKED do FND-004 | DEF-FIELDS-* |")
    a(f"| Tạo definition cục bộ | **46/49 PASS**; 3 FAIL trên cả Chromium/Firefox/WebKit (FND-004) | DEF-CREATE-*, DEF-RETEST-FND-004 |")
    a(f"| Không có dữ liệu giả/mock trong bản production; action bảo vệ luôn hiển thị kèm lý do chặn | PASS | OBS-NOMOCK-001, OBS-BLOCKERS-001 |")
    a(f"| Giao diện so với Figma Current UI (18 route × dark/light) | **FAIL 36/36** — tiêu đề trùng {len(par['title_exact'])}/18, mô tả 0/18, IA điều hướng {par['nav_exact']}/{par['nav_total']}, thiếu {par['ctl_miss']}/{par['ctl_total']} điều khiển Figma | FIGMA-001, FIGMA-PARITY-* |")
    a(f"| 210 view của Figma | COMPLETE {ist['COMPLETE']} · PARTIAL {ist['PARTIAL']} · NOT_IMPLEMENTED {ist['NOT_IMPLEMENTED']} · UNVERIFIED {ist['UNVERIFIED']}; chức năng phía frontend: PASS {fr.get('PASS', 0)}, FAIL {fr.get('FAIL', 0)}, BLOCKED {fr.get('BLOCKED', 0)}, NOT_RUN {fr.get('NOT_RUN', 0)} | FE01-210-001 |")
    a(f"| 174 bước journey (Figma) | PASS {jc['PASS']} · FAIL {jc['FAIL']} · BLOCKED {jc['BLOCKED']} · NOT_RUN {jc['NOT_RUN']} | FE06-UXJ-042 |\n")
    nf = Counter(r['severity'] for r in frows if not r['status'].startswith('OPEN (inherited'))
    a(f"**Tóm tắt.** Deployment không đổi; 120/120 payload khớp manifest. Phần authoring (49 definition type) khớp Figma đến từng field, trừ 3 type không tạo được (FND-004, P1). "
      f"Giao diện module **không** theo Figma Current UI: IA điều hướng, tiêu đề, mô tả và bố cục/điều khiển khác (FND-023/024/025). Verdict **{verdict}**: mọi gate có requirement bắt buộc FAIL "
      f"— FE-01 (FND-004, lệch thiết kế), FE-02 (FND-018), FE-03 (FND-001/021/017/018), FE-04 (FND-002), FE-05 (FND-003/022), FE-06 (FND-005, FND-004 chặn journey). Không có P0; P1: FND-004, FND-012.\n")
    a('## 1. Sáu gate\n')
    a('| Gate | Kết quả | Có bằng chứng | Còn chặn / FAIL |\n|---|---|---|---|')
    for g in GATES:
        c = Counter(r['result'] for r in by_gate[g])
        a(f"| {g} {GATE_NAME[g]} | **{gates[g]}** | {GATE_NOTES[g][0]} — case: {sum(c.values())} (PASS {c['PASS']}, FAIL {c['FAIL']}, BLOCKED {c['BLOCKED']}, NOT_RUN {c['NOT_RUN']}, N/A {c['NOT_APPLICABLE']}) | {GATE_NOTES[g][1]} |")
    a('\n## 2. Implementation (210 view của Figma Planned inventory)\n')
    a('| Trạng thái | Run 4 (OBSERVED) | Run 1 (INHERITED, đã thay thế) |\n|---|---|---|')
    for k in ['COMPLETE', 'PARTIAL', 'NOT_IMPLEMENTED', 'UNVERIFIED']:
        a(f"| {k} | {ist[k]} | {cov['inherited_run1'][k]} |")
    a(f"\nQuy tắc (coverage.py): mỗi view nối với bản deploy qua (a) node Current UI trong inventory → frame → route, (b) registry schema của chính bundle đã deploy (49 schema ↔ view slug), kiểm chứng runtime bằng DEF-*. "
      f"{cov['views_with_figma_frame']} view có frame Current, {cov['views_with_schema']} view có form authoring. PARTIAL = có route/form nhưng màn hình riêng theo Figma chưa có và parity FAIL. "
      "UNVERIFIED (81) = 10 mục Figma đánh dấu review-scope + 71 route/state chỉ xuất hiện khi có điều kiện service (dữ liệu run, quyền bị thu hồi…) hoặc dữ liệu seed cục bộ — không chứng minh được là thiếu, nên **không** gán NOT_IMPLEMENTED. "
      "Không view nào COMPLETE: chính inventory Figma xếp 4 view tốt nhất là \"Present · visual (not code-ready)\". Figma presence: " + ', '.join(f'{k} {v}' for k, v in cov['figma_presence'].items()) + '.\n')
    a('## 3. Figma Current UI vs bản deploy (1440×1000, Chromium 141)\n')
    a('| Route | Frame Figma (Dark) | h1 Figma | h1 deploy | Mô tả | Điều khiển Figma: exact / tương đương / thiếu | Dark | Light |\n|---|---|---|---|---|---|---|---|')
    parj = json.load(open(P('evidence/runs/R4-001-figma/figma_parity/figma-parity.json')))['routes']
    for k, v in parj.items():
        if not k.startswith('dark:'):
            continue
        cc = Counter(c['result'] for c in v['controls'])
        rt = v['route']
        a(f"| #{rt} | {v['figma_frame']} | {v['figma_title']} | {v['h1']} ({v['title_result']}) | {v['purpose_result']} | {cc['EXACT']} / {cc['EQUIVALENT']} / {cc['MISSING'] + cc['SIMILAR']} của {len(v['controls'])} | "
          f"**{T.get(f'FIGMA-PARITY-{rt.upper()}-DARK', {}).get('result', '—')}** | **{T.get(f'FIGMA-PARITY-{rt.upper()}-LIGHT', {}).get('result', '—')}** |")
    a(f"\nĐiều hướng: Figma BUILD / KNOWLEDGE & SERVICES / ADMINISTRATION, bản deploy {T['FIGMA-PARITY-NAV']['actual'][:400]}. Ảnh chụp: `evidence/runs/R4-001-figma/figma_parity/{{dark,light}}/*.jpg` (70). "
      "Không so pixel được (sandbox không tải được ảnh render Figma); phần nội dung minh hoạ trong frame (\"Design example\") bị loại khỏi oracle.\n")
    a('## 4. Field contract 49 definition type (oracle = frame "unified fields")\n')
    a('| Type | Route | Figma field | Tới được | Tạo | Số field + section | Field contract |\n|---|---|---|---|---|---|---|')
    dor = json.load(open(P('evidence/figma/definition-field-oracle-49.json')))['types']
    for t in dor:
        sid = t['schema_label']
        a(f"| {t['title']} | #{t['route']} | {t['field_count']} | {T.get('DEF-NAV-' + sid, {}).get('result', '—')} | **{T.get('DEF-CREATE-' + sid, {}).get('result', '—')}** | {T.get('DEF-COUNT-' + sid, {}).get('result', '—')} | {T.get('DEF-FIELDS-' + sid, {}).get('result', '—')} |")
    a('\n## 5. Journey (Figma traceability: 42 journey / 174 bước)\n')
    a('Mỗi bước: phần frontend quan sát được kiểm bằng case hiện có; phần ORACLE cần receipt của service thật ⇒ BLOCKED_BACKEND. Chi tiết 174 dòng: `Atlas-Frontend-Journey-Results.csv`.\n')
    a('| Kết quả | Số bước | Ví dụ |\n|---|---|---|')
    for res in ['PASS', 'FAIL', 'NOT_RUN', 'BLOCKED']:
        ex = [r for r in jrows if r['result'] == res]
        a(f"| {res} | {len(ex)} | " + '; '.join(f"{r['step_id']} {r['title']} — {r['reason'][:90]}" for r in ex[:4]) + ' |')
    a('\nFigma cũng có 14 journey DESIGN_V8 (J01–J14) và 8 journey xuyên suốt (X01–X08) ở page 07, khác namespace với UXJ-01…42; Figma ghi tất cả "Prototype NOT_VERIFIED · UAT NOT_RUN". '
      'Decision register: 28 quyết định (D01–D14, UXD-01–14) + EX-LOCK-03 + OBSERVER_READ_ONLY + API TBD đều "Proposed not approved" — liên quan FND-006, FND-012, BE-01.\n')
    a('## 6. Test denominator\n')
    a(f"| Total | PASS | FAIL | NOT_RUN | BLOCKED | NOT_APPLICABLE | Exclusions |\n|---|---|---|---|---|---|---|\n| {len(trows)} | {counts['PASS']} | {counts['FAIL']} | {counts['NOT_RUN']} | {counts['BLOCKED']} | {counts['NOT_APPLICABLE']} | 0 |\n")
    a('Mỗi biến thể engine/theme là một case riêng; case tổng hợp (FIGMA-001, DEF-FIGMA-001, FE01-210-001, FE06-UXJ-042, FE02-AUTO-216, FE03-KBD-001, FX-SERVICE-001, PERF-007, PERF-INP-001, FE04-XENGINE-001) được tính thêm. Không dùng % để bù gate.\n')
    a('## 7. Findings\n')
    a('| ID | Sev | Gate | Tiêu đề | Trạng thái | Retest |\n|---|---|---|---|---|---|')
    for r in frows:
        a(f"| {r['finding_id']} | {r['severity']} | {r['gate']} | {r['title']} | {r['status']} | {r['retest_case_ids']} |")
    a('\n**Top P0/P1**: không có P0. P1: FND-004 (xác nhận lại run 4 trên 3 engine — 3 type có "/" trong tiêu đề không tạo được, chặn 7 bước journey và 9 view); FND-012 (0/210 COMPLETE, 81 UNVERIFIED). '
      'P2 mới ở run 4: FND-023/024/025 (lệch thiết kế Figma).\n')
    a('## 8. Specifications / Code Intelligence / Agent Lifecycle\n')
    a('| Mảng | Đã chứng minh | Thiếu / chưa kiểm |\n|---|---|---|')
    a('| Specifications | Route + deep link 3 engine; Document properties & Specification submission request: tạo được, field contract khớp Figma; tablist "Document inspector" theo APG | Tiêu đề/mô tả/điều khiển khác Figma (FND-024/025); FND-001/FND-021; Monaco, import, history/diff (UNVERIFIED) chưa script |')
    a('| Code intelligence | Route; Repository connection, Code index policy, Source query khớp Figma | FND-025 (thiếu "Import folder", "Analyze JS/TS", "Symbols & quality"…); F12/worker chưa script |')
    a('| Agent / resource / service modules | 49/49 type tới được; 46 type tạo + khớp field; FX-SERVICE: 1 POST/double-click, stage đúng, Unknown "do not resend", 401 ⇒ disconnect | FND-004 (Retry / resume, Archive / transfer / deletion, Data export / erasure); FND-005; bố cục service records khác Figma (FND-025) |')
    a('\n## 9. Môi trường thực tế\n')
    a('| Lượt | Thời gian (UTC) | Môi trường | Phạm vi | Ghi chú |\n|---|---|---|---|---|')
    for r in RUN_HISTORY:
        a('| ' + ' | '.join(r) + ' |')
    a('\n- AT thật: không có (FE03-AT-001, UXJ-40-S05). Thiết bị thật: không có. Browser pane: không có. figma.com bị proxy chặn ⇒ không tải ảnh render Figma.\n')
    a('## 10. Backend boundary\n')
    a('Xem `Atlas-Frontend-Backend-Dependencies.md`. DTO `atlas-ui/v1` vẫn "proposed" (Figma decision register: "API TBD — 49 authoring schemas AUTHORING_PROPOSAL"); 160/174 bước journey BLOCKED_BACKEND.\n')
    a('## 11. Deliverables\n')
    for f_ in ['Atlas-Frontend-Acceptance-Report.md / .html', 'Atlas-Frontend-Acceptance-Manifest.json', 'Atlas-Frontend-Screen-Coverage.csv (210 hàng, theo Figma)', 'Atlas-Frontend-Route-Coverage.csv (18 route)',
               'Atlas-Frontend-Test-Results.csv', 'Atlas-Frontend-Findings.csv', 'Atlas-Frontend-Journey-Results.csv (174 bước)', 'Atlas-Frontend-UAT-Classification.csv (header — Figma không chứa dòng UAT)',
               'Atlas-Frontend-Accessibility.md', 'Atlas-Frontend-Performance.json / .md', 'Atlas-Frontend-Backend-Dependencies.md', 'Atlas-Frontend-Remediation-Plan.md',
               'Atlas-Frontend-Cloudflare-Deployment.md', 'evidence/figma/ (inventory 210, frame map, field oracle 49, journey trace 174, page list + đính chính)', 'evidence/runs R2-*, R3-*, R4-* (+ 70 ảnh parity, 49 ảnh definitions) + evidence-index.json',
               'work/ (ledgers + scripts: figma_data.py, figma_journeys.py, record_r2/3/4.py, coverage.py, build.py)', 'harness/ (Playwright suites figma_parity.mjs, definitions.mjs, …)']:
        a(f'- {f_}')
    a('\n## 12. Exact remaining cases\n')
    a('| Case | Gate | Kết quả | Expected | Evidence | Lý do / cách nghiệm thu tiếp |\n|---|---|---|---|---|---|')
    for r in trows:
        if r['result'] in ('BLOCKED', 'NOT_RUN'):
            a(f"| {r['case_id']} | {r['gate']} | {r['result']} | {r['expected'][:160]} | {r['evidence_ids'] or '—'} | {r['reason'][:260]} |")
    a('\n## 13. Giới hạn và sự cố\n')
    a('- Không có source ⇒ không có COMPLETE; local/remote equivalence UNVERIFIED (chỉ chứng minh remote == manifest).')
    a('- Figma parity đo trên text/cấu trúc (tiêu đề, mô tả, IA, điều khiển, field contract); không so pixel. Nội dung minh hoạ trong frame bị loại.')
    a('- Registry schema đọc tĩnh từ bundle đã deploy (hash khớp manifest) chỉ dùng để nối view ↔ form; mọi kết luận PASS/FAIL đến từ chạy runtime.')
    a('- Harness có lỗi ở một số lượt (deeplink cũ, hash runner, 4 kiểm tra bàn phím R3-003, 2 lỗi definitions R4-001); tất cả đã sửa và chạy lại, kết quả lỗi harness không tính FAIL.')
    a('- Sự cố: run CI bị huỷ đã commit bản mirror plaintext của payload công khai; đã gỡ khỏi cây (41948df) nhưng còn trong lịch sử git (chờ chủ repo quyết định force-push).')
    a('- Đính chính: kết luận "Figma chỉ có 2 page" của run 2–3 là sai và đã được thay ở run 4.')
    a(f'\n_Generated {NOW} từ work/tests.json + work/findings.json + work/journeys-r4.json bằng work/build.py._\n')
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
