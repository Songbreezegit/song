import assets from '../data/assets.json';
export type AssetName = keyof typeof assets;
export function Asset({ name, alt = '', className = '', eager = false }: { name: AssetName; alt?: string; className?: string; eager?: boolean }) {
 const asset = assets[name];
 return <img {...asset} alt={alt} className={`asset ${className}`} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager && name.includes('hero') ? 'high' : undefined} />;
}
export function FloatingBadge({ name, className = '' }: { name: AssetName; className?: string }) {
 return <div className={`floating-badge ${className}`} aria-hidden="true"><Asset name={name} /></div>;
}

