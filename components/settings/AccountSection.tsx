'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/lib/auth/use-session';
import { createClient } from '@/lib/auth/supabase-browser';
import { SettingRow } from '@/components/settings/SettingRow';

export function AccountSection() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const { user } = useSession();
  const [busy, setBusy] = React.useState(false);

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
      router.replace('/login');
    } catch {
      toast.error(t('signOutError'));
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
      </div>
    </section>
  );
}
