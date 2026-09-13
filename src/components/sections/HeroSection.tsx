import { MapPin } from 'lucide-react';
import { Asset, FloatingBadge } from '../Asset';
import { CTAButton } from '../CTAButton';
import { PROFILE } from '../../data/portfolioData';
import { usePointerShift } from '../../hooks/usePointerShift';
export function HeroSection() {
 const pointer = usePointerShift({ maxOffset: 4, dampening: .018 });
 return <section id="home" className="home-section"><div className="container home-grid">
  <div className="hero-copy"><p className="eyebrow">Hi, I'm Songyu.</p>
   <h1><span className="hero-name">松屿</span><span>builds</span><span className="hero-last">useful things.</span></h1>
   <p className="hero-role">Builder / Developer / Learner / Creator</p><p className="hero-description">{PROFILE.siteIntro}</p>
   <div className="cta-row"><CTAButton href="#work">View Work</CTAButton><CTAButton href="#contact" secondary>Let's Talk</CTAButton></div>
   <div className="hero-meta"><div><span>Currently</span><p>{PROFILE.currently.text}</p></div><div><span>Based in</span><p><MapPin size={14} />{PROFILE.basedIn}</p></div></div>
  </div>
  <div className="hero-art" onMouseMove={pointer.handleMouseMove} onMouseLeave={pointer.handleMouseLeave}>
   <Asset name="home-background-grid" className="hero-grid-texture" eager />
   <div className="hero-person" style={pointer.style}><Asset name="home-hero-illustration" alt="松屿与猫坐在写着 Good Ideas Build A Brighter Web 的方台上" eager /></div>
   <FloatingBadge name="home-badge-now-building" className="home-building" /><FloatingBadge name="home-badge-open-source" className="home-open-source" />
  </div>
  <a href="#work" className="home-scroll" aria-label="向下探索作品"><Asset name="home-scroll-indicator" className="scroll-letter" eager /><Asset name="home-scroll-indicator" className="scroll-arrow" eager /></a>
 </div><Asset name="home-decoration-leaves" className="home-leaves" /></section>;
}


