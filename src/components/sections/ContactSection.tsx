import { useState } from 'react';
import { ArrowUpRight, Copy, Check } from 'lucide-react';
import { CONTACT_DATA } from '../../data/portfolioData';
import { Asset, FloatingBadge, type AssetName } from '../Asset';
import { CTAButton } from '../CTAButton';
import { ScrollReveal } from '../ScrollReveal';
const socials: { label: string; user: string; href: string; icon: AssetName }[] = [
 { label: 'GitHub', user: CONTACT_DATA.githubUser, href: CONTACT_DATA.github, icon: 'contact-icon-github' },
 { label: 'X / Twitter', user: CONTACT_DATA.xUser, href: CONTACT_DATA.x, icon: 'contact-icon-x' },
 { label: 'Bilibili', user: CONTACT_DATA.bilibiliUser, href: CONTACT_DATA.bilibili, icon: 'contact-icon-bilibili' }
];
export function ContactSection() {
 const [copy, setCopy] = useState('');
 const copyEmail = async () => { try { await navigator.clipboard.writeText(CONTACT_DATA.email); setCopy('邮箱已复制'); } catch { setCopy('未能复制，请选中下方邮箱地址手动复制'); } };
 return <section id="contact" className="section contact-section"><div className="container">
  <div className="contact-top"><ScrollReveal className="contact-copy"><p className="eyebrow">04 / Good ideas start with hello</p><h2>let's<br /><span className="sage-text">talk</span><br />next.</h2><p className="section-intro">如果你也对有趣的想法、产品、开源项目感兴趣，<br />欢迎来聊聊，一起创造一些有用的东西。</p><div className="cta-row"><CTAButton href={`mailto:${CONTACT_DATA.email}`}>Send Email</CTAButton><CTAButton href={CONTACT_DATA.github} external secondary>View GitHub</CTAButton></div></ScrollReveal><ScrollReveal className="contact-illustration"><Asset name="contact-hero-illustration" alt="松屿端着咖啡坐在桌边，等待新的想法与交流" /><FloatingBadge name="contact-badge-open-for-ideas" /></ScrollReveal></div>
  <div className="contact-links"><div className="email-link"><Asset name="about-icon-envelope" /><div><span className="small-label">DROP ME A LINE</span><a href={`mailto:${CONTACT_DATA.email}`}>{CONTACT_DATA.email}</a></div><button className="icon-button" onClick={copyEmail} aria-label="复制邮箱">{copy === '邮箱已复制' ? <Check size={18} /> : <Copy size={18} />}</button><span className="copy-status" role="status">{copy}</span></div><div className="socials">{socials.map(s => <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="social-link"><Asset name={s.icon} /><span><strong>{s.label}</strong><small>{s.user}</small></span><ArrowUpRight size={18} /></a>)}</div></div>
  <div className="contact-signoff"><Asset name="contact-icon-message" /><p>See you on the internet.<span>{CONTACT_DATA.status}</span></p><Asset name="contact-icon-link" /></div>
 </div></section>;
}


