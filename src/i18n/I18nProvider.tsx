import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { DEFAULT_LANGUAGE } from './config';
import { I18nContext } from './I18nContextDefinition';
import type { I18nContextType, SupportedLanguage, TranslationParams } from './types';
import { setStoredLanguage, translateKey } from './utils';

export interface I18nProviderProps {
  children: ReactNode;
  language?: SupportedLanguage;
  onLanguageChange?: (lang: SupportedLanguage) => void;
}

export function I18nProvider({
  children,
  language: controlledLanguage,
  onLanguageChange,
}: I18nProviderProps) {
  const [uncontrolledLanguage, setUncontrolledLanguage] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);

  const currentLanguage = controlledLanguage ?? uncontrolledLanguage;

  const setLanguage = useCallback(
    (newLang: SupportedLanguage) => {
      setStoredLanguage(newLang);
      if (onLanguageChange) {
        onLanguageChange(newLang);
      } else {
        setUncontrolledLanguage(newLang);
      }
    },
    [onLanguageChange]
  );

  const t = useCallback(
    (key: string, params?: TranslationParams) => {
      return translateKey(key, currentLanguage, params);
    },
    [currentLanguage]
  );

  const contextValue = useMemo<I18nContextType>(
    () => ({
      language: currentLanguage,
      setLanguage,
      t,
    }),
    [currentLanguage, setLanguage, t]
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}
