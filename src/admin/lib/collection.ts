import type { ContentStatus } from '../../types/database';

export const contentStatusLabels: Record<ContentStatus, string> = {
  draft: '草稿', published: '已发布', archived: '已归档',
};

export type CollectionSort = 'updated-desc' | 'updated-asc' | 'title-asc' | 'order-asc';

export interface CollectionViewItem {
  key: string;
  title: string;
  searchText: string;
  category: string;
  updatedAt: string;
  order?: number;
  status?: ContentStatus;
}

export interface CollectionFilters {
  query: string;
  status: ContentStatus | 'all';
  category: string;
  sort: CollectionSort;
  page: number;
}

export function readCollectionFilters(params: URLSearchParams): CollectionFilters {
  const status = params.get('status');
  const sort = params.get('sort');
  const page = Number(params.get('page') || 1);
  return {
    query: params.get('q') || '',
    status: status === 'draft' || status === 'published' || status === 'archived' ? status : 'all',
    category: params.get('category') || '',
    sort: sort === 'updated-asc' || sort === 'title-asc' || sort === 'order-asc' ? sort : 'updated-desc',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

function timestamp(value: string): number {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export function filterCollection<T extends CollectionViewItem>(items: T[], filters: CollectionFilters): T[] {
  const terms = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item =>
    (filters.status === 'all' || item.status === filters.status) &&
    (!filters.category || item.category === filters.category) &&
    terms.every(term => item.searchText.toLocaleLowerCase().includes(term)),
  ).sort((left, right) => {
    let difference = 0;
    if (filters.sort === 'title-asc') difference = left.title.localeCompare(right.title, 'zh-CN', { numeric: true });
    if (filters.sort === 'order-asc') difference = (left.order || 0) - (right.order || 0);
    if (filters.sort === 'updated-asc') difference = timestamp(left.updatedAt) - timestamp(right.updatedAt);
    if (filters.sort === 'updated-desc') difference = timestamp(right.updatedAt) - timestamp(left.updatedAt);
    return difference || left.key.localeCompare(right.key);
  });
}

export function formatCollectionDate(value: string): string {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toLocaleDateString('zh-CN') : '未记录';
}
