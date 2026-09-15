import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PROJECTS, ARTICLES, PROFILE, ABOUT_DATA, CONTACT_DATA } from '../src/data/portfolioData';

function escapeSqlString(str: string): string {
  if (!str) return "''";
  return `'${str.replace(/'/g, "''")}'`;
}

function escapeSqlArray(arr: string[]): string {
  if (!arr || arr.length === 0) return "'{}'";
  const escapedElements = arr.map(item => `"${item.replace(/"/g, '\\"')}"`).join(',');
  return `'{${escapedElements}}'`;
}

function escapeSqlJson(obj: unknown): string {
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`;
}

let sql = `-- ==============================================================================
-- 松屿 · SONG ISLE Backend V1 Seed Data
-- ==============================================================================

-- 1. Seed Site Settings
insert into public.site_settings (id, site_intro, currently, based_in, contact, about, updated_at)
values (
  'default',
  ${escapeSqlString(PROFILE.siteIntro)},
  ${escapeSqlJson(PROFILE.currently)},
  ${escapeSqlString(PROFILE.basedIn)},
  ${escapeSqlJson(CONTACT_DATA)},
  ${escapeSqlJson(ABOUT_DATA)},
  now()
)
on conflict (id) do update set
  site_intro = excluded.site_intro,
  currently = excluded.currently,
  based_in = excluded.based_in,
  contact = excluded.contact,
  about = excluded.about,
  updated_at = now();

-- 2. Seed Projects
`;

PROJECTS.forEach((p, index) => {
  sql += `insert into public.projects (
  id, slug, title, subtitle, category, category_label, year, featured,
  tagline, description, tech_stack, github_url, live_url, cover_image,
  image_theme, overview, features, development_notes, challenges_solutions,
  status, sort_order, published_at, created_at, updated_at
) values (
  ${escapeSqlString(p.id)},
  ${escapeSqlString(p.slug)},
  ${escapeSqlString(p.title)},
  ${escapeSqlString(p.subtitle)},
  ${escapeSqlString(p.category)},
  ${escapeSqlString(p.categoryLabel)},
  ${escapeSqlString(p.year)},
  ${p.featured ? 'true' : 'false'},
  ${escapeSqlString(p.tagline)},
  ${escapeSqlString(p.description)},
  ${escapeSqlArray(p.techStack)},
  ${escapeSqlString(p.githubUrl)},
  ${escapeSqlString(p.liveUrl || '')},
  ${escapeSqlString(p.coverImage || '')},
  ${escapeSqlJson(p.imageTheme)},
  ${escapeSqlString(p.overview)},
  ${escapeSqlArray(p.features)},
  ${escapeSqlString(p.developmentNotes)},
  ${escapeSqlJson(p.challengesSolutions || [])},
  'published',
  ${index},
  now(),
  now(),
  now()
)
on conflict (slug) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  category = excluded.category,
  category_label = excluded.category_label,
  year = excluded.year,
  featured = excluded.featured,
  tagline = excluded.tagline,
  description = excluded.description,
  tech_stack = excluded.tech_stack,
  github_url = excluded.github_url,
  live_url = excluded.live_url,
  cover_image = excluded.cover_image,
  image_theme = excluded.image_theme,
  overview = excluded.overview,
  features = excluded.features,
  development_notes = excluded.development_notes,
  challenges_solutions = excluded.challenges_solutions,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();

`;
});

sql += `\n-- 3. Seed Articles\n`;

ARTICLES.forEach((a, index) => {
  sql += `insert into public.articles (
  id, slug, title, subtitle, date, year, category, category_slug,
  tags, read_time, excerpt, content, status, sort_order,
  published_at, created_at, updated_at
) values (
  ${escapeSqlString(a.id)},
  ${escapeSqlString(a.slug)},
  ${escapeSqlString(a.title)},
  ${escapeSqlString(a.subtitle)},
  ${escapeSqlString(a.date)},
  ${escapeSqlString(a.year)},
  ${escapeSqlString(a.category)},
  ${escapeSqlString(a.categorySlug)},
  ${escapeSqlArray(a.tags)},
  ${escapeSqlString(a.readTime)},
  ${escapeSqlString(a.excerpt)},
  ${escapeSqlJson(a.content)},
  'published',
  ${index},
  now(),
  now(),
  now()
)
on conflict (slug) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  date = excluded.date,
  year = excluded.year,
  category = excluded.category,
  category_slug = excluded.category_slug,
  tags = excluded.tags,
  read_time = excluded.read_time,
  excerpt = excluded.excerpt,
  content = excluded.content,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();

`;
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(__dirname, '../supabase/seed.sql');
fs.writeFileSync(outputPath, sql, 'utf-8');
console.log('Successfully generated supabase/seed.sql');
