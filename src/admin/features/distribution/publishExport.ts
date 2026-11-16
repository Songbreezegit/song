import type { MediaItem } from '../../../services/mediaService';
import type { PublishTask } from '../../../types/distributionPublish';
import { createVariantExport } from './variantExport';

export function createPublishExport(task: PublishTask, at = new Date()) {
  const snapshot = task.content_snapshot;
  const assets: MediaItem[] = snapshot.media.map(asset => ({
    id: asset.media_id, path: asset.original_storage_path, name: asset.original_storage_path.split('/').at(-1) ?? '',
    mime_type: asset.mime_type, created_at: snapshot.captured_at, url: '',
  }));
  return {
    ...createVariantExport({
      ...snapshot, id: snapshot.variant_id, version: snapshot.variant_version, status: 'ready',
    }, { id: snapshot.account_id, name: snapshot.account_name }, assets, at),
    publish_task_id: task.id, scheduled_at: task.scheduled_at, timezone: task.timezone, snapshot_captured_at: snapshot.captured_at,
  };
}

export function downloadPublishExport(task: PublishTask) {
  const blob = new Blob([JSON.stringify(createPublishExport(task), null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'distribution-task-' + task.id + '-v' + task.variant_version + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
