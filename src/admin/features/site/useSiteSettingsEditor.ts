import { fetchSiteSettings, updateSiteSettings } from '../../../services/siteService';
import type { SiteSettingsRecord } from '../../../types/database';
import { useAdminEditor, type EditorConfig } from '../../hooks/useAdminEditor';
import { createSiteSettingsDraft, siteSettingsToDraft, serializeSiteSettingsDraft, type SiteSettingsDraft } from './siteSettingsForm';

const config: EditorConfig<SiteSettingsRecord, SiteSettingsDraft> = {
  createDraft: createSiteSettingsDraft, load: fetchSiteSettings, toDraft: siteSettingsToDraft,
  serialize: serializeSiteSettingsDraft, create: updateSiteSettings, update: (_id, draft) => updateSiteSettings(draft),
  listPath: '/admin/site', loadError: '加载站点设置失败', saveError: '保存设置失败',
  createSuccess: '站点设置已成功保存！', updateSuccess: '站点设置已成功保存！',
};

export function useSiteSettingsEditor() {
  const editor = useAdminEditor('default', config);
  const setCurrentlyField = <K extends keyof SiteSettingsDraft['currently']>(field: K, value: SiteSettingsDraft['currently'][K]) =>
    editor.setField('currently', current => ({ ...current, [field]: value }));
  const setContactField = <K extends keyof SiteSettingsDraft['contact']>(field: K, value: SiteSettingsDraft['contact'][K]) =>
    editor.setField('contact', current => ({ ...current, [field]: value }));
  const setAboutField = <K extends keyof SiteSettingsDraft['about']>(field: K, value: SiteSettingsDraft['about'][K]) =>
    editor.setField('about', current => ({ ...current, [field]: value }));
  return { ...editor, setCurrentlyField, setContactField, setAboutField };
}
