import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';
import { createPublishExport } from '../src/admin/features/distribution/publishExport';
import { publishDueLabel, publishListState, publishSnapshotDiff, taskIsOpen } from '../src/admin/features/distribution/publishModel';
import { formatVariantCopy } from '../src/admin/features/distribution/variantExport';
import { inspectPublishTime, localPublishFields, publishCalendarPeriod, publishDate, publishUtcRange, resolvePublishTime } from '../src/lib/distributionPublishTime';
import { publishReason, validatePublishReport, validatePublishSchedule, validateWorkUrl } from '../src/lib/distributionPublishValidation';
import { PublishConflict, publishError } from '../src/services/distributionPublishService';
import type { DistributionVariantRecord } from '../src/types/distribution';
import type { PublishTask } from '../src/types/distributionPublish';

const account = 'aaaaaaaa-1111-4111-8111-111111111111';
const snapshot: PublishTask['content_snapshot'] = {
  account_id: account, account_name: '项目号', variant_id: 'bbbbbbbb-1111-4111-8111-111111111111',
  post_id: 'bbbbcccc-1111-4111-8111-111111111111', variant_version: 4, source_version: 3, platform: 'xiaohongshu',
  title: '冻结标题', body: '冻结正文', tags: ['独立开发'], content_type: 'image_text', profile_url: 'https://example.com/',
  captured_at: '2026-11-12T04:00:00Z', media: [{
    media_id: 'cccccccc-1111-4111-8111-111111111111', sort_order: 0, is_cover: true,
    aspect_ratio_hint: '3:4', processing_notes: '保留留白', original_storage_path: 'uploads/frozen.webp', mime_type: 'image/webp',
  }],
};
const task = {
  id: 'dddddddd-1111-4111-8111-111111111111', version: 1, variant_version: 4, content_snapshot: snapshot,
  scheduled_at: '2026-11-16T12:00:00Z', timezone: 'Asia/Shanghai', status: 'planned',
} as PublishTask;

describe('publishing calendar time', () => {
  it('converts a wall clock without using the browser zone and crosses a date boundary', () => {
    expect(resolvePublishTime('2026-12-31', '20:00', 'America/New_York', '')).toBe('2027-01-01T01:00:00Z');
    expect(localPublishFields('2027-01-01T01:00:00Z', 'Asia/Tokyo')).toEqual({ date: '2027-01-01', time: '10:00' });
  });
  it('rejects impossible dates, time zones, DST gaps and ambiguous times without a choice', () => {
    expect(publishDate('2026-02-29')).toBeNull();
    expect(() => inspectPublishTime('2027-03-14', '02:30', 'America/New_York')).toThrow('跳过');
    expect(() => resolvePublishTime('2026-11-01', '01:30', 'America/New_York', '')).toThrow('两次');
    expect(() => inspectPublishTime('2026-12-12', '14:01', 'UTC+09')).toThrow('IANA');
  });
  it('disambiguates both fall-back instants and preserves the stored seconds for notes-only edits', () => {
    expect(resolvePublishTime('2026-11-01', '01:30', 'America/New_York', 'earlier')).toBe('2026-11-01T05:30:00Z');
    expect(resolvePublishTime('2026-11-01', '01:30', 'America/New_York', 'later')).toBe('2026-11-01T06:30:00Z');
    expect(resolvePublishTime('2026-11-01', '01:30', 'America/New_York', '', '2026-11-01T06:30:42.123456Z'))
      .toBe('2026-11-01T06:30:42.123456Z');
  });
  it('uses the real 23-hour and 25-hour boundaries with an exclusive next day', () => {
    for (const [date, hours] of [['2027-03-14', 23], ['2026-11-01', 25]] as const) {
      const day = Temporal.PlainDate.from(date);
      const bounds = publishUtcRange(day, day.add({ days: 1 }), 'America/New_York');
      expect(Date.parse(bounds.to) - Date.parse(bounds.from)).toBe(hours * 3600_000);
      expect(localPublishFields(bounds.to, 'America/New_York')).toEqual({ date: day.add({ days: 1 }).toString(), time: '00:00' });
    }
  });
  it('includes the adjacent dates in a month grid and handles a week spanning years', () => {
    const date = Temporal.PlainDate.from('2026-12-31');
    const month = publishCalendarPeriod(date, 'month');
    expect([month.start.toString(), month.end.toString()]).toEqual(['2026-11-30', '2027-01-04']);
    const week = publishCalendarPeriod(date, 'week');
    expect([week.start.toString(), week.end.toString()]).toEqual(['2026-12-28', '2027-01-04']);
  });
});

it('preserves URL filters and explicit date ranges with half-open UTC queries', () => {
  const params = new URLSearchParams({ view: 'list', tz: 'America/New_York', platform: 'xiaohongshu',
    account, status: 'manually_reported', completion: 'closed', from: '2026-10-31', through: '2026-11-01' });
  const result = publishListState(params, true);
  expect(result.filters).toEqual({ platform: 'xiaohongshu', account, status: 'manually_reported', completion: 'closed',
    from: '2026-10-31T04:00:00Z', to: '2026-11-02T05:00:00Z' });
  params.set('through', '2028-01-01');
  expect(publishListState(params, true).rangeError).toBeTruthy();
  params.set('account', 'not-a-uuid');
  expect(publishListState(params, true).filters.account).toBe('');
});

it('derives overdue and today labels without changing state', () => {
  expect(publishDueLabel(task, task.timezone, Temporal.Instant.from('2026-11-16T11:00:00Z'))).toBe('今日待处理');
  expect(publishDueLabel(task, task.timezone, Temporal.Instant.from('2026-11-16T13:00:00Z'))).toBe('已逾期');
  expect(publishDueLabel({ ...task, status: 'cancelled' }, task.timezone)).toBe('');
  expect(task.status).toBe('planned');
  expect(taskIsOpen('manually_reported')).toBe(false);
});

it('uses only the frozen content and attachments for task copy and JSON export', () => {
  const latest = { ...snapshot, title: '新标题', body: '新正文', version: 5, media: [] } as unknown as DistributionVariantRecord;
  expect(publishSnapshotDiff(snapshot, latest).map(field => field.label)).toEqual(['标题', '正文', '素材顺序、封面和处理说明']);
  expect(formatVariantCopy(snapshot, 'all')).toBe('冻结标题\n\n冻结正文\n\n#独立开发');
  const exported = createPublishExport(task, new Date('2026-11-15T00:00:00Z'));
  expect(exported).toMatchObject({ schema_version: 1, title: '冻结标题', body: '冻结正文', variant_version: 4,
    publish_task_id: task.id, scheduled_at: task.scheduled_at, timezone: 'Asia/Shanghai', account: { id: account, name: '项目号' },
    media: [{ media_id: snapshot.media[0].media_id, original_storage_path: 'uploads/frozen.webp', is_cover: true }] });
  expect(JSON.stringify(exported)).not.toContain('新标题');
});

it('validates notes, explicit instants, operator evidence and HTTP(S) work URLs', () => {
  expect(validatePublishSchedule({ scheduled_at: '2027-01-01T09:00:00+09:00', timezone: 'Asia/Tokyo', plan_note: '  备注  ' }))
    .toEqual({ scheduled_at: '2027-01-01T00:00:00Z', timezone: 'Asia/Tokyo', plan_note: '备注' });
  expect(() => publishReason('  \n')).toThrow('必填');
  for (const url of ['javascript:alert(1)', 'https://user:pass@example.com', 'https://', 'https://example.com:65536/',
    'https://example.com/\n', 'https://example.com/%oops', 'https:///example.com', 'https://example.com/' + 'x'.repeat(2048)]) {
    expect(() => validateWorkUrl(url)).toThrow('作品链接');
  }
  expect(validateWorkUrl('https://例子.中国/礼账')).toBe('https://xn--fsqu00a.xn--fiqs8s/%E7%A4%BC%E8%B4%A6');
  const input = { published_at: '2026-11-12T00:00:00Z', account_id: account, variant_version: 4, external_url: '', report_note: '人工核对' };
  expect(validatePublishReport(input, Date.parse('2026-11-13'))).toEqual(input);
  expect(() => validatePublishReport({ ...input, report_note: '' }, Date.parse('2026-11-13'))).toThrow('确认备注');
  expect(() => validatePublishReport(input, Date.parse('2026-11-11'))).toThrow('晚于');
});

it('maps PostgREST conflict, MFA and missing migration errors', () => {
  expect(publishError({ code: 'PT409' })).toBeInstanceOf(PublishConflict);
  expect(publishError({ code: '42501' }).message).toContain('MFA');
  expect(publishError({ code: 'PGRST202' }).message).toContain('尚未启用');
});
