import { Temporal } from 'temporal-polyfill';

export const defaultPublishZone = 'Asia/Shanghai';
export const publishZones = ['Asia/Shanghai', 'Asia/Tokyo', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'UTC'];
export const publishDatePattern = /^\d{4}-\d{2}-\d{2}$/;
export const publishInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
export type PublishCalendarView = 'month' | 'week' | 'list';
export type TimeChoice = 'earlier' | 'later';

export function validPublishZone(zone: string) {
  if (!/^(UTC|[A-Za-z_]+\/[A-Za-z0-9_+/-]+)$/.test(zone) || zone.length > 100) return false;
  try {
    new Intl.DateTimeFormat('zh-CN', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function publishDate(value: string | null): Temporal.PlainDate | null {
  if (!value || !publishDatePattern.test(value) || value.startsWith('0000')) return null;
  try { return Temporal.PlainDate.from(value); }
  catch { return null; }
}

export function instantInZone(instant: string, zone: string) {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(zone);
}

export function localPublishFields(instant: string, zone: string) {
  const dateTime = instantInZone(instant, zone);
  return { date: dateTime.toPlainDate().toString(), time: dateTime.toPlainTime().toString({ smallestUnit: 'minute' }) };
}

export function formatPublishTime(instant: string, zone: string) {
  const zoned = instantInZone(instant, zone);
  return zoned.toPlainDate().toString() + ' ' +
    zoned.toPlainTime().toString({ smallestUnit: 'minute' }) + ' ' + zone + ' (UTC' + zoned.offset + ')';
}

export function inspectPublishTime(date: string, time: string, zone: string) {
  if (!publishDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('请选择有效的日期和时间。');
  }
  if (!validPublishZone(zone)) throw new Error('请输入有效的 IANA 时区，例如 Asia/Shanghai。');
  const local = Temporal.PlainDateTime.from(date + 'T' + time);
  const earlier = local.toZonedDateTime(zone, { disambiguation: 'earlier' });
  const later = local.toZonedDateTime(zone, { disambiguation: 'later' });
  if (!earlier.toPlainDateTime().equals(local) || !later.toPlainDateTime().equals(local)) {
    throw new Error('时钟调整跳过了这段本地时间，请选择其他时间。');
  }
  return { earlier, later, repeated: earlier.epochNanoseconds !== later.epochNanoseconds };
}

export function resolvePublishTime(date: string, time: string, zone: string, choice: TimeChoice | '', original?: string) {
  // Notes-only edits keep the stored instant, including sub-minute precision.
  if (original && !choice) {
    const fields = localPublishFields(original, zone);
    if (fields.date === date && fields.time === time) return Temporal.Instant.from(original).toString();
  }
  const times = inspectPublishTime(date, time, zone);
  if (times.repeated && !choice) throw new Error('该本地时间出现两次，请选择对应的 UTC 偏移。');
  return times[choice || 'earlier'].toInstant().toString();
}

function startOfWeek(date: Temporal.PlainDate) {
  return date.subtract({ days: date.dayOfWeek - 1 });
}

export function publishCalendarPeriod(date: Temporal.PlainDate, view: PublishCalendarView) {
  if (view === 'week') {
    const start = startOfWeek(date);
    return { start, end: start.add({ weeks: 1 }) };
  }
  const month = date.with({ day: 1 });
  const nextMonth = month.add({ months: 1 });
  if (view === 'list') return { start: month, end: nextMonth };
  return { start: startOfWeek(month), end: startOfWeek(nextMonth.add({ days: 6 })) };
}

export function publishUtcRange(start: Temporal.PlainDate, end: Temporal.PlainDate, zone: string) {
  return { from: start.toZonedDateTime(zone).toInstant().toString(), to: end.toZonedDateTime(zone).toInstant().toString() };
}

export function publishDates(start: Temporal.PlainDate, end: Temporal.PlainDate) {
  const dates: Temporal.PlainDate[] = [];
  for (let date = start; Temporal.PlainDate.compare(date, end) < 0; date = date.add({ days: 1 })) dates.push(date);
  return dates;
}
