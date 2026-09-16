import { supabase, isSupabaseConfigured } from '../lib/supabase';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface MediaItem {
  name: string;
  id: string;
  path: string;
  url: string;
  created_at: string;
}

export async function uploadMedia(
  file: File,
  folder = 'uploads'
): Promise<{ url: string; path: string }> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase 未配置，无法上传媒体文件。');
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('不支持的文件格式。仅支持 JPG, JPEG, PNG, WEBP 格式图片。');
  }

  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('文件体积过大，最大限制为 5MB。');
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    throw new Error('不支持的文件格式。仅支持 JPG, JPEG, PNG, WEBP 格式图片。');
  }
  const cleanName = file.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .toLowerCase();
  const filePath = `${folder}/${crypto.randomUUID()}-${cleanName}.${ext}`;

  const { error } = await supabase.storage
    .from('media')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from('media')
    .getPublicUrl(filePath);

  return {
    url: publicUrlData.publicUrl,
    path: filePath,
  };
}

export async function listMedia(folder = ''): Promise<MediaItem[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const items: MediaItem[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage
      .from('media')
      .list(folder, {
        limit: 100,
        offset,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      throw error;
    }

    for (const item of data || []) {
      if (item.name === '.emptyFolderPlaceholder') continue;

      // Check if it's a subfolder
      if (!item.id) {
        // It's a folder, list subfolder items
        const subItems = await listMedia(folder ? `${folder}/${item.name}` : item.name);
        items.push(...subItems);
        continue;
      }

      const fullPath = folder ? `${folder}/${item.name}` : item.name;
      const { data: publicUrlData } = supabase.storage
        .from('media')
        .getPublicUrl(fullPath);

      items.push({
        name: item.name,
        id: item.id,
        path: fullPath,
        url: publicUrlData.publicUrl,
        created_at: item.created_at || new Date().toISOString(),
      });
    }

    if (!data || data.length < 100) break;
  }
  return items;
}

export async function deleteMedia(path: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase 未配置，无法删除媒体文件。');
  }

  const { error } = await supabase.storage
    .from('media')
    .remove([path]);

  if (error) {
    throw error;
  }
}
