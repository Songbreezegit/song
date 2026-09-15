import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PROFILE, ABOUT_DATA, CONTACT_DATA } from '../data/portfolioData';
import type { SiteSettingsRecord } from '../types/database';

export async function fetchSiteSettings(): Promise<SiteSettingsRecord> {
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

  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (error || !data) {
      return fallbackSettings;
    }

    return data as SiteSettingsRecord;
  } catch (err) {
    console.error('Error fetching site settings:', err);
    return fallbackSettings;
  }
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
