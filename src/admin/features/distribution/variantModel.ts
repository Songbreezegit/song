import type { MediaItem } from '../../../services/mediaService';
import {
  distributionVariantFields,
  type DistributionAccountRecord, type DistributionMediaKind, type DistributionPostRecord,
  type DistributionSourceSnapshot, type DistributionVariantField, type DistributionVariantInput,
  type DistributionVariantMedia, type DistributionVariantRecord, type DistributionVariantSummary,
} from '../../../types/distribution';

export const variantFieldLabels: Record<DistributionVariantField, string> = {
  title: '标题', body: '正文', tags: '标签', content_type: '内容类型', media_ids: '媒体及顺序',
};

export function variantToDraft(record: DistributionVariantRecord): DistributionVariantInput {
  return { title: record.title, body: record.body, tags: [...record.tags], content_type: record.content_type,
    status: record.status, media: record.media.map(item => ({ ...item })) };
}

function sourceSnapshot(source: DistributionPostRecord): DistributionSourceSnapshot {
  return { title: source.title, body: source.body, tags: source.tags, content_type: source.content_type, media_ids: source.media_ids };
}

export function compareVariantSource(source: DistributionPostRecord, variant: DistributionVariantRecord) {
  const current = sourceSnapshot(source);
  const draft: DistributionSourceSnapshot = { title: variant.title, body: variant.body, tags: variant.tags,
    content_type: variant.content_type, media_ids: variant.media.map(media => media.media_id) };
  const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const stale = source.version > variant.source_version;
  const fields = stale ? distributionVariantFields
    .filter(field => !equal(variant.source_snapshot[field], current[field]))
    .map(field => ({ field, before: variant.source_snapshot[field], current: current[field], variant: draft[field],
      customized: !equal(variant.source_snapshot[field], draft[field]) })) : [];
  const retained = distributionVariantFields.flatMap(field => {
    const sourceVersion = variant.source_retained_fields[field];
    return sourceVersion === undefined ? [] : [{ field, sourceVersion }];
  });
  return { stale, fields, retained };
}

export function variantReadOnlyReason(source: DistributionPostRecord, account: DistributionAccountRecord | undefined, variant?: DistributionVariantSummary): string | null {
  if (!account) return '账号不可用。';
  if (account.archived_at) return '账号已归档，保留历史稿件供查阅。';
  if (!account.is_enabled) return '账号已停用，平台稿暂时只读。';
  if (!source.account_ids.includes(account.id)) return '账号已从当前投放目标移除。重新选择后可继续编辑。';
  if (variant && variant.platform !== account.platform) return '账号平台已变更，此稿保留原平台的快照。';
  return null;
}

export function newVariantMedia(media_id: string): DistributionVariantMedia {
  return { media_id, is_cover: false, aspect_ratio_hint: '', processing_notes: '' };
}

export function replaceVariantSelection(media: DistributionVariantMedia[], ids: string[]): DistributionVariantMedia[] {
  return ids.map(id => media.find(item => item.media_id === id) ?? newVariantMedia(id));
}

export function moveVariantMedia(media: DistributionVariantMedia[], index: number, delta: -1 | 1): DistributionVariantMedia[] {
  const target = index + delta;
  if (index < 0 || index >= media.length || target < 0 || target >= media.length) return media;
  const next = [...media];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function variantMediaKinds(items: MediaItem[]): ReadonlyMap<string, DistributionMediaKind> {
  return new Map(items.map(item => {
    const mime = item.mime_type?.toLowerCase() ?? '';
    return [item.id, mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'unknown'];
  }));
}
