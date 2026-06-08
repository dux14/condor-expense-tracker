// SyncController — wires application-level sync triggers (D5: background only,
// no Realtime). Triggers: app open (start), window focus regain, navigator
// online event, and a debounced flush after writes. The service worker is NOT
// involved. SSR-safe: no-ops when `window` is undefined.

export interface Syncable {
  sync(): Promise<void>;
  flush(): Promise<void>;
  pull(): Promise<void>;
  getStatus(): string;
  onStatus(fn: (s: string) => void): () => void;
}

export interface SyncControllerOptions {
  debounceMs?: number;
}

export class SyncController {
  private debounceMs: number;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanups: Array<() => void> = [];
  private onFocus = () => { void this.repo.sync(); };
  private onOnline = () => { void this.repo.sync(); };
  private onVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void this.repo.sync();
    }
  };

  constructor(private readonly repo: Syncable, opts: SyncControllerOptions = {}) {
    this.debounceMs = opts.debounceMs ?? 1500;
  }

  start(): void {
    if (typeof window === 'undefined') return;
    if (this.cleanups.length > 0) return; // already started — avoid duplicate listeners
    // app open
    void this.repo.sync();
    window.addEventListener('focus', this.onFocus);
    window.addEventListener('online', this.onOnline);
    document.addEventListener('visibilitychange', this.onVisible);
    this.cleanups.push(
      () => window.removeEventListener('focus', this.onFocus),
      () => window.removeEventListener('online', this.onOnline),
      () => document.removeEventListener('visibilitychange', this.onVisible),
    );
  }

  /** Call after each store write to schedule a debounced background flush. */
  notifyWrite(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => { void this.repo.flush(); }, this.debounceMs);
  }

  stop(): void {
    for (const c of this.cleanups) c();
    this.cleanups = [];
    if (this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = null; }
  }
}
