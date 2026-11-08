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

// Browser-side adapters only describe preparation capabilities. Future OAuth,
// provider submissions and retries belong to a separate trusted worker API.
export interface DistributionPreparationAdapter {
  platform: DistributionPlatform;
  supportedTypes: readonly DistributionContentType[];
  validate: (source: DistributionPostInput) => readonly string[];
}
