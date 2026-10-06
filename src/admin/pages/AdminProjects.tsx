import { FolderKanban, Image, Star } from 'lucide-react';
import { fetchAllProjects, deleteProject, updateProjectStatus } from '../../services/projectService';
import type { ProjectRecord } from '../../types/database';
import { safeImageUrl } from '../../lib/safeUrl';
import { useContentCollection } from '../hooks/useContentCollection';
import { ContentCollection } from '../components/ContentCollection';

const config = { label: '项目', load: fetchAllProjects, remove: deleteProject, updateStatus: updateProjectStatus };

export function AdminProjects() {
  const collection = useContentCollection<ProjectRecord>(config);
  return <ContentCollection label="项目" description="整理作品与工具，快速找到草稿并发布到作品集。"
    icon={FolderKanban} basePath="/admin/projects" records={collection.data} loading={collection.loading}
    error={collection.error} feedback={collection.feedback} pendingKey={collection.pendingKey}
    onReload={collection.reload} onStatusChange={collection.changeStatus} onDelete={collection.remove}
    getCategoryLabel={project => project.category_label || project.category}
    getSearchText={project => [project.title, project.subtitle, project.slug, project.category,
      project.category_label, project.year, ...(project.tech_stack || [])].join(' ')}
    renderLeading={project => {
      const coverUrl = safeImageUrl(project.cover_image);
      return coverUrl ? <img className="admin-content-thumb" src={coverUrl} alt="" loading="lazy" /> :
        <span className="admin-content-thumb admin-content-thumb-placeholder"><Image size={20} aria-hidden="true" /></span>;
    }}
    detailColumn={{ label: '项目年份', render: project => <div className="admin-content-meta"><span>{project.year || '未设置'}</span>
      {project.featured && <span className="admin-featured-label"><Star size={12} fill="currentColor" />精选</span>}</div> }} />;
}
