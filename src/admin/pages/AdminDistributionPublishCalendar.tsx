import { useCallback, useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { formatPublishTime, localPublishFields, publishDates, validPublishZone, type PublishCalendarView } from '../../lib/distributionPublishTime';
import { safeExternalUrl } from '../../lib/safeUrl';
import { listPublishTasks } from '../../services/distributionPublishService';
import { fetchDistributionAccounts } from '../../services/distributionService';
import { distributionPlatforms } from '../../types/distribution';
import { publishStatuses, type PublishTaskSummary } from '../../types/distributionPublish';
import { AdminFeedback } from '../components/AdminFeedback';
import { AdminLoading } from '../components/AdminLoading';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { AdminQueryError } from '../components/AdminQueryError';
import { DistributionEmpty, DistributionField, DistributionTabs } from '../features/distribution/DistributionChrome';
import { platformLabels } from '../features/distribution/distributionForm';
import { PublishStatusBadge, PublishZoneField } from '../features/distribution/PublishFields';
import { publishDueLabel, publishListState, publishStatusLabels } from '../features/distribution/publishModel';
import { newPublishTaskPath, publishTaskPath } from '../features/distribution/publishPaths';
import { useAdminAction } from '../hooks/useAdminAction';
import { useAdminQuery } from '../hooks/useAdminQuery';
import '../features/distribution/publish.css';

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
const views: { value: PublishCalendarView; label: string }[] = [
  { value: 'month', label: '月视图' }, { value: 'week', label: '周视图' }, { value: 'list', label: '任务列表' },
];
type CalendarState = ReturnType<typeof publishListState>;
type SetFilter = (key: string, value: string) => void;

export function AdminDistributionPublishCalendar() { return <PublishCalendarPage history={false} />; }
export function AdminDistributionPublishHistory() { return <PublishCalendarPage history />; }

function PublishCalendarPage({ history }: { history: boolean }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const state = useMemo(() => publishListState(params, history), [params, history]);
  const { zone, date, view, period, filters, from, through, explicit, rangeError } = state;
  const returnTo = location.pathname + location.search;
  const accounts = useAdminQuery(fetchDistributionAccounts, [], '无法读取账号筛选项。');
  const set: SetFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };
  const shift = (direction: number) => set('date', date.add(view === 'week' ? { weeks: direction } : { months: direction }).toString());
  const resetRange = () => {
    const next = new URLSearchParams(params);
    next.delete('from');
    next.delete('through');
    setParams(next, { replace: true });
  };
  const periodLabel = view === 'week' ? period.start.toString() + ' 至 ' + period.end.subtract({ days: 1 }).toString()
    : date.year + '年' + date.month + '月';

  return <div className="distribution-workspace publish-workspace">
    <DistributionTabs />
    <AdminPageHeader title={history ? '发布历史' : '发布日历'}
      description={history ? '按计划时间查找任务，查看人工报告和每次变更。' : '安排平台稿的人工发布时间，跟进待处理任务。'}
      actions={!history && <Link className="admin-btn admin-btn-primary" state={{ returnTo }}
        to={newPublishTaskPath({ date: date.toString(), tz: zone })}><CalendarPlus size={16} />新建发布任务</Link>} />

    <section className="admin-card publish-calendar-controls" aria-label="日历与筛选">
      <div className="publish-calendar-toolbar">
        {!explicit && <div className="publish-inline">
          <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" aria-label="上一个时段" onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
          <h2 className="publish-period">{periodLabel}</h2>
          <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" aria-label="下一个时段" onClick={() => shift(1)}><ChevronRight size={16} /></button>
        </div>}
        {!history && <div className="publish-inline" aria-label="日历视图">
          {views.map(option => <button key={option.value} type="button" className="admin-btn admin-btn-secondary admin-btn-sm publish-view-button"
            aria-pressed={view === option.value} onClick={() => set('view', option.value)}>{option.label}</button>)}
        </div>}
        {explicit && <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={resetRange}>恢复按月查看</button>}
      </div>
      <div className="publish-fields publish-filter-fields">
        <PublishZoneFilter key={zone} zone={zone} apply={value => set('tz', value)} />
        <DistributionField id="publish-filter-platform" label="平台"><select id="publish-filter-platform" className="admin-select" value={filters.platform}
          onChange={event => set('platform', event.target.value)}><option value="">全部平台</option>
          {distributionPlatforms.map(value => <option key={value} value={value}>{platformLabels[value]}</option>)}</select></DistributionField>
        <DistributionField id="publish-filter-account" label="账号"><select id="publish-filter-account" className="admin-select" value={filters.account}
          onChange={event => set('account', event.target.value)}><option value="">全部账号</option>
          {accounts.data.map(account => <option key={account.id} value={account.id}>{account.name}{account.archived_at ? '（已归档）' : ''}</option>)}</select></DistributionField>
        <DistributionField id="publish-filter-status" label="任务状态"><select id="publish-filter-status" className="admin-select" value={filters.status}
          onChange={event => set('status', event.target.value)}><option value="">全部状态</option>
          {publishStatuses.map(value => <option key={value} value={value}>{publishStatusLabels[value]}</option>)}</select></DistributionField>
        <DistributionField id="publish-filter-completion" label="处理进度"><select id="publish-filter-completion" className="admin-select" value={filters.completion}
          onChange={event => set('completion', event.target.value)}><option value="">全部进度</option><option value="open">待处理</option>
          <option value="closed">已结束</option></select></DistributionField>
        {view === 'list' && <>
          <DistributionField id="publish-filter-from" label="起始日期"><input id="publish-filter-from" className="admin-input" type="date" value={from}
            onChange={event => set('from', event.target.value)} /></DistributionField>
          <DistributionField id="publish-filter-through" label="截止日期"><input id="publish-filter-through" className="admin-input" type="date" value={through}
            onChange={event => set('through', event.target.value)} /></DistributionField>
        </>}
      </div>
      {accounts.error && <AdminQueryError error={accounts.error} onRetry={accounts.reload} />}
      {rangeError && <p role="alert" className="publish-validation">{rangeError}</p>}
    </section>
    {!rangeError && <PublishCalendarResults key={JSON.stringify([filters, history])} state={state} history={history}
      returnTo={returnTo} select={value => set('date', value)} />}
  </div>;
}

function PublishZoneFilter({ zone, apply }: { zone: string; apply: (value: string) => void }) {
  const [value, setValue] = useState(zone);
  return <form className="publish-zone-filter" onSubmit={event => { event.preventDefault(); if (validPublishZone(value)) apply(value); }}>
    <PublishZoneField id="publish-filter-zone" label="日历时区" value={value} onChange={setValue} />
    {value !== zone && <button className="admin-btn admin-btn-secondary admin-btn-sm" disabled={!validPublishZone(value)}>应用时区</button>}
    {!validPublishZone(value) && <p className="publish-validation">请输入有效的 IANA 时区。</p>}
  </form>;
}

function PublishCalendarResults({ state, history, returnTo, select }: {
  state: CalendarState; history: boolean; returnTo: string; select: (date: string) => void;
}) {
  const { filters, zone, view, period, date } = state;
  const { from, to, platform, account, status, completion } = filters;
  const load = useCallback(() => listPublishTasks({ from, to, platform, account, status, completion }, undefined, history),
    [from, to, platform, account, status, completion, history]);
  const query = useAdminQuery(load, { rows: [], hasMore: false }, '发布任务加载失败。');
  const more = useAdminAction();
  const rows = query.data.rows;
  const grouped = new Map<string, PublishTaskSummary[]>();
  for (const task of rows) {
    const day = localPublishFields(task.scheduled_at, zone).date;
    const tasks = grouped.get(day);
    if (tasks) tasks.push(task); else grouped.set(day, [task]);
  }
  const selectedRows = grouped.get(date.toString()) ?? [];
  const days = view === 'list' ? [] : publishDates(period.start, period.end);
  const loadMore = () => {
    const cursor = rows.at(-1);
    if (!cursor) return;
    void more.run('page', () => listPublishTasks(filters, cursor, history), {
      onSuccess: page => query.setData(previous => {
        const ids = new Set(previous.rows.map(task => task.id));
        return { rows: [...previous.rows, ...page.rows.filter(task => !ids.has(task.id))], hasMore: page.hasMore };
      }),
    });
  };
  if (query.loading) return <AdminLoading />;
  if (query.error) return <AdminQueryError error={query.error} onRetry={query.reload} />;
  return <>
    {view === 'list' ? <PublishTaskList rows={rows} zone={zone} history={history} returnTo={returnTo} /> :
      <div className="publish-calendar-layout">
        <section className="publish-calendar-grid" aria-label={view === 'week' ? '周日历' : '月日历'} data-view={view}>
          {weekdays.map(label => <div key={label} className="publish-weekday">周{label}</div>)}
          {days.map(day => {
            const key = day.toString();
            const tasks = grouped.get(key) ?? [];
            return <button key={key} type="button" className="publish-calendar-day" data-outside={view === 'month' && day.month !== date.month}
              aria-pressed={day.equals(date)} aria-label={key + '，已加载 ' + tasks.length + ' 项任务'} onClick={() => select(key)}>
              <span className="publish-day-number">{day.day}{!!tasks.length && <small>{tasks.length}</small>}</span>
              {tasks.slice(0, 2).map(task => <span key={task.id} className="publish-calendar-preview" data-platform={task.platform}>
                <strong>{localPublishFields(task.scheduled_at, zone).time} {task.title}</strong>
                <small>{platformLabels[task.platform]} · {task.account_name} · {publishStatusLabels[task.status]}</small>
              </span>)}
            </button>;
          })}
        </section>
        <section className="admin-card publish-agenda" aria-label="所选日期的任务">
          <div className="publish-calendar-toolbar">
            <h2 className="admin-card-title">{date.toString()} 的任务</h2>
            <Link to={newPublishTaskPath({ date: date.toString(), tz: zone })} state={{ returnTo }} className="admin-btn admin-btn-secondary admin-btn-sm">
              <CalendarPlus size={15} />安排此日
            </Link>
          </div>
          <PublishTaskList rows={selectedRows} zone={zone} history={false} returnTo={returnTo} partial={query.data.hasMore} />
        </section>
      </div>}
    {query.data.hasMore && <div className="publish-more">
      <p className="distribution-secondary">已加载 {rows.length} 项，继续加载可查看同一范围内的其他任务。</p>
      <button type="button" className="admin-btn admin-btn-secondary" disabled={Boolean(more.pendingKey)} onClick={loadMore}>加载更多任务</button>
      <AdminFeedback feedback={more.feedback} />
    </div>}
  </>;
}

function PublishTaskList({ rows, zone, history, returnTo, partial }: {
  rows: PublishTaskSummary[]; zone: string; history: boolean; returnTo: string; partial?: boolean;
}) {
  if (!rows.length) return <DistributionEmpty title={partial ? '此日暂无已加载任务' : '此范围暂无任务'}
    description={partial ? '加载更多可继续查看。' : '请选择其他日期或调整筛选。'} />;
  return <ul className="publish-task-list">
    {rows.map(task => {
      const due = publishDueLabel(task, zone);
      const workUrl = safeExternalUrl(task.external_url);
      return <li key={task.id}>
        <div className="publish-task-row">
          <div>
            <Link className="publish-task-title" to={publishTaskPath(task.id)} state={{ returnTo }}>{task.title}</Link>
            <p className="publish-task-account" data-platform={task.platform}>{platformLabels[task.platform]} · {task.account_name} · 稿件 v{task.variant_version}</p>
          </div>
          <div className="publish-row-status"><PublishStatusBadge status={task.status} />{due && <span className="publish-due">{due}</span>}</div>
        </div>
        <p className="distribution-secondary">计划 {formatPublishTime(task.scheduled_at, zone)}</p>
        {history && <div className="publish-history-meta">
          <span>实际发布 {task.published_at ? formatPublishTime(task.published_at, task.timezone) : '待回填'}</span>
          <span>任务 v{task.version} · 最后操作 {formatPublishTime(task.updated_at, zone)}</span>
          {workUrl && <a href={workUrl} target="_blank" rel="noreferrer">打开作品链接</a>}
        </div>}
      </li>;
    })}
  </ul>;
}
