import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { openStream, type StreamStatus } from '../../data/stream';
import { useApp } from '../../data/app-store';
import { TerminalBatch } from '../../data/terminal-batch';
import { Badge, Button } from '../../components/ui';
export default function LiveTerminal({ resourceId, illustrative = false }: { resourceId: string; illustrative?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const session = useApp(s => s.session);
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState<StreamStatus>({ state: 'unavailable', reason: 'No stream received — Not observed.' });
  useEffect(() => {
    const colors = getComputedStyle(document.documentElement);
    const term = new Terminal({ disableStdin: true, screenReaderMode: true, scrollback: 2000, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, convertEol: true, minimumContrastRatio: 4.5, theme: { background: colors.getPropertyValue('--color-bg').trim(), foreground: colors.getPropertyValue('--color-text').trim() } });
    const fit = new FitAddon(); term.loadAddon(fit); term.open(host.current!); fit.fit();
    const resize = new ResizeObserver(() => { if (host.current?.offsetWidth) fit.fit(); }); resize.observe(host.current!);
    let socket: ReturnType<typeof openStream> | undefined;
    const batch = new TerminalBatch((data, done) => term.write(data, done), bytes => socket?.consumed(bytes), reason => { setStatus({ state: 'error', reason }); socket?.close(); });
    if (illustrative) { setStatus({ state: 'unavailable', reason: 'Illustrative replay · terminal input is disabled.' }); batch.push(new TextEncoder().encode('[Illustrative replay] Scoped attempt heartbeat received.\r\n')); }
    else socket = openStream('terminal', resourceId, frame => {
      if (frame.type !== 'terminal' || !frame.payload || typeof (frame.payload as { text?: unknown }).text !== 'string') throw new Error('Invalid terminal frame.');
      batch.push(new TextEncoder().encode((frame.payload as { text: string }).text));
    }, setStatus);
    host.current!.querySelector('textarea')?.setAttribute('aria-label', 'Read-only terminal output');
    host.current!.querySelector('textarea')?.setAttribute('aria-readonly', 'true');
    return () => { batch.dispose(); socket?.close(); resize.disconnect(); term.dispose(); };
  }, [resourceId, session, tick, illustrative]);
  return <div className="stack-12"><div className="row-between"><Badge tone={status.state === 'live' ? 'success' : 'warning'}>{status.state === 'live' ? 'Live' : illustrative ? 'Illustrative' : 'Not observed'}</Badge>{!illustrative && <Button compact onClick={() => setTick(t => t + 1)} blocked={session?.streams?.terminal ? undefined : 'No authorized terminal endpoint is advertised.'}>Reconnect stream</Button>}</div><p className="caption" role="status">{status.reason}</p><div ref={host} className="live-terminal" role="region" aria-label="Terminal output" /></div>;
}
