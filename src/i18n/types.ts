export type SupportedLanguage = 'zh' | 'en' | 'ja';

export type TranslationParams = Record<string, string | number>;

export interface I18nContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, params?: TranslationParams) => string;
}
