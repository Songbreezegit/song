import { supabase } from '../lib/supabase';

export async function verifyAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('admin_users')
    .select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw new Error('无法验证管理员权限，请检查连接和数据库迁移。');
  return data?.user_id === userId;
}
