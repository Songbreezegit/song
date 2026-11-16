import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Temporal } from 'temporal-polyfill';
import { defaultPublishZone, publishDate, resolvePublishTime, validPublishZone } from '../../lib/distributionPublishTime';
import { listPublishCandidates, type PublishCandidate } from '../../services/distributionPublishService';
import { getDistributionAccount, getDistributionPost } from '../../services/distributionService';
import { getDistributionVariant } from '../../services/distributionVariantService';
import type { PublishTask } from '../../types/distributionPublish';
import { AdminEditorHeader } from '../components/AdminEditorChrome';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminQueryError } from '../components/AdminQueryError';
import { DistributionField, DistributionTabs } from '../features/distribution/DistributionChrome';
import { DistributionLeaveDialog } from '../features/distribution/DistributionLeaveDialog';
import { platformLabels } from '../features/distribution/distributionForm';
import { PublishTimeFields, type PublishTimeDraft } from '../features/distribution/PublishFields';
import { publishCalendarPath, publishTaskPath } from '../features/distribution/publishPaths';
import { usePublishTaskAction } from '../features/distribution/usePublishTaskAction';
import { variantReadOnlyReason } from '../features/distribution/variantModel';
import { useAdminAction } from '../hooks/useAdminAction';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { getEditorReturnPath } from '../lib/editor';
import '../features/distribution/publish.css';

interface VariantSelection { id: string; post_id: string }

export function AdminDistributionPublishNew() {
  const [params] = useSearchParams();
  const zone = params.get('tz') ?? '';
  const timezone = validPublishZone(zone) ? zone : defaultPublishZone;
  const date = publishDate(params.get('date')) ?? Temporal.Now.plainDateISO(timezone);
  const variant = params.get('variant');
  const post = params.get('post');
  return <PublishNew key={params.toString()} initialTime={{ date: date.toString(), time: '', timezone, offset: '' }}
    initialSelection={variant && post ? { id: variant, post_id: post } : null} />;
}

function PublishNew({ initialSelection, initialTime }: { initialSelection: VariantSelection | null; initialTime: PublishTimeDraft }) {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = getEditorReturnPath(publishCalendarPath, location.state);
  const [selected, setSelected] = useState(initialSelection);
  const [time, setTime] = useState(initialTime);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<PublishTask | null>(null);
  const dirty = !saved && (selected?.id !== initialSelection?.id || JSON.stringify(time) !== JSON.stringify(initialTime) || note !== '');
  const action = usePublishTaskAction(dirty);
  const { blocker, departureApproved, saving } = action;
  const load = useCallback(async () => {
    if (!selected) return null;
    const variant = await getDistributionVariant(selected.post_id, selected.id);
    if (!variant) throw new Error('平台稿不存在或当前无权访问。');
    const [source, account] = await Promise.all([getDistributionPost(variant.post_id), getDistributionAccount(variant.account_id)]);
    if (!source) throw new Error('内容源不可用。');
    const reason = variantReadOnlyReason(source, account ?? undefined, variant);
    if (reason) throw new Error(reason);
    if (!account || variant.status !== 'ready') throw new Error('请选择已保存为待发布的可用平台稿。');
    return { variant, account };
  }, [selected]);
  const draft = useAdminQuery<Awaited<ReturnType<typeof load>>>(load, null, '无法读取所选平台稿。');
  const usable = draft.data?.variant.id === selected?.id && !draft.loading && !draft.error ? draft.data : null;

  useEffect(() => {
    if (saved && !saving && blocker.state === 'unblocked' && !departureApproved.current) {
      void navigate(publishTaskPath(saved.id), { replace: true, state: { returnTo, created: true } });
    }
  }, [saved, saving, blocker.state, departureApproved, navigate, returnTo]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!usable || saving || saved) return;
    try {
      const scheduled_at = resolvePublishTime(time.date, time.time, time.timezone, time.offset);
      if (Date.parse(scheduled_at) <= Date.now()) throw new Error('请选择将来的计划时间。');
      void action.submit({ action: 'create', input: {
        scheduled_at, timezone: time.timezone, plan_note: note, variant_id: usable.variant.id, variant_version: usable.variant.version,
      } }, setSaved, '已创建发布任务。');
    } catch (error) { action.setFeedback({ type: 'error', message: (error as Error).message }); }
  };

  return <div className="distribution-workspace publish-workspace">
    <DistributionTabs />
    {action.blockedNavigation && <DistributionLeaveDialog {...action.blockedNavigation} isDirty={dirty} saving={saving} />}
    <AdminEditorHeader title="新建发布任务" description="选择已准备好的平台稿和计划时间。" backTo={returnTo}
      isDirty={dirty} saving={saving} lastSavedAt={saved ? Date.parse(saved.created_at) : null}
      actions={<button className="admin-btn admin-btn-primary" type="submit" form="publish-new-task" disabled={!usable || saving || Boolean(saved)}>创建发布任务</button>} />
    <div className="publish-detail-layout">
      <section className="admin-card publish-card" aria-label="选择平台稿">
        <h2 className="admin-card-title">平台稿</h2>
        {selected ? <>
          {draft.loading && <AdminLoading />}
          {draft.error && <AdminQueryError error={draft.error} onRetry={draft.reload} />}
          {usable && <>
            <h3>{usable.variant.title}</h3>
            <p className="publish-task-account">{platformLabels[usable.variant.platform]} · {usable.account.name} · 稿件 v{usable.variant.version}</p>
            <p className="publish-preview-text">{usable.variant.body}</p>
            <p className="distribution-secondary">{usable.variant.tags.map(tag => '#' + tag).join(' ')} · {usable.variant.media.length} 项素材</p>
            <Link to={'/admin/distribution/posts/' + usable.variant.post_id + '/variants/' + usable.variant.id}>查看平台稿</Link>
          </>}
          <div className="publish-inline">
            <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" disabled={saving} onClick={() => setSelected(null)}>更换平台稿</button>
            {!draft.error && <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" disabled={saving || draft.loading} onClick={draft.reload}>重新读取平台稿</button>}
          </div>
        </> : <PublishCandidatePicker select={setSelected} />}
      </section>
      <form id="publish-new-task" className="admin-card publish-card" onSubmit={submit}>
        <h2 className="admin-card-title">计划安排</h2>
        <p className="admin-card-description">新任务请选择将来的时间。</p>
        <fieldset className="publish-fieldset" disabled={saving || Boolean(saved)}>
          <PublishTimeFields value={time} onChange={setTime} />
          <DistributionField id="publish-plan-note" label="计划备注">
            <textarea className="admin-textarea" id="publish-plan-note" rows={4} maxLength={2000} value={note}
              onChange={event => setNote(event.target.value)} />
          </DistributionField>
        </fieldset>
        <AdminFeedback feedback={action.feedback} />
      </form>
    </div>
  </div>;
}

function PublishCandidatePicker({ select }: { select: (candidate: PublishCandidate) => void }) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const load = useCallback(() => listPublishCandidates(search), [search]);
  const query = useAdminQuery(load, { rows: [], hasMore: false }, '无法读取待发布平台稿。');
  const more = useAdminAction();
  const rows = query.data.rows.filter(candidate => candidate.account.platform === candidate.platform);
  const loadMore = () => {
    const cursor = query.data.rows.at(-1)?.id;
    if (cursor) void more.run('candidates', () => listPublishCandidates(search, cursor), {
      onSuccess: page => query.setData(previous => ({ rows: [...previous.rows, ...page.rows], hasMore: page.hasMore })),
    });
  };
  return <>
    <form className="publish-candidate-search" onSubmit={event => { event.preventDefault(); setSearch(input.trim()); }}>
      <DistributionField id="publish-candidate-search" label="搜索待发布平台稿">
        <input id="publish-candidate-search" className="admin-input" value={input} maxLength={100} onChange={event => setInput(event.target.value)} />
      </DistributionField>
      <button type="submit" className="admin-btn admin-btn-secondary" disabled={Boolean(more.pendingKey)}>搜索</button>
    </form>
    {query.loading ? <AdminLoading /> : query.error ? <AdminQueryError error={query.error} onRetry={query.reload} /> : <>
      {!rows.length && <p className="distribution-secondary">此页没有匹配的待发布平台稿。</p>}
      <ul className="publish-task-list publish-candidates">{rows.map(candidate => <li key={candidate.id}>
        <div><strong>{candidate.title}</strong>
          <p className="publish-task-account">{platformLabels[candidate.platform]} · {candidate.account.name} · 稿件 v{candidate.version}</p></div>
        <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => select(candidate)}>选择<span className="sr-only"> {candidate.title} {candidate.account.name}</span></button>
      </li>)}</ul>
      {query.data.hasMore && <button type="button" className="admin-btn admin-btn-secondary" onClick={loadMore} disabled={Boolean(more.pendingKey)}>加载更多稿件</button>}
      <AdminFeedback feedback={more.feedback} />
    </>}
  </>;
}
