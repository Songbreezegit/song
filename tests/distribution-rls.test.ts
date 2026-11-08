import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';

const db = new PGlite();
const admin = '11111111-1111-4111-8111-111111111111';
const member = '22222222-2222-4222-8222-222222222222';
const account = 'aaaaaaaa-1111-4111-8111-111111111111';
const source = 'bbbbbbbb-1111-4111-8111-111111111111';
const image = 'cccccccc-1111-4111-8111-111111111111';
const otherImage = 'dddddddd-1111-4111-8111-111111111111';
const migration = readFileSync('supabase/migrations/20261108173132_add_private_distribution_m1.sql', 'utf8');
const payload = { title: 'Source', body: 'Text', tags: ['开发'], content_type: 'image_text', project_id: 'existing-project', promotion_goal: 'download', status: 'draft' };
let originalPolicies: unknown[];

async function save(id = source, version: number | null = null, values: object = payload, accounts = [account], media = [image]) {
  return db.query<{ result: { id: string; version: number; status: string; account_ids: string[]; media_ids: string[] } }>('select public.save_distribution_post($1,$2,$3::jsonb,$4::uuid[],$5::uuid[]) result', [id, version, JSON.stringify(values), accounts, media]);
}
async function asRole(role: string, user: string, aal: string, operation: () => Promise<void>) {
  await db.exec(`set role ${role}; set request.jwt.claim.sub='${user}'; set request.jwt.claim.aal='${aal}';`);
  try { await operation(); } finally { await db.exec('reset role; reset request.jwt.claim.sub; reset request.jwt.claim.aal;'); }
}
const asAdmin = (operation: () => Promise<void>) => asRole('authenticated', admin, 'aal2', operation);

beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create table auth.mfa_factors(user_id uuid, status text, factor_type text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal',nullif(current_setting('request.jwt.claim.aal',true),'')) $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema auth, storage, public to anon, authenticated;
    grant select, insert, update, delete on storage.objects to anon, authenticated;`);
  await db.exec(readFileSync('supabase/migrations/20260916000000_initial_schema.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20260916044953_fix_backend_v1.sql', 'utf8'));
  await db.exec(`insert into auth.users values ('${admin}'),('${member}'); insert into admin_users(user_id) values ('${admin}');
    insert into auth.mfa_factors values ('${admin}','verified','totp');
    insert into projects(id,slug,title,status) values ('existing-project','existing-project','Existing','draft');
    insert into storage.objects(id,bucket_id,name) values ('${image}','media','existing.png'),('${otherImage}','other','private.png');`);
  await db.exec(readFileSync('supabase/migrations/20261004093439_enforce_admin_mfa.sql', 'utf8'));
  originalPolicies = (await db.query("select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies order by schemaname,tablename,policyname")).rows;
  await db.exec(migration);
  await db.exec(`insert into distribution_accounts(id,platform,name,project_id) values ('${account}','xiaohongshu','Account','existing-project');`);
  await asAdmin(async () => { await save(); });
}, 30000);
afterAll(async () => { await db.close(); });

it('reapplying the migration is idempotent, preserves rows and every preexisting policy', async () => {
  await db.exec(migration);
  expect((await db.query('select id from distribution_posts')).rows).toEqual([{ id: source }]);
  expect((await db.query("select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where tablename not like 'distribution_%' order by schemaname,tablename,policyname")).rows).toEqual(originalPolicies);
});

it('review-only read-only smoke checks the deployed-policy contract without writing fixtures', async () => {
  await db.exec(readFileSync('supabase/tests/distribution_security_smoke.sql', 'utf8'));
  expect((await db.query('select count(*)::int count from distribution_posts')).rows).toEqual([{ count: 1 }]);
});

it('anonymous role has no table or RPC privileges', async () => {
  await asRole('anon', '', '', async () => {
    for (const table of ['distribution_accounts','distribution_posts','distribution_post_targets','distribution_post_media']) {
      for (const sql of [`select * from ${table}`, `delete from ${table}`, `update ${table} set created_at=now()`]) await expect(db.exec(sql)).rejects.toThrow('permission denied');
    }
    await expect(save()).rejects.toThrow('permission denied');
    await expect(db.exec("insert into distribution_accounts(platform,name) values ('other','Denied')")).rejects.toThrow();
    await expect(db.exec("insert into distribution_posts(title) values ('Denied')")).rejects.toThrow();
  });
});

it.each([{ user: member, aal: 'aal2' }, { user: member, aal: 'aal1' }, { user: admin, aal: 'aal1' }, { user: admin, aal: '' }, { user: '', aal: 'aal2' }])('denies every private read/write to $user at $aal', async ({ user, aal }) => {
  await asRole('authenticated', user, aal, async () => {
    for (const table of ['distribution_accounts','distribution_posts','distribution_post_targets','distribution_post_media']) {
      expect((await db.query(`select * from ${table}`)).rows).toEqual([]);
      expect((await db.query(`update ${table} set created_at=now() returning *`)).rows).toEqual([]);
      if (table === 'distribution_accounts') await expect(db.exec(`delete from ${table}`)).rejects.toThrow('permission denied');
      else expect((await db.query(`delete from ${table} returning *`)).rows).toEqual([]);
    }
    await expect(db.exec("insert into distribution_accounts(platform,name) values ('other','Denied')")).rejects.toThrow();
    await expect(db.exec("insert into distribution_posts(title) values ('Denied')")).rejects.toThrow();
    await expect(db.exec(`insert into distribution_post_targets values ('${source}','${account}')`)).rejects.toThrow();
    await expect(db.exec(`insert into distribution_post_media(post_id,media_id,sort_order) values ('${source}','${image}',0)`)).rejects.toThrow();
    await expect(save()).rejects.toThrow('MFA-verified');
  });
});

it('restrictive guards withstand accidental permissive policies on all four tables', async () => {
  const tables = ['distribution_accounts','distribution_posts','distribution_post_targets','distribution_post_media'];
  for (const table of tables) await db.exec(`create policy accidental_open on ${table} for all to authenticated using (true) with check (true)`);
  try {
    for (const [user, aal] of [[member,'aal2'],[admin,'aal1']]) await asRole('authenticated', user, aal, async () => {
      for (const table of tables) expect((await db.query(`select * from ${table}`)).rows).toEqual([]);
      await expect(db.exec("insert into distribution_posts(title) values ('Denied')")).rejects.toThrow();
    });
  } finally { for (const table of tables) await db.exec(`drop policy accidental_open on ${table}`); }
});

it('MFA admin performs source CRUD atomically, with optimistic versions and immutable timestamps', async () => {
  await asAdmin(async () => {
    const result = (await save(source, 1, { ...payload, title: 'Updated' })).rows[0].result;
    expect(result).toMatchObject({ id: source, version: 2, account_ids: [account], media_ids: [image] });
    await expect(save(source, 1)).rejects.toThrow('Post changed');
    await expect(save()).rejects.toThrow('duplicate key');
    expect((await db.query('select count(*)::int count from distribution_posts')).rows).toEqual([{ count: 1 }]);
    expect((await db.query("update distribution_accounts set name='Updated',version=999,created_at='2000-01-01' where id=$1 returning version,created_at > '2020-01-01' as timestamp_ok", [account])).rows).toEqual([{ version: 2, timestamp_ok: true }]);
  });
});

it('invalid project/target/media rolls the entire source edit back and validates both link sets', async () => {
  await asAdmin(async () => {
    for (const args of [
      { values: { ...payload, project_id: 'missing' }, accounts: [account], media: [image] },
      { values: payload, accounts: [member], media: [image] },
      { values: payload, accounts: [account], media: [otherImage] },
      { values: payload, accounts: [account], media: [member] },
    ]) await expect(save(source, 2, args.values, args.accounts, args.media)).rejects.toThrow();
    expect((await db.query('select title,version from distribution_posts')).rows).toEqual([{ title: 'Updated', version: 2 }]);
    expect((await db.query('select account_id from distribution_post_targets')).rows).toEqual([{ account_id: account }]);
    expect((await db.query('select media_id from distribution_post_media')).rows).toEqual([{ media_id: image }]);
  });
});

it.each(['javascript:alert(1)','//example.com','https://user:pass@example.com','https://example.com\\evil','https://example.com\n'])('database rejects dangerous homepage %j', async url => {
  await asAdmin(async () => { await expect(db.query('update distribution_accounts set profile_url=$1 where id=$2', [url,account])).rejects.toThrow(); });
});

it('database rejects malformed values, spoofed RPC metadata and duplicate/null relations', async () => {
  await asAdmin(async () => {
    for (const change of [{ title: '' }, { body: 'x'.repeat(100001) }, { status: 'published' }, { tags: ['x','x'] }, { tags: [null] }, { tags: [1] }, { version: 99 }])
      await expect(save(source, 2, { ...payload, ...change })).rejects.toThrow();
    await expect(save(source, 2, payload, [account,account])).rejects.toThrow('Invalid relation');
    await expect(save(source, 2, payload, [account], [image,image])).rejects.toThrow('Invalid relation');
    await expect(save(source, 2, payload, [null as unknown as string])).rejects.toThrow('Invalid relation');
  });
});

it('archive disables new targeting while preserving existing associations and permits unrelated edits', async () => {
  await asAdmin(async () => {
    expect((await db.query("update distribution_accounts set archived_at='2000-01-01',is_enabled=false where id=$1 returning archived_at > '2020-01-01' as timestamp_ok", [account])).rows).toEqual([{ timestamp_ok: true }]);
    expect((await save(source, 2)).rows[0].result.version).toBe(3);
    await expect(save(member, null)).rejects.toThrow('enabled, unarchived');
    expect((await db.query('select account_id from distribution_post_targets')).rows).toHaveLength(1);
    await expect(db.query('delete from distribution_accounts where id=$1', [account])).rejects.toThrow('permission denied');
    await db.query('update distribution_accounts set archived_at=null,is_enabled=false where id=$1', [account]);
    await expect(save(member, null)).rejects.toThrow('enabled, unarchived');
  });
});

it('ready is never published and cannot be deleted until explicitly returned to draft', async () => {
  await asAdmin(async () => {
    expect((await save(source, 3, { ...payload, status: 'ready' })).rows[0].result.status).toBe('ready');
    expect((await db.query('delete from distribution_posts where id=$1 returning id', [source])).rows).toEqual([]);
    await save(source, 4);
  });
});

it('project removal nulls only references; attached media cannot be deleted; source deletion cascades junctions', async () => {
  await asAdmin(async () => {
    expect((await db.query('select status from projects')).rows).toEqual([{ status: 'draft' }]);
    await expect(db.query('delete from storage.objects where id=$1', [image])).rejects.toThrow();
    await db.exec("delete from projects where id='existing-project'");
    expect((await db.query('select project_id from distribution_accounts')).rows).toEqual([{ project_id: null }]);
    expect((await db.query('select project_id from distribution_posts')).rows).toEqual([{ project_id: null }]);
    expect((await db.query('delete from distribution_posts where id=$1 returning id', [source])).rows).toEqual([{ id: source }]);
    expect((await db.query('select * from distribution_post_targets')).rows).toEqual([]);
    expect((await db.query('select * from distribution_post_media')).rows).toEqual([]);
    expect((await db.query('delete from storage.objects where id=$1 returning id', [image])).rows).toHaveLength(1);
  });
});

it('membership revocation immediately closes access even for an aal2 JWT', async () => {
  await db.exec(`delete from admin_users where user_id='${admin}'`);
  await asAdmin(async () => {
    expect((await db.query('select * from distribution_accounts')).rows).toEqual([]);
    await expect(save()).rejects.toThrow('MFA-verified');
  });
});

it('reviewed rollback removes only distribution objects and allows a clean reapply', async () => {
  await db.exec(readFileSync('supabase/rollbacks/distribution_m1.sql', 'utf8'));
  expect((await db.query("select to_regclass('public.distribution_posts') table_name")).rows).toEqual([{ table_name: null }]);
  expect((await db.query("select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies order by schemaname,tablename,policyname")).rows).toEqual(originalPolicies);
  await db.exec(migration);
});
