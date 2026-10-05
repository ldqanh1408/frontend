"""Test ledger (tests.json). Columns follow v2 §8.2 Test-Results schema.
Result enum is hard: PASS | FAIL | NOT_RUN | BLOCKED | NOT_APPLICABLE."""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, 'tests.json')
COLS = ['case_id', 'gate', 'view_id', 'state_id', 'actor', 'requirement_ref', 'fixture_id', 'build_id', 'deployment_id',
        'browser_version', 'viewport', 'theme', 'density', 'zoom', 'input_mode', 'steps', 'expected', 'actual', 'result',
        'evidence_ids', 'reason', 'run_at']
RESULTS = {'PASS', 'FAIL', 'NOT_RUN', 'BLOCKED', 'NOT_APPLICABLE'}
DEFAULTS = {
    'build_id': 'atlas-static-release/v1@2026-10-04T10:09:42.397Z (manifest sha256 0bf5b028…edd3)',
    'deployment_id': 'bd44cfc0-1219-40d9-9c1a-b1b7fe84d085 / version a8b5bc3a-63c9-4996-84e5-e8bc117775d3',
    'browser_version': 'Cloudflare Browser Rendering headless Chromium (UA reports Chrome/119; real version undisclosed)',
    'actor': 'anonymous (no service session)', 'state_id': 'default', 'fixture_id': '', 'density': 'default', 'zoom': '100%',
    'view_id': '', 'theme': '', 'viewport': '', 'evidence_ids': '', 'reason': '',
}


def load():
    if not os.path.exists(PATH):
        return []
    with open(PATH) as f:
        return json.load(f)


def save(rows):
    with open(PATH, 'w') as f:
        json.dump(rows, f, indent=1, ensure_ascii=False)


def add(**kw):
    """Add or replace a case by case_id (IDs are stable; never renumbered)."""
    row = dict(DEFAULTS)
    row.update(kw)
    missing = [c for c in ('case_id', 'gate', 'requirement_ref', 'input_mode', 'steps', 'expected', 'actual', 'result', 'run_at') if not row.get(c)]
    if missing:
        raise ValueError(f"{row.get('case_id')}: missing {missing}")
    if row['result'] not in RESULTS:
        raise ValueError(f"{row['case_id']}: bad result {row['result']}")
    if row['result'] in ('NOT_APPLICABLE', 'BLOCKED', 'NOT_RUN') and not row.get('reason'):
        raise ValueError(f"{row['case_id']}: {row['result']} needs a reason")
    if row['input_mode'] == 'synthetic-DOM' and row['result'] == 'PASS' and any(k in row['case_id'].split('-') for k in ('KBD', 'FOCUS', 'IME', 'MONACO')):
        raise ValueError(f"{row['case_id']}: synthetic input cannot PASS focus/keyboard (v2 §2, invariant 19)")
    rows = [r for r in load() if r['case_id'] != row['case_id']]
    rows.append({c: row.get(c, '') for c in COLS})
    save(rows)
    return row


if __name__ == '__main__':
    rows = load()
    from collections import Counter
    print(len(rows), Counter(r['result'] for r in rows))
