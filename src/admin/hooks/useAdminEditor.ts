import { useCallback, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ContentStatus } from '../../types/database';
import { useAdminQuery } from './useAdminQuery';
import { useAdminAction } from './useAdminAction';

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
  const isNew = !id || id === 'new';
  const load = useCallback(async () => {
    if (isNew) return config.createDraft();
    const record = await config.load(id);
    if (!record && config.missingMessage) throw new Error(config.missingMessage);
    return record ? config.toDraft(record) : config.createDraft();
  }, [id, isNew, config]);
  const query = useAdminQuery(load, config.createDraft, config.loadError);
  const action = useAdminAction(config.saveError);
  const { setData } = query;

  const setField = useCallback(<K extends keyof Draft>(field: K, value: SetStateAction<Draft[K]>) => {
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
        if (isNew) navigate(`${config.listPath}/${record.id}`, { replace: true });
        else query.setData(config.toDraft(record));
      },
    });
  };

  return { draft: query.data, setField, isNew, loading: query.loading, loadFailed: Boolean(query.error),
    loadError: query.error, reload: query.reload, saving: action.pendingKey === 'save',
    feedback: action.feedback, run: action.run, pendingKey: action.pendingKey, save };
}
