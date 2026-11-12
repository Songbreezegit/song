-- Run in an approved environment after M2. No rows or policies are changed.
begin read only;
do $$
declare
  admin_id uuid;
  scenario text;
  role_name text;
  subject text;
  target text;
  boundary record;
  should_allow boolean;
  accepted boolean;
  visible bigint;
begin
  if current_setting('transaction_read_only') <> 'on' then raise exception 'Read-only transaction required'; end if;
  select user_id into admin_id from public.admin_users order by user_id limit 1;
  if admin_id is null then raise exception 'An existing administrator is required for policy evaluation'; end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('distribution_variants','distribution_variant_media')
      and c.relrowsecurity and c.relforcerowsecurity) <> 2 then raise exception 'Expected both M2 tables to force RLS'; end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('create_distribution_variant','save_distribution_variant','sync_distribution_variant','retain_distribution_variant_source')
      and not p.prosecdef and p.proconfig = array['search_path=""'] and not has_function_privilege('anon',p.oid,'EXECUTE')
      and has_function_privilege('authenticated',p.oid,'EXECUTE')) <> 4 then raise exception 'M2 RPC boundary invalid'; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.distribution_variant_media'::regclass
    and confrelid='storage.objects'::regclass and confdeltype='r') then raise exception 'Expected Storage FK RESTRICT'; end if;
  foreach scenario in array array['anon','member-aal2','admin-aal1','admin-no-aal','admin-aal2'] loop
    role_name := case when scenario = 'anon' then 'anon' else 'authenticated' end;
    subject := case when scenario = 'anon' then '' when scenario = 'member-aal2' then gen_random_uuid()::text else admin_id::text end;
    should_allow := scenario = 'admin-aal2';
    perform set_config('request.jwt.claim.sub',subject,true);
    perform set_config('request.jwt.claim.aal',case scenario when 'admin-aal1' then 'aal1' when 'admin-no-aal' then '' else 'aal2' end,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role',role_name,
      'aal',case scenario when 'admin-aal1' then 'aal1' when 'admin-no-aal' then '' else 'aal2' end)::text,true);
    execute format('set local role %I',role_name);
    foreach target in array array['distribution_variants','distribution_variant_media'] loop
      if scenario = 'anon' then
        if has_table_privilege('public.'||target,'SELECT') or has_table_privilege('public.'||target,'INSERT')
          or has_table_privilege('public.'||target,'UPDATE') or has_table_privilege('public.'||target,'DELETE')
        then raise exception 'Anonymous table grant on %',target; end if;
      else
        execute format('select count(*) from public.%I',target) into visible;
        if not should_allow and visible <> 0 then raise exception 'Private rows visible to %',scenario; end if;
        select qual,with_check into strict boundary from pg_policies where schemaname='public' and tablename=target
          and policyname=case target when 'distribution_variants' then 'Distribution MFA boundary variants' else 'Distribution MFA boundary variant media' end
          and permissive='RESTRICTIVE' and cmd='ALL' and roles=array['authenticated']::name[];
        execute format('select coalesce((%s),false)',boundary.qual) into accepted;
        if accepted is distinct from should_allow then raise exception 'USING predicate failed for %, %',scenario,target; end if;
        execute format('select coalesce((%s),false)',boundary.with_check) into accepted;
        if accepted is distinct from should_allow then raise exception 'WITH CHECK predicate failed for %, %',scenario,target; end if;
      end if;
    end loop;
    reset role;
  end loop;
end $$;
select jsonb_build_object('passed',true,'contexts',5,'writes_executed',false) as verification;
rollback;
