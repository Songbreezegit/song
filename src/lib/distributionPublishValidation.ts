import { Temporal } from 'temporal-polyfill';
import { safeExternalUrl } from './safeUrl';
import { distributionId, distributionVersion } from './distributionValidation';
import { publishInstantPattern, validPublishZone } from './distributionPublishTime';
import type { PublishReport, PublishSchedule } from '../types/distributionPublish';

export function publishInstant(value: string) {
  if (!publishInstantPattern.test(value)) throw new Error('请填写带时区的有效时间。');
  return Temporal.Instant.from(value).toString();
}

function note(value: string, label: string, required = false) {
  const trimmed = value.trim();
  if ((required && !trimmed) || Array.from(trimmed).length > 2000 || value.includes('\0')) {
    throw new Error(label + (required ? '必填，且最多 2000 个字符。' : '最多 2000 个字符。'));
  }
  return trimmed;
}

export function publishReason(value: string) {
  return note(value, '操作理由', true);
}

export function validatePublishSchedule(input: PublishSchedule) {
  if (!validPublishZone(input.timezone)) throw new Error('请选择有效的 IANA 时区。');
  return { scheduled_at: publishInstant(input.scheduled_at), timezone: input.timezone, plan_note: note(input.plan_note, '计划备注') };
}

export function validateWorkUrl(value: string) {
  if (!value.trim()) return '';
  const normalized = safeExternalUrl(value);
  // Reject controls before URL normalization can strip them.
  if (!normalized || normalized.length > 2048 || !/^https?:\/\/[^/]/i.test(value.trim())
    || /%(?![0-9a-f]{2})/i.test(normalized)) {
    throw new Error('请输入有效的 HTTP 或 HTTPS 作品链接，最多 2048 个字符。');
  }
  return normalized;
}

export function validatePublishReport(input: PublishReport, now = Date.now()) {
  const published_at = publishInstant(input.published_at);
  if (Temporal.Instant.from(published_at).epochMilliseconds > now) throw new Error('实际发布时间不能晚于当前时间。');
  const external_url = validateWorkUrl(input.external_url);
  const report_note = note(input.report_note, '发布备注');
  if (!external_url && !report_note) throw new Error('请填写作品链接或发布确认备注。');
  return { published_at, external_url, report_note, account_id: distributionId(input.account_id), variant_version: distributionVersion(input.variant_version) };
}
