import { safeExternalUrl, safeImageUrl, safeMailto } from './safeUrl';

type Rule = (value: unknown, label: string) => void;
type Shape = Record<string, Rule>;
const fail = (label: string, message: string): never => { throw new Error(`${label}${message}`); };
const text = (max: number, required = false): Rule => (value, label) => {
  if (typeof value !== 'string') fail(label, '必须是文本。');
  const string = value as string;
  if (required && !string.trim()) fail(label, '不能为空。');
  if (string.length > max) fail(label, `最多 ${max} 个字符。`);
  if (string.includes('\0')) fail(label, '不能包含空字符。');
};
const oneOf = (values: readonly string[]): Rule => (value, label) => { if (!values.includes(value as string)) fail(label, '取值无效。'); };
const list = (rule: Rule, max = 100): Rule => (value, label) => {
  if (!Array.isArray(value) || value.length > max) fail(label, `必须是最多 ${max} 项的列表。`);
  (value as unknown[]).forEach((item, index) => rule(item, `${label}[${index + 1}]`));
};
const object = (shape: Shape, requiredKeys: string[] = Object.keys(shape)): Rule => (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label, '必须是对象。');
  const record = value as Record<string, unknown>;
  for (const key of requiredKeys) if (!(key in record)) fail(`${label}.${key}`, '不能为空。');
  for (const [key, item] of Object.entries(record)) {
    if (!Object.hasOwn(shape, key)) fail(`${label}.${key}`, '不是支持的字段。');
    shape[key](item, `${label}.${key}`);
  }
};
const url = (image = false): Rule => (value, label) => {
  text(2048)(value, label);
  if ((value as string).trim() && !(image ? safeImageUrl(value) : safeExternalUrl(value))) fail(label, image ? '必须是 HTTP(S) 图片地址或站内绝对路径。' : '必须是 HTTP(S) 地址。');
};
const order: Rule = (value, label) => {
  if (!Number.isInteger(value) || (value as number) < -2147483648 || (value as number) > 2147483647) fail(label, '必须是有效整数。');
};
const boolean: Rule = (value, label) => { if (typeof value !== 'boolean') fail(label, '必须是布尔值。'); };
const timestamp: Rule = (value, label) => { if (value !== null && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) fail(label, '日期无效。'); };
const common: Shape = { title: text(200, true), slug: text(200, true), subtitle: text(500), year: text(20),
  status: oneOf(['draft', 'published', 'archived']), sort_order: order, published_at: timestamp };
const project: Shape = { ...common, category: oneOf(['android', 'web', 'ai', 'tools', 'systems', 'opensource', 'notes']),
  category_label: text(100), featured: boolean, tagline: text(500), description: text(10000), overview: text(50000),
  development_notes: text(50000), tech_stack: list(text(100)), features: list(text(5000)),
  github_url: url(), live_url: url(), cover_image: url(true),
  image_theme: object({ bgColor: text(100), accentColor: text(100), type: oneOf(['mobile', 'browser', 'terminal', 'grid', 'ai', 'photo']) }),
  challenges_solutions: list(object({ challenge: text(5000), solution: text(10000) })) };
const section = object({ heading: text(500), body: list(text(50000)), quote: text(50000),
  code: object({ language: text(100), filename: text(300), snippet: text(100000) }, ['language', 'snippet']),
  table: object({ headers: list(text(500), 50), rows: list(list(text(10000), 50), 200) }),
  callout: object({ type: oneOf(['note', 'tip', 'warning']), text: text(50000) }) }, ['body']);
const article: Shape = { ...common, category: text(100), category_slug: oneOf(['tutorial', 'ai', 'tools', 'development', 'notes']),
  date: text(40), tags: list(text(100)), read_time: text(40), excerpt: text(5000), content: object({ lead: text(50000), sections: list(section, 200) }) };
const email: Rule = (value, label) => { text(254)(value, label); if (value && !safeMailto(value)) fail(label, '邮箱格式无效。'); };
const site: Shape = { site_intro: text(10000), based_in: text(500),
  currently: object({ text: text(5000), building: text(5000), learning: text(5000), exploring: text(5000), date: text(100) }),
  contact: object({ github: url(), x: url(), bilibili: url(), email, githubUser: text(200), xUser: text(200), bilibiliUser: text(200), status: text(1000) }, ['github', 'x', 'bilibili', 'email']),
  about: object({ greeting: text(1000), role: text(1000), bio: text(50000), location: text(500),
    whatIDo: list(object({ title: text(500), desc: text(5000) })), techStack: list(object({ category: text(500), items: list(text(200)) })),
    now: list(object({ label: text(500), value: text(5000) })), path: list(object({ year: text(40), event: text(5000) })) }) };

function validate(input: unknown, shape: Shape, label: string, required: string[] = []): void {
  // Bound aggregate size as well as nested fields; do not strip quotes, SQL,
  // code, or HTML examples from article text. React renders them as text.
  let json: string;
  try { json = JSON.stringify(input); } catch { fail(label, '包含无法保存的数据。'); }
  if (!json! || new TextEncoder().encode(json!).byteLength > 1024 * 1024) fail(label, '不能超过 1 MiB。');
  object(shape, required)(input, label);
}
export const validateProjectInput = (input: unknown, creating = false) => validate(input, project, '项目', creating ? ['title', 'slug'] : []);
export const validateArticleInput = (input: unknown, creating = false) => validate(input, article, '文章', creating ? ['title', 'slug'] : []);
export const validateSiteSettingsInput = (input: unknown) => validate(input, site, '站点设置');
