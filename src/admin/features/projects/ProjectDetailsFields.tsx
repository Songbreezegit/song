import { Plus, Trash2 } from 'lucide-react';
import type { useProjectEditor } from './useProjectEditor';

export function ProjectDetailsFields({ editor }: { editor: ReturnType<typeof useProjectEditor> }) {
  const { draft, setField, newTechInput, setNewTechInput, newFeatureInput, setNewFeatureInput,
    handleAddTech, handleRemoveTech, handleAddFeature, handleRemoveFeature, handleAddChallenge, handleRemoveChallenge, handleChallengeChange } = editor;
  return (<>
        <div className="admin-card admin-editor-section" id="project-details">
          <div className="admin-card-header">
            <h3 className="admin-card-title">详细介绍与思考</h3>
          </div>

          <div className="admin-form-group">
            <label className="admin-label" htmlFor="project-desc">卡片简介 (Description)</label>
            <textarea
              id="project-desc"
              className="admin-textarea"
              placeholder="在作品卡片上展示的简短描述..."
              value={draft.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={2}
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-label" htmlFor="project-overview">项目背景与概览 (Overview)</label>
            <textarea
              id="project-overview"
              className="admin-textarea"
              placeholder="项目起因、所解决的核心痛点..."
              value={draft.overview}
              onChange={(e) => setField('overview', e.target.value)}
              rows={4}
            />
          </div>

          <div className="admin-form-group" style={{ marginBottom: 0 }}>
            <label className="admin-label" htmlFor="project-dev-notes">工程思考与架构 (Development Notes)</label>
            <textarea
              id="project-dev-notes"
              className="admin-textarea"
              placeholder="技术选型、架构思路与实现考量..."
              value={draft.development_notes}
              onChange={(e) => setField('development_notes', e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* 3. Tech Stack & Features */}
        <div className="admin-grid-2 admin-editor-section" id="project-features">
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">技术栈 (Tech Stack)</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input
                aria-label="添加技术标签"
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
              {draft.tech_stack.map((tech, idx) => (
                <span key={idx} className="admin-tag-pill">
                  {tech}
                  <button
                    aria-label={`移除技术标签 ${tech}`}
                    type="button"
                    className="admin-tag-remove"
                    onClick={() => handleRemoveTech(idx)}
                  >
                    ×
                  </button>
                </span>
              ))}
              {draft.tech_stack.length === 0 && (
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
                aria-label="添加功能特性"
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
              {draft.features.map((feat, idx) => (
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

          {draft.challenges_solutions.length === 0 ? (
            <p style={{ color: 'var(--admin-text-muted)', fontSize: '13px', margin: 0 }}>
              暂未记录攻坚挑战。点击上方“添加条目”记录关键难点与解法。
            </p>
          ) : (
            draft.challenges_solutions.map((item, idx) => (
              <div key={idx} className="admin-section-block">
                <div className="admin-section-header">
                  <span className="admin-section-title">挑战与解法 #{idx + 1}</span>
                  <button
                    type="button"
                    className="admin-btn admin-btn-danger admin-btn-sm"
                    onClick={() => handleRemoveChallenge(idx)}
                    aria-label={`删除挑战与解法 ${idx + 1}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="admin-form-group">
                  <label className="admin-label" htmlFor={`project-challenge-${idx}`}>遇到的难点 (Challenge)</label>
                  <input
                    id={`project-challenge-${idx}`}
                    type="text"
                    className="admin-input"
                    placeholder="描述当时遇到的技术阻碍或架构权衡..."
                    value={item.challenge}
                    onChange={(e) => handleChallengeChange(idx, 'challenge', e.target.value)}
                  />
                </div>
                <div className="admin-form-group" style={{ marginBottom: 0 }}>
                  <label className="admin-label" htmlFor={`project-solution-${idx}`}>解法与实践 (Solution)</label>
                  <textarea
                    id={`project-solution-${idx}`}
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

  </>);
}
