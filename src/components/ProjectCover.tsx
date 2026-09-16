import { useState, type CSSProperties } from 'react';
import { Sprout } from 'lucide-react';
import './ProjectCover.css';

export interface ProjectCoverProps {
 src?: string | null;
 alt: string;
 fit?: 'cover' | 'contain';
 position?: CSSProperties['objectPosition'];
 blend?: 'soft' | 'none';
}

export function ProjectCover(props: ProjectCoverProps) {
 // Reset loading/error state when the source changes, without an effect.
 return <CoverImage key={props.src ?? ''} {...props} />;
}

function CoverImage({ src, alt, fit = 'cover', position = 'center', blend = 'soft' }: ProjectCoverProps) {
 const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
 const hasImage = Boolean(src?.trim()) && status !== 'error';
 const ready = hasImage && status === 'loaded';

 return <div className="project-cover" data-state={hasImage ? status : 'fallback'} data-fit={fit} data-blend={blend}>
  <div className="project-cover-placeholder" role={hasImage ? undefined : 'img'} aria-label={hasImage ? undefined : `${alt}：暂无封面`} aria-hidden={hasImage ? true : undefined}>
   <Sprout aria-hidden="true" />
  </div>
  {ready ? <img className="project-cover-background" src={src!} alt="" aria-hidden="true" decoding="async" style={{ objectPosition: position }} /> : null}
  <div className="project-cover-overlay" aria-hidden="true" />
  {hasImage ? <div className="project-cover-foreground">
   <img className="project-cover-main" src={src!} alt={alt} loading="lazy" decoding="async" style={{ objectPosition: position }} onLoad={() => setStatus('loaded')} onError={() => setStatus('error')} />
  </div> : null}
 </div>;
}
