import { useEffect, useRef, useState } from 'react';
import { Menu, X, Moon, Sun } from 'lucide-react';
import { Asset } from './Asset';
import { useTheme } from '../context/useTheme';
const sections = ['Home', 'Work', 'Notes', 'About', 'Contact'];
export function Navbar({ activeSection }: { activeSection: string }) {
 const [scrolled, setScrolled] = useState(false);
 const [open, setOpen] = useState(false);
 const toggle = useRef<HTMLButtonElement>(null);
 const { theme, toggleTheme } = useTheme();
 useEffect(() => { const scroll = () => setScrolled(scrollY > 12); scroll(); addEventListener('scroll', scroll, { passive: true }); return () => removeEventListener('scroll', scroll); }, []);
 useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) { setOpen(false); toggle.current?.focus(); } }; addEventListener('keydown', key); return () => removeEventListener('keydown', key); }, [open]);
 return <header className={`site-header ${scrolled || open ? 'scrolled' : ''}`}><div className="container header-inner">
  <a href="#home" className="brand" aria-label="松屿，返回首页" onClick={() => setOpen(false)}><Asset name="home-logo-wordmark" eager /></a>
  <nav id="main-nav" aria-label="主导航" className={open ? 'nav-open' : ''}>{sections.map(label => <a key={label} href={`#${label.toLowerCase()}`} aria-current={activeSection === label.toLowerCase() ? 'location' : undefined} onClick={() => setOpen(false)}>{label}</a>)}</nav>
  <div className="header-actions"><button className="icon-button" onClick={toggleTheme} aria-label={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button><a className="header-note" href="#about">Stay Curious.</a><button ref={toggle} className="icon-button menu-toggle" aria-label={open ? '关闭菜单' : '打开菜单'} aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen(!open)}>{open ? <X size={23} /> : <Menu size={23} />}</button></div>
 </div></header>;
}

