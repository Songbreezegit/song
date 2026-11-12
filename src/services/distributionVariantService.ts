import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { distributionId, distributionVersion, validateDistributionVariant, validateVariantSyncFields } from '../lib/distributionValidation';
import type { DistributionSourceReviewAction, DistributionVariantField, DistributionVariantInput, DistributionVariantRecord, DistributionVariantSummary } from '../types/distribution';

interface Failure { code?: string; message?: string }
export function distributionVariantError(error: Failure): Error {
  switch (error.code) {
    case '42P01': case '42703': case 'PGRST205': case 'PGRST202': case '42883':
      return new Error('平台版本尚未在此环境启用。');
    case 'PT409': case '40001': case '23505':
      return new Error('平台稿、目标账号或内容源已有变化。请保留需要的本地文案，再打开最新版本。');
    case '23503':
      return new Error('内容源、账号或媒体已不可用，请重新加载并检查关联。');
    case '42501':
      return new Error('当前会话无权访问平台版本。请确认管理员资格并完成 MFA。');
    case '22023': case '23514': case '22P02':
      return new Error('平台稿未通过数据检查。请核对内容、待发布条件、素材和同步选项。');
    default:
      return new Error('平台稿操作失败，请重试。');
  }
}

const requireConnection = () => {
  if (!isSupabaseConfigured) throw new Error('Supabase 尚未配置，无法读取或保存平台版本。');
};
function check(error: Failure | null) {
  if (error) throw distributionVariantError(error);
}

const summaryFields = 'id, post_id, account_id, platform, title, status, version, source_version';
const variantFields = `${summaryFields}, body, tags, content_type, source_snapshot, source_retained_fields, created_at, updated_at`;
type MediaRow = DistributionVariantRecord['media'][number] & { sort_order: number };
type VariantRow = Omit<DistributionVariantRecord, 'media'> & { distribution_variant_media: MediaRow[] };

export async function fetchDistributionVariants(postId: string): Promise<DistributionVariantSummary[]> {
  requireConnection();
  distributionId(postId);
  const records: DistributionVariantSummary[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('distribution_variants').select(summaryFields)
      .eq('post_id', postId).order('account_id').range(offset, offset + 499);
    check(error);
    records.push(...(data ?? []) as DistributionVariantSummary[]);
    if (!data || data.length < 500) return records;
  }
}

export async function getDistributionVariant(postId: string, id: string): Promise<DistributionVariantRecord | null> {
  requireConnection();
  distributionId(postId);
  distributionId(id);
  const { data, error } = await supabase.from('distribution_variants')
    .select(`${variantFields}, distribution_variant_media(media_id, sort_order, is_cover, aspect_ratio_hint, processing_notes)`)
    .eq('post_id', postId).eq('id', id).maybeSingle();
  check(error);
  if (!data) return null;
  const { distribution_variant_media, ...record } = data as VariantRow;
  return { ...record, media: [...distribution_variant_media].sort((a, b) => a.sort_order - b.sort_order)
    .map(({ media_id, is_cover, aspect_ratio_hint, processing_notes }) => ({ media_id, is_cover, aspect_ratio_hint, processing_notes })) };
}

function variantResult(data: unknown): DistributionVariantRecord {
  if (!data || typeof data !== 'object' || !('media' in data) || !Array.isArray(data.media)) {
    throw new Error('未能确认平台稿保存结果。请重新打开最新记录。');
  }
  return data as DistributionVariantRecord;
}

export async function createDistributionVariant(id: string, postId: string, accountId: string) {
  requireConnection();
  const { data, error } = await supabase.rpc('create_distribution_variant', {
    p_id: distributionId(id), p_post_id: distributionId(postId), p_account_id: distributionId(accountId),
  });
  check(error);
  return variantResult(data);
}

export async function saveDistributionVariant(id: string, version: number, input: DistributionVariantInput) {
  requireConnection();
  const { media, ...variant } = validateDistributionVariant(input);
  const { data, error } = await supabase.rpc('save_distribution_variant', {
    p_id: distributionId(id), p_version: distributionVersion(version), p_variant: variant, p_media: media,
  });
  check(error);
  return variantResult(data);
}

export async function reviewDistributionVariantSource(action: DistributionSourceReviewAction, id: string, version: number, sourceVersion: number, fields: DistributionVariantField[]) {
  requireConnection();
  const retaining = action === 'retain';
  const { data, error } = await supabase.rpc(retaining ? 'retain_distribution_variant_source' : 'sync_distribution_variant', {
    p_id: distributionId(id), p_version: distributionVersion(version), p_source_version: distributionVersion(sourceVersion),
    p_fields: validateVariantSyncFields(fields, retaining),
  });
  check(error);
  return variantResult(data);
}
