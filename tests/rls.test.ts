import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';

// Real PostgreSQL policy execution, with minimal Supabase auth/storage schemas.
// This does not emulate GoTrue or the Storage HTTP service.
const db = new PGlite();
const admin = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create table auth.mfa_factors(user_id uuid, status text, factor_type text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth, storage to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select jsonb_build_object('aal', nullif(current_setting('request.jwt.claim.aal', true), '')) $$;
    grant execute on function auth.jwt() to anon, authenticated;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
  `);
  await db.exec(readFileSync('supabase/migrations/20260916000000_initial_schema.sql', 'utf8'));
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
  await db.exec(`insert into auth.users values ('${admin}'), ('${other}');`);
  await db.exec(readFileSync('supabase/migrations/20260916044953_fix_backend_v1.sql', 'utf8'));
  await db.exec(`insert into public.admin_users(user_id) values ('${admin}');
    insert into projects(id, slug, title, status) values ('private-project', 'private-project', 'Hidden', 'draft'), ('archived-project', 'archived-project', 'Hidden archive', 'archived');
    insert into articles(id, slug, title, status) values ('private-article', 'private-article', 'Hidden', 'draft'), ('archived-article', 'archived-article', 'Hidden archive', 'archived');
    insert into storage.objects(bucket_id,name) values ('media','public.png'), ('other','private.png');`);
  const migration = readFileSync('supabase/migrations/20261004070228_enforce_admin_mfa.sql', 'utf8');
  await expect(db.exec(migration)).rejects.toThrow('bind the sole admin TOTP');
  await db.exec('rollback');
  await db.exec(`insert into auth.mfa_factors values ('${admin}', 'verified', 'totp');`);
  await db.exec(migration);
}, 30000);
afterAll(async () => { await db.close(); });

async function asRole(role: 'anon' | 'authenticated', user: string, action: () => Promise<void>, aal = 'aal2') {
  await db.exec(`set role ${role}; set request.jwt.claim.sub = '${user}'; set request.jwt.claim.aal = '${aal}';`);
  try { await action(); } finally { await db.exec('reset role; reset request.jwt.claim.sub; reset request.jwt.claim.aal;'); }
}

it.each(['aal1', ''])('admin at %s can verify membership and read public data but cannot read drafts or mutate', async aal => {
  await asRole('authenticated', admin, async () => {
    expect((await db.query('select * from admin_users')).rows).toHaveLength(1);
    for (const table of ['projects', 'articles']) {
      expect((await db.query(`select status from ${table}`)).rows.every(row => row.status === 'published')).toBe(true);
      expect((await db.query(`select id from ${table} where status in ('draft','archived')`)).rows).toEqual([]);
      await expect(db.exec(`insert into ${table}(slug,title) values ('mfa-denied','Denied')`)).rejects.toThrow();
      expect((await db.query(`update ${table} set title='Denied' returning id`)).rows).toEqual([]);
      expect((await db.query(`delete from ${table} returning id`)).rows).toEqual([]);
    }
    expect((await db.query('select id from site_settings')).rows).toHaveLength(1);
    expect((await db.query("update site_settings set site_intro='Denied' returning id")).rows).toEqual([]);
    expect((await db.query('delete from site_settings returning id')).rows).toEqual([]);
    await expect(db.exec("insert into site_settings(id) values ('mfa-denied')")).rejects.toThrow();
    expect((await db.query('select name from storage.objects')).rows).toEqual([{ name: 'public.png' }]);
    await expect(db.exec("insert into storage.objects(bucket_id,name) values ('media','mfa-denied.png')")).rejects.toThrow();
    expect((await db.query("update storage.objects set name='Denied' returning id")).rows).toEqual([]);
    expect((await db.query('delete from storage.objects returning id')).rows).toEqual([]);
  }, aal);
});

it('a permissive policy cannot bypass the MFA write restriction', async () => {
  await db.exec('create policy accidental_authenticated_insert on projects for insert to authenticated with check (true)');
  try {
    await asRole('authenticated', admin, async () => {
      await expect(db.exec("insert into projects(slug,title) values ('bypass','Denied')")).rejects.toThrow();
    }, 'aal1');
    await asRole('authenticated', other, async () => {
      await expect(db.exec("insert into projects(slug,title) values ('bypass','Denied')")).rejects.toThrow();
    });
  } finally { await db.exec('drop policy accidental_authenticated_insert on projects'); }
});

it.each(['anon', 'authenticated'] as const)('%s reads only published content and cannot mutate or self-enroll', async role => {
  await asRole(role, role === 'anon' ? '' : other, async () => {
    for (const table of ['projects', 'articles']) {
      const visible = await db.query<{ status: string }>(`select status from ${table}`);
      expect(visible.rows.length).toBeGreaterThan(0);
      expect(visible.rows.every(row => row.status === 'published')).toBe(true);
      await expect(db.exec(`insert into ${table}(slug,title) values ('denied','Denied')`)).rejects.toThrow();
      if (role === 'anon') {
        await expect(db.exec(`update ${table} set title='denied'`)).rejects.toThrow();
        await expect(db.exec(`delete from ${table}`)).rejects.toThrow();
      } else {
        expect((await db.query(`update ${table} set title='denied' returning id`)).rows).toEqual([]);
        expect((await db.query(`delete from ${table} returning id`)).rows).toEqual([]);
      }
    }
    expect((await db.query('select id from site_settings')).rows).toHaveLength(1);
    await expect(db.exec("insert into site_settings(id) values ('denied')")).rejects.toThrow();
    if (role === 'anon') {
      await expect(db.exec("update site_settings set site_intro='denied'")).rejects.toThrow();
      await expect(db.exec('delete from site_settings')).rejects.toThrow();
    } else {
      expect((await db.query("update site_settings set site_intro='denied' returning id")).rows).toEqual([]);
      expect((await db.query('delete from site_settings returning id')).rows).toEqual([]);
      expect((await db.query('select * from admin_users')).rows).toEqual([]);
    }
    await expect(db.exec(`insert into admin_users(user_id) values ('${other}')`)).rejects.toThrow();
    expect((await db.query('select name from storage.objects')).rows).toEqual([{ name: 'public.png' }]);
    await expect(db.exec("insert into storage.objects(bucket_id,name) values ('media','denied.png')")).rejects.toThrow();
    expect((await db.query("update storage.objects set name='denied.png' returning id")).rows).toEqual([]);
    expect((await db.query('delete from storage.objects returning id')).rows).toEqual([]);
  });
});

it('admin can manage content, settings and media but cannot enroll admins or move objects to another bucket', async () => {
  await asRole('authenticated', admin, async () => {
    expect((await db.query('select * from admin_users')).rows).toHaveLength(1);
    await expect(db.exec(`insert into admin_users(user_id) values ('${other}')`)).rejects.toThrow();
    for (const table of ['projects', 'articles']) {
      expect((await db.query(`select id from ${table} where status = 'draft'`)).rows).toHaveLength(1);
      await db.exec(`insert into ${table}(id,slug,title,sort_order) values ('test','test','Test',17)`);
      for (const status of ['published', 'archived', 'draft']) {
        expect((await db.query(`update ${table} set status='${status}' where id='test' returning sort_order`)).rows).toEqual([{ sort_order: 17 }]);
      }
      expect((await db.query(`delete from ${table} where id='test' returning id`)).rows).toHaveLength(1);
    }
    await db.exec("insert into site_settings(id) values ('test'); update site_settings set site_intro='Updated' where id='test'; delete from site_settings where id='test';");
    await db.exec("insert into storage.objects(bucket_id,name) values ('media','test.png'); update storage.objects set name='updated.png' where name='test.png';");
    await expect(db.exec("update storage.objects set bucket_id='other' where name='updated.png'")).rejects.toThrow();
    expect((await db.query("delete from storage.objects where name='updated.png' returning id")).rows).toHaveLength(1);
  });
  const bucket = await db.query<{ file_size_limit: number; allowed_mime_types: string[] }>("select file_size_limit, allowed_mime_types from storage.buckets where id='media'");
  expect(Number(bucket.rows[0].file_size_limit)).toBe(5242880);
  expect(bucket.rows[0].allowed_mime_types).toEqual(['image/jpeg', 'image/png', 'image/webp']);
});

it('revoking membership immediately removes database write and draft access', async () => {
  await db.exec(`delete from admin_users where user_id='${admin}'`);
  await asRole('authenticated', admin, async () => {
    expect((await db.query("select id from projects where status='draft'")).rows).toEqual([]);
    await expect(db.exec("insert into projects(slug,title) values ('revoked','Revoked')")).rejects.toThrow();
  });
});
