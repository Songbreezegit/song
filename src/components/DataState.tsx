export interface DataStateProps {
  loading: boolean;
  error: Error | null;
  empty: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
}

export function DataState({ loading, error, empty, emptyMessage = '暂无内容。', onRetry }: DataStateProps) {
  if (!loading && !error && !empty) return null;
  return <div className="data-state" role={error ? 'alert' : 'status'}>
    <p>{loading ? '正在加载…' : error ? '内容加载失败，请稍后重试。' : emptyMessage}</p>
    {!loading && error && onRetry && <button className="text-link" onClick={onRetry}>重试</button>}
  </div>;
}
