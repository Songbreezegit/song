-- Review artifact for AFTER an explicitly approved migration. No production
-- execution in M1 development. Queries/predicate evaluation only; no fixtures.
begin read only;
do $$
declare admin_id uuid; other_id uuid := gen_random_uuid(); scenario text; role_name text; subject text;
  target text; boundary record; permitted boolean; accepted boolean; visible bigint;
begin
  if current_setting('transaction_read_only') <> 'on' then raise exception 'Read-only transaction required'; end if;
  if (select count(*) from public.admin_users) <> 1 then raise exception 'Expected sole existing administrator'; end if;
  select user_id into admin_id from public.admin_users;
  if admin_id = other_id then raise exception 'Probe identity collision'; end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('distribution_accounts','distribution_posts','distribution_post_targets','distribution_post_media') and c.relrowsecurity and c.relforcerowsecurity) <> 4
  then raise exception 'Expected four RLS-enabled, forced private tables'; end if;
  if exists(select 1 from pg_proc where oid='public.save_distribution_post(uuid,integer,jsonb,uuid[],uuid[])'::regprocedure and prosecdef)
  then raise exception 'Save RPC must be security invoker'; end if;
  foreach scenario in array array['anon','member-aal2','admin-aal1','admin-missing-aal','admin-aal2'] loop
    role_name := case when scenario='anon' then 'anon' else 'authenticated' end;
    subject := case when scenario='anon' then '' when scenario='member-aal2' then other_id::text else admin_id::text end;
    permitted := scenario='admin-aal2';
    perform set_config('request.jwt.claim.sub',subject,true);
    perform set_config('request.jwt.claim.aal',case when scenario='admin-aal1' then 'aal1' when scenario='admin-missing-aal' then '' else 'aal2' end,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role',role_name,
      'aal',case when scenario='admin-aal1' then 'aal1' when scenario='admin-missing-aal' then '' else 'aal2' end)::text,true);
    execute format('set local role %I',role_name);
    foreach target in array array['distribution_accounts','distribution_posts','distribution_post_targets','distribution_post_media'] loop
      if scenario='anon' then
        if has_table_privilege('public.'||target,'SELECT') or has_table_privilege('public.'||target,'INSERT') or has_table_privilege('public.'||target,'UPDATE') or has_table_privilege('public.'||target,'DELETE')
        then raise exception 'Anonymous table privilege: %',target; end if;
      else
        execute format('select count(*) from public.%I',target) into visible;
        if not permitted and visible <> 0 then raise exception 'Private data leak for %',scenario; end if;
        select qual,with_check into strict boundary from pg_policies where schemaname='public' and tablename=target
          and policyname='Distribution MFA boundary '||case target when 'distribution_accounts' then 'accounts' when 'distribution_posts' then 'posts' when 'distribution_post_targets' then 'targets' else 'media' end
          and permissive='RESTRICTIVE' and cmd='ALL' and roles=array['authenticated']::name[];
        execute format('select coalesce((%s),false)',boundary.qual) into accepted;
        if accepted is distinct from permitted then raise exception 'USING predicate failed for %, %',scenario,target; end if;
        execute format('select coalesce((%s),false)',boundary.with_check) into accepted;
        if accepted is distinct from permitted then raise exception 'WITH CHECK predicate failed for %, %',scenario,target; end if;
      end if;
    end loop;
    if has_function_privilege('public.save_distribution_post(uuid,integer,jsonb,uuid[],uuid[])','EXECUTE') is distinct from (scenario <> 'anon')
    then raise exception 'Unexpected RPC grant'; end if;
    reset role;
  end loop;
end $$;
select jsonb_build_object('passed',true,'contexts',5,'writes_executed',false,'fixtures_inserted',0) as verification;
rollback;
