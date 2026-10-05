import { Marked } from 'marked';
import DOMPurify from 'dompurify';

const md = new Marked({ gfm: true, breaks: false });

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('rel', 'noopener noreferrer nofollow');
    const href = node.getAttribute('href') || '';
    if (/^https?:/i.test(href)) node.setAttribute('target', '_blank');
  }
});

/** Markdown → sanitized HTML (no scripts, event handlers, iframes or forms; remote images are not loaded). */
export function renderMarkdown(src: string): string {
  const html = md.parse(src, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'], FORBID_ATTR: ['style'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  }).replace(/<img\b[^>]*\bsrc="https?:[^"]*"[^>]*>/gi, (tag) => tag.replace(/\bsrc="[^"]*"/i, 'data-blocked-src="remote"').replace(/<img/i, '<img alt="Remote image not loaded"'));
}

export interface Heading { level: number; text: string; line: number }
export function outline(src: string): Heading[] {
  const out: Heading[] = [];
  let fence = false;
  src.split('\n').forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    if (fence) return;
    const m = l.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) out.push({ level: m[1].length, text: m[2], line: i + 1 });
  });
  return out;
}

export interface Scenario { line: number; steps: { kw: string; text: string; line: number }[] }
export interface Requirement { id: string | null; text: string; line: number }
/** Given/When/Then scenarios and requirement bullets (lines under a "Requirements" heading, or tagged REQ-/AC- ids). */
export function requirements(src: string): { scenarios: Scenario[]; items: Requirement[] } {
  const scenarios: Scenario[] = [];
  const items: Requirement[] = [];
  let cur: Scenario | null = null;
  let inReq = false;
  let fence = false;
  src.split('\n').forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) { fence = !fence; return; }
    if (fence) return;
    const h = l.match(/^(#{1,6})\s+(.+)/);
    if (h) { inReq = /requirement/i.test(h[2]); cur = null; return; }
    const g = l.match(/^\s*(?:[-*]\s+)?\**(Given|When|Then|And|But)\**\s+(.+)/i);
    if (g) {
      const kw = g[1][0].toUpperCase() + g[1].slice(1).toLowerCase();
      if (!cur || kw === 'Given' && cur.steps.some((s) => s.kw !== 'Given')) { cur = { line: i + 1, steps: [] }; scenarios.push(cur); }
      cur.steps.push({ kw, text: g[2].trim(), line: i + 1 });
      return;
    }
    if (!l.trim()) cur = null;
    const b = l.match(/^\s*[-*]\s+(?:\[[ xX]\]\s+)?(.+)/);
    const id = l.match(/\b((?:REQ|AC|NFR|FR)-\d+)\b/);
    if ((b && inReq) || id) items.push({ id: id?.[1] ?? null, text: (b?.[1] ?? l).trim().replace(/^\**((?:REQ|AC|NFR|FR)-\d+)\**:?\s*/, ''), line: i + 1 });
  });
  return { scenarios, items };
}
