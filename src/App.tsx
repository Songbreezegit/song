import { useCallback, useEffect, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/sections/HeroSection';
import { WorkSection } from './components/sections/WorkSection';
import { NotesSection } from './components/sections/NotesSection';
import { AboutSection } from './components/sections/AboutSection';
import { ContactSection } from './components/sections/ContactSection';
import { Footer } from './components/Footer';
import { DetailModal } from './components/DetailModal';
import { SiteLoader } from './components/SiteLoader';
import { PROJECTS, ARTICLES, type Project, type Article } from './data/portfolioData';
import './App.css';
function readDetail() {
 const params = new URLSearchParams(location.search);
 return PROJECTS.find(p => p.slug === params.get('project')) ?? ARTICLES.find(a => a.slug === params.get('note')) ?? null;
}
export function App() {
 const [ready, setReady] = useState(false);
 const [activeSection, setActiveSection] = useState('home');
 const [detailItem, setDetailItem] = useState<Project | Article | null>(readDetail);
 const onReady = useCallback(() => setReady(true), []);
 const selectDetail = (item: Project | Article) => {
  const url = new URL(location.href);
  url.searchParams.delete('project'); url.searchParams.delete('note');
  url.searchParams.set('content' in item ? 'note' : 'project', item.slug);
  history.pushState({ detail: true }, '', url); setDetailItem(item);
 };
 const closeDetail = useCallback(() => {
  if (history.state?.detail) history.back();
  else { const url = new URL(location.href); url.searchParams.delete('project'); url.searchParams.delete('note'); history.replaceState(null, '', url); setDetailItem(null); }
 }, []);
 useEffect(() => { const pop = () => setDetailItem(readDetail()); addEventListener('popstate', pop); return () => removeEventListener('popstate', pop); }, []);
 useEffect(() => {
  const observer = new IntersectionObserver(entries => { for (const e of entries) if (e.isIntersecting) setActiveSection(e.target.id); }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
  document.querySelectorAll('main > section[id]').forEach(el => observer.observe(el));
  return () => observer.disconnect();
 }, []);
 return <ThemeProvider><div className={`site ${ready ? 'is-ready' : 'is-entering'}`}>
  <SiteLoader onReady={onReady} /><a className="skip-link" href="#main">跳至主要内容</a>
  <Navbar activeSection={activeSection} />
  <main id="main"><HeroSection /><WorkSection onSelectProject={selectDetail} /><NotesSection onSelectArticle={selectDetail} /><AboutSection /><ContactSection /></main>
  <Footer /><DetailModal item={detailItem} onClose={closeDetail} />
 </div></ThemeProvider>;
}
export default App;

