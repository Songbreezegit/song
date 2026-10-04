import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { ThemeContext, type Theme, type ThemeTransitionOrigin } from './ThemeContextDefinition';
import { applyTheme, createThemeTransition, readStoredTheme } from './themeTransition';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  const currentTheme = useRef(theme);
  const transition = useRef<ReturnType<typeof createThemeTransition> | null>(null);

  useLayoutEffect(() => {
    // Restore the saved theme before React's first paint, without an entrance animation.
    applyTheme(currentTheme.current);
    const controller = createThemeTransition();
    transition.current = controller;
    return () => {
      controller.cancel();
      transition.current = null;
    };
  }, []);

  const toggleTheme = (origin?: ThemeTransitionOrigin) => {
    const next = currentTheme.current === 'light' ? 'dark' : 'light';
    transition.current?.toggle(() => {
      // The new snapshot must see the updated React tree, html.dark, and storage together.
      flushSync(() => {
        currentTheme.current = next;
        applyTheme(next);
        setTheme(next);
      });
    }, origin);
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};
