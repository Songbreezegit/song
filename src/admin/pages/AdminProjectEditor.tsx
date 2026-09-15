import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Upload,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import {
  getProjectById,
  createProject,
  updateProject,
  checkProjectSlugAvailable,
} from '../../services/projectService';
import { uploadMedia } from '../../services/mediaService';
import type { ContentStatus } from '../../types/database';
import type { Project } from '../../data/portfolioData';

const categories: { value: Project['category']; label: string }[] = [
  { value: 'web', label: 'Web 全栈应用' },
  { value: 'android', label: 'Android 原生' },
  { value: 'ai', label: 'AI 与智能实验' },
  { value: 'tools', label: '工具与脚本' },
  { value: 'systems', label: '系统与服务端' },
  { value: 'opensource', label: '开源代码' },
  { value: 'notes', label: '摄影与笔记' },
];

export function AdminProjectEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState<Project['category']>('web');
  const [categoryLabel, setCategoryLabel] = useState('Web / React');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [featured, setFeatured] = useState(false);
  const [status, setStatus] = useState<ContentStatus>('draft');

  const [description, setDescription] = useState('');
  const [overview, setOverview] = useState('');
  const [developmentNotes, setDevelopmentNotes] = useState('');

  const [techStack, setTechStack] = useState<string[]>([]);
  const [newTechInput, setNewTechInput] = useState('');

  const [features, setFeatures] = useState<string[]>([]);
  const [newFeatureInput, setNewFeatureInput] = useState('');

  const [challengesSolutions, setChallengesSolutions] = useState<{ challenge: string; solution: string }[]>([]);

  const [githubUrl, setGithubUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);

  const [imageTheme, setImageTheme] = useState<Project['imageTheme']>({
    bgColor: '#0F172A',
    accentColor: '#38BDF8',
    type: 'browser',
  });

  // Load existing project if editing
  useEffect(() => {
    if (isNew) return;

    async function loadData() {
      try {
        setLoading(true);
        const data = await getProjectById(id!);
        if (!data) {
          setFeedback({ type: 'error', message: '未找到指定项目' });
          return;
        }

        setTitle(data.title);
        setSlug(data.slug);
        setSubtitle(data.subtitle);
        setTagline(data.tagline);
        setCategory(data.category);
        setCategoryLabel(data.category_label);
        setYear(data.year);
        setFeatured(data.featured);
        setStatus(data.status);
        setDescription(data.description);
        setOverview(data.overview);
        setDevelopmentNotes(data.development_notes);
        setTechStack(data.tech_stack || []);
        setFeatures(data.features || []);
        setChallengesSolutions(data.challenges_solutions || []);
        setGithubUrl(data.github_url);
        setLiveUrl(data.live_url || '');
        setCoverImage(data.cover_image || '');
        if (data.image_theme) setImageTheme(data.image_theme);
      } catch (err) {
        setFeedback({ type: 'error', message: err instanceof Error ? err.message : '加载项目失败' });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id, isNew]);

  // Slug Auto-generator helper
  const handleAutoSlug = () => {
    if (!title) return;
    const generated = title
      .toLowerCase()
      .trim()
      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(generated);
  };

  // Tech Stack Handlers
  const handleAddTech = () => {
    if (!newTechInput.trim()) return;
    if (!techStack.includes(newTechInput.trim())) {
      setTechStack([...techStack, newTechInput.trim()]);
    }
    setNewTechInput('');
  };

  const handleRemoveTech = (index: number) => {
    setTechStack(techStack.filter((_, i) => i !== index));
  };

  // Features Handlers
  const handleAddFeature = () => {
    if (!newFeatureInput.trim()) return;
    setFeatures([...features, newFeatureInput.trim()]);
    setNewFeatureInput('');
  };

  const handleRemoveFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  // Challenges Handlers
  const handleAddChallenge = () => {
    setChallengesSolutions([...challengesSolutions, { challenge: '', solution: '' }]);
  };

  const handleChallengeChange = (index: number, field: 'challenge' | 'solution', value: string) => {
    const updated = [...challengesSolutions];
    updated[index] = { ...updated[index], [field]: value };
    setChallengesSolutions(updated);
  };

  const handleRemoveChallenge = (index: number) => {
    setChallengesSolutions(challengesSolutions.filter((_, i) => i !== index));
  };

  // Cover Image Upload Handler
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingCover(true);
      setFeedback(null);
      const { url } = await uploadMedia(file, 'projects');
      setCoverImage(url);
      setFeedback({ type: 'success', message: '封面图片已成功上传并关联' });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : '上传封面图片失败',
      });
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  };

  // Save Form Handler
  const handleSubmit = async (targetStatus?: ContentStatus) => {
    const finalStatus = targetStatus || status;

    if (!title.trim()) {
      setFeedback({ type: 'error', message: '请输入项目标题' });
      return;
    }

    if (!slug.trim()) {
      setFeedback({ type: 'error', message: '请输入项目 Slug（用于链接与详情标识）' });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);

      // Check slug uniqueness
      const isSlugAvailable = await checkProjectSlugAvailable(slug.trim(), isNew ? undefined : id);
      if (!isSlugAvailable) {
        setFeedback({ type: 'error', message: `Slug "${slug.trim()}" 已存在，请更换！` });
        setSaving(false);
        return;
      }

      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        subtitle: subtitle.trim(),
        tagline: tagline.trim(),
        category,
        category_label: categoryLabel.trim(),
        year: year.trim(),
        featured,
        status: finalStatus,
        description: description.trim(),
        overview: overview.trim(),
        development_notes: developmentNotes.trim(),
        tech_stack: techStack,
        features,
        challenges_solutions: challengesSolutions.filter((c) => c.challenge.trim() || c.solution.trim()),
        github_url: githubUrl.trim(),
        live_url: liveUrl.trim(),
        cover_image: coverImage.trim(),
        image_theme: imageTheme,
        sort_order: 0,
      };

      if (isNew) {
        const created = await createProject(payload);
        setFeedback({ type: 'success', message: '项目创建成功！' });
        setTimeout(() => {
          navigate(`/admin/projects/${created.id}`);
        }, 1000);
      } else {
        await updateProject(id!, payload);
        setStatus(finalStatus);
        setFeedback({ type: 'success', message: '项目保存更新成功！' });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : '保存项目失败',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
        <div className="admin-spinner" style={{ margin: '0 auto 16px' }} />
        正在加载项目数据...
      </div>
    );
  }

  return (
    <div>
      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/admin/projects" className="admin-btn admin-btn-secondary admin-btn-sm">
            <ArrowLeft size={15} />
            <span>返回列表</span>
          </Link>
          <span style={{ fontSize: '14px', color: 'var(--admin-text-secondary)' }}>
            {isNew ? '新建项目' : `编辑：${title || '未命名项目'}`}
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
            <span>立即发布</span>
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
              <label className="admin-label" htmlFor="project-title">项目名称 (Title) *</label>
              <input
                id="project-title"
                type="text"
                className="admin-input"
                placeholder="例如：LizhangApp"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="project-slug">
                URL Slug (唯一标识) *
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="project-slug"
                  type="text"
                  className="admin-input"
                  placeholder="例如：lizhang"
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

          <div className="admin-grid-2">
            <div className="admin-form-group">
              <label className="admin-label" htmlFor="project-subtitle">副标题 (Subtitle)</label>
              <input
                id="project-subtitle"
                type="text"
                className="admin-input"
                placeholder="例如：礼金记账"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="project-tagline">一句话定位 (Tagline)</label>
              <input
                id="project-tagline"
                type="text"
                className="admin-input"
                placeholder="一款专为人情往来与礼金支出定制的 Android 原生应用"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
              />
            </div>
          </div>

          <div className="admin-grid-4">
            <div className="admin-form-group">
              <label className="admin-label" htmlFor="project-category">主分类</label>
              <select
                id="project-category"
                className="admin-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as Project['category'])}
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="project-category-label">分类展示标签</label>
              <input
                id="project-category-label"
                type="text"
                className="admin-input"
                placeholder="例如：Android / Compose"
                value={categoryLabel}
                onChange={(e) => setCategoryLabel(e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="project-year">年份 (Year)</label>
              <input
                id="project-year"
                type="text"
                className="admin-input"
                placeholder="2026"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-label" htmlFor="project-status">发布状态</label>
              <select
                id="project-status"
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

          <div className="admin-form-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
              />
              <span style={{ fontSize: '13px', fontWeight: 500 }}>设为首页精选项目 (Featured)</span>
            </label>
          </div>
        </div>

        {/* 2. Description & Overview */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">详细介绍与思考</h3>
          </div>

          <div className="admin-form-group">
            <label className="admin-label" htmlFor="project-desc">卡片简介 (Description)</label>
            <textarea
              id="project-desc"
              className="admin-textarea"
              placeholder="在作品卡片上展示的简短描述..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-label" htmlFor="project-overview">项目背景与概览 (Overview)</label>
            <textarea
              id="project-overview"
              className="admin-textarea"
              placeholder="项目起因、所解决的核心痛点..."
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
              rows={4}
            />
          </div>

          <div className="admin-form-group" style={{ marginBottom: 0 }}>
            <label className="admin-label" htmlFor="project-dev-notes">工程思考与架构 (Development Notes)</label>
            <textarea
              id="project-dev-notes"
              className="admin-textarea"
              placeholder="技术选型、架构思路与实现考量..."
              value={developmentNotes}
              onChange={(e) => setDevelopmentNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* 3. Tech Stack & Features */}
        <div className="admin-grid-2">
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">技术栈 (Tech Stack)</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input
                type="text"
                className="admin-input"
                placeholder="例如：TypeScript, React 19"
                value={newTechInput}
                onChange={(e) => setNewTechInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTech();
                  }
                }}
              />
              <button
                type="button"
                className="admin-btn admin-btn-secondary admin-btn-sm"
                onClick={handleAddTech}
              >
                <Plus size={14} />
                <span>添加</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {techStack.map((tech, idx) => (
                <span key={idx} className="admin-tag-pill">
                  {tech}
                  <button
                    type="button"
                    className="admin-tag-remove"
                    onClick={() => handleRemoveTech(idx)}
                  >
                    ×
                  </button>
                </span>
              ))}
              {techStack.length === 0 && (
                <span style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>尚未添加技术标签</span>
              )}
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">核心功能特性 (Features)</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input
                type="text"
                className="admin-input"
                placeholder="添加一行功能点特性..."
                value={newFeatureInput}
                onChange={(e) => setNewFeatureInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddFeature();
                  }
                }}
              />
              <button
                type="button"
                className="admin-btn admin-btn-secondary admin-btn-sm"
                onClick={handleAddFeature}
              >
                <Plus size={14} />
                <span>添加</span>
              </button>
            </div>

            <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '13px', lineHeight: '1.8' }}>
              {features.map((feat, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{feat}</span>
                    <button
                      type="button"
                      className="admin-btn admin-btn-danger admin-btn-sm"
                      style={{ padding: '2px 6px', fontSize: '11px' }}
                      onClick={() => handleRemoveFeature(idx)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 4. Challenges & Solutions */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">挑战与解决方案 (Challenges & Solutions)</h3>
            <button
              type="button"
              className="admin-btn admin-btn-secondary admin-btn-sm"
              onClick={handleAddChallenge}
            >
              <Plus size={14} />
              <span>添加条目</span>
            </button>
          </div>

          {challengesSolutions.length === 0 ? (
            <p style={{ color: 'var(--admin-text-muted)', fontSize: '13px', margin: 0 }}>
              暂未记录攻坚挑战。点击上方“添加条目”记录关键难点与解法。
            </p>
          ) : (
            challengesSolutions.map((item, idx) => (
              <div key={idx} className="admin-section-block">
                <div className="admin-section-header">
                  <span className="admin-section-title">挑战与解法 #{idx + 1}</span>
                  <button
                    type="button"
                    className="admin-btn admin-btn-danger admin-btn-sm"
                    onClick={() => handleRemoveChallenge(idx)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">遇到的难点 (Challenge)</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="描述当时遇到的技术阻碍或架构权衡..."
                    value={item.challenge}
                    onChange={(e) => handleChallengeChange(idx, 'challenge', e.target.value)}
                  />
                </div>
                <div className="admin-form-group" style={{ marginBottom: 0 }}>
                  <label className="admin-label">解法与实践 (Solution)</label>
                  <textarea
                    className="admin-textarea"
                    placeholder="详细记录如何解决以及最终方案..."
                    value={item.solution}
                    onChange={(e) => handleChallengeChange(idx, 'solution', e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* 5. Links & Media */}
        <div className="admin-grid-2">
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">相关链接 (Links)</h3>
            </div>
            <div className="admin-form-group">
              <label className="admin-label" htmlFor="github-url">GitHub 仓库链接</label>
              <input
                id="github-url"
                type="url"
                className="admin-input"
                placeholder="https://github.com/Songbreezegit/..."
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
              />
            </div>
            <div className="admin-form-group" style={{ marginBottom: 0 }}>
              <label className="admin-label" htmlFor="live-url">在线预览 / 体验链接 (可选)</label>
              <input
                id="live-url"
                type="url"
                className="admin-input"
                placeholder="https://..."
                value={liveUrl}
                onChange={(e) => setLiveUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">封面图片 (Cover Image)</h3>
            </div>

            {coverImage ? (
              <div style={{ marginBottom: '14px' }}>
                <img
                  src={coverImage}
                  alt="封面预览"
                  style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--admin-border)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <a
                    href={coverImage}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '12px', color: 'var(--admin-accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>查看原图</span>
                    <ExternalLink size={12} />
                  </a>
                  <button
                    type="button"
                    className="admin-btn admin-btn-danger admin-btn-sm"
                    onClick={() => setCoverImage('')}
                  >
                    移除封面
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  border: '2px dashed var(--admin-border)',
                  borderRadius: '8px',
                  padding: '24px',
                  textAlign: 'center',
                  marginBottom: '14px',
                  color: 'var(--admin-text-secondary)',
                }}
              >
                <ImageIcon size={28} style={{ margin: '0 auto 8px', color: 'var(--admin-text-muted)' }} />
                <p style={{ margin: 0, fontSize: '13px' }}>尚未设置封面图片</p>
              </div>
            )}

            <div>
              <label className="admin-btn admin-btn-secondary admin-btn-sm" style={{ cursor: 'pointer' }}>
                <Upload size={14} />
                <span>{uploadingCover ? '上传中...' : '上传新封面图片'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleCoverUpload}
                  disabled={uploadingCover}
                  style={{ display: 'none' }}
                />
              </label>
              <div className="admin-label-desc" style={{ marginTop: '6px' }}>
                支持 JPG, PNG, WEBP 格式，最大 5MB
              </div>
            </div>
          </div>
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
