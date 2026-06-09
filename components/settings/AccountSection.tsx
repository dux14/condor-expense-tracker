'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LogOut, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/lib/auth/use-session';
import { createClient } from '@/lib/auth/supabase-browser';
import { deleteAccount } from '@/lib/auth/delete-account';
import { wipeLocalCache } from '@/lib/data/wipe-local-cache';
import { SettingRow } from '@/components/settings/SettingRow';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

export function AccountSection() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const { user } = useSession();
  const [busy, setBusy] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const name = (user?.user_metadata?.full_name as string | undefined) ?? '';
  const avatar = user?.user_metadata?.avatar_url as string | undefined;
  const email = user?.email ?? '';
  const initial = (name || email || '?').charAt(0).toUpperCase();

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // Clear on-device data caches (preserving the app-lock config) so the
      // next user on this device can't read the previous session's data.
      wipeLocalCache();
      router.replace('/login');
    } catch {
      toast.error(t('signOutError'));
      setBusy(false);
    }
  }

  async function handleDeleteAccount() {
    if (busy) return;
    setBusy(true);
    try {
      // 1. Server is authoritative for the cloud: it deletes the user's rows
      //    (scoped by the verified session user_id) BEFORE the auth account.
      //    If it fails, nothing is destroyed locally yet — bail out.
      await deleteAccount();
      // 2. Account is gone — clear ALL local condor:* keys, including the lock.
      //    (A client remote-wipe would fail anyway: the session is now invalid.)
      wipeLocalCache({ keepLock: false });
      // 3. End the (now invalid) session and leave.
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace('/login');
    } catch {
      toast.error(t('deleteAccountError'));
      setBusy(false);
    }
  }

  return (
    <section className="mb-5">
      <p className="mb-2 text-xs font-semibold tracking-wider text-muted-txt">
        {t('account')}
      </p>
      <div className="overflow-hidden rounded-[12px] bg-surface">
        <div className="flex items-center gap-3 px-4 py-3">
          {avatar ? (
            <Image
              src={avatar}
              alt=""
              width={40}
              height={40}
              className="rounded-full"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 font-heading text-base font-semibold text-text"
            >
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-txt">{t('signedInAs')}</p>
            <p className="truncate text-sm font-medium text-text">
              {name || email}
            </p>
            {name && (
              <p className="truncate text-xs text-muted-txt">{email}</p>
            )}
          </div>
        </div>

        <div className="mx-4 h-px bg-outline/40" />

        <SettingRow
          label={busy ? t('signingOut') : t('signOut')}
          danger
          onPress={handleSignOut}
          data-testid="signout-btn"
        >
          <LogOut size={18} className="text-danger" />
        </SettingRow>

        <div className="mx-4 h-px bg-outline/40" />

        <SettingRow
          label={busy ? t('deletingAccount') : t('deleteAccount')}
          danger
          onPress={() => { if (!busy) setDeleteOpen(true); }}
          data-testid="delete-account-btn"
        >
          <Trash2 size={18} className="text-danger" />
        </SettingRow>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('deleteAccountConfirmTitle')}
        description={t('deleteAccountConfirm')}
        confirmLabel={t('deleteAccount')}
        destructive
        onConfirm={handleDeleteAccount}
      />
    </section>
  );
}
