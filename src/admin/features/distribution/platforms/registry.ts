import type { DistributionAspectRatio, DistributionMediaKind, DistributionPlatform, DistributionPreparationAdapter, DistributionRuleIssue, DistributionVariantInput } from '../../../../types/distribution';
import { platformLabels } from '../distributionForm';

type ContentType = DistributionVariantInput['content_type'];
type Source = { title: string; url: string; scope: string };
interface Profile {
  supportedTypes: readonly ContentType[];
  mediaKinds: readonly DistributionMediaKind[];
  presentation: 'note' | 'clip' | 'article' | 'timeline';
  titleGuidance: string;
  bodyGuidance: string;
  tagGuidance: string;
  mediaCountGuidance: string;
  coverFor?: readonly ContentType[];
  ratios: readonly Exclude<DistributionAspectRatio, ''>[];
  note: string;
  sources: readonly Source[];
  confirmedTextLimit?: { type: ContentType; title: number; body: number };
}
export interface DistributionPlatformProfile extends DistributionPreparationAdapter, Profile {
  name: string;
  checkedAt: string;
}

const genericCount = '平台素材上限待核对。工作区每稿可引用 20 项。';
const unknown = '发布入口、账号权益与内容品类可能影响要求，请在实际投稿页确认。';
const imageVideo = ['image', 'video'] as const;
const profiles: Record<DistributionPlatform, Profile> = {
  xiaohongshu: {
    supportedTypes: ['image_text', 'video'], mediaKinds: imageVideo, presentation: 'note',
    titleGuidance: '用一句话交代内容价值。', bodyGuidance: '建议按要点分段，首段给出主题。',
    tagGuidance: '选择与笔记主题直接相关的话题。', mediaCountGuidance: genericCount,
    coverFor: ['image_text', 'video'], ratios: ['3:4', '1:1'], note: unknown,
    sources: [{ title: '小红书开放平台', url: 'https://open.xiaohongshu.com/', scope: '入口参考。通用投稿数值未确认。' }],
  },
  douyin: {
    supportedTypes: ['video', 'image_text', 'moment'], mediaKinds: imageVideo, presentation: 'clip',
    titleGuidance: '便于识别视频或图文主题。', bodyGuidance: '建议先写一段能独立阅读的作品介绍。',
    tagGuidance: '把主要话题放在前面。', mediaCountGuidance: genericCount,
    coverFor: ['video', 'image_text'], ratios: ['9:16', '3:4'], note: unknown,
    sources: [{ title: '抖音开放平台', url: 'https://developer.open-douyin.com/', scope: '开放能力列出视频和图文投稿等形态，入口与权限有差异。' }],
  },
  bilibili: {
    supportedTypes: ['video', 'moment', 'article'], mediaKinds: imageVideo, presentation: 'clip',
    titleGuidance: '建议让视频标题与封面表达同一主题。', bodyGuidance: '可在简介中整理章节或补充链接。',
    tagGuidance: '优先选择内容题材与分区相关的标签。', mediaCountGuidance: genericCount,
    coverFor: ['video'], ratios: ['16:9', '4:3'], note: unknown,
    sources: [{ title: '哔哩哔哩创作中心', url: 'https://member.bilibili.com/', scope: '入口参考。投稿数值和封面要求请查实际分区。' }],
  },
  wechat: {
    supportedTypes: ['article', 'image_text'], mediaKinds: imageVideo, presentation: 'article',
    titleGuidance: '建议与文章内容和封面摘要保持一致。', bodyGuidance: '导出后在公众号编辑器中复查排版。',
    tagGuidance: '这里的标签可用于整理主题，话题能力以账号为准。', mediaCountGuidance: genericCount,
    coverFor: ['article', 'image_text'], ratios: ['16:9', '1:1'], note: unknown,
    sources: [{ title: '微信公众号草稿接口', url: 'https://developers.weixin.qq.com/doc/offiaccount/Draft_Box/Add_draft.html', scope: '接口参考。M2 的人工发布不套用接口参数限制。' }],
  },
  weibo: {
    supportedTypes: ['moment', 'image_text', 'video'], mediaKinds: imageVideo, presentation: 'timeline',
    titleGuidance: '标题可作为整理用的短句。', bodyGuidance: '先写可单独发布的正文，再决定是否附图。',
    tagGuidance: '人工发布时确认话题格式。', mediaCountGuidance: genericCount,
    ratios: ['1:1', '3:4'], note: unknown,
    sources: [{ title: '微博开放平台分享接口', url: 'https://open.weibo.com/wiki/2/statuses/share', scope: '入口参考。人工发布的长度和数量上限未确认。' }],
  },
  zhihu: {
    supportedTypes: ['article', 'moment', 'video'], mediaKinds: imageVideo, presentation: 'article',
    titleGuidance: '建议明确文章讨论的问题。', bodyGuidance: '用清晰分段说明背景、观点和证据。',
    tagGuidance: '话题应匹配讨论对象。', mediaCountGuidance: genericCount,
    coverFor: ['article'], ratios: ['16:9', '1:1'], note: '文章、想法、视频和付费专栏的创作入口与要求不同。',
    sources: [{ title: '知乎创作者手册', url: 'https://www.zhihu.com/knowledge-plan/manual', scope: '文章、想法与视频的创作形态和建议。' }],
  },
  x: {
    supportedTypes: ['moment', 'image_text', 'video'], mediaKinds: imageVideo, presentation: 'timeline',
    titleGuidance: '常规帖子用正文起句表达主题。', bodyGuidance: '常规帖与订阅长帖规则不同，核对目标账号的发布界面。',
    tagGuidance: '保留与正文相关的话题。', mediaCountGuidance: genericCount,
    ratios: ['1:1', '16:9'], note: '官方区分常规帖和订阅长帖。本地不按简单字符数推断配额。',
    sources: [{ title: 'X 帖子类型', url: 'https://help.x.com/en/using-x/types-of-posts', scope: '常规帖、媒体及订阅长帖。' }],
  },
  youtube: {
    supportedTypes: ['video', 'moment'], mediaKinds: imageVideo, presentation: 'clip',
    titleGuidance: 'YouTube Studio 视频标题最多 100 字符。', bodyGuidance: 'YouTube Studio 视频说明最多 5,000 字符。',
    tagGuidance: '根据官方说明，标签主要用于易拼错的关键字。', mediaCountGuidance: genericCount,
    coverFor: ['video'], ratios: ['16:9', '9:16'], note: 'Shorts、普通视频和社区帖的入口与缩略图选项不同。',
    sources: [
      { title: 'YouTube Studio 视频设置', url: 'https://support.google.com/youtube/answer/57404', scope: '普通视频的标题和说明字符上限。' },
      { title: 'YouTube 缩略图指南', url: 'https://support.google.com/youtube/answer/72431', scope: '常规视频缩略图建议，Shorts 有独立流程。' },
    ],
    confirmedTextLimit: { type: 'video', title: 100, body: 5000 },
  },
  other: {
    supportedTypes: ['image_text', 'video', 'article', 'moment'], mediaKinds: imageVideo, presentation: 'note',
    titleGuidance: '使用简明标题。', bodyGuidance: '保留适合人工发布的完整正文。',
    tagGuidance: '可将标签用于准备和归档。', mediaCountGuidance: genericCount,
    ratios: [], note: '通用预览。请在目标平台的实际发布界面核对要求。', sources: [],
  },
};

function inspect(profile: Profile, draft: DistributionVariantInput, kinds: ReadonlyMap<string, DistributionMediaKind>): DistributionRuleIssue[] {
  const issues: DistributionRuleIssue[] = [];
  const add = (code: string, severity: DistributionRuleIssue['severity'], confidence: DistributionRuleIssue['confidence'], message: string) =>
    issues.push({ code, severity, confidence, message });
  const assets = draft.media.map(media => kinds.get(media.media_id));
  const hasImage = assets.includes('image');
  const hasVideo = assets.includes('video');
  if (!draft.title.trim()) add('title-required', 'error', 'workspace', '请填写平台稿标题。');
  if (draft.content_type === 'article' && !draft.body.trim()) add('article-body', 'error', 'workspace', '文章标记待发布前需要正文。');
  if (draft.content_type === 'moment' && !draft.body.trim() && !hasImage && !hasVideo) {
    add('moment-empty', 'error', 'workspace', '动态标记待发布前需要正文或可用媒体。');
  }
  if (draft.content_type === 'image_text' && !hasImage) add('image-required', 'error', 'workspace', '图文标记待发布前需要至少一张可用图片。');
  if (draft.content_type === 'video' && !hasVideo) add('video-required', 'error', 'workspace', '仍需准备视频。可先保存草稿并导出文案和封面。');
  if (assets.includes(undefined)) add('media-unavailable', 'error', 'workspace', '部分素材未在媒体库中找到，请重新选择。');
  if (draft.media.some(media => media.is_cover && kinds.get(media.media_id) !== 'image')) {
    add('cover-image', 'error', 'workspace', '封面必须使用媒体库中的可用图片。');
  }
  const text = profile.confirmedTextLimit;
  if (text?.type === draft.content_type) {
    if ([...draft.title.trim()].length > text.title) add('title-limit', 'error', 'confirmed', `视频标题最多 ${text.title} 字符。`);
    if ([...draft.body].length > text.body) add('body-limit', 'error', 'confirmed', `视频说明最多 ${text.body} 字符。`);
  }
  if (!profile.supportedTypes.includes(draft.content_type)) add('type-unconfirmed', 'warning', 'unconfirmed', '该内容形态未在此入口确认，请核对目标账号的发布能力。');
  if (assets.some(kind => kind && !profile.mediaKinds.includes(kind))) add('kind-unconfirmed', 'warning', 'unconfirmed', '部分素材类型需要在发布入口确认。');
  if (profile.coverFor?.includes(draft.content_type) && !draft.media.some(media => media.is_cover)) {
    add('cover-suggestion', 'warning', 'recommendation', '建议为这份稿件选择一张封面。');
  }
  if (draft.media.some(media => media.aspect_ratio_hint || media.processing_notes)) {
    add('processing-pending', 'warning', 'workspace', '素材仍需按处理说明核对。预览与导出使用原始文件引用。');
  }
  add('platform-review', 'info', 'unconfirmed', profile.note);
  return issues;
}

export function getDistributionPlatform(platform: DistributionPlatform): DistributionPlatformProfile {
  const profile = profiles[platform];
  return {
    ...profile, platform, name: platformLabels[platform], checkedAt: '2026-11-10',
    validate: (draft, kinds) => inspect(profile, draft, kinds),
  };
}
