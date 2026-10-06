import type { ContentStatus } from '../../types/database';
import { useAdminAction } from './useAdminAction';
import { useAdminQuery } from './useAdminQuery';
import { contentStatusLabels } from '../lib/collection';

interface CollectionConfig<T> {
  label: string;
  load: () => Promise<T[]>;
  remove: (id: string) => Promise<void>;
  updateStatus: (id: string, status: ContentStatus) => Promise<void>;
}

export function useContentCollection<T extends { id: string }>(config: CollectionConfig<T>) {
  const query = useAdminQuery<T[]>(config.load, [], `加载${config.label}列表失败`);
  const action = useAdminAction(`${config.label}操作失败`);

  const changeStatus = (id: string, status: ContentStatus) => action.run(id, () => config.updateStatus(id, status), {
    successMessage: `${config.label}状态已更新为：${contentStatusLabels[status]}`,
    onSuccess: () => query.reload(),
  });

  const remove = (id: string, title: string) => {
    if (!window.confirm(`确定要彻底删除${config.label}「${title}」吗？此操作不可撤销。`)) return;
    return action.run(id, () => config.remove(id), {
      successMessage: `${config.label}「${title}」已删除`,
      onSuccess: () => query.setData(records => records.filter(record => record.id !== id)),
    });
  };

  return { ...query, ...action, changeStatus, remove };
}
