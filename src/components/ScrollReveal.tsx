import type { ReactNode } from 'react';
import { useScrollReveal } from '../hooks/useScrollReveal';
export function ScrollReveal({ children, className = '', delayMs = 0, threshold = .08 }: { children: ReactNode; className?: string; delayMs?: number; threshold?: number }) {
 const { ref, isVisible } = useScrollReveal({ threshold });
 return <div ref={ref} className={`reveal ${isVisible ? 'is-visible' : ''} ${className}`} style={{ transitionDelay: `${delayMs}ms` }}>{children}</div>;
}

