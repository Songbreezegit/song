import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PROFILE, ABOUT_DATA, CONTACT_DATA } from '../data/portfolioData';
import type { SiteSettingsRecord } from '../types/database';

export async function fetchSiteSettings(): Promise<SiteSettingsRecord | null> {
  const fallbackSettings: SiteSettingsRecord = {
    id: 'default',
    site_intro: PROFILE.siteIntro,
    currently: PROFILE.currently,
    based_in: PROFILE.basedIn,
    contact: CONTACT_DATA,
    about: ABOUT_DATA,
    updated_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured) {
    return fallbackSettings;
  }

  const { data, error } = await supabase.from('site_settings')
    .select('*').eq('id', 'default').maybeSingle();
  if (error) throw error;
  return data ? normalizeSiteSettings(data as SiteSettingsRecord) : null;
}

// JSON columns may contain empty objects on existing installations.
export function normalizeSiteSettings(data: SiteSettingsRecord): SiteSettingsRecord {
  return {
    ...data,
    currently: { text: '', building: '', learning: '', exploring: '', date: '', ...(data.currently as Partial<SiteSettingsRecord['currently']>) },
    contact: { email: '', github: '', x: '', bilibili: '', ...(data.contact as Partial<SiteSettingsRecord['contact']>) },
    about: { greeting: '', role: '', bio: '', location: '', ...(data.about as Partial<SiteSettingsRecord['about']>),
      whatIDo: data.about?.whatIDo || [], techStack: data.about?.techStack || [],
      now: data.about?.now || [], path: data.about?.path || [] },
  };
}

export async function updateSiteSettings(
  settings: Partial<Omit<SiteSettingsRecord, 'id' | 'updated_at'>>
): Promise<SiteSettingsRecord> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase 未配置，无法保存站点设置。');
  }

  const { data, error } = await supabase
    .from('site_settings')
    .upsert(
      {
        id: 'default',
        ...settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as SiteSettingsRecord;
}
