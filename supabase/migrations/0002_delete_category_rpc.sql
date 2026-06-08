-- 0002_delete_category_rpc.sql — atomic category delete + optional reassign (F3)
create or replace function public.delete_category(
  p_id          text,
  p_reassign_to text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_is_preset boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select is_preset into v_is_preset
  from public.categories
  where user_id = v_uid and id = p_id;

  if v_is_preset is null then
    raise exception 'category % not found', p_id;
  end if;
  if v_is_preset then
    raise exception 'Cannot delete preset category "%"', p_id;
  end if;

  if p_reassign_to is not null then
    update public.expenses
      set category_id = p_reassign_to, updated_at = now()
      where user_id = v_uid and category_id = p_id;
  end if;

  delete from public.categories
    where user_id = v_uid and id = p_id;
end;
$$;

-- Supabase's default ACL also grants execute to `anon`; revoke it explicitly so
-- only authenticated users can call this SECURITY DEFINER function (defense in
-- depth on top of the auth.uid() null-check inside the body).
revoke all on function public.delete_category(text, text) from public;
revoke execute on function public.delete_category(text, text) from anon;
grant execute on function public.delete_category(text, text) to authenticated;
