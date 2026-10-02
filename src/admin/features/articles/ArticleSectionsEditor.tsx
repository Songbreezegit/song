import { Plus, Trash2, ChevronUp, ChevronDown, Code2, Quote as QuoteIcon, HelpCircle } from 'lucide-react';
import { ArticleTableEditor } from '../../components/ArticleTableEditor';
import type { ArticleSection as SectionItem } from './articleForm';

export function ArticleSectionsEditor({ sections, onChange }: { sections: SectionItem[]; onChange: (sections: SectionItem[]) => void }) {
  // Section Operations
  const handleAddSection = () => {
    onChange([
      ...sections,
      {
        heading: '',
        body: [''],
      },
    ]);
  };

  const handleRemoveSection = (index: number) => {
    onChange(sections.filter((_, i) => i !== index));
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sections.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...sections];
    const temp = updated[index];
    updated[index] = updated[targetIndex]!;
    updated[targetIndex] = temp!;
    onChange(updated);
  };

  const handleSectionFieldChange = <K extends keyof SectionItem>(
    index: number,
    field: K,
    value: SectionItem[K]
  ) => {
    const updated = [...sections];
    updated[index] = { ...updated[index]!, [field]: value };
    onChange(updated);
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

  return (
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

                <ArticleTableEditor table={section.table} onChange={table => handleSectionFieldChange(idx, 'table', table)} />
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

  );
}
