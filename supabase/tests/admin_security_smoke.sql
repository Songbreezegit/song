-- 使用数据库管理连接核对真实 RLS 表达式；不读取密码、JWT 或 MFA 密钥。
-- READ ONLY 由 PostgreSQL 强制执行。只修改当前连接的角色与模拟请求声明，
-- 不创建测试账号，不插入、更新或删除业务/Storage 记录。
begin read only;
do $$
declare
  admin_id uuid;
  other_id uuid := gen_random_uuid();
  policies jsonb;
  policy jsonb;
  scenario text;
  role_name text;
  subject text;
  content_state text;
  target text;
  permitted boolean;
  accepted boolean;
  visible bigint;
begin
  if current_setting('transaction_read_only') <> 'on' then
    raise exception 'Verification must be read-only';
  end if;
  if (select count(*) from public.admin_users) <> 1 then
    raise exception 'Expected exactly one admin';
  end if;
  select user_id into admin_id from public.admin_users;
  if other_id = admin_id then raise exception 'Probe identity collision'; end if;
  select jsonb_agg(jsonb_build_object('schema', schemaname, 'table', tablename,
    'command', cmd, 'predicate', coalesce(with_check, qual)) order by schemaname,tablename,cmd)
    into policies from pg_policies where policyname like 'MFA admin %'
      and permissive = 'RESTRICTIVE' and roles = array['authenticated']::name[];
  if jsonb_array_length(policies) <> 14 or policies is null then
    raise exception 'Expected 14 restrictive MFA policies';
  end if;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'MFA admin %' and permissive = 'RESTRICTIVE'
      and cmd in ('INSERT','UPDATE','DELETE')
      and coalesce(qual, with_check) like '%aal2%'
      and coalesce(qual, with_check) like '%admin_users%') <> 3 then
    raise exception 'Storage write policy incomplete';
  end if;

  foreach scenario in array array['anon','other-aal2','admin-aal1','admin-aal2'] loop
    role_name := case when scenario = 'anon' then 'anon' else 'authenticated' end;
    subject := case when scenario = 'anon' then '' when scenario = 'other-aal2' then other_id::text else admin_id::text end;
    permitted := scenario = 'admin-aal2';
    perform set_config('request.jwt.claim.sub', subject, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', subject, 'role', role_name,
      'aal', case when scenario = 'admin-aal1' then 'aal1' else 'aal2' end)::text, true);
    execute format('set local role %I', role_name);
    if current_user <> role_name then raise exception 'Role switch failed'; end if;

    -- 查询现存公开数据，绝不创建临时业务记录。
    foreach target in array array['public.projects','public.articles'] loop
      execute format('select count(*) from %s where status <> ''published''', target) into visible;
      if not permitted and visible <> 0 then raise exception 'Private content visible for %', scenario; end if;
      if not has_table_privilege(target, 'SELECT') then raise exception 'Public read grant missing'; end if;
      if scenario = 'anon' and (has_table_privilege(target, 'INSERT') or has_table_privilege(target, 'UPDATE')
          or has_table_privilege(target, 'DELETE')) then
        raise exception 'Anonymous write grant present';
      end if;
    end loop;
    perform count(*) from public.site_settings;
    if scenario <> 'anon' then
      select count(*) into visible from public.admin_users;
      if visible <> (case when scenario = 'other-aal2' then 0 else 1 end) then
        raise exception 'Membership lookup failed for %', scenario;
      end if;
      if has_table_privilege('public.admin_users', 'INSERT') or has_table_privilege('public.admin_users', 'UPDATE')
          or has_table_privilege('public.admin_users', 'DELETE') then
        raise exception 'Client can modify the admin allowlist';
      end if;

      -- 从本次已核对的策略读取表达式，在只读事务中执行 SELECT。
      -- 虚拟 status 来自 VALUES，覆盖线上没有草稿/归档记录时的规则。
      for policy in select value from jsonb_array_elements(policies) loop
        if policy->>'command' = 'SELECT' then
          foreach content_state in array array['published','draft','archived'] loop
            execute format('select coalesce((%s), false) from (values ($1::public.content_status)) as candidate(status)',
              policy->>'predicate') into accepted using content_state;
            if accepted is distinct from (content_state = 'published' or permitted) then
              raise exception 'Read predicate failed for %, %, %', scenario, policy->>'table', content_state;
            end if;
          end loop;
        else
          execute format('select coalesce((%s), false)', policy->>'predicate') into accepted;
          if accepted is distinct from permitted then
            raise exception 'Write predicate failed for %, %, %', scenario, policy->>'table', policy->>'command';
          end if;
        end if;
      end loop;
    end if;
    reset role;
  end loop;
end $$;
-- 保持在断言所在事务内返回结果，避免客户端忽略异常后产生假成功。
-- 当前角色已重置，未实测生产写入 API；后续回滚清除模拟请求声明。
select jsonb_build_object('passed', true, 'contexts', array['anon','other-aal2','admin-aal1','admin-aal2'],
  'policy_predicates', 14, 'writes_executed', false, 'fixtures_inserted', 0) as verification;
rollback;
