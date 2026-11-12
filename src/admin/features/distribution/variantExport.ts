import type { MediaItem } from '../../../services/mediaService';
import type { DistributionAccountRecord, DistributionVariantRecord } from '../../../types/distribution';
import { getDistributionPlatform } from './platforms/registry';
import { variantMediaKinds } from './variantModel';

export type VariantCopyPart = 'title' | 'body' | 'tags' | 'all';

export function formatVariantCopy(variant: DistributionVariantRecord, part: VariantCopyPart): string {
  const tags = variant.tags.map(tag => `#${tag}`).join(' ');
  if (part === 'tags') return tags;
  if (part === 'all') return [variant.title, variant.body, tags].filter(Boolean).join('\n\n');
  return variant[part];
}

export function createVariantExport(variant: DistributionVariantRecord, account: Pick<DistributionAccountRecord, 'id' | 'name'>, items: MediaItem[], at = new Date()) {
  const profile = getDistributionPlatform(variant.platform);
  const checks = profile.validate(variant, variantMediaKinds(items));
  const media = variant.media.map((link, index) => {
    const item = items.find(candidate => candidate.id === link.media_id);
    return { media_id: link.media_id, sort_order: index, original_storage_path: item?.path ?? null,
      file_name: item?.name ?? null, is_cover: link.is_cover, aspect_ratio_hint: link.aspect_ratio_hint,
      processing_notes: link.processing_notes, still_needs_review: Boolean(link.aspect_ratio_hint || link.processing_notes || !item) };
  });
  return {
    schema_version: 1, purpose: 'manual_preparation', exported_at: at.toISOString(),
    platform: variant.platform, platform_name: profile.name, account: { id: account.id, name: account.name },
    post_id: variant.post_id, variant_id: variant.id, variant_version: variant.version,
    source_version: variant.source_version, status: variant.status, content_type: variant.content_type,
    title: variant.title, body: variant.body, tags: [...variant.tags], media_bucket: 'media',
    media, cover_media_id: media.find(item => item.is_cover)?.media_id ?? null,
    media_handling: '引用原始素材。比例和说明仅用于人工处理。',
    checks: checks.map(({ code, severity, confidence, message }) => ({ code, severity, confidence, message })),
  };
}
