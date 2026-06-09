-- Fails (raises) if any public table that has a user_id column lacks RLS or a policy,
-- or if any public table has RLS disabled. fx_rates (no user_id) is allowed RLS+read-only.
do $$
declare r record; missing text := '';
begin
  -- (a) Every public table must have rowsecurity = true.
  for r in
    select tablename from pg_tables
    where schemaname='public' and rowsecurity = false
  loop
    missing := missing || format('[RLS OFF] %s; ', r.tablename);
  end loop;

  -- (b) Every table with a user_id column must have at least one policy.
  for r in
    select t.tablename
    from pg_tables t
    where t.schemaname='public'
      and exists (
        select 1 from information_schema.columns c
        where c.table_schema='public' and c.table_name=t.tablename and c.column_name='user_id'
      )
      and not exists (
        select 1 from pg_policies p
        where p.schemaname='public' and p.tablename=t.tablename
      )
  loop
    missing := missing || format('[NO POLICY] %s; ', r.tablename);
  end loop;

  if length(missing) > 0 then
    raise exception 'RLS coverage failures: %', missing;
  end if;
  raise notice 'OK: RLS coverage complete';
end $$;
