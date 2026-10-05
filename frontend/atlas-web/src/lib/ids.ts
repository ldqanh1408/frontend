export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const newId = (prefix: string) => `${prefix}-${uuid().slice(0, 8)}`;

// Path separators and control characters are not allowed in item names (they would be ambiguous in exported paths).
const FORBIDDEN = /[\\/\u0000-\u001f\u007f]/;

export function isValidName(name: string): string | null {
  const n = name.trim();
  if (!n) return 'Enter a name.';
  if (n.length > 180) return 'Use at most 180 characters.';
  if (FORBIDDEN.test(n)) return 'Names cannot contain path separators (/ or \\) or control characters.';
  return null;
}

/**
 * Default name for a new local item derived from a display title. Display titles such as "Retry / resume request" contain
 * a slash; the generated name replaces separators so every type can be created with defaults (fixes FND-004).
 */
export function defaultName(title: string, suffix = uuid().slice(0, 8)): string {
  const base = title.replace(/\s*[\\/]\s*/g, ' - ').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  return `${base} ${suffix}`.slice(0, 180);
}
