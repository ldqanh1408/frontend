// Shared helpers for the AUDIT_ONLY harness. Nothing here touches the product source.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const TARGET = (process.env.TARGET || 'https://sparkling-snow-090d.ekko-okke666.workers.dev').replace(/\/$/, '');

export function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export function writeJSON(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

export function nowISO() {
  return new Date().toISOString();
}

// Redact anything that looks like a credential before it reaches evidence.
const SECRET_HEADERS = /^(authorization|cookie|set-cookie|x-csrf-token|cf-access-.*|proxy-authorization)$/i;
export function redactHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h)) out[k] = SECRET_HEADERS.test(k) ? '[REDACTED]' : v;
  return out;
}

export function headersToObject(headers) {
  const o = {};
  headers.forEach((v, k) => { o[k] = v; });
  return o;
}

export class Recorder {
  constructor(runDir, suite) {
    this.runDir = runDir;
    this.suite = suite;
    this.cases = [];
    this.evidence = [];
    this.dir = ensureDir(path.join(runDir, suite));
  }
  file(rel) {
    const p = path.join(this.dir, rel);
    ensureDir(path.dirname(p));
    return p;
  }
  evidenceFile(rel, meta) {
    const p = this.file(rel);
    this.evidence.push({ path: path.relative(ROOT, p), ...meta, timestamp: nowISO() });
    return p;
  }
  // result in PASS|FAIL|NOT_RUN|BLOCKED|NOT_APPLICABLE ; expected must be fixed before execution
  add(c) {
    const allowed = ['PASS', 'FAIL', 'NOT_RUN', 'BLOCKED', 'NOT_APPLICABLE'];
    if (!allowed.includes(c.result)) throw new Error(`bad result ${c.result} for ${c.case_id}`);
    this.cases.push({ run_at: nowISO(), ...c });
  }
  save(extra = {}) {
    writeJSON(path.join(this.dir, 'results.json'), { suite: this.suite, cases: this.cases, evidence: this.evidence, ...extra });
  }
}
