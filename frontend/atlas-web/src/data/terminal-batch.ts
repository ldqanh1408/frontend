/** Bounded terminal producer. The next batch waits for xterm's write callback; no React update per line. */
export class TerminalBatch {
  private pending = new Uint8Array(0);
  private writing = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  constructor(private write: (data: Uint8Array, done: () => void) => void, private consumed: (bytes: number) => void, private fail: (reason: string) => void) {}
  push(data: Uint8Array): void {
    if (this.stopped) return;
    if (data.length + this.pending.length > 256 * 1024) { this.fail('Terminal backpressure limit reached. Refresh the stream from an authoritative offset.'); this.dispose(); return; }
    const merged = new Uint8Array(this.pending.length + data.length); merged.set(this.pending); merged.set(data, this.pending.length); this.pending = merged;
    this.arm();
  }
  private arm() { if (!this.timer && !this.writing && this.pending.length && !this.stopped) this.timer = setTimeout(() => this.flush(), this.pending.length >= 32 * 1024 ? 50 : 100); }
  private flush() {
    this.timer = undefined;
    if (this.stopped || this.writing || !this.pending.length) return;
    const data = this.pending.slice(0, 32 * 1024); this.pending = this.pending.slice(data.length); this.writing = true;
    this.write(data, () => { if (this.stopped) return; this.writing = false; this.consumed(data.length); this.arm(); });
  }
  dispose() { this.stopped = true; clearTimeout(this.timer); this.pending = new Uint8Array(0); }
}
