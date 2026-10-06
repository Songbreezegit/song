import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import type { CollectionSort } from '../lib/collection';

interface CollectionToolbarProps {
  label: string;
  query: string;
  onQuery: (value: string) => void;
  category: string;
  categories: { value: string; label: string }[];
  onCategory: (value: string) => void;
  categoryLabel?: string;
  sort: CollectionSort;
  onSort: (value: CollectionSort) => void;
  includeOrder?: boolean;
  hasFilters: boolean;
  onClear: () => void;
}

export function CollectionToolbar({ label, query, onQuery, category, categories, onCategory,
  categoryLabel = '分类', sort, onSort, includeOrder = true, hasFilters, onClear }: CollectionToolbarProps) {
  return <div className="admin-collection-toolbar">
    <label className="admin-search-field">
      <Search size={17} aria-hidden="true" />
      <input className="admin-input" type="search" value={query} onChange={event => onQuery(event.target.value)}
        placeholder={`搜索${label}…`} aria-label={`搜索${label}`} />
    </label>
    <div className="admin-collection-filters">
      <label className="admin-filter-field">
        <span>{categoryLabel}</span>
        <select className="admin-select" aria-label={`${label}${categoryLabel}`} value={category} onChange={event => onCategory(event.target.value)}>
          <option value="">全部{categoryLabel}</option>
          {category && !categories.some(option => option.value === category) && <option value={category}>{category}</option>}
          {categories.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="admin-filter-field">
        <span>排序</span>
        <select className="admin-select" aria-label={`${label}排序`} value={sort} onChange={event => onSort(event.target.value as CollectionSort)}>
          <option value="updated-desc">最近更新</option>
          <option value="updated-asc">最早更新</option>
          <option value="title-asc">名称顺序</option>
          {includeOrder && <option value="order-asc">展示顺序</option>}
        </select>
      </label>
      {hasFilters && <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={onClear}>
        <X size={14} aria-hidden="true" />清除筛选
      </button>}
    </div>
  </div>;
}

export function CollectionPagination({ total, page, pageCount, pageSize, onPage }: {
  total: number; page: number; pageCount: number; pageSize: number; onPage: (page: number) => void;
}) {
  const start = total ? (page - 1) * pageSize + 1 : 0;
  return <div className="admin-collection-pagination">
    <span>显示 {start}–{Math.min(page * pageSize, total)} 条，共 {total} 条</span>
    <nav aria-label="列表分页" className="admin-pagination-actions">
      <button className="admin-btn admin-btn-secondary admin-btn-sm" aria-label="上一页"
        disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={15} /></button>
      <span>{page} / {pageCount}</span>
      <button className="admin-btn admin-btn-secondary admin-btn-sm" aria-label="下一页"
        disabled={page >= pageCount} onClick={() => onPage(page + 1)}><ChevronRight size={15} /></button>
    </nav>
  </div>;
}
