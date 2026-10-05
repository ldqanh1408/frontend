const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : null;

export function relativeTime(iso: string | number | Date, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'unknown time';
  const s = Math.round((t - now) / 1000);
  const abs = Math.abs(s);
  if (!rtf) return new Date(t).toISOString();
  if (abs < 45) return rtf.format(s, 'second');
  if (abs < 2700) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 64800) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}

export function isoUtc(iso: string | number | Date): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toISOString().replace('.000Z', 'Z') : '—';
}

export function bytes(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
