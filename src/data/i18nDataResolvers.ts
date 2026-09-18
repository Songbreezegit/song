import type { SupportedLanguage } from '../i18n/types';
import type { Project, Article } from './portfolioData';
import { PROJECT_TRANSLATIONS } from './projectTranslations';

export function resolveProject(project: Project, lang: SupportedLanguage): Project {
  if (lang === 'zh') return project;

  const translation = PROJECT_TRANSLATIONS[project.slug] || PROJECT_TRANSLATIONS[project.id];
  if (!translation) return project;

  const target = translation[lang] || (lang === 'ja' ? translation.en : undefined);
  if (!target) return project;

  return {
    ...project,
    title: target.title || project.title,
    subtitle: target.subtitle || project.subtitle,
    tagline: target.tagline || project.tagline,
    categoryLabel: target.categoryLabel || project.categoryLabel,
    description: target.description || project.description,
    overview: target.overview || project.overview,
    features: target.features || project.features,
    developmentNotes: target.developmentNotes || project.developmentNotes,
    challengesSolutions: target.challengesSolutions || project.challengesSolutions,
  };
}

export function resolveArticle(article: Article, lang: SupportedLanguage): Article & { isFallback: boolean } {
  if (article.lang === lang || lang === 'zh') {
    return { ...article, isFallback: false };
  }

  if (article.translations) {
    const direct = article.translations[lang];
    if (direct) {
      return {
        ...article,
        ...direct,
        content: direct.content || article.content,
        isFallback: false,
      };
    }
    if (lang === 'ja' && article.translations.en) {
      const enTrans = article.translations.en;
      return {
        ...article,
        ...enTrans,
        content: enTrans.content || article.content,
        isFallback: false,
      };
    }
  }

  return {
    ...article,
    isFallback: true,
  };
}
