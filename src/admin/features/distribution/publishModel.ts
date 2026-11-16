import { Temporal } from 'temporal-polyfill';
import { defaultPublishZone, publishCalendarPeriod, publishDate, publishUtcRange, validPublishZone, type PublishCalendarView } from '../../../lib/distributionPublishTime';
import { distributionPlatforms, type DistributionPlatform, type DistributionVariantRecord } from '../../../types/distribution';
import { publishStatuses, type PublishEvent, type PublishFilters, type PublishSnapshot, type PublishStatus, type PublishTaskSummary } from '../../../types/distributionPublish';
import { contentTypeLabels } from './distributionForm';

export const publishStatusLabels: Record<PublishStatus, string> = {
  planned: '已计划', awaiting_confirmation: '待人工确认', manually_reported: '已人工报告', cancelled: '已取消',
};

export const publishEventLabels: Record<PublishEvent['event_type'], string> = {
  task_created: '创建发布计划', task_rescheduled: '调整发布计划', task_snapshot_updated: '采用新版平台稿',
  task_started: '开始人工发布', manual_reported: '回填人工发布结果', manual_report_corrected: '纠正人工报告',
  task_returned: '退回计划', task_cancelled: '取消任务',
};

export function taskIsOpen(status: PublishStatus) {
  return status === 'planned' || status === 'awaiting_confirmation';
}

export function publishDueLabel(task: Pick<PublishTaskSummary, 'status' | 'scheduled_at'>, zone: string, now = Temporal.Now.instant()) {
  if (!taskIsOpen(task.status)) return '';
  const scheduled = Temporal.Instant.from(task.scheduled_at);
  if (Temporal.Instant.compare(scheduled, now) < 0) return '已逾期';
  if (scheduled.toZonedDateTimeISO(zone).toPlainDate().equals(now.toZonedDateTimeISO(zone).toPlainDate())) return '今日待处理';
  return Temporal.Instant.compare(scheduled, now.add({ hours: 24 })) <= 0 ? '即将开始' : '';
}

export function publishListState(params: URLSearchParams, history: boolean) {
  const requestedZone = params.get('tz') ?? '';
  const zone = validPublishZone(requestedZone) ? requestedZone : defaultPublishZone;
  const date = publishDate(params.get('date')) ?? Temporal.Now.plainDateISO(zone);
  const requestedView = params.get('view');
  const view: PublishCalendarView = history || requestedView === 'list' ? 'list' : requestedView === 'week' ? 'week' : 'month';
  const period = publishCalendarPeriod(date, view);
  const from = params.get('from') ?? '';
  const through = params.get('through') ?? '';
  const fromDate = publishDate(from);
  const throughDate = publishDate(through);
  const explicit = view === 'list' && Boolean(from || through);
  const end = throughDate?.add({ days: 1 });
  const validRange = fromDate && end && Temporal.PlainDate.compare(fromDate, end) < 0 && fromDate.until(end).days <= 366;
  const rangeError = explicit && !validRange ? '请选择完整的日期范围，起止日期相距最多 366 天。' : '';
  const range = explicit && validRange ? publishUtcRange(fromDate, end, zone) : publishUtcRange(period.start, period.end, zone);
  const platform = params.get('platform') as DistributionPlatform;
  const status = params.get('status') as PublishStatus;
  const completion = params.get('completion');
  const account = params.get('account') ?? '';
  const filters: PublishFilters = {
    ...range, platform: distributionPlatforms.includes(platform) ? platform : '',
    status: publishStatuses.includes(status) ? status : '',
    account: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(account) ? account : '',
    completion: completion === 'open' || completion === 'closed' ? completion : '',
  };
  return { zone, date, view, period, filters, from, through, explicit, rangeError };
}

export function publishSnapshotDiff(snapshot: PublishSnapshot, variant: DistributionVariantRecord) {
  const differences: { label: string; previous: string; latest: string }[] = [];
  const compare = (label: string, previous: string, latest: string) => {
    if (previous !== latest) differences.push({ label, previous, latest });
  };
  compare('标题', snapshot.title, variant.title);
  compare('正文', snapshot.body, variant.body);
  compare('标签', snapshot.tags.map(tag => '#' + tag).join('\n'), variant.tags.map(tag => '#' + tag).join('\n'));
  compare('内容类型', contentTypeLabels[snapshot.content_type], contentTypeLabels[variant.content_type]);
  const mediaSummary = (media: DistributionVariantRecord['media']) => media.map((asset, index) => [
    (index + 1) + '. ' + asset.media_id, asset.is_cover ? '封面' : '', asset.aspect_ratio_hint, asset.processing_notes,
  ].filter(Boolean).join(' · ')).join('\n');
  compare('素材顺序、封面和处理说明', mediaSummary(snapshot.media), mediaSummary(variant.media));
  return differences;
}
