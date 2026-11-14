import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import type { PublishEvent, PublishTask } from '../../../src/types/distributionPublish';
import { distributionVariantsFixture } from './distributionVariants';

export const calendar = '/admin/distribution/calendar';
export const history = '/admin/distribution/history';
export const frozenTitle = '礼账发布手记：记录每一份心意';
const fixtureActor = '11111111-1111-4111-8111-111111111111';
const timestamp = '2026-11-12T07:00:00.000Z';

export async function distributionPublishFixture(page: Page) {
  const m2 = await distributionVariantsFixture(page);
  const variants = m2.variantState.variants;
  Object.assign(variants[0], { status: 'ready', title: frozenTitle });
  Object.assign(variants[1], { status: 'ready', title: '礼账项目号发布说明' });
  const tasks: PublishTask[] = [];
  const events: PublishEvent[] = [];
  const reads: URLSearchParams[] = [];
  const writes: { p_request_id: string; p_action: string; p_task_id: string; p_version: number; p_input: Record<string, any> }[] = [];
  const replay = new Map<string, PublishTask>();
  const flags = { readError: false, loseNextResponse: false };

  function snapshot(variant = variants[0]): PublishTask['content_snapshot'] {
    const account = m2.state.accounts.find(row => row.id === variant.account_id)!;
    return {
      variant_id: variant.id, variant_version: variant.version, source_version: variant.source_version, post_id: variant.post_id,
      account_id: variant.account_id, account_name: account.name, profile_url: account.profile_url, platform: variant.platform,
      title: variant.title, body: variant.body, tags: [...variant.tags], content_type: variant.content_type, captured_at: timestamp,
      media: variant.media.map((item, sort_order) => ({ ...item, sort_order,
        original_storage_path: m2.backend.media.find(row => row.id === item.media_id)?.path ?? '', mime_type: 'image/webp' })),
    };
  }
  function seed(scheduled_at: string, status: PublishTask['status'] = 'planned', variant = variants[0]) {
    const content_snapshot = snapshot(variant);
    const task: PublishTask = {
      id: randomUUID(), variant_id: variant.id, post_id: variant.post_id, account_id: variant.account_id, platform: variant.platform,
      variant_version: variant.version, title: variant.title, account_name: content_snapshot.account_name,
      scheduled_at, timezone: 'Asia/Shanghai', plan_note: '', status, version: 1, content_snapshot,
      published_at: null, reported_at: null, reported_by: null, external_url: null, report_note: null, report_evidence: null,
      created_by: fixtureActor, updated_by: fixtureActor, created_at: timestamp, updated_at: timestamp,
    };
    tasks.push(task);
    return task;
  }
  function append(task: PublishTask, kind: PublishEvent['event_type'], prior: PublishTask | null, request = randomUUID(), metadata: PublishEvent['metadata'] = {}) {
    events.push({
      id: randomUUID(), task_id: task.id, task_version: task.version, event_type: kind, actor_id: fixtureActor, request_id: request,
      old_state: prior, new_state: structuredClone(task), created_at: timestamp, metadata,
    });
  }
  await page.route('https://backend-v1-test.supabase.co/rest/v1/**', async route => {
    const request = route.request();
    const { pathname, searchParams: params } = new URL(request.url());
    const name = pathname.split('/').at(-1);
    const reply = (value: unknown, status = 200) => route.fulfill({ status, json: value });
    const fail = (code: string, status: number) => reply({ code, message: 'fixture response' }, status);
    const single = request.headers().accept?.includes('vnd.pgrst.object');
    if (name === 'distribution_variants' && params.get('select')?.includes('!inner')) {
      return reply(variants.filter(variant => variant.status === 'ready').map(variant => ({
        ...variant, account: m2.state.accounts.find(account => account.id === variant.account_id),
      })));
    }
    if (name === 'distribution_publish_tasks') {
      reads.push(params);
      if (flags.readError) return fail('XX000', 500);
      const matches = (task: PublishTask) => [...params].every(([key, value]) => {
        const row = task[key as keyof PublishTask];
        if (value.startsWith('eq.')) return row === value.slice(3);
        if (value.startsWith('gte.')) return Date.parse(String(row)) >= Date.parse(value.slice(4));
        if (value.startsWith('lt.')) return Date.parse(String(row)) < Date.parse(value.slice(3));
        if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(row));
        return true;
      });
      const filtered = tasks.filter(matches);
      const sorted = filtered.sort((a, b) => (a.scheduled_at.localeCompare(b.scheduled_at) || a.id.localeCompare(b.id)) *
        (params.get('order')?.includes('desc') ? -1 : 1));
      const cursor = params.get('or')?.match(/scheduled_at\.(gt|lt)\.([^,]+),and\(scheduled_at\.eq\.[^,]+,id\.(?:gt|lt)\.([0-9a-f-]+)\)/);
      const pageRows = sorted.filter(task => {
        if (!cursor) return true;
        const order = Date.parse(task.scheduled_at) - Date.parse(cursor[2]) || task.id.localeCompare(cursor[3]);
        return cursor[1] === 'gt' ? order > 0 : order < 0;
      }).slice(0, Number(params.get('limit') ?? 49));
      return reply(single ? pageRows[0] ?? null : pageRows);
    }
    if (name === 'distribution_publish_logs') {
      const rows = events.filter(event => params.get('task_id') === 'eq.' + event.task_id &&
        (!params.has('id') || params.get('id') === 'eq.' + event.id)).sort((a, b) => b.task_version - a.task_version);
      if (single) return reply(rows[0] ?? null);
      return reply(rows.map(event => ({ ...event, previous_status: event.old_state?.status ?? null, next_status: event.new_state.status,
        previous_variant: event.old_state ? String(event.old_state.variant_version) : null, next_variant: String(event.new_state.variant_version) })));
    }
    if (name !== 'change_distribution_publish_task') return route.fallback();
    const input = request.postDataJSON() as typeof writes[number];
    writes.push(input);
    const prior = replay.get(input.p_request_id);
    if (prior) return reply(prior);
    const fields = input.p_input;
    if (input.p_action === 'create') {
      const variant = variants.find(candidate => candidate.id === fields.variant_id);
      if (!variant || variant.version !== fields.variant_version) return fail('PT409', 409);
      const task = seed(fields.scheduled_at, 'planned', variant);
      Object.assign(task, { timezone: fields.timezone, plan_note: fields.plan_note });
      append(task, 'task_created', null, input.p_request_id);
      replay.set(input.p_request_id, structuredClone(task));
      if (flags.loseNextResponse) { flags.loseNextResponse = false; return fail('XX000', 500); }
      return reply(task);
    }
    const task = tasks.find(row => row.id === input.p_task_id);
    if (!task || task.version !== input.p_version) return fail('PT409', 409);
    const previous = structuredClone(task);
    let event: PublishEvent['event_type'];
    switch (input.p_action) {
      case 'reschedule':
        Object.assign(task, fields); event = 'task_rescheduled'; break;
      case 'start':
        task.status = 'awaiting_confirmation'; event = 'task_started'; break;
      case 'return':
        task.status = 'planned'; event = 'task_returned'; break;
      case 'cancel':
        task.status = 'cancelled'; event = 'task_cancelled'; break;
      case 'refresh_snapshot': {
        const latest = variants.find(row => row.id === task.variant_id);
        if (!latest || latest.version !== fields.variant_version) return fail('PT409', 409);
        task.content_snapshot = snapshot(latest); task.variant_version = latest.version; task.title = latest.title;
        event = 'task_snapshot_updated'; break;
      }
      case 'report': case 'correct_report':
        Object.assign(task, { status: 'manually_reported', published_at: fields.published_at, external_url: fields.external_url,
          report_note: fields.report_note, report_evidence: 'manual_user_report', reported_by: fixtureActor, reported_at: timestamp });
        event = input.p_action === 'report' ? 'manual_reported' : 'manual_report_corrected'; break;
      default: return fail('22023', 400);
    }
    task.version++;
    append(task, event, previous, input.p_request_id, { reason: fields.reason, evidence: task.report_evidence ?? undefined });
    replay.set(input.p_request_id, structuredClone(task));
    return reply(task);
  });
  return { ...m2, variants, tasks, events, reads, writes, flags, seed, append };
}
