import type { DistributionAccountInput, DistributionAccountRecord, DistributionContentType, DistributionGoal, DistributionPlatform, DistributionPostInput, DistributionPostRecord } from '../../../types/distribution';
import { validateDistributionPost } from '../../../lib/distributionValidation';

export const platformLabels: Record<DistributionPlatform, string> = { xiaohongshu: '小红书', douyin: '抖音', bilibili: 'B站', wechat: '微信公众号', weibo: '微博', zhihu: '知乎', x: 'X', youtube: 'YouTube', other: '其他' };
export const contentTypeLabels: Record<DistributionContentType, string> = { image_text: '图文', video: '视频', article: '文章', moment: '动态' };
export const goalLabels: Record<DistributionGoal, string> = { awareness: '品牌认知', project_visit: '项目访问', download: '产品下载', community: '关注与交流' };
export const postStatusLabels = { draft: '草稿', ready: '待发布' } as const;

export const createAccountDraft = (): DistributionAccountInput => ({ platform: 'xiaohongshu', name: '', profile_url: '', account_type: 'personal', positioning: '', project_id: null, notes: '', is_enabled: true });
export const accountToDraft = (record: DistributionAccountRecord): DistributionAccountInput => ({ platform: record.platform, name: record.name, profile_url: record.profile_url,
  account_type: record.account_type, positioning: record.positioning, project_id: record.project_id, notes: record.notes, is_enabled: record.is_enabled });
export const createPostDraft = (): DistributionPostInput => ({ title: '', body: '', tags: [], content_type: 'image_text', project_id: null, promotion_goal: 'awareness', status: 'draft', account_ids: [], media_ids: [] });
export const postToDraft = (record: DistributionPostRecord): DistributionPostInput => ({ title: record.title, body: record.body, tags: [...record.tags], content_type: record.content_type,
  project_id: record.project_id, promotion_goal: record.promotion_goal, status: record.status, account_ids: [...record.account_ids].sort(), media_ids: [...record.media_ids] });

export type DistributionPostEditorDraft = Omit<DistributionPostInput, 'tags'> & { tagsText: string };
export const createPostEditorDraft = (): DistributionPostEditorDraft => { const { tags, ...rest } = createPostDraft(); return { ...rest, tagsText: tags.join('，') }; };
export const postToEditorDraft = (record: DistributionPostRecord): DistributionPostEditorDraft => { const { tags, ...rest } = postToDraft(record); return { ...rest, tagsText: tags.join('，') }; };
export const serializePostEditorDraft = (draft: DistributionPostEditorDraft): DistributionPostInput => {
  const { tagsText, ...rest } = draft;
  return validateDistributionPost({ ...rest, tags: tagsText.split(/[,，\n]/).map(tag => tag.trim()).filter(Boolean) });
};
