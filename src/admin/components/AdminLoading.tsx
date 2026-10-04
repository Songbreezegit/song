export function AdminLoading({ message = '正在加载管理模块...', screen = false }: { message?: string; screen?: boolean }) {
  return (
    <div className={screen ? 'admin-loading-screen' : 'admin-loading-content'} role="status" aria-live="polite">
      <div className="admin-spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
