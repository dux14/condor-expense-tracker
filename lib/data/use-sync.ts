'use client';
import { useCallback, useSyncExternalStore } from 'react';
import type { SyncStatus } from './syncing-repository';

export interface SyncHandle {
  getStatus(): SyncStatus;
  onStatus(fn: (s: SyncStatus) => void): () => void;
}

/** Subscribe to a SyncingRepository's status for the header dot. */
export function useSyncStatus(handle: SyncHandle | null): SyncStatus {
  // useSyncExternalStore is the React-blessed way to subscribe to an external
  // store without violating react-hooks/set-state-in-effect.
  const subscribe = useCallback(
    (notify: () => void) => (handle ? handle.onStatus(notify) : () => {}),
    [handle],
  );
  const getSnapshot = useCallback(
    () => handle?.getStatus() ?? 'synced',
    [handle],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => 'synced' as SyncStatus);
}
