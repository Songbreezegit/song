import { useSearchParams } from 'react-router-dom';
import { useCollectionView } from '../../hooks/useCollectionView';
import type { CollectionViewItem } from '../../lib/collection';

export function useDistributionCollection<T extends CollectionViewItem & { stage: string; projectId: string | null }>(items: T[], stages: readonly string[]) {
  const [params, setParams] = useSearchParams();
  const stage = stages.includes(params.get('stage') || '') ? params.get('stage')! : '';
  const project = params.get('project') || '';
  const view = useCollectionView(items.filter(item => (!stage || item.stage === stage) && (!project || item.projectId === project)));
  const setFilter = (name: 'stage' | 'project', value: string) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (value) next.set(name, value); else next.delete(name);
    next.delete('page'); return next;
  }, { replace: true });
  const clearFilters = () => setParams({}, { replace: true });
  return { ...view, stage, project, setFilter, clearFilters, hasFilters: view.hasFilters || Boolean(stage || project) };
}
