"""Findings ledger (findings.json). Columns follow v2 §8.2 Findings schema. IDs continue from run 1 (FND-001…016)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, 'findings.json')
COLS = ['finding_id', 'severity', 'gate', 'view_id', 'requirement_ref', 'title', 'impact', 'repro_steps', 'expected', 'actual',
        'build_id', 'deployment_id', 'profile', 'evidence_ids', 'owner_proposed', 'status', 'fix_ref', 'retest_case_ids', 'closure_result']
SEV = {'P0', 'P1', 'P2', 'P3'}


def load():
    if not os.path.exists(PATH):
        return []
    with open(PATH) as f:
        return json.load(f)


def save(rows):
    with open(PATH, 'w') as f:
        json.dump(rows, f, indent=1, ensure_ascii=False)


def add(**kw):
    if kw.get('severity') not in SEV:
        raise ValueError(f"{kw.get('finding_id')}: bad severity")
    rows = [r for r in load() if r['finding_id'] != kw['finding_id']]
    rows.append({c: kw.get(c, '') for c in COLS})
    rows.sort(key=lambda r: r['finding_id'])
    save(rows)
