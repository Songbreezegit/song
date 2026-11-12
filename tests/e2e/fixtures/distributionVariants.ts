import type { Page } from '@playwright/test';
import { newVariantMedia } from '../../../src/admin/features/distribution/variantModel';
import { distributionVariantFields, type DistributionPostRecord, type DistributionSourceSnapshot, type DistributionVariantField, type DistributionVariantRecord } from '../../../src/types/distribution';
import { accountId, accountRecord, distributionFixture, mediaId, postId, postRecord } from './distribution';

export const secondAccount = 'abababab-1111-4111-8111-111111111111';
export const secondMedia = 'cececece-1111-4111-8111-111111111111';
export const firstVariant = 'bbbbcccc-1111-4111-8111-111111111111';
export const secondVariant = 'bbbbdddd-1111-4111-8111-111111111111';
export const variantsPath = `/admin/distribution/posts/${postId}/variants`;
export const firstName = '小红书个人账号';
export const secondName = '小红书项目账号';
const now = '2026-11-10T00:00:00Z';

function snapshot(source: DistributionPostRecord): DistributionSourceSnapshot {
  return { title: source.title, body: source.body, tags: [...source.tags], content_type: source.content_type, media_ids: [...source.media_ids] };
}

export function variantRecord(source: DistributionPostRecord, fields: Partial<DistributionVariantRecord> = {}): DistributionVariantRecord {
  const { media_ids, ...content } = snapshot(source);
  return { ...content, id: firstVariant, post_id: source.id, account_id: accountId, platform: 'xiaohongshu',
    status: 'draft', source_version: source.version, version: 1, source_snapshot: snapshot(source), source_retained_fields: {},
    media: media_ids.map(newVariantMedia), created_at: now, updated_at: now, ...fields };
}

// These are browser transport fixtures. The migration itself is tested in
// PGlite and on the separately approved Staging project.
export async function distributionVariantsFixture(page: Page, seed = true) {
  const m1 = await distributionFixture(page);
  const source = postRecord({ account_ids: [accountId, secondAccount], media_ids: [mediaId, secondMedia] }) as DistributionPostRecord;
  m1.state.accounts.push(accountRecord({ name: firstName }), accountRecord({ id: secondAccount, name: secondName }));
  m1.state.posts.push(source);
  m1.backend.media.push({ id: mediaId, name: 'first.webp', path: 'uploads/first.webp' }, { id: secondMedia, name: 'second.webp', path: 'uploads/second.webp' });
  const state = {
    variants: seed ? [variantRecord(source), variantRecord(source, { id: secondVariant, account_id: secondAccount })] : [],
    readError: false, writeError: false, writeDelay: 0, loseNextCreateResponse: false,
    writes: [] as { name: string; input: Record<string, unknown> }[],
  };
  await page.route('https://backend-v1-test.supabase.co/storage/v1/object/list/media', async route => {
    const { prefix = '', offset = 0 } = route.request().postDataJSON();
    const rows = offset ? [] : !prefix ? [{ name: 'uploads', id: null }] : m1.backend.media.map(item => ({
      id: item.id, name: item.name, metadata: { mimetype: 'image/webp' }, created_at: now,
    }));
    return route.fulfill({ json: rows });
  });
  await page.route('https://backend-v1-test.supabase.co/storage/v1/object/public/media/uploads/first.webp',
    route => route.fulfill({ path: 'public/assets/work/work-project-cover-fuji.webp', contentType: 'image/webp' }));
  await page.route('https://backend-v1-test.supabase.co/storage/v1/object/public/media/uploads/second.webp',
    route => route.fulfill({ path: 'public/assets/work/work-hero-illustration.webp', contentType: 'image/webp' }));
  await page.route('https://backend-v1-test.supabase.co/rest/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const name = url.pathname.split('/').at(-1) ?? '';
    if (!['distribution_variants','create_distribution_variant','save_distribution_variant','sync_distribution_variant','retain_distribution_variant_source'].includes(name)) return route.fallback();
    const fail = (code: string, status: number) => route.fulfill({ status, json: { code, message: 'Test transport response' } });
    if (m1.backend.aal !== 'aal2') return fail('42501', 403);
    if (request.method() === 'GET') {
      if (state.readError) return fail('XX000', 500);
      const rows = state.variants.filter(row => (!url.searchParams.has('id') || url.searchParams.get('id') === `eq.${row.id}`)
        && url.searchParams.get('post_id') === `eq.${row.post_id}`).map(row => ({
        ...row, distribution_variant_media: row.media.map((item, sort_order) => ({ ...item, sort_order })),
      }));
      return route.fulfill({ json: request.headers().accept?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows });
    }
    const input = request.postDataJSON();
    state.writes.push({ name, input });
    if (state.writeDelay) await new Promise(resolve => setTimeout(resolve, state.writeDelay));
    if (state.writeError) return fail('XX000', 500);
    const selected = m1.state.posts.find(row => row.id === (input.p_post_id ?? state.variants.find(row => row.id === input.p_id)?.post_id)) as DistributionPostRecord | undefined;
    const variant = state.variants.find(row => row.id === input.p_id);
    if (!selected) return fail('23503', 409);
    if (name === 'create_distribution_variant') {
      const existing = state.variants.find(row => row.post_id === selected.id && row.account_id === input.p_account_id);
      if (existing) return route.fulfill({ json: existing });
      const account = m1.state.accounts.find(row => row.id === input.p_account_id);
      if (!account?.is_enabled || account.archived_at || !selected.account_ids.includes(input.p_account_id)) return fail('PT409', 409);
      const created = variantRecord(selected, { id: input.p_id, account_id: input.p_account_id, platform: account.platform });
      state.variants.push(created);
      if (state.loseNextCreateResponse) { state.loseNextCreateResponse = false; return fail('XX000', 500); }
      return route.fulfill({ json: created });
    }
    if (!variant || variant.version !== input.p_version) return fail('PT409', 409);
    const account = m1.state.accounts.find(row => row.id === variant.account_id);
    if (!account?.is_enabled || account.archived_at || !selected.account_ids.includes(variant.account_id)) return fail('PT409', 409);
    if (name === 'save_distribution_variant') {
      Object.assign(variant, input.p_variant, { media: input.p_media });
    } else {
      if (selected.version !== input.p_source_version || selected.version <= variant.source_version) return fail('PT409', 409);
      const retain = name === 'retain_distribution_variant_source';
      const fields = input.p_fields as DistributionVariantField[];
      const latest = snapshot(selected);
      const pending = distributionVariantFields.filter(field => JSON.stringify(latest[field]) !== JSON.stringify(variant.source_snapshot[field]));
      if (fields.some(field => !pending.includes(field)) || (!fields.length && (!retain || pending.length))) return fail('22023', 400);
      for (const field of fields) {
        Object.assign(variant.source_snapshot, { [field]: latest[field] });
        if (retain) {
          variant.source_retained_fields[field] = selected.version;
        } else {
          delete variant.source_retained_fields[field];
          if (field === 'media_ids') variant.media = selected.media_ids.map(id => variant.media.find(item => item.media_id === id) ?? newVariantMedia(id));
          else Object.assign(variant, { [field]: latest[field] });
        }
      }
      if (fields.length === pending.length) variant.source_version = selected.version;
    }
    variant.version++;
    return route.fulfill({ json: variant });
  });
  return { ...m1, source, variantState: state };
}
