import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { distributionId, distributionVersion, validateDistributionAccount, validateDistributionPost } from '../lib/distributionValidation';
import type { DistributionAccountInput, DistributionAccountRecord, DistributionOverview, DistributionPostInput, DistributionPostRecord } from '../types/distribution';

type Failure = { code?: string; message?: string };
function configured() {
  if (!isSupabaseConfigured) throw new Error('Supabase 尚未配置，无法读取或保存分发数据。');
}
function check(error: Failure | null) {
  if (!error) return;
  if (['42P01', 'PGRST205', 'PGRST202', '42883'].includes(error.code || '')) throw new Error('内容分发尚未启用。请先审查并批准数据库迁移，再由管理员执行。');
  if (['PGRST116', 'PT409', '40001', '23505'].includes(error.code || '')) throw new Error('记录已发生变化，或刚才的保存已经成功。请返回列表重新打开后再编辑。');
  if (error.code === '23503') throw new Error('关联项目、账号或媒体已变化，请重新加载并确认选择。');
  if (error.code === '42501') throw new Error('当前会话无权访问分发数据，请确认管理员资格并完成 MFA。');
  throw new Error(error.message || '分发数据操作失败，请重试。');
}

const postSelect = '*, distribution_post_targets(account_id), distribution_post_media(media_id, sort_order)';
type PostRow = Omit<DistributionPostRecord, 'account_ids' | 'media_ids'> & {
  distribution_post_targets: { account_id: string }[];
  distribution_post_media: { media_id: string; sort_order: number }[];
};
function toPost(row: PostRow): DistributionPostRecord {
  const { distribution_post_targets, distribution_post_media, ...post } = row;
  return { ...post, account_ids: distribution_post_targets.map(item => item.account_id).sort(),
    media_ids: [...distribution_post_media].sort((a, b) => a.sort_order - b.sort_order).map(item => item.media_id) };
}

// Explicit ranges avoid the API's default row cap silently truncating a library.
export async function fetchDistributionAccounts(): Promise<DistributionAccountRecord[]> {
  configured();
  const rows: DistributionAccountRecord[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('distribution_accounts').select('*').order('updated_at', { ascending: false }).order('id').range(offset, offset + 499);
    check(error); rows.push(...(data || []) as DistributionAccountRecord[]);
    if (!data || data.length < 500) return rows;
  }
}

export async function fetchDistributionPosts(): Promise<DistributionPostRecord[]> {
  configured();
  const rows: DistributionPostRecord[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('distribution_posts').select(postSelect).order('updated_at', { ascending: false }).order('id').range(offset, offset + 499);
    check(error); rows.push(...((data || []) as PostRow[]).map(toPost));
    if (!data || data.length < 500) return rows;
  }
}

export async function fetchDistributionOverview(): Promise<DistributionOverview> {
  configured();
  const results = await Promise.all([
    supabase.from('distribution_accounts').select('id', { head: true, count: 'exact' }).is('archived_at', null),
    supabase.from('distribution_posts').select('id', { head: true, count: 'exact' }).eq('status', 'draft'),
    supabase.from('distribution_posts').select('id', { head: true, count: 'exact' }).eq('status', 'ready'),
    supabase.from('distribution_posts').select(postSelect).order('updated_at', { ascending: false }).order('id').limit(6),
  ]);
  // HEAD responses carry no JSON error body. Prefer the accompanying SELECT's
  // detailed migration/permission error before checking failed count requests.
  check(results[3].error);
  results.slice(0, 3).forEach(result => check(result.error));
  if (results.slice(0, 3).some(result => result.count === null)) throw new Error('未能读取完整统计，请重试。');
  return { accounts: results[0].count!, drafts: results[1].count!, ready: results[2].count!, recent: ((results[3].data || []) as PostRow[]).map(toPost) };
}

export async function getDistributionAccount(id: string): Promise<DistributionAccountRecord | null> {
  configured(); distributionId(id);
  const { data, error } = await supabase.from('distribution_accounts').select('*').eq('id', id).maybeSingle();
  check(error); return data as DistributionAccountRecord | null;
}

export async function saveDistributionAccount(id: string, input: DistributionAccountInput, version: number | null): Promise<DistributionAccountRecord> {
  configured(); distributionId(id); if (version !== null) distributionVersion(version);
  const payload = validateDistributionAccount(input);
  const query = version === null ? supabase.from('distribution_accounts').insert({ id, ...payload })
    : supabase.from('distribution_accounts').update(payload).eq('id', id).eq('version', version).is('archived_at', null);
  const { data, error } = await query.select().single();
  check(error); return data as DistributionAccountRecord;
}

export async function archiveDistributionAccount(id: string, version: number): Promise<DistributionAccountRecord> {
  configured(); distributionId(id); distributionVersion(version);
  const { data, error } = await supabase.from('distribution_accounts').update({ archived_at: new Date().toISOString(), is_enabled: false })
    .eq('id', id).eq('version', version).is('archived_at', null).select().single();
  check(error); return data as DistributionAccountRecord;
}

export async function getDistributionPost(id: string): Promise<DistributionPostRecord | null> {
  configured(); distributionId(id);
  const { data, error } = await supabase.from('distribution_posts').select(postSelect).eq('id', id).maybeSingle();
  check(error); return data ? toPost(data as PostRow) : null;
}

export async function saveDistributionPost(id: string, input: DistributionPostInput, version: number | null): Promise<DistributionPostRecord> {
  configured(); distributionId(id); if (version !== null) distributionVersion(version);
  const { account_ids, media_ids, ...payload } = validateDistributionPost(input);
  // One invoker RPC commits the source and both sets of relations atomically.
  const { data, error } = await supabase.rpc('save_distribution_post', {
    p_id: id, p_version: version, p_post: payload, p_account_ids: account_ids, p_media_ids: media_ids,
  });
  check(error); return data as DistributionPostRecord;
}

export async function deleteDistributionDraft(id: string, version: number): Promise<void> {
  configured(); distributionId(id); distributionVersion(version);
  const { error } = await supabase.from('distribution_posts').delete().eq('id', id).eq('version', version).eq('status', 'draft').select('id').single();
  if (error && ['23503', '23001'].includes(error.code ?? '') && /distribution_publish_tasks_(post|variant)_id_fkey/.test(error.message ?? '')) {
    throw new Error('这份内容源已有发布任务。请在发布历史查看关联记录。');
  }
  check(error);
}
