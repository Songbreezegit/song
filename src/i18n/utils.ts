import {
  DEFAULT_LANGUAGE,
  FALLBACK_CHAIN,
  STORAGE_KEY_LANGUAGE,
  SUPPORTED_LANGUAGES,
} from './config';
import { DICTIONARIES } from './dictionaries';
import type { SupportedLanguage, TranslationParams } from './types';

export function isSupportedLanguage(val: unknown): val is SupportedLanguage {
  return typeof val === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(val);
}

export function detectBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  const browserLangs = navigator.languages || [navigator.language];
  for (const lang of browserLangs) {
    if (!lang) continue;
    const lower = lang.toLowerCase();
    if (lower.startsWith('zh')) return 'zh';
    if (lower.startsWith('ja')) return 'ja';
    if (lower.startsWith('en')) return 'en';
  }

  return 'en';
}

export function getStoredLanguage(): SupportedLanguage | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_LANGUAGE);
    if (isSupportedLanguage(stored)) return stored;
  } catch {
    // Ignore storage errors in private browsing
  }
  return null;
}

export function setStoredLanguage(lang: SupportedLanguage): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_LANGUAGE, lang);
  } catch {
    // Ignore storage errors
  }
}

function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

const KNOWN_NAMESPACES = ['common', 'home', 'work', 'notes', 'about', 'contact'] as const;

export function lookupTranslation(
  key: string,
  lang: SupportedLanguage
): { value: unknown; sourceLang: SupportedLanguage } | null {
  const dict = DICTIONARIES[lang];
  if (!dict) return null;

  // 1. Direct path lookup in dict (e.g. "home.hero.title")
  let val = getNestedValue(dict, key);
  if (val !== undefined) {
    return { value: val, sourceLang: lang };
  }

  // 2. Check within namespaces if key didn't include namespace (e.g. "nav.home" -> "common.nav.home")
  for (const ns of KNOWN_NAMESPACES) {
    const nsObj = dict[ns];
    if (nsObj && typeof nsObj === 'object') {
      val = getNestedValue(nsObj, key);
      if (val !== undefined) {
        return { value: val, sourceLang: lang };
      }
    }
  }

  return null;
}

export function translateKey(
  key: string,
  lang: SupportedLanguage,
  params?: TranslationParams
): string {
  const chain = FALLBACK_CHAIN[lang] || [lang, DEFAULT_LANGUAGE];
  let found: { value: unknown; sourceLang: SupportedLanguage } | null = null;

  for (const candidateLang of chain) {
    const res = lookupTranslation(key, candidateLang);
    if (res && res.value !== undefined && res.value !== null) {
      found = res;
      break;
    }
  }

  if (!found) {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] Missing translation key: "${key}" for language "${lang}"`);
    }
    return import.meta.env.DEV ? key : '';
  }

  if (found.sourceLang !== lang && import.meta.env.DEV) {
    console.warn(`[i18n] Translation fallback: "${key}" used from "${found.sourceLang}" for "${lang}"`);
  }

  let text = typeof found.value === 'string' ? found.value : String(found.value);

  if (params) {
    for (const [pKey, pVal] of Object.entries(params)) {
      text = text.replaceAll(`{${pKey}}`, String(pVal));
    }
  }

  return text;
}

export function extractLanguageFromPath(pathname: string): {
  lang: SupportedLanguage | null;
  rawLangSegment: string | null;
  restPath: string;
} {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return { lang: null, rawLangSegment: null, restPath: '/' };
  }

  const first = segments[0];
  const rest = '/' + segments.slice(1).join('/');

  if (isSupportedLanguage(first)) {
    return { lang: first, rawLangSegment: first, restPath: rest === '/' ? '' : rest };
  }

  return { lang: null, rawLangSegment: first, restPath: pathname };
}

export function buildLocalizedPath(
  currentPath: string,
  targetLang: SupportedLanguage
): string {
  const { restPath } = extractLanguageFromPath(currentPath);
  const cleanRest = restPath === '/' ? '' : restPath;
  return `/${targetLang}${cleanRest ? (cleanRest.startsWith('/') ? cleanRest : '/' + cleanRest) : '/'}`;
}
