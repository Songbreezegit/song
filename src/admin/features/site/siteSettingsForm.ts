import type { SiteSettingsRecord } from '../../../types/database';
import { normalizeSiteSettings } from '../../../services/siteService';

export type SiteSettingsDraft = Omit<SiteSettingsRecord, 'id' | 'updated_at'>;

export function createSiteSettingsDraft(): SiteSettingsDraft {
  return { site_intro: '', based_in: '', currently: { text: '', building: '', learning: '', exploring: '', date: '' },
    contact: { email: '', github: '', githubUser: '', x: '', xUser: '', bilibili: '', bilibiliUser: '', status: '' },
    about: { greeting: '', role: '', bio: '', location: '', whatIDo: [], techStack: [], now: [], path: [] } };
}

export function siteSettingsToDraft(record: SiteSettingsRecord): SiteSettingsDraft {
  const { id: _id, updated_at: _updated, ...draft } = normalizeSiteSettings(record);
  return draft;
}

export function serializeSiteSettingsDraft(draft: SiteSettingsDraft): SiteSettingsDraft {
  const trimValues = <T extends object>(value: T): T => Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, typeof item === 'string' ? item.trim() : item]),
  ) as T;
  return { ...draft, site_intro: draft.site_intro.trim(), based_in: draft.based_in.trim(),
    currently: trimValues(draft.currently), contact: trimValues(draft.contact),
    about: { ...draft.about, techStack: draft.about.techStack.map(group => ({ ...group,
      items: group.items.map(item => item.trim()).filter(Boolean) })) } };
}
