// Side-map of per-record LWW timestamps (condor:synctimes).
//
// WHY: Category and Settings have no `updatedAt` field (see lib/domain/types.ts).
// Rather than mutate the domain/schema (which would ripple into F3 + every
// test), F4 tracks a comparable ISO timestamp here, keyed by `${entity}:${id}`.
// Expense/Budget/Rule carry their own updatedAt and do NOT need this map, but
// SyncingRepository falls back to it uniformly when a record lacks updatedAt.

import type { OutboxEntity } from './sync-queue';

const KEY = 'condor:synctimes';

function isUnavailable(): boolean {
  return typeof window === 'undefined' || !window.localStorage;
}

function mapKey(entity: OutboxEntity, id: string): string {
  return entity === 'settings' ? 'settings:singleton' : `${entity}:${id}`;
}

export class SyncTimeStore {
  private read(): Record<string, string> {
    if (isUnavailable()) return {};
    const raw = localStorage.getItem(KEY);
    if (raw === null) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  get(entity: OutboxEntity, id: string): string | null {
    return this.read()[mapKey(entity, id)] ?? null;
  }

  set(entity: OutboxEntity, id: string, iso: string): void {
    if (isUnavailable()) return;
    const map = this.read();
    map[mapKey(entity, id)] = iso;
    localStorage.setItem(KEY, JSON.stringify(map));
  }
}
