import { safeExternalUrl } from './safeUrl';
import { distributionPlatforms, type DistributionAccountInput, type DistributionPostInput } from '../types/distribution';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (message: string): never => { throw new Error(message); };

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('请输入有效的表单数据。');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(record, key))) fail('表单包含不支持或缺少的字段。');
  return record;
}

function text(value: unknown, max: number, label: string, required = false, trim = true): string {
  if (typeof value !== 'string') fail(`${label}必须是文本。`);
  const result = trim ? (value as string).trim() : value as string;
  if ((required && !result.trim()) || result.length > max || result.includes('\0')) fail(`${label}${required ? '不能为空，且' : ''}最多 ${max} 个字符。`);
  return result;
}

function choice<T extends string>(value: unknown, choices: readonly T[], label: string): T {
  if (!choices.includes(value as T)) fail(`${label}取值无效。`);
  return value as T;
}

function projectId(value: unknown): string | null {
  return value === null ? null : text(value, 200, '关联项目', true);
}

export function distributionId(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value)) fail('记录标识无效，请返回列表重新打开。');
  return value as string;
}

export function distributionVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) fail('记录版本无效，请重新加载。');
  return value as number;
}

function ids(value: unknown, max: number, label: string): string[] {
  if (!Array.isArray(value) || value.length > max) fail(`${label}最多选择 ${max} 项。`);
  const result = (value as unknown[]).map(distributionId);
  if (new Set(result).size !== result.length) fail(`${label}不能重复。`);
  return result;
}

export function validateDistributionAccount(value: unknown): DistributionAccountInput {
  const input = object(value, ['platform', 'name', 'profile_url', 'account_type', 'positioning', 'project_id', 'notes', 'is_enabled']);
  // eslint-disable-next-line no-control-regex
  if (typeof input.profile_url === 'string' && /[\u0000-\u001f\u007f\\]/.test(input.profile_url)) fail('主页链接不能包含控制字符或反斜杠。');
  const profile = text(input.profile_url, 2048, '主页链接');
  if (profile && !safeExternalUrl(profile)) fail('主页链接必须是 HTTP(S) 地址，且不能包含登录凭据、控制字符或反斜杠。');
  const normalizedProfile = profile ? safeExternalUrl(profile)! : '';
  if (normalizedProfile.length > 2048) fail('主页链接编码后不能超过 2048 个字符。');
  if (typeof input.is_enabled !== 'boolean') fail('启用状态无效。');
  return {
    platform: choice(input.platform, distributionPlatforms, '平台'),
    name: text(input.name, 100, '账号名称', true),
    profile_url: normalizedProfile,
    account_type: choice(input.account_type, ['personal', 'project'], '账号类型'),
    positioning: text(input.positioning, 1000, '账号定位'),
    project_id: projectId(input.project_id),
    notes: text(input.notes, 5000, '备注'),
    is_enabled: input.is_enabled as boolean,
  };
}

export function validateDistributionPost(value: unknown): DistributionPostInput {
  const input = object(value, ['title', 'body', 'tags', 'content_type', 'project_id', 'promotion_goal', 'status', 'account_ids', 'media_ids']);
  if (!Array.isArray(input.tags) || input.tags.length > 20) fail('标签最多 20 个。');
  const tags = (input.tags as unknown[]).map(tag => text(tag, 50, '标签', true));
  if (new Set(tags).size !== tags.length) fail('标签不能重复。');
  return {
    title: text(input.title, 200, '标题', true), body: text(input.body, 100000, '正文', false, false), tags,
    content_type: choice(input.content_type, ['image_text', 'video', 'article', 'moment'], '内容类型'),
    project_id: projectId(input.project_id),
    promotion_goal: choice(input.promotion_goal, ['awareness', 'project_visit', 'download', 'community'], '推广目标'),
    status: choice(input.status, ['draft', 'ready'], '内容状态'),
    account_ids: ids(input.account_ids, 50, '目标账号'), media_ids: ids(input.media_ids, 20, '媒体素材'),
  };
}
