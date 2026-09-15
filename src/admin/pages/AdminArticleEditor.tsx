import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Code2,
  Quote as QuoteIcon,
  HelpCircle,
} from 'lucide-react';
import {
  getArticleById,
  createArticle,
  updateArticle,
  checkArticleSlugAvailable,
} from '../../services/articleService';
import type { ArticleRecord, ContentStatus } from '../../types/database';
import type { Article } from '../../data/portfolioData';

type SectionItem = Article['content']['sections'][number];

const categorySlugs: { value: Article['categorySlug']; label: string }[] = [
  { value: 'notes', label: '思考与随笔 (notes)' },
  { value: 'development', label: '工程与开发 (development)' },
  { value: 'tools', label: '工具与配置 (tools)' },
  { value: 'ai', label: 'AI 与实验 (ai)' },
  { value: 'tutorial', label: '教程指南 (tutorial)' },
];

export function AdminArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form Basic Info
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState('思考');
  const [categorySlug, setCategorySlug] = useState<Article['categorySlug']>('notes');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  });
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [readTime, setReadTime] = useState('3 min');
  const [excerpt, setExcerpt] = useState('');
  const [status, setStatus] = useState<ContentStatus>('draft');

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');

  // Structured Content
  const [lead, setLead] = useState('');
  const [sections, setSections] = useState<SectionItem[]>([]);

  // Load existing article if editing
  useEffect(() => {
    if (isNew) return;

    async function loadData() {
      try {
        setLoading(true);
        const data = await getArticleById(id!);
        if (!data) {
          setFeedback({ type: 'error', message: '未找到指定文章' });
          return;
        }

        setTitle(data.title);
        setSlug(data.slug);
        setSubtitle(data.subtitle);
        setCategory(data.category);
        setCategorySlug(data.category_slug);
        setDate(data.date);
        setYear(data.year);
        setReadTime(data.read_time);
        setExcerpt(data.excerpt);
        setStatus(data.status);
        setTags(data.tags || []);
        setLead(data.content?.lead || '');
        setSections(data.content?.sections || []);
      } catch (err) {
        setFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : '加载文章失败',
        });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id, isNew]);

  // Slug auto-generation
  const handleAutoSlug = () => {
    if (!title) return;
    const generated = title
      .toLowerCase()
      .trim()
      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(generated);
  };

  // Tags
  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    if (!tags.includes(newTagInput.trim())) {
      setTags([...tags, newTagInput.trim()]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  // Section Operations
  const handleAddSection = () => {
    setSections([
      ...sections,
      {
        heading: '',
        body: [''],
      },
    ]);
  };

  const handleRemoveSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sections.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...sections];
    const temp = updated[index];
    updated[index] = updated[targetIndex]!;
    updated[targetIndex] = temp!;
    setSections(updated);
  };

  const handleSectionFieldChange = <K extends keyof SectionItem>(
    index: number,
    field: K,
    value: SectionItem[K]
  ) => {
    const updated = [...sections];
    updated[index] = { ...updated[index]!, [field]: value };
    setSections(updated);
  };

  const handleBodyChange = (index: number, text: string) => {
    const paragraphs = text.split('\n\n').map((p) => p.trim()).filter(Boolean);
    handleSectionFieldChange(index, 'body', paragraphs.length ? paragraphs : [text]);
  };

  // Code Block toggle/update
  const handleToggleCode = (index: number) => {
    const s = sections[index];
    if (!s) return;
    if (s.code) {
      handleSectionFieldChange(index, 'code', undefined);
    } else {
      handleSectionFieldChange(index, 'code', {
        language: 'typescript',
        filename: '',
        snippet: '',
      });
    }
  };

  // Callout toggle/update
  const handleToggleCallout = (index: number) => {
    const s = sections[index];
    if (!s) return;
    if (s.callout) {
      handleSectionFieldChange(index, 'callout', undefined);
    } else {
      handleSectionFieldChange(index, 'callout', {
        type: 'note',
        text: '',
      });
    }
  };

  // Quote toggle/update
  const handleToggleQuote = (index: number) => {
    const s = sections[index];
    if (!s) return;
    if (s.quote !== undefined) {
      handleSectionFieldChange(index, 'quote', undefined);
    } else {
      handleSectionFieldChange(index, 'quote', '');
    }
  };

  // Submit Handler
  const handleSubmit = async (targetStatus?: ContentStatus) => {
    const finalStatus = targetStatus || status;

    if (!title.trim()) {
      setFeedback({ type: 'error', message: '请输入文章标题' });
      return;
    }

    if (!slug.trim()) {
      setFeedback({ type: 'error', message: '请输入文章 Slug' });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);

      // Check slug uniqueness
      const isSlugAvailable = await checkArticleSlugAvailable(slug.trim(), isNew ? undefined : id);
      if (!isSlugAvailable) {
        setFeedback({ type: 'error', message: `Slug "${slug.trim()}" 已存在，请更换！` });
        setSaving(false);
        return;
      }

      const payload: Omit<ArticleRecord, 'id' | 'created_at' | 'updated_at'> = {
        title: title.trim(),
        slug: slug.trim(),
        subtitle: subtitle.trim(),
        category: category.trim(),
        category_slug: categorySlug,
        date: date.trim(),
        year: year.trim(),
        read_time: readTime.trim(),
        excerpt: excerpt.trim(),
        status: finalStatus,
        tags,
        content: {
          lead: lead.trim(),
          sections,
        },
        sort_order: 0,
        published_at: finalStatus === 'published' ? new Date().toISOString() : null,
      };

      if (isNew) {
        const created = await createArticle(payload);
        setFeedback({ type: 'success', message: '文章已成功创建！' });
        setTimeout(() => {
          navigate(`/admin/articles/${created.id}`);
        }, 1000);
      } else {
        await updateArticle(id!, payload);
        setStatus(finalStatus);
        setFeedback({ type: 'success', message: '文章保存更新成功！' });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : '保存文章失败',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
        <div className="admin-spinner" style={{ margin: '0 auto 16px' }} />
        正在加载文章数据...
      </div>
    );
  }

  return (
    <div>
      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/admin/articles" className="admin-btn admin-btn-secondary admin-btn-sm">
            <ArrowLeft size={15} />
            <span>返回列表</span>
          </Link>
          <span style={{ fontSize: '14px', color: 'var(--admin-text-secondary)' }}>
            {isNew ? '新建文章' : `编辑：${title || '未命名文章'}`}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => handleSubmit('draft')}
            disabled={saving}
          >
            <Save size={15} />
            <span>存为草稿</span>
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => handleSubmit('published')}
            disabled={saving}
          >
            {saving ? (
              <div className="admin-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
            ) : (
              <CheckCircle size={15} />
            )}
            <span>保存并发布</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`admin-alert ${
            feedback.type === 'success' ? 'admin-alert-success' : 'admin-alert-error'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <div>{feedback.message}</div>
        </div>
      )}

      <form onSubmit={(e: FormEvent) => { e.preventDefault(); handleSubmit(); }}>
        {/* 1. Basic Information */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">基本信息 (Basic Information)</h3>
          </div>

          <div className="admin-grid-2">
            <div className="admin-form-group">
              <label className="admin-label" htmlFor="article-title">文章标题 *</label>
              <input
                id="article-title"
                type="text"
                className="admin-input"
                placeholder="例如：做产品之前先想清楚问题"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="article-slug">URL Slug *</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="article-slug"
                  type="text"
                  className="admin-input"
                  placeholder="例如：think-before-code"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                  onClick={handleAutoSlug}
                  title="根据标题生成"
                >
                  自动生成
                </button>
              </div>
            </div>
          </div>

          <div className="admin-form-group">
            <label className="admin-label" htmlFor="article-subtitle">副标题</label>
            <input
              id="article-subtitle"
              type="text"
              className="admin-input"
              placeholder="探讨真实需求与代码实现的边界，拒绝伪需求陷阱"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
            />
          </div>

          <div className="admin-grid-4">
            <div className="admin-form-group">
              <label className="admin-label" htmlFor="article-category">分类显示名称</label>
              <input
                id="article-category"
                type="text"
                className="admin-input"
                placeholder="例如：思考 / 前端 / 安全"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="article-cat-slug">分类分组标识</label>
              <select
                id="article-cat-slug"
                className="admin-select"
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value as Article['categorySlug'])}
              >
                {categorySlugs.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="article-date">发布日期</label>
              <input
                id="article-date"
                type="text"
                className="admin-input"
                placeholder="2026.09.02"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="article-status">发布状态</label>
              <select
                id="article-status"
                className="admin-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as ContentStatus)}
              >
                <option value="draft">草稿 (Draft)</option>
                <option value="published">已发布 (Published)</option>
                <option value="archived">已归档 (Archived)</option>
              </select>
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="admin-form-group">
              <label className="admin-label" htmlFor="article-read-time">预计阅读时间</label>
              <input
                id="article-read-time"
                type="text"
                className="admin-input"
                placeholder="3 min"
                value={readTime}
                onChange={(e) => setReadTime(e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="article-year">归档年份</label>
              <input
                id="article-year"
                type="text"
                className="admin-input"
                placeholder="2026"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
          </div>

          {/* Tags */}
          <div className="admin-form-group" style={{ marginBottom: 0 }}>
            <label className="admin-label">标签 (Tags)</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input
                type="text"
                className="admin-input"
                placeholder="输入标签名..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <button
                type="button"
                className="admin-btn admin-btn-secondary admin-btn-sm"
                onClick={handleAddTag}
              >
                <Plus size={14} />
                <span>添加标签</span>
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {tags.map((tag, idx) => (
                <span key={idx} className="admin-tag-pill">
                  #{tag}
                  <button
                    type="button"
                    className="admin-tag-remove"
                    onClick={() => handleRemoveTag(idx)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Lead & Excerpt */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">摘要与导语 (Excerpt & Lead)</h3>
          </div>

          <div className="admin-form-group">
            <label className="admin-label" htmlFor="article-excerpt">卡片摘要 (Excerpt)</label>
            <textarea
              id="article-excerpt"
              className="admin-textarea"
              placeholder="在文章卡片列表展示的一两句摘要..."
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
            />
          </div>

          <div className="admin-form-group" style={{ marginBottom: 0 }}>
            <label className="admin-label" htmlFor="article-lead">全文导语 (Lead Paragraph)</label>
            <textarea
              id="article-lead"
              className="admin-textarea"
              placeholder="文章正文开头的重点引导段落（以加大字体呈现）..."
              value={lead}
              onChange={(e) => setLead(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* 3. Sections Editor */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">正文小节与区块 (Sections)</h3>
            <button
              type="button"
              className="admin-btn admin-btn-secondary admin-btn-sm"
              onClick={handleAddSection}
            >
              <Plus size={14} />
              <span>添加小节 (Section)</span>
            </button>
          </div>

          {sections.length === 0 ? (
            <p style={{ color: 'var(--admin-text-muted)', fontSize: '13px', margin: 0 }}>
              暂无小节内容。点击右上角“添加小节”开始编写正文。
            </p>
          ) : (
            sections.map((section, idx) => (
              <div key={idx} className="admin-section-block">
                <div className="admin-section-header">
                  <span className="admin-section-title">小节 #{idx + 1}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary admin-btn-sm"
                      onClick={() => handleMoveSection(idx, 'up')}
                      disabled={idx === 0}
                      title="上移"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary admin-btn-sm"
                      onClick={() => handleMoveSection(idx, 'down')}
                      disabled={idx === sections.length - 1}
                      title="下移"
                    >
                      <ChevronDown size={13} />
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-danger admin-btn-sm"
                      onClick={() => handleRemoveSection(idx)}
                      title="删除该小节"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Heading */}
                <div className="admin-form-group">
                  <label className="admin-label">小节标题 (Heading, 可选)</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="例如：一、什么是真实的问题？"
                    value={section.heading || ''}
                    onChange={(e) => handleSectionFieldChange(idx, 'heading', e.target.value)}
                  />
                </div>

                {/* Body Paragraphs */}
                <div className="admin-form-group">
                  <label className="admin-label">段落正文 (Body Paragraphs, 空行分隔)</label>
                  <textarea
                    className="admin-textarea"
                    placeholder="输入段落文字。双次回车（空行）会自动拆分为独立的段落..."
                    value={section.body?.join('\n\n') || ''}
                    onChange={(e) => handleBodyChange(idx, e.target.value)}
                    rows={4}
                  />
                </div>

                {/* Sub-blocks Toolbar */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button
                    type="button"
                    className={`admin-btn admin-btn-sm ${section.code ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                    onClick={() => handleToggleCode(idx)}
                  >
                    <Code2 size={13} />
                    <span>{section.code ? '移除代码块' : '插入代码块'}</span>
                  </button>
                  <button
                    type="button"
                    className={`admin-btn admin-btn-sm ${section.quote !== undefined ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                    onClick={() => handleToggleQuote(idx)}
                  >
                    <QuoteIcon size={13} />
                    <span>{section.quote !== undefined ? '移除引述' : '插入引述 (Quote)'}</span>
                  </button>
                  <button
                    type="button"
                    className={`admin-btn admin-btn-sm ${section.callout ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                    onClick={() => handleToggleCallout(idx)}
                  >
                    <HelpCircle size={13} />
                    <span>{section.callout ? '移除提示框' : '插入提示 (Callout)'}</span>
                  </button>
                </div>

                {/* Code Block Editor */}
                {section.code && (
                  <div style={{ background: '#FFFFFF', padding: '12px', border: '1px solid var(--admin-border)', borderRadius: '6px', marginBottom: '12px' }}>
                    <div className="admin-grid-2">
                      <div className="admin-form-group">
                        <label className="admin-label">语言 (Language)</label>
                        <input
                          type="text"
                          className="admin-input"
                          placeholder="typescript / css / bash"
                          value={section.code.language}
                          onChange={(e) =>
                            handleSectionFieldChange(idx, 'code', {
                              ...section.code!,
                              language: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="admin-form-group">
                        <label className="admin-label">文件名 (Filename, 可选)</label>
                        <input
                          type="text"
                          className="admin-input"
                          placeholder="motion.css"
                          value={section.code.filename || ''}
                          onChange={(e) =>
                            handleSectionFieldChange(idx, 'code', {
                              ...section.code!,
                              filename: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                      <label className="admin-label">代码内容 (Snippet)</label>
                      <textarea
                        className="admin-textarea"
                        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}
                        rows={4}
                        value={section.code.snippet}
                        onChange={(e) =>
                          handleSectionFieldChange(idx, 'code', {
                            ...section.code!,
                            snippet: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Quote Editor */}
                {section.quote !== undefined && (
                  <div className="admin-form-group" style={{ marginBottom: '12px' }}>
                    <label className="admin-label">引用名言 / 金句 (Quote)</label>
                    <input
                      type="text"
                      className="admin-input"
                      placeholder="“先找到钉子，再去挑选最适合的锤子；而不是举着锤子满世界找钉子。”"
                      value={section.quote}
                      onChange={(e) => handleSectionFieldChange(idx, 'quote', e.target.value)}
                    />
                  </div>
                )}

                {/* Callout Editor */}
                {section.callout && (
                  <div style={{ background: '#FFFFFF', padding: '12px', border: '1px solid var(--admin-border)', borderRadius: '6px' }}>
                    <div className="admin-form-group">
                      <label className="admin-label">提示类型</label>
                      <select
                        className="admin-select"
                        value={section.callout.type}
                        onChange={(e) =>
                          handleSectionFieldChange(idx, 'callout', {
                            ...section.callout!,
                            type: e.target.value as 'note' | 'tip' | 'warning',
                          })
                        }
                      >
                        <option value="note">Note 笔记</option>
                        <option value="tip">Tip 技巧提示</option>
                        <option value="warning">Warning 警告提醒</option>
                      </select>
                    </div>
                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                      <label className="admin-label">提示文本</label>
                      <input
                        type="text"
                        className="admin-input"
                        value={section.callout.text}
                        onChange={(e) =>
                          handleSectionFieldChange(idx, 'callout', {
                            ...section.callout!,
                            text: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Save Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => handleSubmit('draft')}
            disabled={saving}
          >
            <Save size={15} />
            <span>存为草稿</span>
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => handleSubmit('published')}
            disabled={saving}
          >
            {saving ? (
              <div className="admin-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
            ) : (
              <CheckCircle size={15} />
            )}
            <span>保存并发布</span>
          </button>
        </div>
      </form>
    </div>
  );
}
