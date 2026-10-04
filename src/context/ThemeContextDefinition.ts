import { createContext } from 'react';

export type Theme = 'light' | 'dark';

export type ThemeTransitionOrigin = { x: number; y: number };

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: (origin?: ThemeTransitionOrigin) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
