import type { SupportedLanguage } from './types';

// Chinese
import zhCommon from '../locales/zh/common.json';
import zhHome from '../locales/zh/home.json';
import zhWork from '../locales/zh/work.json';
import zhNotes from '../locales/zh/notes.json';
import zhAbout from '../locales/zh/about.json';
import zhContact from '../locales/zh/contact.json';

// English
import enCommon from '../locales/en/common.json';
import enHome from '../locales/en/home.json';
import enWork from '../locales/en/work.json';
import enNotes from '../locales/en/notes.json';
import enAbout from '../locales/en/about.json';
import enContact from '../locales/en/contact.json';

// Japanese
import jaCommon from '../locales/ja/common.json';
import jaHome from '../locales/ja/home.json';
import jaWork from '../locales/ja/work.json';
import jaNotes from '../locales/ja/notes.json';
import jaAbout from '../locales/ja/about.json';
import jaContact from '../locales/ja/contact.json';

export type TranslationDictionary = Record<string, unknown>;

export const DICTIONARIES: Record<SupportedLanguage, TranslationDictionary> = {
  zh: {
    common: zhCommon,
    home: zhHome,
    work: zhWork,
    notes: zhNotes,
    about: zhAbout,
    contact: zhContact,
  },
  en: {
    common: enCommon,
    home: enHome,
    work: enWork,
    notes: enNotes,
    about: enAbout,
    contact: enContact,
  },
  ja: {
    common: jaCommon,
    home: jaHome,
    work: jaWork,
    notes: jaNotes,
    about: jaAbout,
    contact: jaContact,
  },
};
