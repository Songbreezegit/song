import { ABOUT_DATA, PROFILE } from '../../data/portfolioData';
import { Asset, FloatingBadge } from '../Asset';
import { ScrollReveal } from '../ScrollReveal';
export function AboutSection() {
 return <section id="about" className="section about-section"><div className="container">
  <div className="about-top"><ScrollReveal className="about-title"><p className="eyebrow">03 / The person behind the pixels</p><h2>about<br />this <span className="sage-text">builder.</span></h2><p className="section-intro">{ABOUT_DATA.greeting}。<br />在学习、创造与分享中，持续成长。</p><p className="small-label">{ABOUT_DATA.role}</p></ScrollReveal><ScrollReveal className="about-illustration"><Asset name="about-hero-illustration" alt="松屿坐在沙发上使用笔记本电脑，身旁是猫和植物" /><FloatingBadge name="about-badge-curious-human" /></ScrollReveal></div>
  <div className="about-grid"><ScrollReveal className="about-bio"><Asset name="about-icon-sprout" /><div><p className="eyebrow">Who I am</p><h3>把朴素的功能，做精致。</h3><p>{ABOUT_DATA.bio}</p><span className="small-label">{ABOUT_DATA.location}</span></div></ScrollReveal>
   <ScrollReveal className="about-now"><Asset name="about-icon-spark" /><p className="eyebrow">What I'm learning</p><h3>Still a work in progress.</h3>{ABOUT_DATA.now.slice(0,2).map(n => <p key={n.label}><strong>{n.label}</strong><br />{n.value}</p>)}</ScrollReveal>
   <ScrollReveal className="about-build"><Asset name="about-icon-code" /><p className="eyebrow">What I build</p>{ABOUT_DATA.whatIDo.map(item => <div key={item.title}><h4>{item.title}</h4><p>{item.desc}</p></div>)}</ScrollReveal>
   <ScrollReveal className="about-life"><Asset name="about-icon-mountain" /><p className="eyebrow">Away from the keyboard</p><h3>Code. Coffee.<br />A little everyday life.</h3><p>{ABOUT_DATA.now[2]!.value}。</p><p className="small-label">{PROFILE.basedIn}</p></ScrollReveal>
  </div>
  <details className="about-details"><summary>More about me / 技术、工具与一路走来的记录</summary><div className="about-details-grid"><div><h3>My toolkit</h3>{ABOUT_DATA.techStack.map(g => <p key={g.category}><strong>{g.category}</strong><br />{g.items.join(' / ')}</p>)}</div><div><h3>My path</h3>{ABOUT_DATA.path.map(s => <p key={s.year}><strong>{s.year}</strong> {s.event}</p>)}</div></div></details>
  <Asset name="about-divider-nice-to-meet-you" className="section-divider" alt="Nice to meet you!" />
 </div></section>;
}


