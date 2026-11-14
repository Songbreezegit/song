-- Run against a migration test database or the approved Staging project.
begin read only;
do $$
declare
  admin_id uuid;
  scenario text;
  role_name text;
  subject text;
  assurance text;
  target regclass;
  predicate text;
  allowed boolean;
  visible bigint;
  writer oid;
  api regprocedure := 'public.change_distribution_publish_task(uuid,text,uuid,integer,jsonb)'::regprocedure;
  private_writer regprocedure := 'distribution_publish_private.change_task(uuid,text,uuid,integer,jsonb)'::regprocedure;
  tables regclass[] := array[
    'public.distribution_publish_tasks'::regclass,
    'public.distribution_publish_task_media'::regclass,
    'public.distribution_publish_logs'::regclass
  ];
begin
  select user_id into strict admin_id from public.admin_users order by user_id limit 1;
  select oid into strict writer from pg_roles where rolname='distribution_publish_writer'
    and not (rolcanlogin or rolsuper or rolbypassrls or rolcreaterole or rolcreatedb);
  if (select count(*) from pg_class where oid=any(tables) and relrowsecurity and relforcerowsecurity) <> 3
    or (select count(*) from pg_constraint where conrelid=any(tables) and contype='f' and convalidated and confdeltype='r') <> 6
    or pg_has_role('authenticated',writer,'SET') or pg_has_role('authenticator',writer,'SET')
    or has_schema_privilege('authenticated','distribution_publish_private','USAGE')
    or has_schema_privilege(writer,'distribution_publish_private','CREATE')
    or not exists (select 1 from pg_proc where oid=api and not prosecdef and proconfig=array['search_path=""'])
    or not exists (select 1 from pg_proc where oid=private_writer and prosecdef and proowner=writer and proconfig=array['search_path=""'])
    or not has_function_privilege('authenticated',api,'EXECUTE')
    or has_function_privilege('anon',api,'EXECUTE') or has_function_privilege('service_role',api,'EXECUTE')
    or has_table_privilege(writer,'public.distribution_publish_logs','UPDATE, DELETE, TRUNCATE')
  then raise exception 'Invalid publishing object, privilege or retention boundary'; end if;

  foreach scenario in array array['anon','member-aal2','admin-aal1','admin-no-aal','admin-aal2'] loop
    role_name := case when scenario='anon' then 'anon' else 'authenticated' end;
    subject := case when scenario='anon' then '' when scenario='member-aal2' then gen_random_uuid()::text else admin_id::text end;
    assurance := case scenario when 'admin-aal1' then 'aal1' when 'admin-no-aal' then '' else 'aal2' end;
    perform set_config('request.jwt.claim.sub',subject,true);
    perform set_config('request.jwt.claim.aal',assurance,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',nullif(subject,''),'role',role_name,'aal',assurance)::text,true);
    execute format('set local role %I', role_name);
    foreach target in array tables loop
      if has_table_privilege(target,'INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER')
        or has_any_column_privilege(target,'INSERT, UPDATE')
      then raise exception 'Client has a direct write grant on %',target; end if;
      if role_name='anon' then
        if has_table_privilege(target,'SELECT') then raise exception 'Anonymous read grant on %',target; end if;
      else
        execute format('select count(*) from %s',target) into visible;
        if scenario<>'admin-aal2' and visible<>0 then raise exception 'Unexpected visible rows on % for %',target,scenario; end if;
        select qual into strict predicate from pg_policies where schemaname='public'
          and tablename=(select relname from pg_class where oid=target)
          and policyname='Distribution publish MFA' and permissive='RESTRICTIVE'
          and cmd='ALL' and with_check=qual;
        execute format('select coalesce((%s), false)',predicate) into allowed;
        if allowed is distinct from (scenario='admin-aal2') then raise exception 'Invalid MFA result for % on %',scenario,target; end if;
      end if;
    end loop;
    -- An invalid request reaches input validation only for the eligible
    -- identity, before any mutation or write lock.
    begin
      perform public.change_distribution_publish_task(null,'start',null,null,'{}');
      raise exception 'Invalid publishing request unexpectedly succeeded';
    exception
      when insufficient_privilege then
        if scenario='admin-aal2' then raise; end if;
      when invalid_parameter_value then
        if scenario<>'admin-aal2' then raise; end if;
    end;
    reset role;
  end loop;
end $$;
select jsonb_build_object('passed',true,'contexts',5,'writes_executed',false) as verification;
rollback;
