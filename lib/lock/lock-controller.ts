type Listener = (locked: boolean) => void;

export interface LockControllerOptions {
  enabled: boolean;
  timeoutMinutes: number;
}

export interface LockController {
  isLocked(): boolean;
  unlock(): void;
  lock(): void;
  noteActivity(): void;
  onBackground(): void;
  subscribe(fn: Listener): () => void;
  destroy(): void;
}

export function createLockController(opts: LockControllerOptions): LockController {
  let locked = opts.enabled;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<Listener>();

  function emit() {
    for (const fn of listeners) fn(locked);
  }
  function set(next: boolean) {
    if (next === locked) return;
    locked = next;
    emit();
  }
  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }
  function armTimer() {
    clearTimer();
    if (!opts.enabled || locked) return;
    timer = setTimeout(() => set(true), opts.timeoutMinutes * 60_000);
  }

  return {
    isLocked: () => locked,
    unlock() {
      set(false);
      armTimer();
    },
    lock() {
      clearTimer();
      set(true);
    },
    noteActivity() {
      if (!opts.enabled || locked) return;
      armTimer();
    },
    onBackground() {
      if (!opts.enabled) return;
      clearTimer();
      set(true);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    destroy() {
      clearTimer();
      listeners.clear();
    },
  };
}
