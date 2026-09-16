import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ARTICLES, type Article } from '../data/portfolioData';
import {
  type ArticleRecord,
  type ContentStatus,
  articleRecordToUiModel,
} from '../types/database';

export async function fetchPublishedArticles(): Promise<Article[]> {
  if (!isSupabaseConfigured) {
    return ARTICLES;
  }

  const { data, error } = await supabase
    .from('articles').select('*').eq('status', 'published')
    .order('sort_order', { ascending: true }).order('created_at', { ascending: false });
  if (error) throw error;
  return ((data || []) as ArticleRecord[]).map(articleRecordToUiModel);
}

export async function fetchAllArticles(): Promise<ArticleRecord[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data as ArticleRecord[]) || [];
}

export async function getArticleById(id: string): Promise<ArticleRecord | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as ArticleRecord | null;
}

export async function checkArticleSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return true;

  let query = supabase.from('articles').select('id').eq('slug', slug);
  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return !data || data.length === 0;
}

export async function createArticle(
  articleData: Omit<ArticleRecord, 'id' | 'created_at' | 'updated_at'>
): Promise<ArticleRecord> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase 未配置，无法创建文章。请在 .env.local 中配置环境变量。');
  }

  const isSlugAvailable = await checkArticleSlugAvailable(articleData.slug);
  if (!isSlugAvailable) {
    throw new Error(`Slug "${articleData.slug}" 已存在，请更换其他 Slug。`);
  }

  const { data, error } = await supabase
    .from('articles')
    .insert([
      {
        ...articleData,
        published_at: articleData.status === 'published' ? new Date().toISOString() : null,
      },
    ])
    .select()
    .single();

  if (error?.code === '23505') throw new Error('Slug 已存在，请更换其他 Slug。');
  if (error) throw error;
  return data as ArticleRecord;
}

export async function updateArticle(
  id: string,
  articleData: Partial<ArticleRecord>
): Promise<ArticleRecord> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase 未配置，无法更新文章。');
  }

  if (articleData.slug) {
    const isSlugAvailable = await checkArticleSlugAvailable(articleData.slug, id);
    if (!isSlugAvailable) {
      throw new Error(`Slug "${articleData.slug}" 已存在，请更换其他 Slug。`);
    }
  }

  const payload: Partial<ArticleRecord> = {
    ...articleData,
    updated_at: new Date().toISOString(),
  };

  if (articleData.status === 'published' && !articleData.published_at) {
    payload.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('articles')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error?.code === '23505') throw new Error('Slug 已存在，请更换其他 Slug。');
  if (error) throw error;
  return data as ArticleRecord;
}

export async function deleteArticle(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase 未配置，无法删除文章。');
  }

  const { error } = await supabase
    .from('articles')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateArticleStatus(id: string, status: ContentStatus): Promise<void> {
  await updateArticle(id, {
    status,
    published_at: status === 'published' ? new Date().toISOString() : null,
  });
}
