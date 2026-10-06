import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ContentStatus } from '../../types/database';
import { useAdminQuery } from './useAdminQuery';
import { useAdminAction } from './useAdminAction';
import { getEditorReturnPath } from '../lib/editor';

export interface EditorConfig<Record extends { id: string }, Draft> {
  createDraft: () => Draft;
  load: (id: string) => Promise<Record | null>;
  toDraft: (record: Record) => Draft;
  serialize: (draft: Draft, status?: ContentStatus) => Draft;
  create: (draft: Draft) => Promise<Record>;
  update: (id: string, draft: Draft) => Promise<Record>;
  listPath: string;
  missingMessage?: string;
  loadError: string;
  saveError: string;
  createSuccess: string;
  updateSuccess: string;
}

export function useAdminEditor<Record extends { id: string }, Draft>(id: string | undefined, config: EditorConfig<Record, Draft>) {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = getEditorReturnPath(config.listPath, location.state);
  const isNew = !id || id === 'new';
  const [baseline, setBaseline] = useState<string | null>(null);
  const loadGeneration = useRef(0);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const load = useCallback(async () => {
    const request = ++loadGeneration.current;
    const record = isNew ? null : await config.load(id);
    if (!isNew && !record && config.missingMessage) throw new Error(config.missingMessage);
    const draft = record ? config.toDraft(record) : config.createDraft();
    if (request === loadGeneration.current) setBaseline(JSON.stringify(draft));
    return draft;
  }, [id, isNew, config]);
  const query = useAdminQuery(load, config.createDraft, config.loadError);
  const action = useAdminAction(config.saveError);
  const { setData } = query;
  const isDirty = !query.loading && baseline !== null && JSON.stringify(query.data) !== baseline;

  useEffect(() => () => { ++loadGeneration.current; }, []);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const setField = useCallback(<K extends keyof Draft>(field: K, value: SetStateAction<Draft[K]>) => {
    ++loadGeneration.current;
    setData(previous => ({ ...previous, [field]: typeof value === 'function'
      ? (value as (current: Draft[K]) => Draft[K])(previous[field]) : value }));
  }, [setData]);

  const save = (status?: ContentStatus) => {
    if (query.loading || query.error) return Promise.resolve(false);
    return action.run('save', async () => {
      const payload = config.serialize(query.data, status);
      return isNew ? config.create(payload) : config.update(id, payload);
    }, {
      successMessage: isNew ? config.createSuccess : config.updateSuccess,
      onSuccess: record => {
        const savedDraft = config.toDraft(record);
        setBaseline(JSON.stringify(savedDraft));
        ++loadGeneration.current;
        setLastSavedAt(Date.now());
        if (isNew) navigate(`${config.listPath}/${record.id}`, { replace: true, state: { returnTo } });
        else query.setData(savedDraft);
      },
    });
  };

  return { draft: query.data, setField, isNew, loading: query.loading, loadFailed: Boolean(query.error),
    loadError: query.error, reload: query.reload, saving: action.pendingKey === 'save',
    feedback: action.feedback, run: action.run, pendingKey: action.pendingKey, save, isDirty, lastSavedAt, returnTo };
}
