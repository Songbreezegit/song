import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/useTheme';

export function AdminThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = theme === 'dark' ? '切换到浅色模式' : '切换到深色模式';
  return <button type="button" className="admin-theme-toggle" title={label} aria-label={label}
    aria-pressed={theme === 'dark'} onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      toggleTheme({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }}>
    <span className={theme === 'light' ? 'is-active' : ''}><Sun size={16} aria-hidden="true" /></span>
    <span className={theme === 'dark' ? 'is-active' : ''}><Moon size={16} aria-hidden="true" /></span>
  </button>;
}
