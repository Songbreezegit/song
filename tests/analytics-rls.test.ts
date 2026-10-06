import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { EnabledAdminAnalytics } from '../src/services/analyticsService';

// Exercise the actual PostgreSQL functions, grants and RLS. HTTP fixtures in
// browser tests deliberately cannot prove the aggregate access boundary.
const db = new PGlite();
const admin = '11111111-1111-4111-8111-111111111111';
const member = '22222222-2222-4222-8222-222222222222';
const today = "(now() at time zone 'Asia/Shanghai')::date";
const eventId = (number: number) => `a0000000-0000-4000-8000-${String(number).padStart(12, '0')}`;

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create table auth.mfa_factors(user_id uuid, status text, factor_type text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select jsonb_build_object('aal', nullif(current_setting('request.jwt.claim.aal', true), '')) $$;
    grant usage on schema public, auth, storage to anon, authenticated;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
  `);
  await db.exec(readFileSync('supabase/migrations/20260916000000_initial_schema.sql', 'utf8'));
  await db.exec(`insert into auth.users values ('${admin}'), ('${member}');`);
  await db.exec(readFileSync('supabase/migrations/20260916044953_fix_backend_v1.sql', 'utf8'));
  await db.exec(`insert into public.admin_users(user_id) values ('${admin}');
    insert into auth.mfa_factors values ('${admin}', 'verified', 'totp');
    insert into projects(id, slug, title, status) values ('legacy-project', 'legacy-project', 'Legacy project', 'published'), ('draft-project', 'draft-project', 'Draft project', 'draft');
    insert into articles(id, slug, title, status) values ('legacy-article', 'legacy-article', 'Legacy article', 'published'), ('archived-article', 'archived-article', 'Archived article', 'archived'), ('zero-article', 'zero-article', 'Zero clicks article', 'published');`);
  await db.exec(readFileSync('supabase/migrations/20261004093439_enforce_admin_mfa.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20261006192850_add_private_analytics.sql', 'utf8'));
}, 30000);
beforeEach(async () => {
  await db.exec('truncate analytics_page_daily, analytics_content_daily, analytics_private.event_receipts;');
});
afterAll(async () => { await db.close(); });

async function asRole<T>(role: 'anon' | 'authenticated', user: string, action: () => Promise<T>, aal = 'aal2'): Promise<T> {
  await db.exec(`set role ${role}; set request.jwt.claim.sub = '${user}'; set request.jwt.claim.aal = '${aal}';`);
  try { return await action(); }
  finally { await db.exec('reset role; reset request.jwt.claim.sub; reset request.jwt.claim.aal;'); }
}

async function record(number: number, type = 'page_view', content: string | null = null) {
  const result = await db.query<{ recorded: boolean }>('select public.record_analytics_event($1::uuid, $2::text, $3::text) as recorded', [eventId(number), type, content]);
  return result.rows[0]!.recorded;
}

async function aggregate(days = 30) {
  return asRole('authenticated', admin, async () => {
    const result = await db.query<{ snapshot: EnabledAdminAnalytics }>('select public.get_admin_analytics($1::integer) as snapshot', [days]);
    return result.rows[0]!.snapshot;
  });
}

describe('private site analytics database boundaries', () => {
  it('accepts anonymous bounded events, deduplicates retry IDs and preserves legacy text content IDs', async () => {
    await asRole('anon', '', async () => {
      expect(await record(1)).toBe(true);
      expect(await record(1)).toBe(false);
      expect(await record(2, 'article_click', 'legacy-article')).toBe(true);
      expect(await record(2, 'article_click', 'legacy-article')).toBe(false);
      expect(await record(3, 'project_click', 'legacy-project')).toBe(true);
      expect(await record(4, 'article_click', 'legacy-article')).toBe(true);
    });
    const result = await aggregate();
    expect(result).toMatchObject({ totalViews: 1, todayViews: 1, periodViews: 1, articleClicks: 2, projectClicks: 1, timeZone: 'Asia/Shanghai' });
    expect(result.articles.find(item => item.id === 'legacy-article')).toMatchObject({ clicks: 2, totalClicks: 2 });
    expect(result.projects.find(item => item.id === 'legacy-project')).toMatchObject({ clicks: 1, totalClicks: 1 });
    const day = await db.query<{ actual: string; expected: string }>(`select to_char(day, 'YYYY-MM-DD') actual, to_char(${today}, 'YYYY-MM-DD') expected from analytics_page_daily`);
    expect(day.rows[0]!.actual).toBe(day.rows[0]!.expected);
    expect((await db.query('select title, status from articles where id=\'legacy-article\'')).rows).toEqual([{ title: 'Legacy article', status: 'published' }]);
  });

  it('refuses unpublished, missing and mismatched targets without adding receipts or clicks', async () => {
    await asRole('anon', '', async () => {
      expect(await record(1, 'project_click', 'draft-project')).toBe(false);
      expect(await record(2, 'article_click', 'archived-article')).toBe(false);
      expect(await record(3, 'article_click', 'missing')).toBe(false);
      expect(await record(4, 'article_click', 'legacy-project')).toBe(false);
    });
    expect((await db.query('select * from analytics_content_daily')).rows).toEqual([]);
    expect((await db.query('select * from analytics_private.event_receipts')).rows).toEqual([]);
  });

  it('rejects invalid event surfaces instead of allowing arbitrary dates, targets or increments', async () => {
    await asRole('anon', '', async () => {
      await expect(record(1, 'arbitrary_event')).rejects.toThrow('Invalid analytics event');
      await expect(record(2, 'page_view', 'legacy-project')).rejects.toThrow('Page views cannot target content');
      await expect(record(3, 'article_click', null)).rejects.toThrow('Invalid analytics content id');
      await expect(record(4, 'project_click', 'x'.repeat(201))).rejects.toThrow('Invalid analytics content id');
      await expect(db.exec("select record_analytics_event(null, 'page_view', null)")).rejects.toThrow('Invalid analytics event');
    });
    expect((await db.query('select * from analytics_page_daily')).rows).toEqual([]);
  });

  it('keeps anonymous aggregates and receipts inaccessible even though event submission is public', async () => {
    await asRole('anon', '', async () => {
      await expect(db.exec('select get_admin_analytics(30)')).rejects.toThrow();
      for (const table of ['analytics_page_daily', 'analytics_content_daily', 'analytics_private.event_receipts', 'analytics_private.maintenance']) {
        await expect(db.exec(`select * from ${table}`)).rejects.toThrow();
      }
    });
  });

  it.each([{ user: member, aal: 'aal2' }, { user: admin, aal: 'aal1' }, { user: admin, aal: '' }])('denies aggregate and raw rows to user $user at $aal', async ({ user, aal }) => {
    await db.exec(`insert into analytics_page_daily values (${today}, 12);`);
    await asRole('authenticated', user, async () => {
      await expect(db.exec('select get_admin_analytics(30)')).rejects.toThrow('MFA-verified site administrator');
      expect((await db.query('select * from analytics_page_daily')).rows).toEqual([]);
      expect((await db.query('select * from analytics_content_daily')).rows).toEqual([]);
      await expect(db.exec('select * from analytics_private.event_receipts')).rejects.toThrow();
    }, aal);
  });

  it('allows the sole MFA administrator to read but never directly edit stored counters', async () => {
    await asRole('authenticated', admin, async () => {
      expect(await record(1)).toBe(true);
      expect((await db.query('select * from analytics_page_daily')).rows).toHaveLength(1);
      await expect(db.exec(`insert into analytics_page_daily values (${today}, 999)`)).rejects.toThrow();
      await expect(db.exec('update analytics_page_daily set page_views=999')).rejects.toThrow();
      await expect(db.exec('delete from analytics_page_daily')).rejects.toThrow();
      await expect(db.exec(`insert into analytics_content_daily values (${today}, 'article', 'legacy-article', 999)`)).rejects.toThrow();
      await expect(db.exec('delete from analytics_private.event_receipts')).rejects.toThrow();
    });
  });

  it('uses inclusive Beijing date ranges, preserves lifetime totals and returns zero-click titles', async () => {
    await db.exec(`insert into analytics_page_daily values (${today}, 5), (${today} - 6, 7), (${today} - 7, 11), (${today} - 40, 13);
      insert into analytics_content_daily values (${today}, 'article', 'legacy-article', 2), (${today} - 6, 'article', 'legacy-article', 3), (${today} - 7, 'article', 'legacy-article', 5);`);
    const result = await aggregate(7);
    expect(result).toMatchObject({ days: 7, timeZone: 'Asia/Shanghai', todayViews: 5, totalViews: 36, periodViews: 12, articleClicks: 5, totalArticleClicks: 10, projectClicks: 0 });
    expect(result.daily).toHaveLength(7);
    expect(result.daily[0]!.pageViews).toBe(7);
    expect(result.daily.at(-1)).toMatchObject({ pageViews: 5, articleClicks: 2, projectClicks: 0 });
    expect(result.daily.slice(1, -1).every(point => point.pageViews === 0 && point.articleClicks === 0)).toBe(true);
    expect(result.articles.find(item => item.id === 'legacy-article')).toMatchObject({ clicks: 5, totalClicks: 10 });
    expect(result.articles.find(item => item.id === 'zero-article')).toMatchObject({ title: 'Zero clicks article', clicks: 0, totalClicks: 0 });
    expect(result.articles.find(item => item.id === 'archived-article')).toMatchObject({ status: 'archived', clicks: 0, totalClicks: 0 });
    expect((await aggregate(30)).periodViews).toBe(23);
    expect((await aggregate(90)).periodViews).toBe(36);
    await expect(aggregate(365)).rejects.toThrow('7, 30 or 90 days');
  });

  it('revoked administrator membership removes aggregate access immediately', async () => {
    await db.exec(`delete from admin_users where user_id='${admin}'`);
    try { await expect(aggregate()).rejects.toThrow('MFA-verified site administrator'); }
    finally { await db.exec(`insert into admin_users(user_id) values ('${admin}')`); }
  });
});
