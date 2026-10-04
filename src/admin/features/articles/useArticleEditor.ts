import { useState } from 'react';
import { getArticleById, createArticle, updateArticle } from '../../../services/articleService';
import type { ArticleRecord } from '../../../types/database';
import { useAdminEditor, type EditorConfig } from '../../hooks/useAdminEditor';
import { generateContentSlug } from '../../lib/content';
import { createArticleDraft, articleToDraft, serializeArticleDraft, type ArticleDraft } from './articleForm';

const config: EditorConfig<ArticleRecord, ArticleDraft> = {
  createDraft: createArticleDraft, load: getArticleById, toDraft: articleToDraft, serialize: serializeArticleDraft,
  create: createArticle, update: updateArticle, listPath: '/admin/articles', missingMessage: '未找到指定文章',
  loadError: '加载文章失败', saveError: '保存文章失败', createSuccess: '文章已成功创建！', updateSuccess: '文章保存更新成功！',
};

export function useArticleEditor(id?: string) {
  const editor = useAdminEditor(id, config);
  const { draft, setField } = editor;
  const [newTagInput, setNewTagInput] = useState('');
  const handleAddTag = () => {
    const tag = newTagInput.trim();
    if (tag) setField('tags', current => current.includes(tag) ? current : [...current, tag]);
    setNewTagInput('');
  };
  return { ...editor, handleSubmit: editor.save, handleAutoSlug: () => setField('slug', generateContentSlug(draft.title)),
    newTagInput, setNewTagInput, handleAddTag,
    handleRemoveTag: (index: number) => setField('tags', current => current.filter((_, i) => i !== index)),
  };
}
