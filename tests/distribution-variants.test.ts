import { describe, expect, it } from 'vitest';
import { getDistributionPlatform } from '../src/admin/features/distribution/platforms/registry';
import { createVariantExport, formatVariantCopy } from '../src/admin/features/distribution/variantExport';
import { compareVariantSource, moveVariantMedia, newVariantMedia, replaceVariantSelection, variantMediaKinds, variantReadOnlyReason, variantToDraft } from '../src/admin/features/distribution/variantModel';
import { validateDistributionVariant, validateVariantSyncFields } from '../src/lib/distributionValidation';
import { distributionVariantError } from '../src/services/distributionVariantService';
import { distributionPlatforms, type DistributionAccountRecord, type DistributionPostRecord, type DistributionVariantRecord } from '../src/types/distribution';

const postId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const accountId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const variantId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const image = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const other = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const source = (): DistributionPostRecord => ({
  id: postId, title: '源标题', body: '源正文', tags: ['🌿,标签', '带空格的 标签'], content_type: 'image_text',
  project_id: null, promotion_goal: 'awareness', status: 'draft', account_ids: [accountId], media_ids: [image],
  version: 1, created_at: '2026-11-10T00:00:00Z', updated_at: '2026-11-10T00:00:00Z',
});
const variant = (): DistributionVariantRecord => ({
  id: variantId, post_id: postId, account_id: accountId, platform: 'xiaohongshu', title: '独立标题',
  body: '<script>文本原样</script>\n第二行', tags: ['🌿,标签', '带空格的 标签'], content_type: 'image_text',
  source_version: 1, source_snapshot: { title: '源标题', body: '源正文', tags: [...source().tags], content_type: 'image_text', media_ids: [image] },
  source_retained_fields: {}, status: 'draft', media: [newVariantMedia(image)], version: 3,
  created_at: '2026-11-10T00:00:00Z', updated_at: '2026-11-10T00:00:00Z',
});
const account = (): DistributionAccountRecord => ({
  id: accountId, name: '公开账号名', platform: 'xiaohongshu', profile_url: '', account_type: 'personal',
  positioning: '', project_id: null, notes: '', is_enabled: true, archived_at: null,
  version: 1, created_at: '2026-11-10T00:00:00Z', updated_at: '2026-11-10T00:00:00Z',
});
const assets = [{ id: image, name: 'existing.webp', path: 'uploads/existing.webp', url: 'https://example.invalid/file?token=DO_NOT_EXPORT',
  mime_type: 'image/webp', created_at: '2026-11-10T00:00:00Z' }];

describe('M2 draft contracts', () => {
  it('validates exact fields and preserves Unicode, comma tags and literal HTML', () => {
    const draft = variantToDraft(variant());
    expect(validateDistributionVariant(draft)).toEqual(draft);
    expect(() => validateDistributionVariant({ ...draft, access_token: 'reject' })).toThrow('不支持');
    expect(() => validateDistributionVariant({ ...draft, body: 'hello\0world' })).toThrow('正文');
    expect(() => validateDistributionVariant({ ...draft, tags: ['重复', '重复'] })).toThrow('重复');
  });

  it('rejects invalid media IDs, repeated media and multiple covers', () => {
    const draft = variantToDraft(variant());
    expect(() => validateDistributionVariant({ ...draft, media: [newVariantMedia('invalid')] })).toThrow('标识');
    expect(() => validateDistributionVariant({ ...draft, media: [newVariantMedia(image), newVariantMedia(image.toUpperCase())] })).toThrow('重复');
    expect(() => validateDistributionVariant({ ...draft, media: [{ ...newVariantMedia(image), is_cover: true }, { ...newVariantMedia(other), is_cover: true }] })).toThrow('一张封面');
  });

  it('only allows explicit, unique sync fields', () => {
    expect(validateVariantSyncFields(['title', 'media_ids'])).toEqual(['title', 'media_ids']);
    expect(() => validateVariantSyncFields([])).toThrow('至少');
    expect(validateVariantSyncFields([], true)).toEqual([]);
    expect(() => validateVariantSyncFields(['tags', 'tags'])).toThrow('重复');
    expect(() => validateVariantSyncFields(['status'])).toThrow('无效');
  });

  it('compares stored source snapshots without replacing manually written text', () => {
    const draft = variant();
    const updated = { ...source(), version: 2, title: '新版源', media_ids: [other, image] };
    expect(compareVariantSource(source(), draft)).toEqual({ stale: false, fields: [], retained: [] });
    expect(compareVariantSource(updated, draft)).toMatchObject({ stale: true, fields: [
      { field: 'title', before: '源标题', current: '新版源', variant: '独立标题', customized: true },
      { field: 'media_ids', before: [image], current: [other, image], variant: [image], customized: false },
    ] });
    expect(draft.title).toBe('独立标题');
  });

  it('keeps unresolved differences, version-only changes and retained decisions distinct', () => {
    const draft = variant();
    const updated = { ...source(), version: 2, title: '新版源', body: '新版正文' };
    draft.source_snapshot.body = updated.body;
    expect(compareVariantSource(updated, draft)).toMatchObject({ stale: true, fields: [{ field: 'title' }], retained: [] });
    draft.source_snapshot.title = updated.title;
    draft.source_retained_fields.title = 2;
    draft.source_version = 2;
    expect(compareVariantSource({ ...updated, version: 3, promotion_goal: 'download' }, draft)).toEqual({
      stale: true, fields: [], retained: [{ field: 'title', sourceVersion: 2 }],
    });
  });

  it('classifies archived, disabled, detached and platform-changed drafts', () => {
    expect(variantReadOnlyReason(source(), account(), variant())).toBeNull();
    expect(variantReadOnlyReason(source(), { ...account(), archived_at: 'now' }, variant())).toContain('归档');
    expect(variantReadOnlyReason(source(), { ...account(), is_enabled: false }, variant())).toContain('停用');
    expect(variantReadOnlyReason({ ...source(), account_ids: [] }, account(), variant())).toContain('移除');
    expect(variantReadOnlyReason(source(), { ...account(), platform: 'x' }, variant())).toContain('平台已变更');
  });

  it('preserves cover and instructions on media reorder and selection', () => {
    const cover = { ...newVariantMedia(image), is_cover: true, processing_notes: '保留文字' };
    const links = [cover, newVariantMedia(other)];
    expect(moveVariantMedia(links, 1, -1)).toEqual([links[1], cover]);
    expect(replaceVariantSelection(links, [other, image])).toEqual([links[1], cover]);
    expect(links[0]).toBe(cover);
    expect(moveVariantMedia(links, 0, -1)).toBe(links);
  });
});

describe('platform preparation and export', () => {
  it('registers all platforms and scopes source links and capabilities', () => {
    for (const platform of distributionPlatforms) {
      const profile = getDistributionPlatform(platform);
      expect(profile.platform).toBe(platform);
      expect(profile.supportedTypes.length).toBeGreaterThan(0);
      expect(profile.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(profile.sources.every(source => source.url.startsWith('https://'))).toBe(true);
    }
    expect(getDistributionPlatform('other').sources).toEqual([]);
  });

  it('distinguishes confirmed constraints, readiness and recommendations', () => {
    const draft = variantToDraft(variant());
    const youtube = getDistributionPlatform('youtube');
    const issues = youtube.validate({ ...draft, content_type: 'video', title: '🍃'.repeat(101), body: '字'.repeat(5001) }, variantMediaKinds(assets));
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'title-limit', severity: 'error', confidence: 'confirmed' }),
      expect.objectContaining({ code: 'body-limit', severity: 'error', confidence: 'confirmed' }),
      expect.objectContaining({ code: 'video-required', severity: 'error', confidence: 'workspace' }),
      expect.objectContaining({ code: 'cover-suggestion', severity: 'warning', confidence: 'recommendation' }),
      expect.objectContaining({ code: 'platform-review', severity: 'info', confidence: 'unconfirmed' }),
    ]));
    expect(getDistributionPlatform('x').validate({ ...draft, content_type: 'moment', body: '长'.repeat(1000) }, variantMediaKinds(assets)).some(issue => issue.severity === 'error')).toBe(false);
    expect(getDistributionPlatform('other').validate({ ...draft, content_type: 'article', body: ' \n\t' }, new Map())).toContainEqual(expect.objectContaining({ code: 'article-body', severity: 'error' }));
  });

  it('exports a detached saved revision and excludes session material and media URLs', () => {
    const draft = variant();
    draft.media[0].is_cover = true;
    draft.media[0].aspect_ratio_hint = '3:4';
    const unsafeAccount = { ...account(), password: 'DO_NOT_EXPORT_PASSWORD', token: 'DO_NOT_EXPORT_TOKEN' };
    const file = createVariantExport(draft, unsafeAccount, assets, new Date('2026-11-10T08:00:00Z'));
    draft.tags.push('unsaved later');
    draft.media[0].is_cover = false;
    expect(file).toMatchObject({ post_id: postId, variant_id: variantId, variant_version: 3, exported_at: '2026-11-10T08:00:00.000Z', cover_media_id: image });
    expect(file.tags).toEqual(['🌿,标签', '带空格的 标签']);
    expect(file.media[0]).toMatchObject({ original_storage_path: 'uploads/existing.webp', is_cover: true, still_needs_review: true });
    expect(JSON.stringify(file)).not.toMatch(/DO_NOT_EXPORT|access_token|service_role/);
    expect(formatVariantCopy(variant(), 'all')).toBe('独立标题\n\n<script>文本原样</script>\n第二行\n\n#🌿,标签 #带空格的 标签');
  });

  it('maps conflict and authorization errors without echoing backend details', () => {
    expect(distributionVariantError({ code: 'PT409', message: 'DO_NOT_ECHO' }).message).toContain('变化');
    expect(distributionVariantError({ code: '42501' }).message).toContain('MFA');
    expect(distributionVariantError({ code: '23503' }).message).toContain('媒体');
    expect(distributionVariantError({ code: 'PGRST205' }).message).toContain('未在此环境启用');
    expect(distributionVariantError({ message: 'DO_NOT_ECHO' }).message).not.toContain('DO_NOT_ECHO');
  });
});
