import { useCallback, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { formatPublishTime, localPublishFields, resolvePublishTime } from '../../lib/distributionPublishTime';
import { safeExternalUrl } from '../../lib/safeUrl';
import { getPublishTask } from '../../services/distributionPublishService';
import { getDistributionAccount, getDistributionPost } from '../../services/distributionService';
import { getDistributionVariant } from '../../services/distributionVariantService';
import type { PublishCommand, PublishTask } from '../../types/distributionPublish';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { AdminQueryError } from '../components/AdminQueryError';
import { DistributionField, DistributionTabs } from '../features/distribution/DistributionChrome';
import { DistributionLeaveDialog } from '../features/distribution/DistributionLeaveDialog';
import { platformLabels } from '../features/distribution/distributionForm';
import { PublishStatusBadge, PublishTimeFields, type PublishTimeDraft } from '../features/distribution/PublishFields';
import { publishDueLabel, taskIsOpen } from '../features/distribution/publishModel';
import { publishCalendarPath, publishHistoryPath } from '../features/distribution/publishPaths';
import { PublishSnapshotPanel, PublishSnapshotReview, PublishTimeline } from '../features/distribution/PublishTaskPanels';
import { usePublishTaskAction } from '../features/distribution/usePublishTaskAction';
import { variantReadOnlyReason } from '../features/distribution/variantModel';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { getEditorReturnPath } from '../lib/editor';
import '../features/distribution/publish.css';

type TaskAction = Exclude<PublishCommand['action'], 'create'>;
interface Operation {
  action: TaskAction;
  baseVersion: number;
  time: PublishTimeDraft;
  note: string;
  workUrl: string;
  reason: string;
  confirmed: boolean;
  snapshotVersion?: number;
}

const operationLabels: Record<TaskAction, string> = {
  reschedule: '调整计划', refresh_snapshot: '更新任务内容', start: '开始人工发布', return: '退回计划',
  report: '确认已人工发布', correct_report: '纠正人工报告', cancel: '取消任务',
};

function operationFor(task: PublishTask, action: TaskAction, snapshotVersion?: number): Operation {
  const reporting = action === 'report' || action === 'correct_report';
  const timestamp = reporting ? task.published_at ?? new Date().toISOString() : task.scheduled_at;
  return {
    action, baseVersion: task.version, time: { ...localPublishFields(timestamp, task.timezone), timezone: task.timezone, offset: '' },
    note: reporting ? task.report_note ?? '' : task.plan_note, workUrl: task.external_url ?? '', reason: '', confirmed: false, snapshotVersion,
  };
}

function commandFor(task: PublishTask, form: Operation): PublishCommand {
  const record = { id: task.id, version: form.baseVersion };
  const { date, time, timezone, offset } = form.time;
  switch (form.action) {
    case 'start': return { ...record, action: 'start', input: {} };
    case 'return': case 'cancel': return { ...record, action: form.action, input: { reason: form.reason } };
    case 'refresh_snapshot':
      if (!form.snapshotVersion || form.snapshotVersion <= task.variant_version) throw new Error('请重新读取可采用的新版平台稿。');
      return { ...record, action: 'refresh_snapshot', input: { variant_version: form.snapshotVersion } };
    case 'reschedule': {
      const scheduled_at = resolvePublishTime(date, time, timezone, offset, timezone === task.timezone ? task.scheduled_at : undefined);
      if (Date.parse(scheduled_at) !== Date.parse(task.scheduled_at) && Date.parse(scheduled_at) <= Date.now()) {
        throw new Error('调整计划时间时请选择将来的时间。');
      }
      return { ...record, action: 'reschedule', input: { scheduled_at, timezone, plan_note: form.note } };
    }
    case 'report': case 'correct_report': {
      if (!form.confirmed) throw new Error('请核对账号和稿件版本，再确认人工发布结果。');
      const input = {
        published_at: resolvePublishTime(date, time, timezone, offset, task.published_at ?? undefined),
        external_url: form.workUrl, report_note: form.note, account_id: task.account_id, variant_version: task.variant_version,
      };
      return form.action === 'report' ? { ...record, action: 'report', input }
        : { ...record, action: 'correct_report', input: { ...input, reason: form.reason } };
    }
  }
}

export function AdminDistributionPublishTask() {
  const { taskId = '' } = useParams();
  return <PublishTaskPage key={taskId} id={taskId} />;
}

function PublishTaskPage({ id }: { id: string }) {
  const location = useLocation();
  const historyReturn = getEditorReturnPath(publishHistoryPath, location.state);
  const returnTo = historyReturn !== publishHistoryPath || location.state?.returnTo === publishHistoryPath
    ? historyReturn : getEditorReturnPath(publishCalendarPath, location.state);
  const [form, setForm] = useState<Operation | null>(null);
  const action = usePublishTaskAction(Boolean(form));
  const load = useCallback(() => getPublishTask(id), [id]);
  const query = useAdminQuery<PublishTask | null>(load, null, '无法读取发布任务。');
  const task = query.data;
  const variantId = task?.variant_id;
  const postId = task?.post_id;
  const accountId = task?.account_id;
  const loadVariant = useCallback(async () => {
    if (!variantId || !postId || !accountId) return null;
    const [variant, source, account] = await Promise.all([
      getDistributionVariant(postId, variantId), getDistributionPost(postId), getDistributionAccount(accountId),
    ]);
    if (!variant || !source) return null;
    return { variant, account, disabled: variantReadOnlyReason(source, account ?? undefined, variant) };
  }, [variantId, postId, accountId]);
  const live = useAdminQuery<Awaited<ReturnType<typeof loadVariant>>>(loadVariant, null, '无法读取当前平台稿。');
  const readyLatest = live.data && !live.error && !live.loading && !live.data.disabled && live.data.variant.status === 'ready'
    ? live.data.variant.version : undefined;
  if (!task && query.loading) return <AdminLoading />;
  if (!task) return <div className="publish-workspace">
    <DistributionTabs /><Link to={returnTo}>返回任务列表</Link><AdminQueryError error={query.error} onRetry={query.reload} />
  </div>;

  const currentVariant = live.data?.variant;
  const newer = currentVariant && currentVariant.version > task.variant_version ? currentVariant : null;
  const refreshAllowed = readyLatest !== undefined && readyLatest > task.variant_version && taskIsOpen(task.status);
  const allowed: TaskAction[] = [];
  if (task.status === 'planned') allowed.push('start');
  if (task.status === 'awaiting_confirmation') allowed.push('report', 'return');
  if (taskIsOpen(task.status)) {
    allowed.push('reschedule');
    if (refreshAllowed) allowed.push('refresh_snapshot');
    allowed.push('cancel');
  }
  if (task.status === 'manually_reported') allowed.push('correct_report');
  const due = publishDueLabel(task, task.timezone);
  const workUrl = safeExternalUrl(task.external_url);
  const snapshotChanged = form?.action === 'refresh_snapshot' && form.snapshotVersion !== readyLatest;
  const refresh = () => { void query.reload(); void live.reload(); };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form || form.baseVersion !== task.version || action.saving || query.loading || snapshotChanged || !allowed.includes(form.action)) return;
    try {
      void action.submit(commandFor(task, form), updated => {
        query.setData(updated);
        setForm(null);
        void query.reload();
        if (form.action === 'refresh_snapshot') void live.reload();
      }, '已记录' + operationLabels[form.action] + '。');
    } catch (error) { action.setFeedback({ type: 'error', message: (error as Error).message }); }
  };

  return <div className="distribution-workspace publish-workspace">
    <DistributionTabs />
    {action.blockedNavigation && <DistributionLeaveDialog {...action.blockedNavigation} isDirty={Boolean(form)} saving={action.saving} />}
    <AdminPageHeader title={task.title} description={platformLabels[task.platform] + ' · ' + task.account_name + ' · 稿件 v' + task.variant_version}
      actions={<>
        <Link to={returnTo} className="admin-btn admin-btn-secondary">返回任务列表</Link>
        <button type="button" className="admin-btn admin-btn-secondary" disabled={query.loading || action.saving} onClick={refresh}>重新读取任务</button>
      </>} />
    <AdminFeedback feedback={action.feedback ?? (location.state?.created ? { type: 'success', message: '已创建发布任务。' } : null)} />
    {query.error && <AdminQueryError error={query.error} onRetry={query.reload} />}
    <div className="publish-detail-layout">
      <div>
        <section className="admin-card publish-card" aria-label="任务状态与操作">
          <div className="publish-calendar-toolbar"><h2 className="admin-card-title">发布计划</h2>
            <div className="publish-inline"><PublishStatusBadge status={task.status} />{due && <span className="publish-due">{due}</span>}</div>
          </div>
          <dl className="publish-task-facts">
            <div><dt>计划发布时间</dt><dd>{formatPublishTime(task.scheduled_at, task.timezone)}</dd></div>
            <div><dt>任务版本</dt><dd>v{task.version}</dd></div>
            {task.plan_note && <div><dt>计划备注</dt><dd>{task.plan_note}</dd></div>}
            {task.published_at && <div><dt>实际发布时间</dt><dd>{formatPublishTime(task.published_at, task.timezone)}</dd></div>}
            {task.reported_by && <div><dt>人工报告人</dt><dd>{task.reported_by}</dd></div>}
            {task.report_note && <div><dt>发布备注</dt><dd>{task.report_note}</dd></div>}
          </dl>
          {task.report_evidence && <p className="distribution-secondary">证据类型为人工报告。平台核验状态为未核验。</p>}
          {workUrl && <a href={workUrl} target="_blank" rel="noreferrer">打开作品链接</a>}
          {live.error && <AdminQueryError error={live.error} onRetry={live.reload} />}
          {live.data?.disabled && <p className="distribution-secondary">{live.data.disabled}</p>}
          {newer && <div className="publish-version-notice">
            <strong>平台稿已有新版本</strong>
            <p>当前任务使用 v{task.variant_version}，最新为 v{newer.version}。</p>
            <PublishSnapshotReview task={task} latest={newer} accountName={live.data?.account?.name} />
          </div>}
          {!form && <div className="publish-inline publish-operation-actions">
            {allowed.map(kind => <button key={kind} type="button" className={'admin-btn ' +
              (kind === 'start' || kind === 'report' ? 'admin-btn-primary' : kind === 'cancel' ? 'admin-btn-danger' : 'admin-btn-secondary')}
              disabled={query.loading || Boolean(query.error)} onClick={() => {
                action.setFeedback(null);
                setForm(operationFor(task, kind, kind === 'refresh_snapshot' ? readyLatest : undefined));
              }}>{operationLabels[kind]}</button>)}
          </div>}
          {form && <PublishOperationForm task={task} form={form} setForm={setForm} submit={submit} snapshotChanged={Boolean(snapshotChanged)}
            pending={action.saving} unavailable={Boolean(query.loading || query.error || snapshotChanged) || !allowed.includes(form.action)} />}
        </section>
        <PublishTimeline key={task.version} task={task} />
      </div>
      <PublishSnapshotPanel task={task} />
    </div>
  </div>;
}

function PublishOperationForm({ task, form, setForm, submit, snapshotChanged, pending, unavailable }: {
  task: PublishTask; form: Operation; setForm: (value: Operation | null) => void; submit: (event: FormEvent) => void;
  snapshotChanged: boolean; pending: boolean; unavailable: boolean;
}) {
  const set = (patch: Partial<Operation>) => setForm({ ...form, ...patch });
  const reporting = form.action === 'report' || form.action === 'correct_report';
  const plan = form.action === 'reschedule';
  const needsReason = form.action === 'return' || form.action === 'cancel' || form.action === 'correct_report';
  const stale = form.baseVersion !== task.version;
  return <form className="publish-operation" onSubmit={submit}>
    <h3>{operationLabels[form.action]}</h3>
    {stale && <div className="publish-version-notice">
      <p>任务已更新至 v{task.version}。核对当前内容后可以保留表单并继续。</p>
      <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" disabled={unavailable}
        onClick={() => set({ baseVersion: task.version, confirmed: false })}>以当前任务版本继续编辑</button>
    </div>}
    {form.action === 'start' && <p>开始后，任务进入待人工确认，供你前往平台操作并回填结果。</p>}
    {form.action === 'refresh_snapshot' && <p>{snapshotChanged ? '可用的平台稿版本已变化，请重新选择并确认。'
      : '确认将任务快照从 v' + task.variant_version + ' 更新为 v' + form.snapshotVersion + '。变更会加入操作时间线。'}</p>}
    {form.action === 'cancel' && <p>确认取消此任务。之后可从平台稿创建新的计划。</p>}
    {reporting && <p>此操作记录人工确认结果，平台核验状态仍为待核验。</p>}
    <fieldset className="publish-fieldset" disabled={pending}>
      {(plan || reporting) && <>
        <PublishTimeFields value={form.time} onChange={time => set({ time })} actual={reporting} allowZoneChange={plan} />
        {reporting && <DistributionField id="publish-work-url" label="作品链接" help="作品链接和发布备注至少填写一项。">
          <input id="publish-work-url" className="admin-input" type="url" maxLength={2048} value={form.workUrl}
            aria-describedby="publish-work-url-help" onChange={event => set({ workUrl: event.target.value })} />
        </DistributionField>}
        <DistributionField id="publish-operation-note" label={plan ? '计划备注' : '发布备注'}>
          <textarea id="publish-operation-note" className="admin-textarea" rows={3} maxLength={2000} value={form.note}
            onChange={event => set({ note: event.target.value })} />
        </DistributionField>
      </>}
      {needsReason && <DistributionField id="publish-operation-reason" label="操作理由">
        <textarea id="publish-operation-reason" className="admin-textarea" required rows={2} maxLength={2000} value={form.reason}
          onChange={event => set({ reason: event.target.value })} />
      </DistributionField>}
      {reporting && <label className="distribution-checkbox publish-confirm">
        <input type="checkbox" required checked={form.confirmed} onChange={event => set({ confirmed: event.target.checked })} />
        <span>我确认使用 {task.account_name} 发布了稿件 v{task.variant_version}。</span>
      </label>}
    </fieldset>
    <div className="publish-inline publish-operation-actions">
      <button type="button" className="admin-btn admin-btn-secondary" disabled={pending} onClick={() => setForm(null)}>放弃本次编辑</button>
      <button type="submit" className={form.action === 'cancel' ? 'admin-btn admin-btn-danger' : 'admin-btn admin-btn-primary'}
        disabled={pending || unavailable || stale}>{pending ? '正在保存…' : '提交' + operationLabels[form.action]}</button>
    </div>
  </form>;
}
