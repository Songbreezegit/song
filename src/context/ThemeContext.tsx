import { useEffect, useState, type ReactNode } from 'react';
import { ThemeContext, type Theme } from './ThemeContextDefinition';
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
 const [theme, setTheme] = useState<Theme>(() => {
  try { const saved = localStorage.getItem('song_theme'); if (saved === 'light' || saved === 'dark') return saved; } catch { /* Private browsing still works. */ }
  return 'light';
 });
 useEffect(() => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try { localStorage.setItem('song_theme', theme); } catch { /* Theme works without persistence. */ }
 }, [theme]);
 return <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light') }}>{children}</ThemeContext.Provider>;
};
