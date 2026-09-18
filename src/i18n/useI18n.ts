import { useContext } from 'react';
import { I18nContext } from './I18nContextDefinition';
import type { I18nContextType } from './types';

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
