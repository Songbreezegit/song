import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
export function CTAButton({ href, children, secondary = false, external = false }: { href: string; children: ReactNode; secondary?: boolean; external?: boolean }) {
 return <a className={`cta ${secondary ? 'cta-secondary' : ''}`} href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>{children}<ArrowRight size={17} aria-hidden="true" /></a>;
}

