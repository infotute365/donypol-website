import Dashboard from '@/components/admin/Dashboard';
import { getDocuments, getGalleries, getCirculars } from '@/lib/content';
import { readSiteWithRevision } from '@/lib/db';
export const metadata = { title: 'Admin dashboard', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function DashboardPage() {
  const [site, galleries, documents, circulars] = await Promise.all([readSiteWithRevision(),getGalleries(1,200),getDocuments(),getCirculars()]);
  return <Dashboard initial={{ ...site, galleries:galleries.items, documents, circulars }} />;
}
