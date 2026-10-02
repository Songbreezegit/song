import type { ProjectRecord } from '../../../types/database';
import { validateContentDraft } from '../../lib/content';

export type ProjectDraft = Omit<ProjectRecord, 'id' | 'created_at' | 'updated_at' | 'published_at'>;

export function createProjectDraft(): ProjectDraft {
  return { title: '', slug: '', subtitle: '', tagline: '', category: 'web', category_label: 'Web / React',
    year: new Date().getFullYear().toString(), featured: false, sort_order: 0, status: 'draft',
    description: '', overview: '', development_notes: '', tech_stack: [], features: [], challenges_solutions: [],
    github_url: '', live_url: '', cover_image: '', image_theme: { bgColor: '#0F172A', accentColor: '#38BDF8', type: 'browser' } };
}

export function projectToDraft(record: ProjectRecord): ProjectDraft {
  const { id: _id, created_at: _created, updated_at: _updated, published_at: _published, ...fields } = record;
  return { ...createProjectDraft(), ...fields, tech_stack: fields.tech_stack || [], features: fields.features || [],
    challenges_solutions: fields.challenges_solutions || [], image_theme: fields.image_theme || createProjectDraft().image_theme };
}

export function serializeProjectDraft(draft: ProjectDraft, status = draft.status): ProjectDraft {
  validateContentDraft(draft, '项目');
  return { ...draft, status, title: draft.title.trim(), slug: draft.slug.trim(), subtitle: draft.subtitle.trim(),
    tagline: draft.tagline.trim(), category_label: draft.category_label.trim(), year: draft.year.trim(),
    description: draft.description.trim(), overview: draft.overview.trim(), development_notes: draft.development_notes.trim(),
    github_url: draft.github_url.trim(), live_url: draft.live_url.trim(), cover_image: draft.cover_image.trim(),
    challenges_solutions: draft.challenges_solutions.filter(item => item.challenge.trim() || item.solution.trim()) };
}

export const projectCategories: { value: ProjectDraft['category']; label: string }[] = [
  { value: 'web', label: 'Web 全栈应用' }, { value: 'android', label: 'Android 原生' },
  { value: 'ai', label: 'AI 与智能实验' }, { value: 'tools', label: '工具与脚本' },
  { value: 'systems', label: '系统与服务端' }, { value: 'opensource', label: '开源代码' },
  { value: 'notes', label: '摄影与笔记' },
];
