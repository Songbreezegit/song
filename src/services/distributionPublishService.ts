import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { distributionId, distributionVersion } from '../lib/distributionValidation';
import { publishInstant, publishReason, validatePublishReport, validatePublishSchedule } from '../lib/distributionPublishValidation';
import type { DistributionAccountRecord, DistributionVariantSummary } from '../types/distribution';
import type { PublishCommand, PublishEvent, PublishEventSummary, PublishFilters, PublishTask, PublishTaskSummary } from '../types/distributionPublish';

export class PublishConflict extends Error {
  constructor() { super('任务或平台稿版本已变化。请重新读取并核对后提交。'); }
}

export function publishError(error: { code?: string; message?: string }): Error {
  switch (error.code) {
    case 'PT409': case '40001': return new PublishConflict();
    case '42P01': case '42883': case 'PGRST202': case 'PGRST205':
      return new Error('此环境尚未启用发布日历。');
    case '42501': return new Error('请使用已完成 MFA 的管理员会话。');
    case '23503': return new Error('关联账号、内容源或素材已变化，请重新读取。');
    case '22007': case '22008': return new Error('日期或时间无效，请重新选择。');
    case '22023': case '23514': case '22P02':
      return new Error('操作未保存。请核对任务状态、平台稿就绪条件和表单字段。');
    default: return new Error('发布任务操作失败，请重试。');
  }
}

function check(error: Parameters<typeof publishError>[0] | null) {
  if (error) throw publishError(error);
}

function requireConnection() {
  if (!isSupabaseConfigured) throw new Error('Supabase 尚未配置，无法读取或保存发布任务。');
}

export const publishTaskPageSize = 48;
const taskFields = 'id,variant_id,post_id,account_id,platform,variant_version,title,account_name,scheduled_at,timezone,status,version,published_at,external_url,updated_at';
const closedStatuses = ['manually_reported', 'cancelled'];
const openStatuses = ['planned', 'awaiting_confirmation'];
type TaskCursor = Pick<PublishTaskSummary, 'scheduled_at' | 'id'>;

export async function listPublishTasks(filters: PublishFilters, cursor?: TaskCursor, newestFirst = false) {
  requireConnection();
  let query = supabase.from('distribution_publish_tasks').select(taskFields)
    .gte('scheduled_at', publishInstant(filters.from)).lt('scheduled_at', publishInstant(filters.to));
  if (filters.platform) query = query.eq('platform', filters.platform);
  if (filters.account) query = query.eq('account_id', distributionId(filters.account));
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.completion) query = query.in('status', filters.completion === 'open' ? openStatuses : closedStatuses);
  if (cursor) {
    const at = publishInstant(cursor.scheduled_at);
    const id = distributionId(cursor.id);
    const comparison = newestFirst ? 'lt' : 'gt';
    query = query.or('scheduled_at.' + comparison + '.' + at + ',and(scheduled_at.eq.' + at + ',id.' + comparison + '.' + id + ')');
  }
  const { data, error } = await query.order('scheduled_at', { ascending: !newestFirst })
    .order('id', { ascending: !newestFirst }).limit(publishTaskPageSize + 1);
  check(error);
  const rows = (data ?? []) as PublishTaskSummary[];
  return { rows: rows.slice(0, publishTaskPageSize), hasMore: rows.length > publishTaskPageSize };
}

export async function getPublishTask(id: string) {
  requireConnection();
  const { data, error } = await supabase.from('distribution_publish_tasks')
    .select(taskFields + ',content_snapshot,plan_note,reported_at,reported_by,report_note,report_evidence,created_by,updated_by,created_at')
    .eq('id', distributionId(id)).maybeSingle();
  check(error);
  if (!data) throw new Error('发布任务不存在或当前会话无权读取。');
  return data as unknown as PublishTask;
}

const eventFields = 'id,task_id,task_version,event_type,actor_id,request_id,metadata,created_at';

export async function listPublishEvents(taskId: string, beforeVersion?: number) {
  requireConnection();
  let query = supabase.from('distribution_publish_logs')
    .select(eventFields + ',previous_status:old_state->>status,next_status:new_state->>status,previous_variant:old_state->>variant_version,next_variant:new_state->>variant_version')
    .eq('task_id', distributionId(taskId));
  if (beforeVersion !== undefined) query = query.lt('task_version', distributionVersion(beforeVersion));
  const { data, error } = await query.order('task_version', { ascending: false }).limit(21);
  check(error);
  const rows = (data ?? []) as unknown as PublishEventSummary[];
  return { rows: rows.slice(0, 20), hasMore: rows.length > 20 };
}

export async function getPublishEvent(taskId: string, id: string) {
  requireConnection();
  const { data, error } = await supabase.from('distribution_publish_logs')
    .select(eventFields + ',old_state,new_state').eq('task_id', distributionId(taskId)).eq('id', distributionId(id)).maybeSingle();
  check(error);
  if (!data) throw new Error('事件不存在或当前会话无权读取。');
  return data as unknown as PublishEvent;
}

type CandidateAccount = Pick<DistributionAccountRecord, 'name' | 'platform'>;
export type PublishCandidate = DistributionVariantSummary & { account: CandidateAccount };

export async function listPublishCandidates(search: string, after?: string) {
  requireConnection();
  let query = supabase.from('distribution_variants')
    .select('id,post_id,account_id,platform,title,status,version,source_version,account:distribution_accounts!inner(name,platform)')
    .eq('status', 'ready').eq('account.is_enabled', true).is('account.archived_at', null);
  if (search.trim()) query = query.ilike('title', '%' + search.trim().slice(0, 100).replace(/[\\%_]/g, '\\$&') + '%');
  if (after) query = query.gt('id', distributionId(after));
  const { data, error } = await query.order('id').limit(21);
  check(error);
  const rows = (data ?? []) as unknown as PublishCandidate[];
  return { rows: rows.slice(0, 20), hasMore: rows.length > 20 };
}

export async function changePublishTask(requestId: string, command: PublishCommand) {
  requireConnection();
  let input = command.input;
  switch (command.action) {
    case 'create':
      input = { ...validatePublishSchedule(command.input), variant_id: distributionId(command.input.variant_id), variant_version: distributionVersion(command.input.variant_version) };
      break;
    case 'reschedule':
      input = validatePublishSchedule(command.input);
      break;
    case 'refresh_snapshot':
      input = { variant_version: distributionVersion(command.input.variant_version) };
      break;
    case 'report':
      input = validatePublishReport(command.input);
      break;
    case 'correct_report':
      input = { ...validatePublishReport(command.input), reason: publishReason(command.input.reason) };
      break;
    case 'cancel': case 'return':
      input = { reason: publishReason(command.input.reason) };
      break;
  }
  const { data, error } = await supabase.rpc('change_distribution_publish_task', {
    p_request_id: distributionId(requestId), p_action: command.action,
    p_task_id: command.action === 'create' ? null : distributionId(command.id),
    p_version: command.action === 'create' ? null : distributionVersion(command.version), p_input: input,
  });
  check(error);
  if (!data || typeof data.id !== 'string' || !data.content_snapshot) throw new Error('未能确认保存结果，请重试当前操作。');
  return data as PublishTask;
}
