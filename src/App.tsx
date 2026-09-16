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
import { type Project, type Article } from './data/portfolioData';
import { useProjects } from './hooks/useProjects';
import { useArticles } from './hooks/useArticles';
import { useSiteSettings } from './hooks/useSiteSettings';
import { useLocation, useNavigate } from 'react-router-dom';
import './App.css';

export function App() {
  const [ready, setReady] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  const { projects, loading: projectsLoading, error: projectsError, refresh: refreshProjects } = useProjects();
  const { articles, loading: articlesLoading, error: articlesError, refresh: refreshArticles } = useArticles();
  const { settings, loading: settingsLoading, error: settingsError, refresh: refreshSettings } = useSiteSettings();
  const siteProps = { settings: settingsError ? null : settings, loading: settingsLoading, error: settingsError, onRetry: refreshSettings };
  const route = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(route.search);
  const projectSlug = params.get('project');
  const noteSlug = params.get('note');
  const detailRequested = params.has('project') || params.has('note');
  const isProject = params.has('project');
  const detailLoading = isProject ? projectsLoading : articlesLoading;
  const detailError = isProject ? projectsError : articlesError;
  const detailItem = detailLoading || detailError ? null : isProject
    ? projects.find(p => p.slug === projectSlug) ?? null
    : articles.find(a => a.slug === noteSlug) ?? null;
  const onReady = useCallback(() => setReady(true), []);
  const selectDetail = (item: Project | Article) => {
    const next = new URLSearchParams(route.search);
    next.delete('project'); next.delete('note');
    next.set('content' in item ? 'note' : 'project', item.slug);
    navigate({ search: next.toString(), hash: route.hash });
  };
  const closeDetail = () => {
    const next = new URLSearchParams(route.search);
    next.delete('project'); next.delete('note');
    navigate({ search: next.toString(), hash: route.hash }, { replace: true });
  };

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
          <HeroSection {...siteProps} />
          <WorkSection projects={projects} loading={projectsLoading} error={projectsError} onRetry={refreshProjects} onSelectProject={selectDetail} />
          <NotesSection articles={articles} loading={articlesLoading} error={articlesError} onRetry={refreshArticles} onSelectArticle={selectDetail} />
          <AboutSection {...siteProps} />
          <ContactSection {...siteProps} />
        </main>
        <Footer />
        <DetailModal item={detailRequested ? detailItem : null} pending={detailRequested} loading={detailLoading} error={detailError} onRetry={isProject ? refreshProjects : refreshArticles} onClose={closeDetail} />
      </div>
    </ThemeProvider>
  );
}

export default App;
