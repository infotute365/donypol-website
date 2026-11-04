export const EDITOR_SECTIONS = [
  { id: 'home', label: 'Home page', route: '/', path: ['pages', 'home'] },
  { id: 'about', label: 'About page', route: '/about', path: ['pages', 'about'] },
  { id: 'admission', label: 'Admission page', route: '/admission', path: ['pages', 'admission'] },
  { id: 'facilities', label: 'Facilities page', route: '/facilities', path: ['pages', 'facilities'] },
  { id: 'gallery', label: 'Gallery page', route: '/gallery', path: ['pages', 'gallery'] },
  { id: 'cbse', label: 'CBSE information page', route: '/cbse-information', path: ['pages', 'cbse'] },
  { id: 'contact', label: 'Contact page', route: '/contact', path: ['pages', 'contact'] },
  { id: 'school', label: 'School information', route: '/', path: ['school'] },
  { id: 'principal', label: 'Principal’s message', route: '/', path: ['principal'] },
  { id: 'stats', label: 'School statistics', route: '/', path: ['stats'] },
  { id: 'notices', label: 'Homepage notices', route: '/', path: ['notices'] },
  { id: 'navigation', label: 'Website navigation', route: '/', path: ['pages', 'navigation'] },
  { id: 'images', label: 'Shared school images', route: '/', path: ['pages', 'images'] },
];
export const PREVIEW_PAGES = [
  ...EDITOR_SECTIONS.slice(0, 7).map(({ label, route }) => ({ label, route })),
  { label: 'Our Pride', route: '/our-pride' }, { label: 'Circulars', route: '/circulars' },
];
export function withSiteDefaults(value) {
  if (!value?.pages?.images) return value;
  return { ...value, pages: { ...value.pages, images: { ...value.pages.images, heroBackground: value.pages.images.heroBackground || value.pages.images.schoolGate } } };
}
export function isEditorImage(value) {
  return typeof value === 'string' && (/\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(value) || value.startsWith('/upload/') || value.startsWith('/api/media/image?'));
}
export function imageFileName(value) {
  try {
    const url = new URL(value, 'https://school.invalid');
    return decodeURIComponent(url.searchParams.get('file') || url.pathname.split('/').pop()) || 'School image';
  } catch { return 'School image'; }
}
export function previewUrl(route, draft, version = '') {
  const parsed = new URL(route, 'https://school.invalid');
  if (!PREVIEW_PAGES.some((page) => page.route === parsed.pathname)) return '';
  const query = new URLSearchParams(parsed.search);
  query.set('draft', draft); if (version) query.set('v', String(version));
  return `/admin/preview${parsed.pathname === '/' ? '' : parsed.pathname}?${query}`;
}
