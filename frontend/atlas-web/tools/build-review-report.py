"""Generate a factual Vietnamese acceptance report from retained local evidence."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument('evidence', type=Path)
ap.add_argument('output', type=Path)
ap.add_argument('--source-checkpoint', help='Tested runtime checkpoint before evidence-only commits.')
args = ap.parse_args()
root = Path(__file__).resolve().parents[1]
base = '4737b155e9f106bc7351c271d19ef207cfbb9a66'
files = {'functional': 'e2e-initial-all-engines.json', 'final_ui': 'final-ui-all-engines.json', 'final_focus': 'final-focus-all-engines.json', 'ides_final': 'ides-final-all-engines.json', 'a11y_recheck': 'a11y-recheck-all-engines.json', 'visual': 'visual-chromium.json', 'visual_mobile': 'visual-mobile-final.json', 'visual_graph': 'graph-visual-final.json', 'review': 'review-all-engines.json', 'graph_review': 'graph-review-final.json', 'performance': 'perf-final.json', 'performance_initial': 'perf-initial.json'}
results = {key: json.loads((args.evidence / file).read_text()) for key, file in files.items()}
stats = {key: value['stats'] for key, value in results.items()}
assert all(s['unexpected'] == 0 and s['flaky'] == 0 and s['expected'] > 0 for key, s in stats.items() if key not in ['functional', 'final_ui', 'final_focus', 'performance_initial']), 'A failed or flaky recheck suite cannot produce a green report.'
unit = json.loads((args.evidence / 'unit-final.json').read_text())
assert unit['numFailedTests'] == 0 and unit['numPassedTests'] == 54
perf = [json.loads(line.split(' ', 2)[2]) | {'route': line.split(' ', 2)[1]} for line in (args.evidence / 'perf-final.log').read_text().splitlines() if line.startswith('PERF ')]
assert len(perf) == 8 and all(0 < m['lcp'] < 2500 and m['cls'] < 0.1 and m['jsBytes'] < 512 * 1024 for m in perf)
assert stats['performance']['expected'] == 8 and all(not m['editorLoaded'] for m in perf if m['route'] in ['/specifications', '/code'])
parity = {}
for module, hit, total, extra in re.findall(r'^PARITY (\S+) (\d+)/(\d+)(.*)', (args.evidence / 'final-ui-all-engines.log').read_text(), re.M):
    row = (int(hit), int(total), extra.replace(' missing: ', '').strip().replace(' | ', '; ') or '—')
    assert module not in parity or parity[module] == row
    parity[module] = row
parity_hit = sum(x[0] for x in parity.values())
parity_total = sum(x[1] for x in parity.values())
assert len(parity) == 18 and parity_total == 457
manifest = json.loads((root / 'src/generated/manifest.json').read_text())
shortlist = json.loads((root / 'ui-review/archive-shortlist.json').read_text())
sha = args.source_checkpoint or subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
source_hash = hashlib.sha256()
for file in sorted((root / 'src').rglob('*')):
    if file.is_file() and '.test.' not in file.name:
        source_hash.update(str(file.relative_to(root)).encode())
        source_hash.update(b'\0')
        source_hash.update(file.read_bytes())
log = subprocess.check_output(['git', 'log', '--reverse', '--format=%H%x09%s', f'{base}..{sha}'], cwd=root, text=True)
commits = [{'sha': line.split('\t', 1)[0], 'title': line.split('\t', 1)[1]} for line in log.splitlines()]
(root / 'ui-review/code-commits.json').write_text(json.dumps(commits, indent=2, ensure_ascii=False) + '\n')

def project_counts(result):
    counts = {}
    def walk(suite):
        for spec in suite.get('specs', []):
            for test in spec.get('tests', []):
                project = test['projectName']
                entry = counts.setdefault(project, {'expected': 0, 'skipped': 0, 'unexpected': 0, 'flaky': 0})
                entry[test['status']] += 1
        for child in suite.get('suites', []):
            walk(child)
    for suite in result['suites']:
        walk(suite)
    return counts

projects = {key: project_counts(value) for key, value in results.items()}

# This is a derived coverage inventory, not a fabricated green Playwright run.
# Keep the failed initial run unchanged and require every failure to be covered
# by a later passing run with the same project/file/describe/test identity.
def cases(result, source):
    rows = {}
    def walk(suite, trail):
        path = [*trail, suite['title']]
        for spec in suite.get('specs', []):
            for test in spec.get('tests', []):
                key = json.dumps([test['projectName'], Path(spec['file']).name, path, spec['title']], ensure_ascii=False)
                rows[key] = {'project': test['projectName'], 'file': spec['file'], 'title': spec['title'], 'status': test['status'], 'source': source}
        for child in suite.get('suites', []):
            walk(child, path)
    for suite in result['suites']:
        walk(suite, [])
    return rows

initial = cases(results['functional'], files['functional'])
latest = dict(initial)
for key in ['final_ui', 'a11y_recheck', 'final_focus', 'ides_final']:
    latest.update(cases(results[key], files[key]))
initial_failures = {key: value for key, value in initial.items() if value['status'] not in ['expected', 'skipped']}
focus_failures = {key: value for key, value in cases(results['final_ui'], files['final_ui']).items() if value['status'] not in ['expected', 'skipped']}
assert all(latest[key]['status'] == 'expected' and latest[key]['source'] in [files['final_focus'], files['ides_final']] for key in focus_failures), 'A UI follow-up failure remains unverified.'
ides_failures = {key: value for key, value in cases(results['final_focus'], files['final_focus']).items() if value['status'] not in ['expected', 'skipped']}
assert all(latest[key]['status'] == 'expected' and latest[key]['source'] == files['ides_final'] for key in ides_failures), 'An editor readiness failure remains unverified.'
assert all(latest[key]['status'] == 'expected' and latest[key]['source'] != files['functional'] for key in initial_failures), 'An initial failure remains unverified.'
assert all(value['status'] in ['expected', 'skipped'] for value in latest.values()), 'Latest coverage still contains a failure.'
coverage_projects = {}
for value in latest.values():
    count = coverage_projects.setdefault(value['project'], {'expected': 0, 'skipped': 0, 'unexpected': 0, 'flaky': 0})
    count[value['status']] += 1
coverage_stats = {k: sum(p[k] for p in coverage_projects.values()) for k in ['expected', 'skipped', 'unexpected', 'flaky']}
coverage = {'kind': 'derived_unique_case_coverage', 'sources': [files[k] for k in ['functional', 'final_ui', 'a11y_recheck', 'final_focus', 'ides_final']], 'stats': coverage_stats, 'projects': coverage_projects, 'initial_stats': stats['functional'], 'initial_failures_rechecked': list(initial_failures.values()), 'followup_failures_rechecked': list(focus_failures.values()), 'editor_failures_rechecked': list(ides_failures.values()), 'latest_cases': list(latest.values())}
(args.evidence / 'e2e-coverage.json').write_text(json.dumps(coverage, indent=2, ensure_ascii=False)+'\n')
evidence_hashes = {file: hashlib.sha256((args.evidence / file).read_bytes()).hexdigest() for file in [*files.values(), 'unit-final.json', 'perf-final.log', 'perf-initial.log']}
verification = {
    'source_commit': sha, 'base_commit': base, 'source_sha256': source_hash.hexdigest(),
    'stats': stats, 'projects': projects, 'validated_coverage': coverage_stats, 'coverage_projects': coverage_projects, 'initial_failures_rechecked': list(initial_failures.values()), 'followup_failures_rechecked': list(focus_failures.values()), 'editor_failures_rechecked': list(ides_failures.values()), 'unit': {'passed': unit['numPassedTests'], 'failed': unit['numFailedTests'], 'files': len(unit['testResults'])},
    'performance': perf, 'parity': {'hit': parity_hit, 'total': parity_total, 'modules': parity}, 'design_counts': manifest['counts'], 'evidence_sha256': evidence_hashes,
    'deployed': False, 'pushed': False, 'current_ci': 'not_verified_push_blocked_by_auto_review',
    'push_blocked_reason': 'Remote and external source/artifact transfer were not explicitly authorized; automatic approval review rejected the push.',
    'firefox': 'local_functional_and_review_passed', 'webkit': 'local_functional_and_review_passed',
    'manual_assistive_technology': 'not_run', 'live_business_backend': 'not_provided',
    'production_origin_cookie_isolation': 'not_accepted', 'ui_approval_before_deploy': 'pending',
    'final_ui_delta': 'mobile breadcrumb/scope layout, lazy heading and input focus, Observer disconnected status tone, Memory/Identity panel data mapping and SVG dependency edge clipping; affected suites rerun',
}
(root / 'ui-review/verification.json').write_text(json.dumps(verification, indent=2, ensure_ascii=False) + '\n')
counts = manifest['counts']
text = f'''# Atlas — triển khai frontend và nghiệm thu local

Ngày 07/10/2026. Nhánh `claude/sharp-thompson-5tff91`, base `{base}`.

Đã triển khai phần frontend còn lại của handoff: stack D1–D4, Observer độc lập, đủ 18 native state ở Dark/Light và các phần được khuyến nghị trong 12 nhóm Archive. Các kiểm tra local đã qua. **Chưa deploy, chưa chạy staging, chưa ghi Cloudflare.** Chưa có backend nghiệp vụ, CI cho commit mới hay nghiệm thu NVDA/VoiceOver; không tuyên bố production-ready.

Yêu cầu mới “triển khai và nghiệm thu toàn bộ” được hiểu là tiếp tục các khuyến nghị D1–D4 và shortlist đã trình bày, không hỏi lại các quyết định cũ. Điều kiện duyệt UI trước deploy từ yêu cầu đầu vẫn giữ.

## Xem và thao tác

- `Atlas-UI-Review.html` là gallery offline: Before/After 18 module, 18 native state, 7 definition state, 8 Execution state, IDE/draft responsive và Archive/app. Có Dark/Light, chọn viewport và mở ảnh lớn. Ảnh chụp app thật; dữ liệu minh hoạ được ghi rõ.
- Source zip giữ tree dự án, test, baseline, ảnh, raw result và patch series từ base. Chạy local ở `frontend/atlas-web`:

```bash
npm ci
npm run build:review
npm run preview:review
```

Review ở `http://127.0.0.1:4174`; production local dùng `npm run build` và `npm run preview` ở 4173. `/observer/*` mở entry Observer riêng trong cả hai bản. Các lệnh này không publish.

## UI/UX đã hoàn thiện

| Hạng mục | Kết quả và giới hạn |
|---|---|
| UI-1 | 18 module cả hai theme; Current shell, labels, tokens, typography 12 px. Các giá trị dịch vụ chưa có là Not observed. |
| UI-2 | 18 màn hình `/states/:key` được sinh từ text và tọa độ của frame Current UI; OB-Stale ở `/observer/states/OB-Stale`. Đúng heading, purpose, hai panel, scope và actions; ảnh app/Figma cả hai theme. Giữ bố cục responsive của shell hiện hành, chưa coi là pixel parity hay nghiệm thu business state trên backend. |
| UI-3 | 751 scene có template IDE, Review, Table, StatePattern, Run/Observer/Trace, Terminal, Diff/Merge, Plan/Tasklist/Workflow và Palette. Production dùng prodState/prodLabel; receipt/lifecycle/confirm/schema được giữ. |
| UI-4 | Account layout hai pane, theme và service connection. Observer sign-in dùng session client riêng; các nút chưa có identity provider bị khoá kèm lý do. Không có handler đăng nhập thành công giả. |
| UI-5 | Monaco lazy, source import, editor chỉ đọc, Symbols & quality / Coverage boundary và explicit JS/TS analysis. Snapshot thiết bị không phải Git commit; chưa có remote LSP. |
| UI-6 | Error/Not found có icon, giải thích và bước tiếp theo; toast tối đa 3, pause khi hover/focus. |
| UI-7 | IDE Explorer/Editor/Inspector dưới 1024; pane ẩn không nằm trong tab order. Execution List mặc định mobile. Native state kiểm 320/390/768/1024/1280/1440/1920; shell kiểm nhiều width, visual 390/1024/1440. Sửa breadcrumb chồng chữ và thu gọn scope bar mobile. |
| UI-8 | Dirty guard, cross-tab conflict, validation chuyển tab, focus dialog/palette, phím tắt và thao tác local. Nút nghiệp vụ cần grant/resource/revision, không suy quyền từ role. |
| UI-9 | Giữ Field Dictionary: parity {parity_hit}/{parity_total}, chỉ thiếu các nhãn trong danh sách ngoại lệ được duyệt; không đổi tên trường để đạt số. |
| UI-10 | Monaco/React Flow/xterm và các màn hình live tải theo nhu cầu; route prefetch và placeholder giữ layout. JS ban đầu giữ ngân sách 512 KiB. |
| UI-11 | Execution và 11 nhóm khác được tích hợp toàn phần hoặc phần khuyến nghị vào Current shell. Bảng dưới ghi phần giữ/đổi; không sao chép shell hay quyền giả của v9. |

GAP map có 655 binding thực mỗi theme; 96 scene còn lại dùng template Current UI/design system. Giữ {counts['views']} view, {counts['scenes']} scene, {counts['schemas']} schema / {counts['fields']} field, {counts['lifecycles']} lifecycle / {counts['lifecycleStates']} state, {counts['sourceActions']} source action, {counts['uxJourneys']} journey / {counts['uxSteps']} bước.

## Stack và ranh giới tích hợp

| Quyết định | Triển khai |
|---|---|
| D1 | Monaco 0.55 + Yjs/y-monaco/y-websocket. Room chứa scope/branch/document bất biến; server cung cấp nội dung đầu; editor chỉ ghi sau sync và trở về read-only khi mất quyền/kết nối. Không seed shared document từ draft. Sync không được coi là durable snapshot/freeze. |
| D2 | Hai Vite HTML entry, hai router/Zustand store/session client/theme key. Observer không import Workspace store, IndexedDB, journal hay session restoration. Local path rewrite chỉ phục vụ review; domain/cookie production còn cần triển khai riêng. |
| D3 | React Flow với node button và Graph/List tương đương; xterm chỉ đọc, queue có giới hạn/backpressure; TanStack Query cache theo service/audience/actor/scope; Zustand cho store hiện có. |
| D4 | Adapter WebSocket có protocol, grant, scope/resource, sequence và expiry; sai phạm đóng stream. DAG mới chặn lệnh đến khi REST refresh; Thought tree chỉ structured state, 10.000 record/≤14 DOM row. Reconnect thủ công, không tự resend command. |

Configuration resolver áp dụng Project > Workspace > Org > System, giữ source/revision; zero override hợp lệ. Risk, drift và budget ba tầng dùng cấu hình đã resolve, không hard-code thành threshold hiện hành. Scope switch dùng offered action và scope gốc, chỉ reconnect sau matching Effective readback; Unknown giữ identity và scope ban đầu.

Presence dùng heartbeat/TTL từ cấu hình đã resolve. Inbox có All/Unread, bảng và link an toàn; đọc notification không tự hoàn tất nghiệp vụ. Terminal gom tối đa 32 KiB mỗi lô trong 50–100 ms, queue 256 KiB, ACK sau callback ghi xterm. Không có terminal input hay raw chain-of-thought.

`atlas-ui/v1` vẫn là contract đề xuất. Peer REST/WS/Yjs chỉ nằm trong test; production không có fixture/success handler. Hai Monaco editor hội tụ qua Yjs thực và terminal nhận dữ liệu qua xterm trong browser test, nhưng chưa có service thật để chứng minh persistence/freeze/lock/AI/CI/Implemented. Timing peer local là diagnostic, không phải chứng nhận NFR <200 ms trên mạng production. Chi tiết DTO và trách nhiệm server ở `docs/INTEGRATION.md`.

Monaco giữ basic grammars và explicit analyzer hiện có; word-only automatic suggestions được tắt để không thể hiện như semantic completion và tránh ARIA sai của standalone widget. Chunk editor lớn vẫn được báo trong build; chỉ tải khi mở tài liệu/file.

## Archive — phần tích hợp

| Nhóm / frame Dark | Phần giữ và refactor |
|---|---|
'''
archive_changes = {
    'onboarding': '4 readiness card, thứ tự repository → AI/budget → membership; dùng link kiểm tra và dữ liệu service hoặc Not observed.',
    'members': '4 thẻ thành viên/invitation/policy/session, scope và recovery links; role label không cấp quyền.',
    'gateway': 'Routing, ledger, budget ba tầng và config source qua SRS details; ngưỡng lấy từ resolver, trạng thái rủi ro/budget có test.',
    'hub': '6 loại resource, version pins/consumers và agent composition trên Agents/Resources; link vào draft thật.',
    'memory': '4 lớp memory, Knowledge/Review queue/Engine settings/Import; tìm theo tên/type và đọc draft đã lưu, promotion vẫn cần service.',
    'editor': 'Explorer/Editor/Inspector, conflict/freeze/manifest native states; Monaco và command guard Current UI, không suy Lock thành Submit.',
    'code': 'Source snapshot/search/symbols/coverage, Monaco read-only và CI-Coverage; không giả Git ref/index/LSP.',
    'workflow': 'Plan-first proposal table, immutable input/human checkpoint/Approve plan; React Flow local workflow và List, lệnh cần offered grant/revision.',
    'execution': 'Run header, controls, dependency graph, Task/Context/Access, 5 activity tabs và 8 review states; React Flow/xterm/live DAG, List mobile.',
    'gates': '6 risk axes, Veto/quorum/signatures, eligibility/no-self-approval và post-merge acceptance; threshold từ config, bằng chứng thiếu để Not observed.',
    'notifications': 'Inbox All/Unread, scoped table/link; collaboration room/presence độc lập theo scope, không giả mark-read receipt.',
    'obs-overview': '16 Observer routes, metric/table/inspector/health/coverage và OB-Stale; SPA/session riêng, chỉ obs:* grants.',
}
for item in shortlist['items']:
    text += f"| {item['group']} · `{item['node_id']}` | {archive_changes.get(item['key'], item['reason'])} |\n"
text += f'''
Các mẫu dùng Current UI primitives và có bảng/List/link cho bàn phím; dữ liệu review gắn Illustrative. Không mất label đã đạt parity. Source có commit theo từng phần triển khai và raw ảnh before/after/reference.

## Nghiệm thu local

| Cổng | Kết quả |
|---|---|
| Typecheck / production build / review build | Qua; raw log trong evidence |
| Unit/component | {unit['numPassedTests']}/{unit['numPassedTests']}, {len(unit['testResults'])} file |
| Lượt functional/axe/service/parity toàn bộ đầu | {stats['functional']['expected']} đạt, {stats['functional']['unexpected']} lỗi, {stats['functional']['skipped']} skip; raw result được giữ nguyên |
| Coverage sau sửa và kiểm lại, 3 engine | {coverage_stats['expected']} ca độc lập có kết quả đạt gần nhất, {coverage_stats['skipped']} skip; 0 lỗi còn mở. Đây là tổng hợp nhiều lượt, không phải một raw run xanh |
| Lượt kiểm UI/parity rộng sau sửa, 3 engine | {stats['final_ui']['expected']} đạt, {stats['final_ui']['unexpected']} lỗi focus/compactness được phát hiện thêm; raw result giữ nguyên |
| Kiểm lại focus/draft/mobile, 3 engine | {stats['final_focus']['expected']} đạt, {stats['final_focus']['unexpected']} timeout tải Monaco khi chạy đồng thời; raw result giữ nguyên |
| IDE chạy riêng sau cùng, 3 engine | {stats['ides_final']['expected']} đạt, 0 lỗi; tạo/edit/save/preview/history/import/analysis/mobile |
| Kiểm lại route a11y timeout | {stats['a11y_recheck']['expected']} đạt trên 3 engine × 2 theme, ngưỡng không đổi |
| Visual Linux Chromium | {stats['visual']['expected']}/150; 2 theme × 3 width × 25 target, ngưỡng 0,5% |
| Visual mobile sau sửa spacing/focus cuối | {stats['visual_mobile']['expected']}/50, giữ ngưỡng 0,5%; desktop baseline không đổi |
| Review, 3 engine | {stats['review']['expected']} đạt; 18 native state × 2 theme, 210 route labels, 8 Execution states, inspector/dock/List |
| Graph sau visual inspection cuối | {stats['graph_review']['expected']} đạt ở 3 engine × 2 theme: SVG paint viewport, 8 trạng thái, axe, inspector và bàn phím; {stats['visual_graph']['expected']} ảnh Workflow/Execution production kiểm lại |
| Performance | 8/8; LCP {min(m['lcp'] for m in perf):.0f}–{max(m['lcp'] for m in perf):.0f} ms, CLS tối đa {max(m['cls'] for m in perf):.3f}, JS ban đầu tối đa {max(m['jsBytes'] for m in perf)/1024:.1f} KiB |
| Backend nghiệp vụ / production cookie-domain | Chưa nghiệm thu; backend và hosting identity chưa được cung cấp |
| NVDA/VoiceOver | Chưa chạy thủ công; `AT-CHECKLIST.md` |
| CI của commit bàn giao | Chưa xác nhận; push bị kiểm duyệt tự động chặn |

Coverage có kết quả gần nhất theo engine (sau kiểm lại):

| Engine | Đạt | Skip | Lỗi |
|---|---:|---:|---:|
'''
for engine, p in coverage_projects.items():
    text += f"| {engine} | {p['expected']} | {p['skipped']} | {p['unexpected']} |\n"
text += '''
Lượt toàn bộ đầu có 6 lỗi: 4 phép đo parity đọc trước React commit, 1 timeout h1 khi WebKit chạy cùng nhiều browser, 1 helper Yjs nhập form trong lúc tab thứ hai đang tự restore session. Đã sửa điều kiện chờ heading và kiểm session restore thực, giữ nguyên timeout/ngưỡng. Từng case lỗi bắt buộc có kết quả kiểm lại đạt; raw kết quả lỗi vẫn giữ trong `e2e-initial-all-engines.json`. Lượt kiểm UI rộng sau đó có thêm 5 lỗi: scope bar 161 px vượt mục tiêu <160, focus skip-link khi lazy mount, và focus navigation chen vào nhập tên draft. Đã sửa source focus để đợi heading và tôn trọng tương tác mới, giảm mobile spacing bằng token hiện có, rồi kiểm lại shell/IDE/definition/Archive trên ba engine. Raw `final-ui-all-engines.json` được giữ nguyên; các lỗi đều cần kết quả đạt trong `final-focus-all-engines.json`. Lượt focus có một timeout Monaco cold-load dưới tải browser đồng thời; giữ raw và kiểm lại cả suite IDE trên ba engine với một worker (`ides-final-all-engines.json`), không tăng timeout. Editor chunk lớn vẫn là giới hạn đã ghi, cần thêm đo trên thiết bị thực/CI.

`e2e-coverage.json` tổng hợp theo project/file/describe/title, không cộng test lặp thành ca độc lập.

Ba release/staging test có điều kiện ở mỗi engine được giữ từ source gốc; không bật RELEASE_CHECK trong nhiệm vụ này. Không tắt/nới test hay threshold. Baseline visual cập nhật có chủ đích theo stack/UI mới, chụp và kiểm lại ở Linux local; chưa chứng minh rasterizer Ubuntu CI khớp.

Full matrix chạy trước các chỉnh cuối ở breadcrumb/scope mobile, lazy heading/input focus, badge Disconnected của Observer và data mapping Memory/Identity. Các phần đó đã được build lại và chạy lại các suite bị ảnh hưởng trên cả ba engine, cùng visual, review và ảnh mới. Sau sửa focus/spacing cuối chỉ mobile visual 390 px cần cập nhật/kiểm lại; desktop baseline không đổi. Review matrix chạy trước chỉnh màu badge Observer; native/scene production và visual sau đó kiểm lại phần bị ảnh hưởng. Không cộng các lượt test chồng nhau thành số “test độc lập”. Firefox local cần launch prefs phù hợp container; CI giữ thiết lập mặc định. CI chia thành ba job engine riêng, giữ budget 45 phút và các ngưỡng; Chromium giữ visual/performance/reproducibility. Cấu hình này chưa có run cho commit mới.

Visual inspection cuối phát hiện cạnh DAG bị global SVG max-width reset co về 0 px, dù path và node vẫn có trong DOM. Đã giới hạn ngoại lệ CSS trong graph và dùng stroke/arrow theo token Current UI. Kiểm lại 6 case Execution trên ba engine/hai theme, gồm viewport SVG không bị co, 8 run state, axe và Graph/List/inspector/bàn phím; kiểm lại 12 ảnh Workflow/Execution production. Ảnh Execution trong gallery đã chụp lại sau sửa. Đây là các lượt bị ảnh hưởng, không cộng thành ca review độc lập mới.

Perf dùng context mới mỗi route, desktop không throttling, không phải mạng lạnh thiết bị người dùng/RUM. Lượt perf đầu đạt các ngân sách nhưng 2 phép kiểm editor nhận nhầm chunk `LazyCodeEditor` là Monaco. Đã sửa regex tại ranh giới tên chunk thực (`CodeEditor-`, editor API/worker), thêm kiểm DOM chưa mount Monaco, rồi chạy lại 8/8 đạt; giữ raw `perf-initial.json/log`, không tăng ngân sách hay timeout. Monaco không tải trước khi mở tài liệu/file. Các route, byte và timing gốc nằm trong `verification.json` và `evidence/perf-final.log`.

CI lịch sử [run 37311004973](https://github.com/ldqanh1408/frontend/actions/runs/37311004973) ở SHA `9e4b411fb64c091e5d6391895fe380297462459c` không thuộc commit bàn giao, không tính là T-8 đạt.

## SRS và business acceptance còn thiếu

Đã giữ UI cho Lock → explicit Submit to AI → Memory Preparation → Proposed DAG → Approve Plan → Human Gate → Risk/Gate → PR/CI → Post-merge Drift → Implemented, cùng Episodic Promote. Có 5 enum SRS, grant/session/entitlement/quota reason, kiểm scope/revision/expiry, một POST per activation, Unknown giữ operation ID và không tự gửi lại. Nút cần service luôn hiển thị và có lý do khoá ngay cạnh.

| Ngoại lệ SRS | UI/bằng chứng frontend | Phần server chưa nghiệm thu |
|---|---|---|
| EX-SPEC-02 | SP-Conflict, local cross-tab conflict/export/reload | FCFS/merge revision thật |
| EX-AGENT-02 | SAAS-Budget, budget-blocked scene, config boundary test | Reservation/enforcement |
| EX-AGENT-04 | EX-TaskAttempt, snapshot/retry command guard | Restore sandbox |
| EX-LOCK-02 | EX-Cleanup, lock inspector/force-release grant | Fence/TTL/cleanup effect |
| EX-GOV-01/06 | reviewer eligibility và no-self-approval | Phân công/quorum thật |
| EX-GOV-04 | CI-failed và RV-Acceptance | PR/CI của commit mới |
| EX-DRIFT-01 | CI-Coverage, drift route/config resolver | Scan/drift score và post-merge acceptance |

## Text parity

| Module | Đạt / tổng | Ngoại lệ có chủ đích |
|---|---|---|
'''
text += '\n'.join(f'| {module} | {hit}/{total} | {extra} |' for module, (hit, total, extra) in parity.items())
text += f'''

Tổng **{parity_hit}/{parity_total}** trên cả ba engine: Resources thiếu 1, Memory thiếu 2, Configuration thiếu 3. Danh sách ngoại lệ cũ cho phép 7 nhãn; panel Memory mới đã làm “Knowledge type” hiện diện trong tìm kiếm/bảng, nên số thiếu thực tế còn 6. Checkpoint 12 trước đó là 450/457. Field Dictionary được giữ; missing label ngoài danh sách làm test fail.

## Git và bước còn lại

Commit chỉ trên nhánh đã chỉ định; không PR, không force-push. Push bị kiểm duyệt tự động chặn vì remote chưa được xác minh và chưa có chỉ thị rõ cho việc gửi source/bằng chứng ra ngoài. Lượt dry-run trước cũng thiếu credential. Thay đổi đang local; chưa có kết quả CI trên commit mới. ZIP chứa source đầy đủ, 30 patch đến checkpoint source và evidence để khôi phục từ base; README của series ghi phạm vi và `--keep-cr` đã kiểm chứng.

Bạn xem UI trước. Sau khi UI được duyệt và có backend/GitHub/hosting access, còn cần nghiệm thu business E2E, domain/cookie production, AT thủ công và job verify trên đúng commit. Deployment vẫn chưa được thực hiện.

'''
text += '\n'.join(f'- `{c["sha"][:12]}` — {c["title"]}' for c in commits)
text += f'\n\nSource checkpoint trước commit tài liệu: `{sha}`. SHA-256 source runtime (path + bytes trong src, không gồm test): `{source_hash.hexdigest()}`. Hash raw evidence lưu trong `verification.json`.\n'
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(text)
print(json.dumps({'report': str(args.output), 'stats': stats, 'source_commit': sha}, ensure_ascii=False))
