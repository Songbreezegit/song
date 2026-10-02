import { useState, type ChangeEvent } from 'react';
import { getProjectById, createProject, updateProject } from '../../../services/projectService';
import { uploadMedia } from '../../../services/mediaService';
import { useAdminEditor, type EditorConfig } from '../../hooks/useAdminEditor';
import { generateContentSlug } from '../../lib/content';
import type { ProjectRecord } from '../../../types/database';
import { createProjectDraft, projectToDraft, serializeProjectDraft, type ProjectDraft } from './projectForm';

const config: EditorConfig<ProjectRecord, ProjectDraft> = {
  createDraft: createProjectDraft, load: getProjectById, toDraft: projectToDraft, serialize: serializeProjectDraft,
  create: createProject, update: updateProject, listPath: '/admin/projects', missingMessage: '未找到指定项目',
  loadError: '加载项目失败', saveError: '保存项目失败', createSuccess: '项目创建成功！', updateSuccess: '项目保存更新成功！',
};

export function useProjectEditor(id?: string) {
  const editor = useAdminEditor(id, config);
  const { draft, setField } = editor;
  const [newTechInput, setNewTechInput] = useState('');
  const [newFeatureInput, setNewFeatureInput] = useState('');

  const handleAddTech = () => {
    const tech = newTechInput.trim();
    if (tech) setField('tech_stack', current => current.includes(tech) ? current : [...current, tech]);
    setNewTechInput('');
  };
  const handleAddFeature = () => {
    const feature = newFeatureInput.trim();
    if (feature) setField('features', current => [...current, feature]);
    setNewFeatureInput('');
  };
  const handleCoverUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    await editor.run('cover', () => uploadMedia(file, 'projects'), {
      successMessage: '封面图片已上传，请保存项目以关联',
      onSuccess: ({ url }) => setField('cover_image', url),
    });
    input.value = '';
  };

  return { ...editor, uploadingCover: editor.pendingKey === 'cover',
    handleSubmit: editor.save, handleAutoSlug: () => setField('slug', generateContentSlug(draft.title)),
    newTechInput, setNewTechInput, newFeatureInput, setNewFeatureInput, handleAddTech, handleAddFeature, handleCoverUpload,
    handleRemoveTech: (index: number) => setField('tech_stack', current => current.filter((_, i) => i !== index)),
    handleRemoveFeature: (index: number) => setField('features', current => current.filter((_, i) => i !== index)),
    handleAddChallenge: () => setField('challenges_solutions', current => [...current, { challenge: '', solution: '' }]),
    handleRemoveChallenge: (index: number) => setField('challenges_solutions', current => current.filter((_, i) => i !== index)),
    handleChallengeChange: (index: number, field: 'challenge' | 'solution', value: string) => setField('challenges_solutions',
      current => current.map((item, i) => i === index ? { ...item, [field]: value } : item)),
  };
}
