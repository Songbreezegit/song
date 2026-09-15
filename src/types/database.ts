import type { Article, Project } from '../data/portfolioData';

export type ContentStatus = 'draft' | 'published' | 'archived';

export interface ProjectRecord {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: Project['category'];
  category_label: string;
  year: string;
  featured: boolean;
  tagline: string;
  description: string;
  tech_stack: string[];
  github_url: string;
  live_url: string;
  cover_image: string;
  image_theme: Project['imageTheme'];
  overview: string;
  features: string[];
  development_notes: string;
  challenges_solutions: { challenge: string; solution: string }[];
  status: ContentStatus;
  sort_order: number;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArticleRecord {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  date: string;
  year: string;
  category: string;
  category_slug: Article['categorySlug'];
  tags: string[];
  read_time: string;
  excerpt: string;
  content: Article['content'];
  status: ContentStatus;
  sort_order: number;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteSettingsRecord {
  id: string;
  site_intro: string;
  currently: {
    text: string;
    building: string;
    learning: string;
    exploring: string;
    date: string;
  };
  based_in: string;
  contact: {
    github: string;
    x: string;
    email: string;
    bilibili: string;
    githubUser?: string;
    xUser?: string;
    bilibiliUser?: string;
    status?: string;
  };
  about: {
    greeting: string;
    role: string;
    bio: string;
    location: string;
    whatIDo: { title: string; desc: string }[];
    techStack: { category: string; items: string[] }[];
    now: { label: string; value: string }[];
    path: { year: string; event: string }[];
  };
  updated_at: string;
}

export function projectRecordToUiModel(record: ProjectRecord): Project {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    subtitle: record.subtitle,
    category: record.category,
    categoryLabel: record.category_label,
    year: record.year,
    featured: record.featured,
    tagline: record.tagline,
    description: record.description,
    techStack: record.tech_stack || [],
    githubUrl: record.github_url,
    liveUrl: record.live_url || '',
    coverImage: record.cover_image || undefined,
    imageTheme: record.image_theme || {
      bgColor: '#0F172A',
      accentColor: '#38BDF8',
      type: 'browser',
    },
    overview: record.overview,
    features: record.features || [],
    developmentNotes: record.development_notes,
    challengesSolutions: record.challenges_solutions || [],
  };
}

export function articleRecordToUiModel(record: ArticleRecord): Article {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    subtitle: record.subtitle,
    date: record.date,
    year: record.year,
    category: record.category,
    categorySlug: record.category_slug,
    tags: record.tags || [],
    readTime: record.read_time,
    excerpt: record.excerpt,
    content: record.content || { lead: '', sections: [] },
  };
}
