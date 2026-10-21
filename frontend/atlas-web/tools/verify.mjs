#!/usr/bin/env node
// One fresh acceptance run; log files and summaries never merge old successful reruns.
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceDigest } from './release-manifest.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const mode = process.argv[2] || 'local';
if (!['local', 'staging'].includes(mode)) throw new Error('Use local or staging.');
const run = process.env.ATLAS_VERIFY_RUN || new Date().toISOString().replace(/[:.]/g, '-');
if (!/^[a-zA-Z0-9_-]+$/.test(run)) throw new Error('Invalid run identifier.');
const out = resolve(root, 'test-results', 'acceptance', run);
mkdirSync(out, { recursive: true });
if (existsSync(join(out, 'summary.json'))) throw new Error('Run already exists; use a fresh ATLAS_VERIFY_RUN.');
const summary = { format: 'atlas-acceptance/v1', mode, run, node: process.version, startedAt: new Date().toISOString(), sourceDigest: sourceDigest(root), gates: [], result: 'RUNNING', limitations: ['Live backend business acceptance and manual NVDA/VoiceOver are not established by this command.'] };
let activeChild = null;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  summary.result = 'INTERRUPTED'; summary.finishedAt = new Date().toISOString(); summary.interruptionReason = signal; persist(); activeChild?.kill('SIGTERM'); process.exit(signal === 'SIGINT' ? 130 : 143);
});
const persist = () => writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2)); persist();
async function gate(name, command, args, report) {
  console.log(`Starting ${name}`);
  const log = createWriteStream(join(out, name + '.log'));
  const started = Date.now();
  const env = { ...process.env, ...(report ? { PLAYWRIGHT_JSON_OUTPUT_NAME: join(out, report + '.json'), ATLAS_TEST_OUTPUT: join(out, report) } : {}) };
  let error = null;
  const code = await new Promise(resolveCode => {
    const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    activeChild = child;
    child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
    child.once('error', e => { error = e.message; resolveCode(1); });
    child.once('close', code => resolveCode(code ?? 1));
  });
  activeChild = null;
  await new Promise(done => log.end(done));
  const result = { name, code, durationMs: Date.now() - started, status: code === 0 ? 'PASS' : 'FAIL', log: name + '.log', ...(error ? { error } : {}) };
  if (report && existsSync(join(out, report + '.json'))) { const data = JSON.parse(readFileSync(join(out, report + '.json'), 'utf8')); result.stats = data.stats; }
  summary.gates.push(result); persist(); console.log(`${name}: ${result.status}`); return code === 0;
}
let passed = true;
if (mode === 'local') {
  passed = await gate('check', 'npm', ['run', 'check']);
  if (passed) passed = await gate('tooling', 'npm', ['run', 'test:tooling']);
  if (passed) passed = await gate('functional', 'npx', ['playwright', 'test', '--project=chromium', '--project=firefox', '--project=webkit'], 'functional');
  if (passed) passed = await gate('layout-performance', 'npx', ['playwright', 'test', '--project=layout-chromium'], 'layout-performance');
  if (passed && process.env.ATLAS_VISUAL_BASELINE_DIR) passed = await gate('private-visual', 'npx', ['playwright', 'test', 'e2e/visual.spec.ts', '--project=visual-chromium'], 'private-visual');
  else if (passed) summary.limitations.push('Private pixel regression was not run: ATLAS_VISUAL_BASELINE_DIR was not supplied. Layout checks do not establish pixel equality.');
  if (passed) passed = await gate('build-review', 'npm', ['run', 'build:review']);
  if (passed) passed = await gate('review', 'npx', ['playwright', 'test', '-c', 'playwright.review.config.ts'], 'review');
} else passed = await gate('staging', 'npx', ['playwright', 'test', '-c', 'playwright.staging.config.ts'], 'staging');
const unchanged = sourceDigest(root) === summary.sourceDigest;
summary.finishedAt = new Date().toISOString();
summary.sourceUnchanged = unchanged;
summary.result = passed && unchanged ? 'PASS' : 'FAIL';
persist(); console.log(`Acceptance ${summary.result}: ${join(out, 'summary.json')}`);
process.exitCode = summary.result === 'PASS' ? 0 : 1;
