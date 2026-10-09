import { useEffect, useState, type ReactNode } from 'react';
import { Button } from './ui';

/** The three desktop panes become explicit controls on smaller screens; hidden panes leave the tab order. */
export function ResponsiveIde({ children, activeKey }: { children: ReactNode; activeKey?: string | null }) {
  const [pane, setPane] = useState(activeKey ? 'editor' : 'explorer');
  useEffect(() => { if (activeKey) setPane('editor'); }, [activeKey]);
  return <div className="ide-layout" data-mobile-pane={pane}>
    <div className="ide-switcher" role="group" aria-label="IDE panels">{[{ id: 'explorer', title: 'Explorer', icon: 'folder' }, { id: 'editor', title: 'Editor', icon: 'file-text' }, { id: 'inspector', title: 'Inspector', icon: 'eye' }].map(p => <Button key={p.id} icon={p.icon} aria-pressed={pane === p.id} onClick={() => setPane(p.id)}>{p.title}</Button>)}</div>
    <div className="ide">{children}</div>
  </div>;
}
