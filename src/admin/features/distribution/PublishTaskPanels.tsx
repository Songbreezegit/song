import { useCallback, useState } from 'react';
import { Copy, Download, ExternalLink } from 'lucide-react';
import { formatPublishTime } from '../../../lib/distributionPublishTime';
import { safeExternalUrl } from '../../../lib/safeUrl';
import { getPublishEvent, listPublishEvents } from '../../../services/distributionPublishService';
import { publicMediaUrl } from '../../../services/mediaService';
import type { DistributionVariantRecord } from '../../../types/distribution';
import type { PublishEventSummary, PublishTask } from '../../../types/distributionPublish';
import { AdminFeedback } from '../../components/AdminFeedback';
import { AdminLoading } from '../../components/AdminLoading';
import { AdminQueryError } from '../../components/AdminQueryError';
import { useAdminAction } from '../../hooks/useAdminAction';
import { useAdminQuery } from '../../hooks/useAdminQuery';
import { contentTypeLabels } from './distributionForm';
import { getDistributionPlatform } from './platforms/registry';
import { downloadPublishExport } from './publishExport';
import { publishEventLabels, publishSnapshotDiff, publishStatusLabels } from './publishModel';
import { formatVariantCopy, type VariantCopyPart } from './variantExport';

export function PublishSnapshotPanel({ task }: { task: PublishTask }) {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const snapshot = task.content_snapshot;
  const profileUrl = safeExternalUrl(snapshot.profile_url);
  const platformUrl = profileUrl ?? safeExternalUrl(getDistributionPlatform(snapshot.platform).sources[0]?.url);
  const copy = async (part: VariantCopyPart) => {
    try {
      await navigator.clipboard.writeText(formatVariantCopy(snapshot, part));
      setFeedback({ type: 'success', message: '已复制任务所用稿件 v' + task.variant_version + ' 的文案。' });
    } catch {
      setFeedback({ type: 'error', message: '剪贴板不可用。可以选择正文中的文字或导出发布资料。' });
    }
  };
  return <section className="admin-card publish-card" aria-labelledby="publish-snapshot-heading">
    <div className="publish-calendar-toolbar"><h2 className="admin-card-title" id="publish-snapshot-heading">任务内容快照</h2>
      <span className="distribution-platform">稿件 v{task.variant_version}</span></div>
    <h3 className="publish-snapshot-title">{snapshot.title}</h3>
    <p className="distribution-secondary">{contentTypeLabels[snapshot.content_type]} · 保存于 {formatPublishTime(snapshot.captured_at, task.timezone)}</p>
    <div className="publish-inline publish-copy-actions">
      <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => void copy('title')}><Copy size={14} />复制标题</button>
      <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => void copy('body')}><Copy size={14} />复制正文</button>
      <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => void copy('tags')}><Copy size={14} />复制标签</button>
      <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => downloadPublishExport(task)}><Download size={14} />导出发布资料</button>
      {platformUrl && <a className="admin-btn admin-btn-secondary admin-btn-sm" href={platformUrl} target="_blank" rel="noreferrer">
        <ExternalLink size={14} />{profileUrl ? '打开平台账号主页' : '打开平台官网'}</a>}
    </div>
    {platformUrl && <p className="distribution-secondary">平台页面将在新窗口打开。完成发布后，请在任务中人工回填结果。</p>}
    <AdminFeedback feedback={feedback} />
    {snapshot.body && <p className="publish-preview-text">{snapshot.body}</p>}
    {!!snapshot.tags.length && <div className="distribution-tags">
      {snapshot.tags.map(tag => <span key={tag} className="admin-tag-pill">#{tag}</span>)}
    </div>}
    <details className="publish-details">
      <summary>查看素材（{snapshot.media.length}）</summary>
      <ol className="publish-snapshot-media">
        {snapshot.media.map(asset => {
          const url = safeExternalUrl(publicMediaUrl(asset.original_storage_path));
          const filename = asset.original_storage_path.split('/').at(-1) ?? asset.original_storage_path;
          return <li key={asset.media_id}>
            {asset.mime_type.startsWith('image/') && url && <img src={url} alt={filename} loading="lazy" />}
            <div>
              {url ? <a href={url} target="_blank" rel="noreferrer">{filename}</a> : <strong>{filename}</strong>}
              <p className="distribution-secondary">{[asset.is_cover ? '封面' : '', asset.aspect_ratio_hint, asset.processing_notes].filter(Boolean).join(' · ')}</p>
            </div>
          </li>;
        })}
      </ol>
    </details>
  </section>;
}

export function PublishSnapshotReview({ task, latest, accountName }: { task: PublishTask; latest: DistributionVariantRecord; accountName?: string }) {
  const differences = publishSnapshotDiff(task.content_snapshot, latest);
  if (accountName && accountName !== task.account_name) differences.push({ label: '账号展示名称', previous: task.account_name, latest: accountName });
  return <details className="publish-details">
    <summary>查看平台稿版本差异</summary>
    {!differences.length && <p className="distribution-secondary">两版可发布内容一致，平台稿的修订版本已更新。</p>}
    {differences.map(change => <div className="publish-diff" key={change.label}>
      <h3>{change.label}</h3>
      <div className="publish-diff-columns">
        <div><strong>任务 v{task.variant_version}</strong><p>{change.previous || '空'}</p></div>
        <div><strong>最新 v{latest.version}</strong><p>{change.latest || '空'}</p></div>
      </div>
    </div>)}
  </details>;
}

export function PublishTimeline({ task }: { task: PublishTask }) {
  const id = task.id;
  const load = useCallback(() => listPublishEvents(id), [id]);
  const query = useAdminQuery(load, { rows: [], hasMore: false }, '发布历史加载失败。');
  const more = useAdminAction();
  const loadMore = () => {
    const cursor = query.data.rows.at(-1)?.task_version;
    if (cursor) void more.run('events', () => listPublishEvents(id, cursor), {
      onSuccess: page => query.setData(previous => ({ rows: [...previous.rows, ...page.rows], hasMore: page.hasMore })),
    });
  };
  return <section className="admin-card publish-card" aria-labelledby="publish-timeline-heading">
    <h2 className="admin-card-title" id="publish-timeline-heading">操作时间线</h2>
    {query.loading ? <AdminLoading /> : query.error ? <AdminQueryError error={query.error} onRetry={query.reload} /> :
      <ol className="publish-timeline">{query.data.rows.map(event => <li key={event.id}>
        <strong>{publishEventLabels[event.event_type]}</strong>
        <p>{event.previous_status && publishStatusLabels[event.previous_status] + ' → '}{publishStatusLabels[event.next_status]}
          {' · 任务 v' + event.task_version + ' · 稿件 v' + event.next_variant}</p>
        {event.metadata.reason && <p>理由 {event.metadata.reason}</p>}
        {event.metadata.evidence === 'manual_user_report' && <p>证据为人工报告</p>}
        <p className="distribution-secondary">{formatPublishTime(event.created_at, task.timezone)} · 操作人 {event.actor_id}</p>
        <PublishRawEvent event={event} />
      </li>)}</ol>}
    {query.data.hasMore && <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={loadMore}
      disabled={Boolean(more.pendingKey)}>加载较早事件</button>}
    <AdminFeedback feedback={more.feedback} />
  </section>;
}

function PublishRawEvent({ event }: { event: PublishEventSummary }) {
  const [open, setOpen] = useState(false);
  return <details className="publish-details" onToggle={change => setOpen(change.currentTarget.open)}>
    <summary>查看原始事件</summary>
    {open && <PublishRawEventData taskId={event.task_id} id={event.id} />}
  </details>;
}

function PublishRawEventData({ taskId, id }: { taskId: string; id: string }) {
  const load = useCallback(() => getPublishEvent(taskId, id), [taskId, id]);
  const query = useAdminQuery<Awaited<ReturnType<typeof load>> | null>(load, null, '原始事件加载失败。');
  if (query.loading) return <AdminLoading />;
  if (query.error) return <AdminQueryError error={query.error} onRetry={query.reload} />;
  return <pre className="publish-event-json">{JSON.stringify(query.data, null, 2)}</pre>;
}
