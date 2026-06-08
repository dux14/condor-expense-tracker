'use client';
import type { SyncStatus } from '@/lib/data/syncing-repository';

const LABEL: Record<SyncStatus, string> = {
  synced: 'Sincronizado',
  syncing: 'Sincronizando…',
  offline: 'Sin conexión',
  error: 'Error de sincronización',
};

const COLOR: Record<SyncStatus, string> = {
  synced: 'bg-emerald-500',
  syncing: 'bg-amber-400 animate-pulse',
  offline: 'bg-zinc-400',
  error: 'bg-red-500',
};

export function SyncDot({ status }: { status: SyncStatus }) {
  return (
    <span
      role="status"
      aria-label={LABEL[status]}
      title={LABEL[status]}
      data-testid="sync-dot"
      data-status={status}
      className={`inline-block h-2 w-2 rounded-full ${COLOR[status]}`}
    />
  );
}
