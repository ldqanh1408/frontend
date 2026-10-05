import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from './Icon';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; compact?: boolean; icon?: string; iconOnly?: boolean; block?: boolean;
  /** When set, the button is shown but cannot run; the reason is rendered next to it and announced (never hover-only). */
  blocked?: string;
  /** Id of a reason already rendered nearby (several actions blocked for the same reason); the reason is not repeated. */
  reasonId?: string;
}
const cls = (v: Variant | undefined, compact?: boolean, iconOnly?: boolean, block?: boolean, extra?: string) =>
  ['btn', v && v !== 'secondary' ? `btn-${v}` : '', compact ? 'btn-compact' : '', iconOnly ? 'btn-icon' : '', block ? 'btn-block' : '', extra || ''].filter(Boolean).join(' ');

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', compact, icon, iconOnly, block, blocked, reasonId, children, className, type = 'button', onClick, ...rest }, ref,
) {
  const rid = useId();
  const btn = (
    <button
      {...rest} ref={ref} type={type} className={cls(variant, compact, iconOnly, block, className)}
      aria-disabled={blocked ? true : undefined} aria-describedby={blocked ? (reasonId ?? rid) : rest['aria-describedby']}
      onClick={blocked ? (e) => e.preventDefault() : onClick}
    >
      {icon && <Icon name={icon} />}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </button>
  );
  if (!blocked || reasonId) return btn;
  return (
    <span className="blocked-action">
      {btn}
      <span id={rid} className="blocked-reason">{blocked}</span>
    </span>
  );
});

export function ButtonLink({ to, variant = 'secondary', compact, icon, children, className }: { to: string; variant?: Variant; compact?: boolean; icon?: string; children: ReactNode; className?: string }) {
  return <Link to={to} className={cls(variant, compact, false, false, className)}>{icon && <Icon name={icon} />}{children}</Link>;
}

const TONES: Record<string, string> = {
  verified: 'success', effective: 'success', completed: 'success', passed: 'success', active: 'success', observed: 'success', pinned: 'accent', ready: 'success', saved: 'success', approved: 'success', merged: 'success', durable: 'success', connected: 'success',
  accepted: 'info', received: 'info', requested: 'info', running: 'info', review: 'info', pending: 'info', queued: 'info', syncing: 'info', 'in review': 'info', draft: 'neutral',
  partial: 'warning', stale: 'warning', unknown: 'warning', excluded: 'warning', blocked: 'warning', degraded: 'warning', paused: 'warning', missing: 'warning', held: 'warning', illustrative: 'warning', 'not observed': 'warning',
  failed: 'danger', rejected: 'danger', revoked: 'danger', denied: 'danger', conflict: 'danger', expired: 'danger', error: 'danger', cancelled: 'danger', redacted: 'purple',
};
export function toneFor(status: string): string {
  const s = status.toLowerCase();
  return TONES[s] ?? Object.entries(TONES).find(([k]) => s.includes(k))?.[1] ?? 'neutral';
}
export function Badge({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  const t = tone ?? (typeof children === 'string' ? toneFor(children) : 'neutral');
  return <span className={['badge', t !== 'neutral' ? `badge-${t}` : '', className || ''].join(' ').trim()}>{children}</span>;
}

export function Banner({ tone = 'info', title, children, icon, role }: { tone?: 'info' | 'warning' | 'danger' | 'success'; title?: ReactNode; children?: ReactNode; icon?: string; role?: 'status' | 'alert' }) {
  return (
    <div className={`banner banner-${tone}`} role={role}>
      <Icon name={icon ?? (tone === 'success' ? 'success' : tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'info')} />
      <div className="stack" style={{ gap: 2 }}>
        {title && <strong>{title}</strong>}
        {children && <div className="secondary">{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, children, actions, headingLevel = 2 }: { icon?: string; title: string; children?: ReactNode; actions?: ReactNode; headingLevel?: 2 | 3 }) {
  const H = `h${headingLevel}` as 'h2' | 'h3';
  return (
    <div className="empty">
      <Icon name={icon} />
      <H>{title}</H>
      {children && <p>{children}</p>}
      {actions && <div className="row" style={{ justifyContent: 'center' }}>{actions}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, purpose, actions, titleId }: { eyebrow?: ReactNode; title: string; purpose?: ReactNode; actions?: ReactNode; titleId?: string }) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 id={titleId} tabIndex={-1} data-page-title>{title}</h1>
        {purpose && <p>{purpose}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

export function Panel({ title, actions, children, className, headingLevel = 2, id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; headingLevel?: 2 | 3; id?: string }) {
  const H = `h${headingLevel}` as 'h2' | 'h3';
  const hid = useId();
  return (
    <section className={`panel ${className || ''}`} aria-labelledby={title ? hid : undefined} id={id}>
      {title && <div className="panel-head"><H id={hid}>{title}</H>{actions && <div className="row">{actions}</div>}</div>}
      {children}
    </section>
  );
}

export function KeyValue({ items }: { items: [ReactNode, ReactNode][] }) {
  return <dl className="kv">{items.map(([k, v], i) => <div key={i} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

const STAGES = ['Requested', 'Received', 'Accepted', 'Effective'] as const;
/** Command stages: acknowledgement is never shown as effect. Unknown/Rejected are terminal tones of their own. */
export function Stages({ stage }: { stage: string }) {
  const idx = STAGES.findIndex((s) => s.toLowerCase() === stage.toLowerCase());
  const special = ['unknown', 'rejected', 'notsent', 'not sent'].includes(stage.toLowerCase());
  return (
    <div className="stages" aria-label={`Command stage: ${stage}`}>
      {STAGES.map((s, i) => (
        <span key={s} className="stage" data-reached={!special && i <= idx} data-current={!special && i === idx && s !== 'Effective'} data-tone={!special && i === idx && s === 'Effective' ? 'success' : undefined}>{s}</span>
      ))}
      {special && <span className="stage" data-tone={stage.toLowerCase() === 'rejected' ? 'danger' : 'warning'}>{stage}</span>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <span role="status" className="caption">{label}…</span>;
}
