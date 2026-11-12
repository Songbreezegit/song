export const distributionPlatforms = ['xiaohongshu', 'douyin', 'bilibili', 'wechat', 'weibo', 'zhihu', 'x', 'youtube', 'other'] as const;
export type DistributionPlatform = typeof distributionPlatforms[number];
export type DistributionContentType = 'image_text' | 'video' | 'article' | 'moment';
export type DistributionPostStatus = 'draft' | 'ready';
export type DistributionGoal = 'awareness' | 'project_visit' | 'download' | 'community';

export interface DistributionAccountInput {
  platform: DistributionPlatform;
  name: string;
  profile_url: string;
  account_type: 'personal' | 'project';
  positioning: string;
  project_id: string | null;
  notes: string;
  is_enabled: boolean;
}

export interface DistributionAccountRecord extends DistributionAccountInput {
  id: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

// A post is the canonical source. Platform-specific versions will reference its
// id rather than overwriting its body or the public projects/articles records.
export interface DistributionPostInput {
  title: string;
  body: string;
  tags: string[];
  content_type: DistributionContentType;
  project_id: string | null;
  promotion_goal: DistributionGoal;
  status: DistributionPostStatus;
  account_ids: string[];
  media_ids: string[];
}

export interface DistributionPostRecord extends DistributionPostInput {
  id: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface DistributionOverview {
  accounts: number;
  drafts: number;
  ready: number;
  recent: DistributionPostRecord[];
}

export const distributionVariantFields = ['title', 'body', 'tags', 'content_type', 'media_ids'] as const;
export type DistributionVariantField = typeof distributionVariantFields[number];
export type DistributionSourceReviewAction = 'sync' | 'retain';
export const distributionAspectRatios = ['', '1:1', '3:4', '4:3', '9:16', '16:9'] as const;
export type DistributionAspectRatio = typeof distributionAspectRatios[number];

export type DistributionVariantContent = Pick<DistributionPostInput, 'title' | 'body' | 'tags' | 'content_type'>;
export type DistributionSourceSnapshot = DistributionVariantContent & Pick<DistributionPostInput, 'media_ids'>;

export interface DistributionVariantMedia {
  media_id: string;
  is_cover: boolean;
  aspect_ratio_hint: DistributionAspectRatio;
  processing_notes: string;
}

export interface DistributionVariantInput extends DistributionVariantContent {
  status: DistributionPostStatus;
  media: DistributionVariantMedia[];
}

export interface DistributionVariantRecord extends DistributionVariantInput {
  id: string;
  post_id: string;
  account_id: string;
  platform: DistributionPlatform;
  source_version: number;
  source_snapshot: DistributionSourceSnapshot;
  source_retained_fields: Partial<Record<DistributionVariantField, number>>;
  version: number;
  created_at: string;
  updated_at: string;
}

export type DistributionVariantSummary = Pick<DistributionVariantRecord,
  'id' | 'post_id' | 'account_id' | 'platform' | 'title' | 'status' | 'version' | 'source_version'>;

export type DistributionMediaKind = 'image' | 'video' | 'unknown';

export interface DistributionRuleIssue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  confidence: 'confirmed' | 'recommendation' | 'unconfirmed' | 'workspace';
  message: string;
}

// Browser-side adapters only describe preparation capabilities. Future OAuth,
// provider submissions and retries belong to a separate trusted worker API.
export interface DistributionPreparationAdapter {
  platform: DistributionPlatform;
  supportedTypes: readonly DistributionContentType[];
  validate: (draft: DistributionVariantInput, kinds: ReadonlyMap<string, DistributionMediaKind>) => readonly DistributionRuleIssue[];
}
