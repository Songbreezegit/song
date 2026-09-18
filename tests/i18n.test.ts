import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  translateKey,
  detectBrowserLanguage,
  extractLanguageFromPath,
  buildLocalizedPath,
  isSupportedLanguage,
} from '../src/i18n/utils';
import { resolveProject, resolveArticle } from '../src/data/i18nDataResolvers';
import type { Project, Article } from '../src/data/portfolioData';

describe('i18n infrastructure', () => {
  describe('isSupportedLanguage', () => {
    it('recognizes valid supported languages', () => {
      expect(isSupportedLanguage('zh')).toBe(true);
      expect(isSupportedLanguage('en')).toBe(true);
      expect(isSupportedLanguage('ja')).toBe(true);
    });

    it('rejects unsupported languages', () => {
      expect(isSupportedLanguage('fr')).toBe(false);
      expect(isSupportedLanguage('de')).toBe(false);
      expect(isSupportedLanguage('')).toBe(false);
      expect(isSupportedLanguage(null)).toBe(false);
    });
  });

  describe('translateKey', () => {
    it('translates common brand across languages', () => {
      expect(translateKey('common.brand', 'zh')).toBe('松屿 · SONG ISLE');
      expect(translateKey('common.brand', 'en')).toBe('SONG ISLE');
      expect(translateKey('common.brand', 'ja')).toBe('SONG ISLE');
    });

    it('interpolates parameters correctly', () => {
      expect(translateKey('common.copyright', 'zh', { year: 2026 })).toBe('© 2026 松屿');
      expect(translateKey('common.copyright', 'en', { year: 2026 })).toBe('© 2026 Songyu');
    });

    it('resolves without namespace prefix for common keys', () => {
      expect(translateKey('nav.home', 'zh')).toBe('首页');
      expect(translateKey('nav.home', 'en')).toBe('Home');
      expect(translateKey('nav.home', 'ja')).toBe('ホーム');
    });

    it('falls back through fallback chain when key is missing in target language', () => {
      // If a key only exists in zh, requesting in ja or en falls back to zh
      const result = translateKey('home.hero.name', 'ja');
      expect(result).toBe('松屿');
    });
  });

  describe('detectBrowserLanguage', () => {
    const originalNavigator = globalThis.navigator;

    beforeEach(() => {
      vi.stubGlobal('navigator', {
        languages: ['en-US', 'en'],
        language: 'en-US',
      });
    });

    afterEach(() => {
      vi.stubGlobal('navigator', originalNavigator);
    });

    it('detects Chinese language variant', () => {
      vi.stubGlobal('navigator', {
        languages: ['zh-CN', 'zh'],
        language: 'zh-CN',
      });
      expect(detectBrowserLanguage()).toBe('zh');
    });

    it('detects Japanese language variant', () => {
      vi.stubGlobal('navigator', {
        languages: ['ja-JP', 'ja'],
        language: 'ja-JP',
      });
      expect(detectBrowserLanguage()).toBe('ja');
    });

    it('defaults other languages to English', () => {
      vi.stubGlobal('navigator', {
        languages: ['fr-FR', 'fr'],
        language: 'fr-FR',
      });
      expect(detectBrowserLanguage()).toBe('en');
    });
  });

  describe('URL language utilities', () => {
    it('extracts language from supported paths', () => {
      expect(extractLanguageFromPath('/zh/work')).toEqual({
        lang: 'zh',
        rawLangSegment: 'zh',
        restPath: '/work',
      });

      expect(extractLanguageFromPath('/en/notes')).toEqual({
        lang: 'en',
        rawLangSegment: 'en',
        restPath: '/notes',
      });

      expect(extractLanguageFromPath('/ja')).toEqual({
        lang: 'ja',
        rawLangSegment: 'ja',
        restPath: '',
      });
    });

    it('identifies unsupported language segment', () => {
      expect(extractLanguageFromPath('/fr/work')).toEqual({
        lang: null,
        rawLangSegment: 'fr',
        restPath: '/fr/work',
      });
    });

    it('builds localized path while maintaining current subroute', () => {
      expect(buildLocalizedPath('/zh/work', 'en')).toBe('/en/work');
      expect(buildLocalizedPath('/en/about', 'ja')).toBe('/ja/about');
      expect(buildLocalizedPath('/ja/notes', 'zh')).toBe('/zh/notes');
      expect(buildLocalizedPath('/zh/', 'en')).toBe('/en/');
      expect(buildLocalizedPath('/', 'zh')).toBe('/zh/');
    });
  });

  describe('resolveProject', () => {
    const mockProject: Project = {
      id: 'lizhang',
      slug: 'lizhang',
      title: '礼金记账',
      subtitle: '礼金记账',
      category: 'android',
      categoryLabel: 'Android / Compose',
      year: '2024',
      featured: true,
      tagline: '一款专为人情往来定制的应用',
      description: '基于 Jetpack Compose 构建的 Android 记账应用',
      techStack: ['Android', 'Kotlin'],
      githubUrl: 'https://github.com/Songbreezegit/LizhangApp.git',
      imageTheme: { bgColor: '#1E293B', accentColor: '#22C55E', type: 'mobile' },
      overview: '中国传统人情往来频繁',
      features: ['人情双向账本'],
      developmentNotes: '完全基于 Kotlin 开发',
    };

    it('returns original project for zh', () => {
      const resolved = resolveProject(mockProject, 'zh');
      expect(resolved.title).toBe('礼金记账');
    });

    it('returns translated project for en', () => {
      const resolved = resolveProject(mockProject, 'en');
      expect(resolved.title).toBe('LizhangApp');
      expect(resolved.subtitle).toBe('Gift & Cash Tracker');
      expect(resolved.description).toContain('Built with Jetpack Compose');
    });

    it('returns translated project for ja', () => {
      const resolved = resolveProject(mockProject, 'ja');
      expect(resolved.title).toBe('LizhangApp');
      expect(resolved.subtitle).toBe('交際費・祝儀記録');
    });
  });

  describe('resolveArticle fallback behavior', () => {
    const mockArticle: Article = {
      id: 'test-note',
      slug: 'test-note',
      title: '中文测试文章',
      subtitle: '副标题',
      date: '2026.09',
      year: '2026',
      category: '开发思考',
      categorySlug: 'notes',
      tags: ['测试'],
      readTime: '5 min',
      excerpt: '中文摘要',
      content: { lead: '导言', sections: [] },
    };

    it('marks isFallback as false for zh', () => {
      const resolved = resolveArticle(mockArticle, 'zh');
      expect(resolved.isFallback).toBe(false);
      expect(resolved.title).toBe('中文测试文章');
    });

    it('marks isFallback as true when note has only Chinese and viewed in en or ja', () => {
      const resolvedEn = resolveArticle(mockArticle, 'en');
      expect(resolvedEn.isFallback).toBe(true);
      expect(resolvedEn.title).toBe('中文测试文章');

      const resolvedJa = resolveArticle(mockArticle, 'ja');
      expect(resolvedJa.isFallback).toBe(true);
      expect(resolvedJa.title).toBe('中文测试文章');
    });

    it('uses localized article translation when available', () => {
      const articleWithTranslation: Article = {
        ...mockArticle,
        translations: {
          en: {
            title: 'English Test Article',
            excerpt: 'English excerpt',
          },
        },
      };

      const resolved = resolveArticle(articleWithTranslation, 'en');
      expect(resolved.isFallback).toBe(false);
      expect(resolved.title).toBe('English Test Article');
    });
  });
});
