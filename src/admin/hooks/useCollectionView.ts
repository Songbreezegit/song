import { useSearchParams } from 'react-router-dom';
import { filterCollection, readCollectionFilters, type CollectionFilters, type CollectionViewItem } from '../lib/collection';

export function useCollectionView<T extends CollectionViewItem>(items: T[], pageSize = 10) {
  const [params, setParams] = useSearchParams();
  const filters = readCollectionFilters(params);
  const filtered = filterCollection(items, filters);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(filters.page, pageCount);

  const updateFilter = <K extends keyof CollectionFilters>(key: K, value: CollectionFilters[K]) => {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      const parameter = key === 'query' ? 'q' : key;
      const isDefault = value === '' || (key === 'status' && value === 'all') ||
        (key === 'sort' && value === 'updated-desc') || (key === 'page' && value === 1);
      if (isDefault) next.delete(parameter);
      else next.set(parameter, String(value));
      if (key !== 'page') next.delete('page');
      return next;
    }, { replace: true });
  };

  const clearFilters = () => setParams(previous => {
    const next = new URLSearchParams(previous);
    for (const key of ['q', 'status', 'category', 'sort', 'page']) next.delete(key);
    return next;
  }, { replace: true });

  return {
    filters, updateFilter, clearFilters, filtered,
    visible: filtered.slice((page - 1) * pageSize, page * pageSize),
    page, pageSize, pageCount, total: filtered.length,
    hasFilters: Boolean(filters.query || filters.status !== 'all' || filters.category || filters.sort !== 'updated-desc'),
    search: params.toString() ? `?${params.toString()}` : '',
  };
}
