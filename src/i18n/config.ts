import type { SupportedLanguage } from './types';

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['zh', 'en', 'ja'] as const;

export const DEFAULT_LANGUAGE: SupportedLanguage = 'zh';

export const FALLBACK_CHAIN: Record<SupportedLanguage, readonly SupportedLanguage[]> = {
  ja: ['ja', 'en', 'zh'],
  en: ['en', 'zh'],
  zh: ['zh'],
};

export interface LanguageMeta {
  code: SupportedLanguage;
  short: string;
  label: string;
  htmlLang: string;
  ogLocale: string;
}

export const LANGUAGE_METAS: Record<SupportedLanguage, LanguageMeta> = {
  zh: {
    code: 'zh',
    short: '中',
    label: '中文',
    htmlLang: 'zh-CN',
    ogLocale: 'zh_CN',
  },
  en: {
    code: 'en',
    short: 'EN',
    label: 'English',
    htmlLang: 'en',
    ogLocale: 'en_US',
  },
  ja: {
    code: 'ja',
    short: '日',
    label: '日本語',
    htmlLang: 'ja',
    ogLocale: 'ja_JP',
  },
};

export const STORAGE_KEY_LANGUAGE = 'preferred-language';
