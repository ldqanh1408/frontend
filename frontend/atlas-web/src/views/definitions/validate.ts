import type { FieldSpec, SchemaSpec } from '../../data/types';

/** Form values are kept as strings/booleans while editing and converted to typed JSON on save. */
export type FormValue = string | boolean | null;
export type FormValues = Record<string, FormValue>;
export type Errors = Record<string, string>;

const ISO_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


/* secret-leak policy (device drafts must never hold secret values) */
const VAULT_REF = /^vault:\/\/\S+$/;
/** Keys that hold a reference to a secret: credentialReference, replacementCredentialRef, apiKeyRef, tokenRef… */
const SECRET_REF_KEY = /(credential|secret|password|token|apikey)[a-z]*ref(erence)?$|vault/i;

// true for keys that hold a reference to a secret
export const isSecretRefKey = (key: string) => SECRET_REF_KEY.test(key);


const ENV_REFS_KEY = /environmentRefs$/i;
/** In an environmentRefs object/array these keys name the variable; every other string must be a vault reference. */
const ENV_NAME_KEYS = new Set(['name', 'key', 'env', 'variable']);
const SECRET_WORDS = new Set(['key', 'apikey', 'token', 'secret', 'password', 'passwd', 'credential', 'credentials', 'auth', 'authorization']);
/** `--api-key`, `-token`, `--client_secret` → true; `--keyboard`, `--author` → false (whole hyphen/underscore-separated words only). */
const isSecretFlag = (name: string) => name.replace(/^-+/, '').toLowerCase().split(/[-_]/).some((w) => SECRET_WORDS.has(w));
const SECRET_LITERAL = /(\bsk-[A-Za-z0-9_-]{8,}|\bgh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|\bxox[abprs]-[A-Za-z0-9-]{10,}|\bAKIA[0-9A-Z]{16}\b|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.|\bBearer\s+\S{8,}|:\/\/[^\s/:@]+:[^\s/@]+@)/;

function envRefsLeak(v: unknown, path = ''): string | null {
  if (typeof v === 'string') return VAULT_REF.test(v) ? null : `${path || 'value'} must be a vault reference such as vault://team/name, not a secret value.`;
  if (Array.isArray(v)) { for (const [i, x] of v.entries()) { const e = envRefsLeak(x, `${path}[${i}]`); if (e) return e; } return null; }
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (ENV_NAME_KEYS.has(k.toLowerCase()) && typeof x === 'string') continue;
      const e = envRefsLeak(x, path ? `${path}.${k}` : k); if (e) return e;
    }
    return null;
  }
  return v === null || v === undefined ? null : `${path || 'value'} must be a vault reference string.`;
}

/** Heuristic scan of command-line args for inline secrets. Not a proof of absence; the service must still reject them. */
function argsLeak(items: string[]): string | null {
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (SECRET_LITERAL.test(a)) return 'Arguments appear to contain a secret value. Pass a vault:// reference through environmentRefs instead.';
    const m = /^(-{1,2}[\w-]+)[=:](.*)$/.exec(a);
    if (m && isSecretFlag(m[1]) && m[2].trim() && !VAULT_REF.test(m[2].trim())) return `${m[1]} appears to carry a secret value. Use a vault:// reference.`;
    const next = items[i + 1];
    if (!m && /^-{1,2}[\w-]+$/.test(a) && isSecretFlag(a) && next !== undefined && !next.startsWith('-') && !VAULT_REF.test(next)) return `The value after ${a} looks like a secret. Use a vault:// reference.`;
  }
  return null;
}

/** Returns an error when a draft field would carry a secret value instead of a reference. */
export function secretPolicy(f: FieldSpec, s: string): string | null {
  if (f.control === 'text' && SECRET_REF_KEY.test(f.key) && !VAULT_REF.test(s)) return 'Use a vault reference such as vault://team/provider. Never paste secret values.';
  if (f.control === 'json' && ENV_REFS_KEY.test(f.key)) {
    try { return envRefsLeak(JSON.parse(s)); } catch { return null; } // invalid JSON is reported by the json case
  }
  if (f.control === 'list' && f.key === 'args') return argsLeak(s.split('\n').map((x) => x.trim()).filter(Boolean));
  return null;
}
export function toFormValue(f: FieldSpec, v: unknown): FormValue {
  if (v === undefined || v === null) {
    if (f.default !== undefined) return toFormValue(f, f.default);
    return f.control === 'boolean' ? null : '';
  }
  switch (f.control) {
    case 'boolean': return typeof v === 'boolean' ? v : v === 'true';
    case 'list': return Array.isArray(v) ? v.map(String).join('\n') : String(v);
    case 'json': case 'pins': return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
    default: return String(v);
  }
}

export function initialValues(schema: SchemaSpec, data: Record<string, unknown> = {}): FormValues {
  const out: FormValues = {};
  for (const g of schema.groups) for (const f of g.fields) out[f.key] = toFormValue(f, data[f.key]);
  return out;
}

/** Validates one field. `complete` adds required-field checks (complete definition validation). */
export function validateField(f: FieldSpec, raw: FormValue, complete: boolean): string | null {
  const empty = raw === null || raw === '' || (typeof raw === 'string' && raw.trim() === '');
  if (empty) return complete && f.required ? `${f.label} is required for complete validation.` : null;
  const s = typeof raw === 'string' ? raw : String(raw);
  const leak = secretPolicy(f, s);   
  if (leak) return leak;     
    switch (f.control) {
    case 'number': {
      const n = Number(s);
      if (!Number.isFinite(n)) return `${f.label} must be a number.`;
      if (f.type === 'integer' && !Number.isInteger(n)) return `${f.label} must be a whole number.`;
      if (f.minimum !== null && n < f.minimum) return `${f.label} must be at least ${f.minimum}${f.unit ? ` ${f.unit}` : ''}.`;
      if (f.maximum !== null && n > f.maximum) return `${f.label} must be at most ${f.maximum}${f.unit ? ` ${f.unit}` : ''}.`;
      return null;
    }
    case 'select':
      return f.enum && !f.enum.includes(s) ? `Choose one of: ${f.enum.join(', ')}.` : null;
    case 'datetime':
      return ISO_TZ.test(s.trim()) ? (Number.isNaN(Date.parse(s)) ? `${f.label} is not a valid date.` : null) : `Use ISO 8601 with an explicit timezone, e.g. 2026-10-03T09:00:00Z.`;
    case 'list': {
      const items = s.split('\n').map((x) => x.trim()).filter(Boolean);
      if (f.maxItems !== null && items.length > f.maxItems) return `Use at most ${f.maxItems} entries.`;
      if (f.uniqueItems && new Set(items).size !== items.length) return 'Duplicate entries are not allowed.';
      const ic = f.itemConstraints as { maxLength?: number; pattern?: string } | null;
      if (ic?.maxLength && items.some((x) => x.length > ic.maxLength!)) return `Each entry must be at most ${ic.maxLength} characters.`;
      return null;
    }
    case 'json': case 'pins': {
      let v: unknown;
      try { v = JSON.parse(s); } catch { return `${f.label} must be valid JSON.`; }
      if (f.control === 'pins') {
        if (!Array.isArray(v)) return 'Pins must be a JSON array of exact saved references.';
        for (const p of v as Record<string, unknown>[]) {
          if (!p || typeof p !== 'object' || typeof p.id !== 'string' || typeof p.kind !== 'string' || !Number.isInteger(p.rev) || (p.rev as number) < 1 || typeof p.hash !== 'string' || !/^[a-f0-9]{64}$/.test(p.hash)) {
            return 'Each pin needs id, kind, rev ≥ 1 and a 64-character lowercase SHA-256 hash.';
          }
        }
        if (f.maxItems !== null && (v as unknown[]).length > f.maxItems) return `Use at most ${f.maxItems} pins.`;
        return null;
      }
      const t = Array.isArray(f.type) ? f.type : [f.type];
      const actual = Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
      if (!t.includes(actual) && !(t.includes('object') && actual === 'object')) return `${f.label} must be a JSON ${t.join(' or ')}.`;
      return null;
    }
    case 'boolean':
      return null;
    default: {
      if (f.minLength !== null && s.length < f.minLength) return `${f.label} must be at least ${f.minLength} characters.`;
      if (f.maxLength !== null && s.length > f.maxLength) return `${f.label} must be at most ${f.maxLength} characters.`;
      if (f.pattern && !new RegExp(f.pattern).test(s)) return `${f.label} has an invalid format.`;
      if (f.format === 'email' && !EMAIL.test(s)) return 'Enter an email address like name@example.com.';
      if (f.format === 'uri' || /endpoint|url/i.test(f.key)) {
        try {
          const u = new URL(s);
          if (u.username || u.password) return 'Remove credentials from the URL.';
          if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))) return 'Use HTTPS (HTTP only for localhost development).';
        } catch { return 'Enter a full URL, e.g. https://api.example.com.'; }
      }
      return null;
    }
  }
}

export function validateAll(schema: SchemaSpec, values: FormValues, complete: boolean): Errors {
  const errs: Errors = {};
  for (const g of schema.groups) for (const f of g.fields) {
    const e = validateField(f, values[f.key] ?? '', complete);
    if (e) errs[f.key] = e;
  }
  return errs;
}

/** Converts edited values to typed JSON. Empty optional values are omitted (omitted ≠ null ≠ empty). */
export function toData(schema: SchemaSpec, values: FormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const g of schema.groups) for (const f of g.fields) {
    const raw = values[f.key];
    if (raw === null || raw === '' || raw === undefined) continue;
    const s = typeof raw === 'string' ? raw : String(raw);
    switch (f.control) {
      case 'number': out[f.key] = Number(s); break;
      case 'boolean': out[f.key] = raw === true || raw === 'true'; break;
      case 'list': out[f.key] = s.split('\n').map((x) => x.trim()).filter(Boolean); break;
      case 'json': case 'pins': try { out[f.key] = JSON.parse(s); } catch { out[f.key] = s; } break;
      default: out[f.key] = s;
    }
  }
  return out;
}

export function isDirty(a: FormValues, b: FormValues) {
  return Object.keys({ ...a, ...b }).some((k) => (a[k] ?? '') !== (b[k] ?? ''));
}
