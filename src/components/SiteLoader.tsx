import { useEffect, useState } from 'react';
import { Asset } from './Asset';
import assets from '../data/assets.json';
export function SiteLoader({ onReady }: { onReady: () => void }) {
 const [phase, setPhase] = useState('enter');
 useEffect(() => {
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const delay = (ms: number) => new Promise<void>(resolve => timers.push(setTimeout(resolve, ms)));
  let seen = false;
  try { seen = sessionStorage.getItem('song-isle-intro') === 'seen'; } catch { /* Storage may be disabled. */ }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const critical = ['home-hero-illustration', 'home-logo-wordmark'] as const;
  const load = critical.map(name => new Promise<void>(resolve => {
   const img = new Image();
   img.onload = () => { img.decode().catch(() => {}).then(resolve); };
   img.onerror = () => resolve(); img.src = assets[name].src;
  }));
  const started = performance.now();
  Promise.race([Promise.all([...load, document.fonts.ready]), delay(2400)]).then(async () => {
   const min = reduced ? 120 : seen ? 280 : 850;
   await delay(Math.max(0, min - (performance.now() - started)));
   if (cancelled) return;
   onReady(); setPhase('exit');
   try { sessionStorage.setItem('song-isle-intro', 'seen'); } catch { /* No storage required. */ }
   await delay(reduced ? 120 : 320);
   if (!cancelled) setPhase('done');
  });
  return () => { cancelled = true; timers.forEach(clearTimeout); };
 }, [onReady]);
 if (phase === 'done') return null;
 return <div className={`site-loader loader-${phase}`} role="status" aria-label="松屿正在浮现">
  <div className="loader-mark"><Asset name="home-logo-wordmark" alt="松屿 SONG ISLE" eager />
   <svg className="loader-orbit" viewBox="0 0 180 60" aria-hidden="true"><path d="M 20 42 C 44 4, 153 1, 163 24 C 176 49, 66 66, 31 44" /><circle r="4" cx="0" cy="0" /></svg>
   <Asset name="about-icon-sprout" className="loader-leaf" eager />
  </div>
 </div>;
}


