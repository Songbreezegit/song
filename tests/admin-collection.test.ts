import { describe, expect, it } from 'vitest';
import { filterCollection, readCollectionFilters, type CollectionViewItem } from '../src/admin/lib/collection';

const records: CollectionViewItem[] = [
  { key: 'older', title: '项目 2', searchText: '项目 2 Android Compose', category: 'android', status: 'published', updatedAt: '2026-09-01T00:00:00Z', order: 3 },
  { key: 'newer', title: '项目 10', searchText: '项目 10 Android Kotlin', category: 'android', status: 'draft', updatedAt: '2026-09-02T00:00:00Z', order: 1 },
  { key: 'other', title: '网页作品', searchText: '网页作品 React Compose', category: 'web', status: 'published', updatedAt: '2026-09-03T00:00:00Z', order: 2 },
];

describe('admin content collection behavior', () => {
  it('combines every search term with publication and category filters', () => {
    const filters = readCollectionFilters(new URLSearchParams('q=+ANDROID++Compose+&status=published&category=android'));
    expect(filterCollection(records, filters).map(record => record.key)).toEqual(['older']);
    expect(filterCollection(records, { ...filters, query: 'not found' })).toEqual([]);
  });

  it('defaults invalid URL controls safely without discarding a valid search', () => {
    const filters = readCollectionFilters(new URLSearchParams('q=content&status=administrator&sort=unsupported&page=-2'));
    expect(filters).toMatchObject({ query: 'content', status: 'all', sort: 'updated-desc', page: 1 });
    for (const page of ['1.5', 'NaN', 'Infinity', '9007199254740992']) {
      expect(readCollectionFilters(new URLSearchParams({ page })).page).toBe(1);
    }
  });

  it('uses numerical names, explicit display order and recent changes without mutating fetched records', () => {
    const before = structuredClone(records);
    const filters = readCollectionFilters(new URLSearchParams());
    expect(filterCollection(records, filters).map(record => record.key)).toEqual(['other', 'newer', 'older']);
    expect(filterCollection(records, { ...filters, sort: 'title-asc', category: 'android' }).map(record => record.key)).toEqual(['older', 'newer']);
    expect(filterCollection(records, { ...filters, sort: 'order-asc' }).map(record => record.key)).toEqual(['newer', 'other', 'older']);
    expect(records).toEqual(before);
  });

  it('retains incomplete timestamp records and gives tied records a consistent order', () => {
    const incomplete = [
      { ...records[0]!, key: 'b', updatedAt: '' },
      { ...records[0]!, key: 'a', updatedAt: 'invalid-date' },
      records[2]!,
    ];
    expect(filterCollection(incomplete, readCollectionFilters(new URLSearchParams())).map(record => record.key)).toEqual(['other', 'a', 'b']);
  });
});
