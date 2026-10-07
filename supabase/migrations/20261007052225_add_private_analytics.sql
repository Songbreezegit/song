-- Privacy-preserving counters. No IP, user id, referrer, query string or visitor
-- identifier is stored. Each receipt id represents one event, never a person.
-- Anonymous clients can submit one bounded increment; these are not audited
-- human visits and remain susceptible to automated/spoofed submissions.
begin;

create schema if not exists analytics_private;
revoke all on schema analytics_private from public;
grant usage on schema analytics_private to anon, authenticated;

create table public.analytics_page_daily (
  day date primary key,
  page_views bigint not null default 0 check (page_views >= 0)
);
create table public.analytics_content_daily (
  day date not null,
  content_type text not null check (content_type in ('article', 'project')),
  content_id text not null check (length(content_id) between 1 and 200),
  clicks bigint not null default 0 check (clicks >= 0),
  primary key (day, content_type, content_id)
);
create index analytics_content_target_idx on public.analytics_content_daily(content_type, content_id, day);

create table analytics_private.event_receipts (
  event_id uuid primary key,
  received_at timestamptz not null default now()
);
create index analytics_receipts_age_idx on analytics_private.event_receipts(received_at);
create table analytics_private.maintenance (
  id boolean primary key default true check (id),
  last_cleanup_at timestamptz not null default '-infinity'
);
insert into analytics_private.maintenance(id) values (true);

alter table public.analytics_page_daily enable row level security;
alter table public.analytics_content_daily enable row level security;
alter table analytics_private.event_receipts enable row level security;
alter table analytics_private.maintenance enable row level security;
revoke all on public.analytics_page_daily, public.analytics_content_daily from public, anon, authenticated;
revoke all on analytics_private.event_receipts, analytics_private.maintenance from public, anon, authenticated;
grant select on public.analytics_page_daily, public.analytics_content_daily to authenticated;

create policy "Sole MFA admin reads page analytics" on public.analytics_page_daily
  for select to authenticated using (
    (select auth.jwt()->>'aal') = 'aal2'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );
create policy "Sole MFA admin reads content analytics" on public.analytics_content_daily
  for select to authenticated using (
    (select auth.jwt()->>'aal') = 'aal2'
    and exists (select 1 from public.admin_users where user_id = (select auth.uid()))
  );

-- The privileged writer is in an unexposed schema; its entire input surface is
-- validated. Public API wrappers remain invoker functions. No caller can choose
-- the date, delta or a content title, and no content rows are mutated.
create function analytics_private.write_event(p_event_id uuid, p_event_type text, p_content_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  event_day date := (now() at time zone 'Asia/Shanghai')::date;
  receipt_inserted boolean;
  cleanup_due boolean;
  content_kind text;
begin
  if p_event_id is null or p_event_type is null or p_event_type not in ('page_view', 'article_click', 'project_click') then
    raise exception using errcode = '22023', message = 'Invalid analytics event';
  end if;
  if p_event_type = 'page_view' then
    if p_content_id is not null then
      raise exception using errcode = '22023', message = 'Page views cannot target content';
    end if;
  else
    if p_content_id is null or length(p_content_id) not between 1 and 200 then
      raise exception using errcode = '22023', message = 'Invalid analytics content id';
    end if;
    if p_event_type = 'article_click' then
      if not exists (select 1 from public.articles where id = p_content_id and status = 'published') then return false; end if;
      content_kind := 'article';
    else
      if not exists (select 1 from public.projects where id = p_content_id and status = 'published') then return false; end if;
      content_kind := 'project';
    end if;
  end if;

  -- At most one caller per minute cleans at most 1000 old rows via the age index.
  -- Cleanup is lazy: no extra scheduler or credentials are required. Receipts
  -- have a 48-hour deduplication window; expired event ids can be counted again.
  update analytics_private.maintenance set last_cleanup_at = now()
    where id and last_cleanup_at < now() - interval '1 minute' returning true into cleanup_due;
  if cleanup_due then
    delete from analytics_private.event_receipts where event_id in (
      select event_id from analytics_private.event_receipts
      where received_at < now() - interval '48 hours'
      order by received_at limit 1000
    );
  end if;

  insert into analytics_private.event_receipts(event_id) values (p_event_id)
    on conflict (event_id) do nothing returning true into receipt_inserted;
  if not coalesce(receipt_inserted, false) then return false; end if;

  if p_event_type = 'page_view' then
    insert into public.analytics_page_daily(day, page_views) values (event_day, 1)
      on conflict (day) do update set page_views = public.analytics_page_daily.page_views + 1;
  else
    insert into public.analytics_content_daily(day, content_type, content_id, clicks)
      values (event_day, content_kind, p_content_id, 1)
      on conflict (day, content_type, content_id) do update set clicks = public.analytics_content_daily.clicks + 1;
  end if;
  return true;
end;
$$;
revoke all on function analytics_private.write_event(uuid, text, text) from public, anon, authenticated;
grant execute on function analytics_private.write_event(uuid, text, text) to anon, authenticated;

create function public.record_analytics_event(p_event_id uuid, p_event_type text, p_content_id text default null)
returns boolean language sql security invoker set search_path = '' as $$
  select analytics_private.write_event(p_event_id, p_event_type, p_content_id);
$$;
revoke all on function public.record_analytics_event(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_analytics_event(uuid, text, text) to anon, authenticated;

-- Read APIs use the caller's privileges and RLS. The explicit check distinguishes
-- lack of authorization from an authorized, genuinely empty analytics dataset.
create function public.get_admin_analytics(p_days integer default 30)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  end_day date := (now() at time zone 'Asia/Shanghai')::date;
  start_day date;
  result jsonb;
begin
  if p_days is null or p_days not in (7, 30, 90) then
    raise exception using errcode = '22023', message = 'Analytics range must be 7, 30 or 90 days';
  end if;
  if coalesce(auth.jwt()->>'aal', '') <> 'aal2' or not exists (
    select 1 from public.admin_users where user_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'Analytics requires the MFA-verified site administrator';
  end if;
  start_day := end_day - (p_days - 1);
  select jsonb_build_object(
    'enabled', true, 'timeZone', 'Asia/Shanghai', 'days', p_days,
    'startDate', start_day, 'endDate', end_day,
    'totalViews', (select coalesce(sum(page_views), 0) from public.analytics_page_daily),
    'todayViews', (select coalesce(sum(page_views), 0) from public.analytics_page_daily where day = end_day),
    'periodViews', (select coalesce(sum(page_views), 0) from public.analytics_page_daily where day between start_day and end_day),
    'articleClicks', (select coalesce(sum(clicks), 0) from public.analytics_content_daily where content_type = 'article' and day between start_day and end_day),
    'projectClicks', (select coalesce(sum(clicks), 0) from public.analytics_content_daily where content_type = 'project' and day between start_day and end_day),
    'totalArticleClicks', (select coalesce(sum(clicks), 0) from public.analytics_content_daily where content_type = 'article'),
    'totalProjectClicks', (select coalesce(sum(clicks), 0) from public.analytics_content_daily where content_type = 'project'),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
      'date', dates.day::date,
      'pageViews', coalesce((select page_views from public.analytics_page_daily p where p.day = dates.day::date), 0),
      'articleClicks', (select coalesce(sum(clicks), 0) from public.analytics_content_daily c where c.day = dates.day::date and content_type = 'article'),
      'projectClicks', (select coalesce(sum(clicks), 0) from public.analytics_content_daily c where c.day = dates.day::date and content_type = 'project')
    ) order by dates.day), '[]'::jsonb) from generate_series(start_day::timestamp, end_day::timestamp, interval '1 day') dates(day)),
    'articles', (select coalesce(jsonb_agg(item order by period_clicks desc, title), '[]'::jsonb) from (
      select a.title,
        coalesce((select sum(clicks) from public.analytics_content_daily c where c.content_type = 'article' and c.content_id = a.id and day between start_day and end_day), 0) period_clicks,
        jsonb_build_object('id', a.id, 'title', a.title, 'slug', a.slug, 'status', a.status,
          'clicks', coalesce((select sum(clicks) from public.analytics_content_daily c where c.content_type = 'article' and c.content_id = a.id and day between start_day and end_day), 0),
          'totalClicks', coalesce((select sum(clicks) from public.analytics_content_daily c where c.content_type = 'article' and c.content_id = a.id), 0)) item
      from public.articles a
    ) ranked_articles),
    'projects', (select coalesce(jsonb_agg(item order by period_clicks desc, title), '[]'::jsonb) from (
      select p.title,
        coalesce((select sum(clicks) from public.analytics_content_daily c where c.content_type = 'project' and c.content_id = p.id and day between start_day and end_day), 0) period_clicks,
        jsonb_build_object('id', p.id, 'title', p.title, 'slug', p.slug, 'status', p.status,
          'clicks', coalesce((select sum(clicks) from public.analytics_content_daily c where c.content_type = 'project' and c.content_id = p.id and day between start_day and end_day), 0),
          'totalClicks', coalesce((select sum(clicks) from public.analytics_content_daily c where c.content_type = 'project' and c.content_id = p.id), 0)) item
      from public.projects p
    ) ranked_projects)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_admin_analytics(integer) from public, anon, authenticated;
grant execute on function public.get_admin_analytics(integer) to authenticated;

comment on table public.analytics_page_daily is 'Daily aggregate page views; Asia/Shanghai day; no visitor identifiers.';
comment on table public.analytics_content_daily is 'Daily published-content detail opens; no visitor identifiers; retained after content removal for aggregate totals.';
comment on table analytics_private.event_receipts is 'Ephemeral per-event UUIDs for 48h retry deduplication. Lazy, indexed, bounded cleanup.';
commit;
