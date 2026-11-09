import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { useBlocker, useLocation, useNavigate, type BlockerFunction } from 'react-router-dom';
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
  const saving = action.pendingKey === 'save';
  const shouldProtect = isDirty || saving;
  const shouldBlock = useCallback<BlockerFunction>(({ currentLocation, nextLocation }) => (
    shouldProtect && currentLocation.pathname !== nextLocation.pathname
  ), [shouldProtect]);
  const blocker = useBlocker(shouldBlock);
  const departureApproved = useRef(false);

  useEffect(() => {
    if (!shouldProtect) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [shouldProtect]);

  // Wait for the clean draft and for the user's navigation decision before
  // replacing a new editor's URL with the persisted record URL.
  const savedId = query.data.record?.id;
  useEffect(() => {
    if (!isNew || !savedId || shouldProtect || blocker.state !== 'unblocked' || departureApproved.current) return;
    void navigate(`${config.listPath}/${savedId}`, { replace: true, state: { returnTo } });
  }, [isNew, savedId, shouldProtect, blocker.state, navigate, config.listPath, returnTo]);

  const blockedNavigation = blocker.state === 'blocked' ? {
    stay: blocker.reset,
    leave: () => {
      departureApproved.current = true;
      blocker.proceed();
    },
  } : null;

  const setField = <K extends keyof Draft>(key: K, value: SetStateAction<Draft[K]>) => {
    setDraftOverride(current => { const previous = current ?? query.data.draft; return { ...previous, [key]: typeof value === 'function' ? (value as (field: Draft[K]) => Draft[K])(previous[key]) : value }; });
  };
  const save = () => {
    if (query.loading || query.error) return Promise.resolve(false);
    return action.run('save', () => config.save(recordId, draft, query.data.record?.version ?? null), {
      successMessage: '已保存。', onSuccess: record => {
        setDraftOverride(null);
        query.setData({ record, draft: config.toDraft(record) });
        setLastSavedAt(Date.now());
      },
    });
  };
  return { ...query, ...action, draft, setField, save, isNew, returnTo, isDirty, lastSavedAt, saving, blockedNavigation };
}
