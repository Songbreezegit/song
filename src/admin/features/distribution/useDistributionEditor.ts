import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAdminQuery } from '../../hooks/useAdminQuery';
import { useAdminAction } from '../../hooks/useAdminAction';
import { getEditorReturnPath } from '../../lib/editor';

interface EditorConfig<Record, Draft> {
  create: () => Draft;
  load: (id: string) => Promise<Record | null>;
  toDraft: (record: Record) => Draft;
  save: (id: string, draft: Draft, version: number | null) => Promise<Record>;
  listPath: string;
}

export function useDistributionEditor<Record extends { id: string; version: number }, Draft>(id: string | undefined, config: EditorConfig<Record, Draft>) {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = getEditorReturnPath(config.listPath, location.state);
  const isNew = !id || id === 'new';
  // Retained for retries after an uncertain network response: never create a
  // second record merely because the first response was lost.
  const [recordId] = useState(() => isNew ? crypto.randomUUID() : id);
  const load = useCallback(async () => {
    const record = isNew ? null : await config.load(recordId);
    if (!isNew && !record) throw new Error('记录不存在或当前无权读取，请返回列表重新打开。');
    return { record, draft: record ? config.toDraft(record) : config.create() };
  }, [isNew, recordId, config]);
  const query = useAdminQuery(load, () => ({ record: null as Record | null, draft: config.create() }), '加载失败，请重试。');
  const [draftOverride, setDraftOverride] = useState<Draft | null>(null);
  const draft = draftOverride ?? query.data.draft;
  const baseline = JSON.stringify(query.data.draft);
  const isDirty = !query.loading && !query.error && JSON.stringify(draft) !== baseline;
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const action = useAdminAction('保存失败，请重试。');
  const dirty = useRef(isDirty);
  useEffect(() => { dirty.current = isDirty; }, [isDirty]);

  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ''; } };
    const leaveLink = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!dirty.current || !(link instanceof HTMLAnchorElement) || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href);
      if (url.pathname === location.pathname && url.search === location.search) return;
      if (!window.confirm('有未保存的修改，确定离开吗？')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', leaveLink, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', leaveLink, true); };
  }, [location.pathname, location.search]);

  const setField = <K extends keyof Draft>(key: K, value: SetStateAction<Draft[K]>) => {
    setDraftOverride(current => { const previous = current ?? query.data.draft; return { ...previous, [key]: typeof value === 'function' ? (value as (field: Draft[K]) => Draft[K])(previous[key]) : value }; });
  };
  const save = () => {
    if (query.loading || query.error) return Promise.resolve(false);
    return action.run('save', () => config.save(recordId, draft, query.data.record?.version ?? null), {
      successMessage: '已保存。', onSuccess: record => {
        dirty.current = false;
        setDraftOverride(null);
        query.setData({ record, draft: config.toDraft(record) });
        setLastSavedAt(Date.now());
        if (isNew) navigate(`${config.listPath}/${record.id}`, { replace: true, state: { returnTo } });
      },
    });
  };
  return { ...query, ...action, draft, setField, save, isNew, returnTo, isDirty, lastSavedAt, saving: Boolean(action.pendingKey) };
}
