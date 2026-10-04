-- Deploy the MFA login page and verify the owner's authenticator BEFORE this
-- migration. The precondition prevents accidentally locking out the sole admin.
begin;
do $$
declare
  target regclass;
  label text;
  command text;
  predicate text;
begin
  if (select count(*) from public.admin_users) <> 1 or not exists (
    select 1 from public.admin_users a join auth.mfa_factors f on f.user_id = a.user_id
    where f.factor_type = 'totp' and f.status = 'verified'
  ) then
    raise exception 'Deploy the MFA login page and bind the sole admin TOTP factor before applying this migration';
  end if;

  predicate := '(select auth.jwt()->>''aal'') = ''aal2'' and exists (select 1 from public.admin_users where user_id = (select auth.uid()))';
  -- Restrictive write policies AND with existing membership policies. They
  -- cannot be bypassed by another permissive policy or direct REST requests.
  for target, label in select * from (values
    ('public.projects'::regclass, 'projects'), ('public.articles'::regclass, 'articles'),
    ('public.site_settings'::regclass, 'site settings'), ('storage.objects'::regclass, 'media')
  ) as tables(relation, name) loop
    foreach command in array array['insert', 'update', 'delete'] loop
      execute format('create policy %I on %s as restrictive for %s to authenticated %s',
        'MFA admin ' || command || ' ' || label, target, command,
        case command
          when 'insert' then 'with check (' || predicate || ')'
          when 'update' then 'using (' || predicate || ') with check (' || predicate || ')'
          else 'using (' || predicate || ')'
        end);
    end loop;
  end loop;
  -- Authenticated visitors and pre-MFA admins retain published/public reads.
  -- Private content additionally requires aal2. Membership lookup remains
  -- available at aal1 so the owner can enroll and complete login.
  foreach target in array array['public.projects'::regclass, 'public.articles'::regclass] loop
    execute format('create policy %I on %s as restrictive for select to authenticated using (status = ''published'' or (%s))',
      'MFA admin reads private ' || target::text, target, predicate);
  end loop;
end
$$;
commit;
