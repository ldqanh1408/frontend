// Entry point: reads frontend-acceptance/run-request.json and runs each suite in order.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ensureDir, writeJSON, nowISO, TARGET } from './lib.mjs';

const req = JSON.parse(fs.readFileSync(path.join(ROOT, 'run-request.json'), 'utf8'));
const runId = process.env.GITHUB_RUN_ID || `local-${Date.now()}`;
const runDir = ensureDir(path.join(ROOT, 'evidence', 'runs', `${req.request_id}`));
const summary = { request_id: req.request_id, github_run_id: runId, target: TARGET, started_at: nowISO(), suites: {} };
let failed = false;
for (const name of req.suites) {
  const t0 = Date.now();
  try {
    const mod = await import(`./suites/${name}.mjs`);
    const res = await mod.default({ runDir, req, target: TARGET });
    summary.suites[name] = { status: 'completed', ms: Date.now() - t0, ...(res || {}) };
  } catch (e) {
    failed = true;
    summary.suites[name] = { status: 'harness_error', ms: Date.now() - t0, error: String(e && e.stack || e).slice(0, 4000) };
    console.error(`suite ${name} failed`, e);
  }
  writeJSON(path.join(runDir, 'summary.json'), summary);
}
summary.finished_at = nowISO();
writeJSON(path.join(runDir, 'summary.json'), summary);
console.log(JSON.stringify(summary, null, 2).slice(0, 20000));
if (failed) process.exitCode = 1;
