import * as RD from '@radix-ui/react-dialog';
import * as RT from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { Button } from './ui';
import { app, dismissToast, useApp } from '../data/app-store';

/** Modal dialog (APG Dialog Modal via Radix): focus trap, Escape, inert background, focus returns to the invoker. */
export function Dialog({ open, onOpenChange, title, description, children, footer, wide, trigger }: {
  open?: boolean; onOpenChange?: (o: boolean) => void; title: string; description?: ReactNode; children?: ReactNode; footer?: ReactNode; wide?: boolean; trigger?: ReactNode;
}) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RD.Trigger asChild>{trigger}</RD.Trigger>}
      <RD.Portal>
        <RD.Overlay className="scrim" />
        <RD.Content className={`dialog ${wide ? 'dialog-wide' : ''}`} aria-describedby={description ? undefined : undefined}>
          <div className="dialog-head">
            <div className="stack" style={{ gap: 4 }}>
              <RD.Title asChild><h2>{title}</h2></RD.Title>
              {description ? <RD.Description className="secondary">{description}</RD.Description> : <RD.Description className="sr-only">{title}</RD.Description>}
            </div>
            <RD.Close asChild><Button variant="quiet" compact iconOnly icon="close">Close</Button></RD.Close>
          </div>
          {children && <div className="dialog-body">{children}</div>}
          {footer && <div className="dialog-foot">{footer}</div>}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
export const DialogClose = RD.Close;

/** Tabs (APG Tabs via Radix): roving tabindex, arrow keys, aria-controls ↔ tabpanel/aria-labelledby (fixes FND-001). */
export function Tabs({ tabs, value, onValueChange, defaultValue, label, activation = 'automatic' }: {
  tabs: { id: string; label: ReactNode; content: ReactNode; badge?: ReactNode }[]; value?: string; onValueChange?: (v: string) => void;
  defaultValue?: string; label: string; activation?: 'automatic' | 'manual';
}) {
  return (
    <RT.Root value={value} onValueChange={onValueChange} defaultValue={defaultValue ?? tabs[0]?.id} activationMode={activation}>
      <RT.List className="tabs-list" aria-label={label}>
        {tabs.map((t) => <RT.Trigger key={t.id} value={t.id} className="tabs-trigger">{t.label}{t.badge}</RT.Trigger>)}
      </RT.List>
      {tabs.map((t) => <RT.Content key={t.id} value={t.id} className="tabs-content">{t.content}</RT.Content>)}
    </RT.Root>
  );
}

export function Toaster() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="toast-region" role="region" aria-label="Notifications">
      <div aria-live="polite" aria-atomic="false" className="stack">
        {toasts.map((t) => (
          <div key={t.id} className="toast" data-tone={t.tone} role={t.tone === 'danger' ? 'alert' : 'status'}>
            <Icon name={t.tone === 'success' ? 'success' : t.tone === 'danger' ? 'danger' : t.tone === 'warning' ? 'warning' : 'info'} />
            <div className="grow stack" style={{ gap: 2 }}>
              <strong className="label">{t.title}</strong>
              {t.body && <span className="secondary">{t.body}</span>}
            </div>
            <Button variant="quiet" compact iconOnly icon="close" onClick={() => dismissToast(t.id)}>Dismiss notification</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
export const clearToasts = () => app.set({ toasts: [] });
