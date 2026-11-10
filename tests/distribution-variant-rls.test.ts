import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { DistributionVariantRecord } from '../src/types/distribution';

const db = new PGlite();
const admin = randomUUID();
const member = randomUUID();
const image = randomUUID();
const cover = randomUUID();
const foreignImage = randomUUID();
const video = randomUUID();
const legacyPost = randomUUID();
const legacyAccount = randomUUID();
const migration = (name: string) => readFileSync(`supabase/migrations/${name}.sql`, 'utf8');
const postPayload = { title: 'Source', body: 'Original body', tags: ['礼账', 'A，B'], content_type: 'image_text',
  project_id: 'preserved-project', promotion_goal: 'awareness', status: 'draft' };
const variantPayload = { title: '独立标题', body: 'Independent body', tags: ['🌿,原样'], content_type: 'image_text', status: 'draft' };
const link = (media_id: string, is_cover = false) => ({ media_id, is_cover, aspect_ratio_hint: '', processing_notes: '' });

async function asRole<T>(role: 'authenticated' | 'anon', user: string, aal: string, operation: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${role}; set request.jwt.claim.sub='${user}'; set request.jwt.claim.aal='${aal}';`);
  try { return await operation(); }
  finally { await db.exec('reset role; reset request.jwt.claim.sub; reset request.jwt.claim.aal;'); }
}
const asAdmin = <T,>(operation: () => Promise<T>) => asRole('authenticated', admin, 'aal2', operation);

async function savePost(id: string, accounts: string[], media: string[], version: number | null = null, payload = postPayload) {
  const { rows } = await db.query<{ result: { version: number } }>(
    'select public.save_distribution_post($1,$2,$3::jsonb,$4::uuid[],$5::uuid[]) result', [id, version, JSON.stringify(payload), accounts, media]);
  return rows[0].result;
}
async function variantRpc(sql: string, params: unknown[]) {
  const { rows } = await db.query<{ result: DistributionVariantRecord }>(sql, params);
  return rows[0].result;
}
const create = (id: string, source: string, account: string) => variantRpc('select public.create_distribution_variant($1,$2,$3) result', [id, source, account]);
const save = (id: string, version: number, media: ReturnType<typeof link>[] = [link(image)], payload = variantPayload) =>
  variantRpc('select public.save_distribution_variant($1,$2,$3::jsonb,$4::jsonb) result', [id, version, JSON.stringify(payload), JSON.stringify(media)]);
const sync = (id: string, version: number, sourceVersion: number, fields: string[]) =>
  variantRpc('select public.sync_distribution_variant($1,$2,$3,$4::text[]) result', [id, version, sourceVersion, fields]);

async function fixtures(platform = 'xiaohongshu', media = [image, cover]) {
  const source = randomUUID(), account = randomUUID(), other = randomUUID();
  await db.query('insert into public.distribution_accounts(id,platform,name) values ($1,$3,$4),($2,$3,$5)', [account, other, platform, 'Account A', 'Account B']);
  await savePost(source, [account, other], media);
  return { source, account, other };
}

let oldSchema: unknown[];
let oldRows: unknown[];
const schemaBefore = () => db.query(`select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
 from pg_policies where tablename not in ('distribution_variants','distribution_variant_media')
 order by schemaname,tablename,policyname`);
const existingRows = () => db.query(`select jsonb_build_object(
 'source',(select to_jsonb(p) from public.distribution_posts p where id=$1),
 'account',(select to_jsonb(a) from public.distribution_accounts a where id=$2),
 'media',(select jsonb_agg(to_jsonb(m) order by sort_order) from public.distribution_post_media m where post_id=$1),
 'target',(select jsonb_agg(to_jsonb(t)) from public.distribution_post_targets t where post_id=$1),
 'project',(select to_jsonb(p) from public.projects p where id='preserved-project')
 ) snapshot`, [legacyPost, legacyAccount]);

beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create table auth.mfa_factors(user_id uuid, status text, factor_type text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal',nullif(current_setting('request.jwt.claim.aal',true),'')) $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, metadata jsonb);
    alter table storage.objects enable row level security;
    grant usage on schema auth,storage,public to anon,authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;`);
  await db.exec(migration('20260916000000_initial_schema'));
  await db.exec(migration('20260916044953_fix_backend_v1'));
  await db.exec(`insert into auth.users values ('${admin}'),('${member}');
    insert into admin_users(user_id) values ('${admin}');
    insert into auth.mfa_factors values ('${admin}','verified','totp');
    insert into projects(id,slug,title,status) values ('preserved-project','preserved','Existing','draft');
    insert into storage.objects values ('${image}','media','source.png','{"mimetype":"image/png"}'),
      ('${cover}','media','cover.webp','{"mimetype":"image/webp"}'),
      ('${foreignImage}','other','forbidden.png','{"mimetype":"image/png"}'),
      ('${video}','media','existing-video.mp4','{"mimetype":"video/mp4"}');`);
  await db.exec(migration('20261004093439_enforce_admin_mfa'));
  await db.exec(migration('20261108173132_add_private_distribution_m1'));
  await db.exec(migration('20261109161000_report_distribution_version_conflicts'));
  await asAdmin(async () => {
    await db.query("insert into distribution_accounts(id,platform,name) values ($1,'other','Existing account')", [legacyAccount]);
    await savePost(legacyPost, [legacyAccount], [image]);
  });
  oldSchema = (await schemaBefore()).rows;
  oldRows = (await existingRows()).rows;
  await db.exec(migration('20261110100401_add_distribution_platform_variants'));
}, 30000);
afterAll(async () => { await db.close(); });

it('keeps every old policy and source row without generating variants', async () => {
  expect((await schemaBefore()).rows).toEqual(oldSchema);
  expect((await existingRows()).rows).toEqual(oldRows);
  expect((await db.query('select id from distribution_variants')).rows).toEqual([]);
});

it('runs the M2 read-only smoke across five policy contexts', async () => {
  const results = await db.exec(readFileSync('supabase/tests/distribution_m2_security_smoke.sql', 'utf8'));
  expect(results.flatMap(result => result.rows)).toContainEqual({ verification: { passed: true, contexts: 5, writes_executed: false } });
});

it.each([{ role: 'anon', user: '', aal: '' }, { role: 'authenticated', user: member, aal: 'aal2' },
  { role: 'authenticated', user: admin, aal: 'aal1' } ] as const)('enforces the table and RPC boundary for $role at $aal', async ({ role, user, aal }) => {
  const draft = await asAdmin(() => create(randomUUID(), legacyPost, legacyAccount));
  await asRole(role, user, aal, async () => {
    if (role === 'anon') {
      await expect(db.query('select id from distribution_variants')).rejects.toMatchObject({ code: '42501' });
      await expect(db.query('select media_id from distribution_variant_media')).rejects.toMatchObject({ code: '42501' });
    } else {
      expect((await db.query('select id from distribution_variants')).rows).toEqual([]);
      expect((await db.query('select media_id from distribution_variant_media')).rows).toEqual([]);
    }
    await expect(create(randomUUID(), legacyPost, legacyAccount)).rejects.toMatchObject({ code: '42501' });
    await expect(save(draft.id, draft.version)).rejects.toMatchObject({ code: '42501' });
    await expect(sync(draft.id, draft.version, 2, ['body'])).rejects.toMatchObject({ code: '42501' });
  });
});

it('blocks an accidental permissive policy without MFA and keeps RPCs invoker-only', async () => {
  await db.exec('create policy accidentally_open on distribution_variants for all to authenticated using (true) with check (true)');
  try {
    await asRole('authenticated', admin, 'aal1', async () => {
      expect((await db.query('select * from distribution_variants')).rows).toEqual([]);
      expect((await db.query("update distribution_variants set title='oops' returning id")).rows).toEqual([]);
    });
  } finally { await db.exec('drop policy accidentally_open on distribution_variants'); }
  const { rows } = await db.query(`select proname, prosecdef, proconfig, has_function_privilege('anon',oid,'execute') anon
    from pg_proc where proname in ('create_distribution_variant','save_distribution_variant','sync_distribution_variant')`);
  expect(rows).toHaveLength(3);
  for (const row of rows) expect(row).toMatchObject({ prosecdef: false, anon: false, proconfig: ['search_path=""'] });
});

it('clones ordered source media, deduplicates retries and keeps same-platform accounts independent', async () => {
  await asAdmin(async () => {
    const { source, account, other } = await fixtures();
    const id = randomUUID();
    const a = await create(id, source, account);
    const b = await create(randomUUID(), source, other);
    expect(a).toMatchObject({ id, version: 1, platform: 'xiaohongshu', title: 'Source', source_version: 1, status: 'draft' });
    expect(a.media).toEqual([link(image), link(cover)]);
    expect(await create(id, source, account)).toEqual(a);
    expect(await create(randomUUID(), source, account)).toEqual(a);
    const updated = await save(id, a.version, [link(cover, true), link(image)]);
    expect(updated).toMatchObject({ version: 2, title: variantPayload.title, tags: variantPayload.tags });
    expect(updated.media.map(item => [item.media_id, item.is_cover])).toEqual([[cover, true], [image, false]]);
    expect(await create(b.id, source, other)).toEqual(b);
    expect((await db.query('select title,version from distribution_posts where id=$1', [source])).rows).toEqual([{ title: 'Source', version: 1 }]);
  });
});

it('detects stale saves and rolls back the full aggregate when the media FK or bucket check fails', async () => {
  await asAdmin(async () => {
    const { source, account } = await fixtures();
    const a = await create(randomUUID(), source, account);
    const edited = await save(a.id, a.version, [link(cover, true)]);
    await expect(save(a.id, a.version)).rejects.toMatchObject({ code: 'PT409' });
    await expect(save(a.id, edited.version, [link(image), link(foreignImage)], { ...variantPayload, title: 'Must roll back' }))
      .rejects.toMatchObject({ code: '23503' });
    expect(await create(a.id, source, account)).toEqual(edited);
    await db.query('update distribution_variant_media set processing_notes=$2 where variant_id=$1', [a.id, 'Direct media edit']);
    await expect(save(a.id, edited.version)).rejects.toMatchObject({ code: 'PT409' });
  });
});

it('keeps authored fields after source edits and syncs selected changes using both versions', async () => {
  await asAdmin(async () => {
    const { source, account, other } = await fixtures();
    const a = await create(randomUUID(), source, account);
    const edited = await save(a.id, a.version, [link(image, true), link(cover)]);
    const next = await savePost(source, [account, other], [cover, image], 1, { ...postPayload, title: 'Source v2', body: 'New source body' });
    expect(await create(a.id, source, account)).toEqual(edited);
    await expect(sync(a.id, edited.version, 1, ['body'])).rejects.toMatchObject({ code: 'PT409' });
    await expect(sync(a.id, edited.version, next.version, [])).rejects.toMatchObject({ code: '22023' });
    await expect(sync(a.id, edited.version, next.version, ['tags'])).rejects.toMatchObject({ code: '22023' });
    const synced = await sync(a.id, edited.version, next.version, ['body', 'media_ids']);
    expect(synced).toMatchObject({ title: variantPayload.title, body: 'New source body', source_version: 2, version: 3, status: 'draft' });
    expect(synced.media).toEqual([link(cover), link(image, true)]);
    expect(synced.source_snapshot.title).toBe('Source v2');
    await expect(sync(a.id, edited.version, next.version, ['body'])).rejects.toMatchObject({ code: 'PT409' });
  });
});

it('retains detached or archived variants as read-only and restores the same draft on reselection', async () => {
  await asAdmin(async () => {
    const { source, account, other } = await fixtures();
    const a = await create(randomUUID(), source, account);
    await savePost(source, [other], [image, cover], 1);
    expect(await create(a.id, source, account)).toEqual(a);
    await expect(save(a.id, a.version)).rejects.toMatchObject({ code: 'PT409' });
    await expect(db.query('delete from distribution_variant_media where variant_id=$1', [a.id])).rejects.toMatchObject({ code: 'PT409' });
    await savePost(source, [other, account], [image, cover], 2);
    expect(await create(randomUUID(), source, account)).toEqual(a);
    await db.query('update distribution_accounts set archived_at=now() where id=$1', [account]);
    expect((await db.query('select title from distribution_variants where id=$1', [a.id])).rows).toEqual([{ title: 'Source' }]);
    await expect(save(a.id, a.version)).rejects.toMatchObject({ code: 'PT409' });
    await expect(db.query('update distribution_accounts set archived_at=null where id=$1', [account])).rejects.toMatchObject({ code: '55000' });
  });
});

it('enforces active target and platform identity on creation and later updates', async () => {
  await asAdmin(async () => {
    const { source, account, other } = await fixtures();
    const a = await create(randomUUID(), source, account);
    await db.query("update distribution_accounts set platform='x' where id=$1", [account]);
    await expect(save(a.id, a.version)).rejects.toMatchObject({ code: 'PT409' });
    await db.query('update distribution_accounts set is_enabled=false where id=$1', [other]);
    await expect(create(randomUUID(), source, other)).rejects.toMatchObject({ code: 'PT409' });
    expect((await db.query('select platform from distribution_variants where id=$1', [a.id])).rows).toEqual([{ platform: 'xiaohongshu' }]);
  });
});

it('enforces readiness at commit and keeps drafts editable when a video is missing', async () => {
  await asAdmin(async () => {
    const { source, account } = await fixtures('youtube', []);
    const a = await create(randomUUID(), source, account);
    const incomplete = { ...variantPayload, content_type: 'video', status: 'draft' };
    const draft = await save(a.id, a.version, [link(image, true)], incomplete);
    await expect(save(a.id, draft.version, [link(image)], { ...incomplete, status: 'ready' })).rejects.toMatchObject({ code: '22023' });
    await expect(save(a.id, draft.version, [link(video)], { ...incomplete, title: '长'.repeat(101), status: 'ready' })).rejects.toMatchObject({ code: '22023' });
    const ready = await save(a.id, draft.version, [link(video), link(image, true)], { ...incomplete, status: 'ready' });
    expect(ready.status).toBe('ready');
    await expect(db.query('delete from distribution_variant_media where variant_id=$1 and media_id=$2', [a.id, video]))
      .rejects.toMatchObject({ code: '22023' });
    expect(await create(a.id, source, account)).toEqual(ready);
  });
});

it('protects a variant-only Storage reference and cascades platform drafts on source deletion', async () => {
  await asAdmin(async () => {
    const attachment = randomUUID();
    await db.query("insert into storage.objects values ($1,'media','variant-only.png','{\"mimetype\":\"image/png\"}')", [attachment]);
    const { source, account } = await fixtures('other', []);
    const a = await create(randomUUID(), source, account);
    await save(a.id, a.version, [link(attachment, true)], { ...variantPayload, status: 'ready' });
    await expect(db.query('delete from storage.objects where id=$1', [attachment])).rejects.toMatchObject({
      code: '23001', constraint: 'distribution_variant_media_media_id_fkey',
    });
    await expect(db.query('delete from distribution_variants where id=$1', [a.id])).rejects.toMatchObject({ code: '42501' });
    await db.query('delete from distribution_posts where id=$1', [source]);
    expect((await db.query('select id from distribution_variants where id=$1', [a.id])).rows).toEqual([]);
    expect((await db.query('select media_id from distribution_variant_media where variant_id=$1', [a.id])).rows).toEqual([]);
    expect((await db.query('delete from storage.objects where id=$1 returning id', [attachment])).rows).toHaveLength(1);
  });
  expect((await existingRows()).rows).toEqual(oldRows);
});
