// Durable delete tombstones (condor:tombstones).
//
// A tombstone marks a record as deleted locally and PENDING confirmation at
// the remote. While a tombstone exists, pull() must NOT re-add the record from
// a stale remote copy (anti-resurrection). A tombstone is dropped when either
// (a) the remote delete is confirmed and a pull shows the row gone, or
// (b) the remote row's LWW timestamp is NEWER than deletedAt (a legitimate
//     re-create after our delete — remote wins).

import type { OutboxEntity } from './sync-queue';

export interface Tombstone {
  entity: OutboxEntity;
  id: string;
  deletedAt: string; // ISO — the LWW clock for the delete
}

const KEY = 'condor:tombstones';

function isUnavailable(): boolean {
  return typeof window === 'undefined' || !window.localStorage;
}

export class TombstoneStore {
  all(): Tombstone[] {
    if (isUnavailable()) return [];
    const raw = localStorage.getItem(KEY);
    if (raw === null) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Tombstone[]) : [];
    } catch {
      return [];
    }
  }

  private writeAll(list: Tombstone[]): void {
    if (isUnavailable()) return;
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  add(entity: OutboxEntity, id: string, deletedAt: string): void {
    const kept = this.all().filter(t => !(t.entity === entity && t.id === id));
    kept.push({ entity, id, deletedAt });
    this.writeAll(kept);
  }

  remove(entity: OutboxEntity, id: string): void {
    this.writeAll(this.all().filter(t => !(t.entity === entity && t.id === id)));
  }

  isDeleted(entity: OutboxEntity, id: string): boolean {
    return this.all().some(t => t.entity === entity && t.id === id);
  }

  deletedAt(entity: OutboxEntity, id: string): string | null {
    return this.all().find(t => t.entity === entity && t.id === id)?.deletedAt ?? null;
  }
}
