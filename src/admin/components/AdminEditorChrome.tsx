import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, LoaderCircle } from 'lucide-react';

interface EditorSaveState {
  isDirty: boolean;
  saving: boolean;
  lastSavedAt: number | null;
}

export function AdminEditorSaveState({ isDirty, saving, lastSavedAt }: EditorSaveState) {
  const time = lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : null;
  return <p className="admin-editor-save-state" data-dirty={isDirty} aria-live="polite">
    {saving ? <LoaderCircle size={14} className="admin-spin" /> : isDirty ? <Circle size={12} /> : <CheckCircle2 size={14} />}
    <span>{saving ? '正在保存…' : isDirty ? '有未保存的修改' : time ? `已保存于 ${time}` : '修改后记得保存'}</span>
  </p>;
}

export function AdminEditorHeader({ title, description, backTo, actions, ...saveState }: EditorSaveState & {
  title: string;
  description: string;
  backTo?: string;
  actions: ReactNode;
}) {
  return <header className="admin-editor-header">
    <div className="admin-editor-heading">
      {backTo && <Link to={backTo} className="admin-btn admin-btn-secondary admin-btn-sm"><ArrowLeft size={15} /><span>返回列表</span></Link>}
      <div><h1>{title}</h1><p>{description}</p></div>
    </div>
    <div className="admin-editor-toolbar"><AdminEditorSaveState {...saveState} />{actions}</div>
  </header>;
}

export function AdminEditorNavigation({ sections }: { sections: { id: string; label: string }[] }) {
  const jumpTo = (id: string) => {
    const section = document.getElementById(id);
    section?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    const firstField = section?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input:not([type="hidden"]), textarea, select');
    firstField?.focus({ preventScroll: true });
  };
  return <nav className="admin-editor-nav" aria-label="编辑内容分区">
    {sections.map((section, index) => <button type="button" key={section.id} onClick={() => jumpTo(section.id)}><span>{String(index + 1).padStart(2, '0')}</span>{section.label}</button>)}
  </nav>;
}
