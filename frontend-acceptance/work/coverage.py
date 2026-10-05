"""Coverage classification (v2 §6.7).

Run 2 received neither Atlas-Screen-Inventory.csv nor Atlas-Archive-Canonical-Frontend.csv, so no canonical view_id can be
enumerated. Rule: never invent view_ids from titles or route names (invariant 20). Therefore:
  * Atlas-Frontend-Screen-Coverage.csv keeps the exact §8.2 header and 0 data rows; the 210-view denominator is reported as
    UNVERIFIED (BLOCKED_INPUT_MISSING) in the manifest/report.
  * Atlas-Frontend-Route-Coverage.csv (PROPOSED_EXTENSION) records what was observed per module route, same columns with
    route_id in place of view_id. It is NOT a substitute for the canonical denominator.
"""
import csv, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SC_COLS = ['view_id', 'title', 'module', 'owner_route', 'actual_route', 'canonical_spec_ids', 'source_component', 'required_fields',
           'required_actions', 'applicable_states', 'implementation_status', 'functional_result', 'responsive_result',
           'accessibility_result', 'runtime_result', 'performance_result', 'journey_ids', 'finding_ids', 'evidence_ids', 'limitations']
CANONICAL_DENOMINATOR = 210

# Observed in R2-002 (h1 + module chunk). Chunk names come from release-manifest payload list.
ROUTES = [
    ('home', 'Overview', 'index-CNIcNnJO.js'),
    ('specifications', 'Specifications', 'Specifications-B5BZcMrs.js'),
    ('code', 'Code intelligence', 'Code-BP0UUWrU.js'),
    ('agents', 'Agents', 'Definitions-BiKmtg8L.js + ServiceModule-C-aU3Waa.js'),
    ('resources', 'Resources', 'Definitions-BiKmtg8L.js + ServiceModule-C-aU3Waa.js'),
    ('memory', 'Memory', 'Definitions-BiKmtg8L.js + ServiceModule-C-aU3Waa.js'),
    ('workflow', 'Workflow', 'Workflow-DGDD8eIP.js'),
    ('execution', 'Execution', 'Definitions-BiKmtg8L.js + ServiceModule-C-aU3Waa.js + ExecutionGraph-CJpCkBCj.js'),
    ('governance', 'Delivery & acceptance', 'Definitions-BiKmtg8L.js + ServiceModule-C-aU3Waa.js'),
    ('gateway', 'AI gateway', 'Definitions-BiKmtg8L.js + ServiceModule-C-aU3Waa.js'),
    ('collaboration', 'Collaboration', 'Definitions-BiKmtg8L.js + ServiceModule-C-aU3Waa.js'),
    ('configuration', 'Configuration', 'Definitions-BiKmtg8L.js + ServiceModule-C-aU3Waa.js'),
    ('identity', 'Identity & access', 'Definitions-BiKmtg8L.js + ServiceModule-C-aU3Waa.js'),
    ('tenancy', 'Organization & projects', 'Definitions-BiKmtg8L.js + ServiceModule-C-aU3Waa.js'),
    ('saas', 'Usage & billing', 'Definitions-BiKmtg8L.js + ServiceModule-C-aU3Waa.js'),
    ('desktop', 'Desktop companion', 'Definitions-BiKmtg8L.js + ServiceModule-C-aU3Waa.js'),
    ('observer', 'Observer', 'Definitions-BiKmtg8L.js + ServiceModule-C-aU3Waa.js'),
    ('connection', 'Connection & operations', 'Connection-AA1_Uk-L.js'),
]


def build():
    with open(os.path.join(ROOT, 'Atlas-Frontend-Screen-Coverage.csv'), 'w', newline='') as f:
        csv.writer(f).writerow(SC_COLS)
    route_cols = ['route_id'] + SC_COLS[1:]
    rows = []
    for rid, title, chunk in ROUTES:
        rows.append({
            'route_id': f'ROUTE:{rid}', 'title': title, 'module': rid, 'owner_route': '', 'actual_route': f'#{rid}',
            'canonical_spec_ids': '', 'source_component': f'bundle chunk {chunk} (source not provided)', 'required_fields': '',
            'required_actions': '', 'applicable_states': 'default (no service session)',
            'implementation_status': 'UNVERIFIED',
            'functional_result': 'NOT_RUN',
            'responsive_result': 'FAIL',
            'accessibility_result': 'FAIL',
            'runtime_result': 'PASS',
            'performance_result': 'BLOCKED',
            'journey_ids': '', 'finding_ids': 'FND-017,FND-018' + (',FND-002,FND-003' if rid == 'home' else ''),
            'evidence_ids': 'EV-RT-501,EV-RT-502,EV-RESP-501,EV-RESP-502,EV-RESP-503,EV-RESP-504,EV-RESP-505',
            'limitations': ('Route-level proxy only (PROPOSED_EXTENSION), not a canonical view. Routing: direct/refresh PASS (CF-PRE-008). '
                            'Responsive FAIL = light@320/375 target-size flag (FND-018); 768/1280/1440 clean; 1920 BLOCKED. '
                            'Accessibility FAIL = FND-017 (title) + FND-018; axe/keyboard/AT not run. Runtime = 0 errors in default state only. '
                            'Specification/field/action parity not evaluated (inventory/spec/source missing).'),
        })
    with open(os.path.join(ROOT, 'Atlas-Frontend-Route-Coverage.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=route_cols)
        w.writeheader()
        w.writerows(rows)
    summary = {
        'canonical_denominator': CANONICAL_DENOMINATOR, 'canonical_rows_resolved': 0,
        'implementation_status': {'COMPLETE': 0, 'PARTIAL': 0, 'NOT_IMPLEMENTED': 0, 'UNVERIFIED': CANONICAL_DENOMINATOR},
        'implementation_status_basis': 'OBSERVED_THIS_RUN: no canonical view could be enumerated (inventory missing) ⇒ all 210 UNVERIFIED',
        'inherited_run1': {'COMPLETE': 0, 'PARTIAL': 74, 'NOT_IMPLEMENTED': 7, 'UNVERIFIED': 129, 'label': 'INHERITED_EVIDENCE (v2 prompt §6.7), not re-verified'},
        'routes_observed': len(ROUTES),
    }
    with open(os.path.join(HERE, 'coverage-summary.json'), 'w') as f:
        json.dump(summary, f, indent=1, ensure_ascii=False)
    return summary


if __name__ == '__main__':
    print(json.dumps(build(), indent=1, ensure_ascii=False))
