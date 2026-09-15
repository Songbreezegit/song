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
import { useProjects } from './hooks/useProjects';
import { useArticles } from './hooks/useArticles';
import './App.css';

function readDetailFrom(projects: Project[], articles: Article[]) {
  const params = new URLSearchParams(location.search);
  const projectSlug = params.get('project');
  const noteSlug = params.get('note');

  if (projectSlug) {
    return (
      projects.find((p) => p.slug === projectSlug) ??
      PROJECTS.find((p) => p.slug === projectSlug) ??
      null
    );
  }
  if (noteSlug) {
    return (
      articles.find((a) => a.slug === noteSlug) ??
      ARTICLES.find((a) => a.slug === noteSlug) ??
      null
    );
  }
  return null;
}

export function App() {
  const [ready, setReady] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  const { projects } = useProjects();
  const { articles } = useArticles();

  const activeProjects = projects.length > 0 ? projects : PROJECTS;
  const activeArticles = articles.length > 0 ? articles : ARTICLES;

  const [selectedDetail, setSelectedDetail] = useState<Project | Article | null>(null);
  const detailItem = selectedDetail ?? readDetailFrom(activeProjects, activeArticles);

  const onReady = useCallback(() => setReady(true), []);

  const selectDetail = (item: Project | Article) => {
    const url = new URL(location.href);
    url.searchParams.delete('project');
    url.searchParams.delete('note');
    url.searchParams.set('content' in item ? 'note' : 'project', item.slug);
    history.pushState({ detail: true }, '', url);
    setSelectedDetail(item);
  };

  const closeDetail = useCallback(() => {
    if (history.state?.detail) {
      history.back();
    } else {
      const url = new URL(location.href);
      url.searchParams.delete('project');
      url.searchParams.delete('note');
      history.replaceState(null, '', url);
      setSelectedDetail(null);
    }
  }, []);

  useEffect(() => {
    const pop = () => setSelectedDetail(readDetailFrom(activeProjects, activeArticles));
    addEventListener('popstate', pop);
    return () => removeEventListener('popstate', pop);
  }, [activeProjects, activeArticles]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveSection(e.target.id);
        }
      },
      { rootMargin: '-15% 0px -65% 0px', threshold: 0 }
    );
    document.querySelectorAll('main > section[id]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <ThemeProvider>
      <div className={`site ${ready ? 'is-ready' : 'is-entering'}`}>
        <SiteLoader onReady={onReady} />
        <a className="skip-link" href="#main">
          跳至主要内容
        </a>
        <Navbar activeSection={activeSection} />
        <main id="main">
          <HeroSection />
          <WorkSection projects={activeProjects} onSelectProject={selectDetail} />
          <NotesSection articles={activeArticles} onSelectArticle={selectDetail} />
          <AboutSection />
          <ContactSection />
        </main>
        <Footer />
        <DetailModal item={detailItem} onClose={closeDetail} />
      </div>
    </ThemeProvider>
  );
}

export default App;
