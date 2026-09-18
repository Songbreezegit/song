import { useEffect } from 'react';
import { LANGUAGE_METAS } from '../i18n/config';
import type { SupportedLanguage } from '../i18n/types';
import type { Article, Project } from '../data/portfolioData';

interface SeoHeadProps {
  language: SupportedLanguage;
  section?: string;
  detailItem?: Article | Project | null;
}

const BASE_URL = 'https://songisle.xyz';

function setMetaTag(name: string, content: string, attribute: 'name' | 'property' = 'name') {
  let el = document.querySelector(`meta[${attribute}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attribute, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLinkTag(rel: string, href: string, hreflang?: string) {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    if (hreflang) el.setAttribute('hreflang', hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

const SECTION_TITLES: Record<SupportedLanguage, Record<string, string>> = {
  zh: {
    home: '松屿 · SONG ISLE — Notes, tools, experiments and things I build.',
    work: '作品集 · 松屿 · SONG ISLE',
    notes: '笔记 · 松屿 · SONG ISLE',
    about: '关于 · 松屿 · SONG ISLE',
    contact: '联系 · 松屿 · SONG ISLE',
  },
  en: {
    home: 'SONG ISLE — Notes, tools, experiments and things I build.',
    work: 'Selected Work · SONG ISLE',
    notes: 'Notes · SONG ISLE',
    about: 'About · SONG ISLE',
    contact: 'Contact · SONG ISLE',
  },
  ja: {
    home: 'SONG ISLE — ノート、ツール、実験、そしてつくるもの。',
    work: '作品集 · SONG ISLE',
    notes: 'ノート · SONG ISLE',
    about: 'About · SONG ISLE',
    contact: 'コンタクト · SONG ISLE',
  },
};

const DEFAULT_DESCRIPTIONS: Record<SupportedLanguage, string> = {
  zh: '松屿 (SONG ISLE) 的个人数字空间。记录有价值的技术笔记、工具使用教程与正在构建的项目。',
  en: 'SONG ISLE — Personal digital space and technical archive of Songyu. Notes, developer tools, experiments, and creative software.',
  ja: 'SONG ISLE — 松屿（Songyu）の個人デジタル空間・技術アーカイブ。開発ノート、便利なツール、実験的ソフトウェアの記録。',
};

export function SeoHead({ language, section = 'home', detailItem }: SeoHeadProps) {
  useEffect(() => {
    const meta = LANGUAGE_METAS[language] || LANGUAGE_METAS.zh;
    document.documentElement.lang = meta.htmlLang;

    const brand = language === 'zh' ? '松屿 · SONG ISLE' : 'SONG ISLE';

    let pageTitle = SECTION_TITLES[language]?.[section] || SECTION_TITLES[language]?.home;
    let pageDesc = DEFAULT_DESCRIPTIONS[language];

    if (detailItem) {
      pageTitle = `${detailItem.title} · ${brand}`;
      if ('description' in detailItem && detailItem.description) {
        pageDesc = detailItem.description;
      } else if ('excerpt' in detailItem && detailItem.excerpt) {
        pageDesc = detailItem.excerpt;
      }
    }

    document.title = pageTitle;

    // Standard meta
    setMetaTag('description', pageDesc);

    // Canonical & Hreflang
    const cleanSection = section && section !== 'home' ? `/${section}` : '';
    const currentUrl = `${BASE_URL}/${language}${cleanSection}`;

    setLinkTag('canonical', currentUrl);
    setLinkTag('alternate', `${BASE_URL}/zh${cleanSection}`, 'zh-CN');
    setLinkTag('alternate', `${BASE_URL}/en${cleanSection}`, 'en');
    setLinkTag('alternate', `${BASE_URL}/ja${cleanSection}`, 'ja');
    setLinkTag('alternate', `${BASE_URL}/en${cleanSection}`, 'x-default');

    // OpenGraph
    setMetaTag('og:title', pageTitle, 'property');
    setMetaTag('og:description', pageDesc, 'property');
    setMetaTag('og:url', currentUrl, 'property');
    setMetaTag('og:type', detailItem ? 'article' : 'website', 'property');
    setMetaTag('og:locale', meta.ogLocale, 'property');
    setMetaTag('og:site_name', brand, 'property');

    // Twitter
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:title', pageTitle);
    setMetaTag('twitter:description', pageDesc);
  }, [language, section, detailItem]);

  return null;
}
