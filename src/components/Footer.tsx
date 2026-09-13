import { ArrowUp } from 'lucide-react';
export function Footer() {
 return <footer className="site-footer"><div className="container footer-inner"><a href="#home" className="footer-brand">SONG ISLE<span>Small things, made with care.</span></a><span>© {new Date().getFullYear()} 松屿</span><a href="#home" className="text-link">Back to top<ArrowUp size={16} /></a></div></footer>;
}

