import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PROJECTS, type Project } from '../data/portfolioData';
import {
  type ProjectRecord,
  type ContentStatus,
  projectRecordToUiModel,
} from '../types/database';

export async function fetchPublishedProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured) {
    return PROJECTS;
  }

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('status', 'published')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      console.warn('Supabase projects query returned empty or error, falling back to local data:', error?.message);
      return PROJECTS;
    }

    return (data as ProjectRecord[]).map(projectRecordToUiModel);
  } catch (err) {
    console.error('Error fetching published projects:', err);
    return PROJECTS;
  }
}

export async function fetchAllProjects(): Promise<ProjectRecord[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data as ProjectRecord[]) || [];
}

export async function getProjectById(id: string): Promise<ProjectRecord | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as ProjectRecord | null;
}

export async function checkProjectSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return true;

  let query = supabase.from('projects').select('id').eq('slug', slug);
  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return !data || data.length === 0;
}

export async function createProject(
  projectData: Omit<ProjectRecord, 'id' | 'created_at' | 'updated_at'>
): Promise<ProjectRecord> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase 未配置，无法创建项目。请在 .env.local 中配置环境变量。');
  }

  const isSlugAvailable = await checkProjectSlugAvailable(projectData.slug);
  if (!isSlugAvailable) {
    throw new Error(`Slug "${projectData.slug}" 已存在，请使用其他 Slug。`);
  }

  const { data, error } = await supabase
    .from('projects')
    .insert([
      {
        ...projectData,
        published_at: projectData.status === 'published' ? new Date().toISOString() : null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as ProjectRecord;
}

export async function updateProject(
  id: string,
  projectData: Partial<ProjectRecord>
): Promise<ProjectRecord> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase 未配置，无法更新项目。');
  }

  if (projectData.slug) {
    const isSlugAvailable = await checkProjectSlugAvailable(projectData.slug, id);
    if (!isSlugAvailable) {
      throw new Error(`Slug "${projectData.slug}" 已存在，请更换其他 Slug。`);
    }
  }

  const payload: Partial<ProjectRecord> = {
    ...projectData,
    updated_at: new Date().toISOString(),
  };

  if (projectData.status === 'published' && !projectData.published_at) {
    payload.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('projects')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ProjectRecord;
}

export async function deleteProject(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase 未配置，无法删除项目。');
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateProjectStatus(id: string, status: ContentStatus): Promise<void> {
  await updateProject(id, {
    status,
    published_at: status === 'published' ? new Date().toISOString() : null,
  });
}
