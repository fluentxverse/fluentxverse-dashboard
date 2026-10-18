export type AdminArtName = 'home' | 'community' | 'training' | 'schedule' | 'growth' | 'pay';

export function AdminArt({ name, className = '' }: { name: AdminArtName; className?: string }) {
  return <img className={`admin-art ${className}`} src={`/assets/img/home-icons/${name}-v1.webp`} alt="" width="40" height="40" />;
}
