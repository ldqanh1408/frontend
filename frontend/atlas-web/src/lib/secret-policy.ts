/** Defence at the draft boundary, not a substitute for backend diff/entropy scanning. */
const VAULT_REF = /^vault:\/\/[^\s]+$/;
const REF_KEY = /(?:credential|secret|password|token|api[_-]?key)[a-z_-]*ref(?:erence)?$|vault/i;
const SECRET_KEY = /^(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|client[_-]?secret|authorization)$/i;
const SECRET_WORDS = new Set(['key', 'apikey', 'token', 'secret', 'password', 'passwd', 'credential', 'credentials', 'auth', 'authorization']);
const isSecretFlag = (flag: string) => flag.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/^-+/, '').toLowerCase().split(/[-_]/).some(word => SECRET_WORDS.has(word));
const SECRET_TEXT = /(?:\bsk-[A-Za-z0-9_-]{8,}|\bgh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|\bxox[abprs]-[A-Za-z0-9-]{10,}|\bAKIA[0-9A-Z]{16}\b|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.|\bBearer\s+\S+|:\/\/[^\s/:@]+:[^\s/@]+@|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const HINT = 'Use vault references such as vault://team/provider. Never save secret values in device drafts.';

function isRef(value: unknown): boolean {
  return value == null || value === '' || (typeof value === 'string' && VAULT_REF.test(value));
}

function environmentIsSafe(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return isRef(value);
  if (Array.isArray(value)) return value.every(environmentIsSafe);
  if (typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  // A descriptor has an explicit reference slot. Arbitrary map keys named KEY/name
  // remain environment variables and must never receive a global metadata exemption.
  const descriptor = Object.keys(obj).some(k => /^(?:valueRef|secretRef|credentialRef|reference|ref)$/.test(k));
  return Object.entries(obj).every(([key, item]) => descriptor && /^(?:name|key|env|variable)$/.test(key)
    ? typeof item === 'string' : environmentIsSafe(item));
}

export function secretFieldError(key: string, value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /:\/\/[^\s/:@]+:[^\s/@]+@/.test(value)) return 'Remove credentials from the URL. Use vault references for secrets.';
  if ((REF_KEY.test(key) || SECRET_KEY.test(key)) && !isRef(value)) return HINT;
  if (/^environmentRefs$/i.test(key) && !environmentIsSafe(value)) return HINT;
  if (/^args$/i.test(key)) {
    const args = Array.isArray(value) ? value.map(String) : String(value).split('\n');
    for (let i = 0; i < args.length; i++) {
      const arg = args[i].trim();
      const flag = /^(-{1,2}[\w-]+)(?:[=:](.*))?$/.exec(arg);
      if (flag && isSecretFlag(flag[1]) && !isRef(flag[2] ?? args[i + 1])) return HINT;
      if (SECRET_TEXT.test(arg)) return HINT;
    }
  }
  if (typeof value === 'string' && SECRET_TEXT.test(value)) return HINT;
  return null;
}

/** Run before any draft/revision write and before exporting legacy drafts. */
export function assertDraftSecretPolicy(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(assertDraftSecretPolicy); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    const error = secretFieldError(key, item);
    if (error) throw new Error(error); // Never echo the submitted value or key.
    assertDraftSecretPolicy(item);
  }
}
