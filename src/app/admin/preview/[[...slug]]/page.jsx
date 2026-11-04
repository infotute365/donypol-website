import { redirect, notFound } from 'next/navigation';
import { getAdmin } from '@/lib/auth';
import { PreviewDraft } from '@/lib/models';
import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';
import PreviewBridge from '@/components/admin/PreviewBridge';
import Home from '@/app/(public)/page';
import About from '@/app/(public)/about/page';
import Admission from '@/app/(public)/admission/page';
import Facilities from '@/app/(public)/facilities/page';
import Contact from '@/app/(public)/contact/page';
import Gallery from '@/app/(public)/gallery/page';
import Cbse from '@/app/(public)/cbse-information/page';
import OurPride from '@/app/(public)/our-pride/page';
import Circulars from '@/app/(public)/circulars/page';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Private website preview', robots: { index: false, follow: false } };
const views = { '/': Home, '/about': About, '/admission': Admission, '/facilities': Facilities, '/contact': Contact, '/gallery': Gallery, '/cbse-information': Cbse, '/our-pride': OurPride, '/circulars': Circulars };
export default async function PreviewPage({ params, searchParams }) {
  const admin = await getAdmin(); if (!admin) redirect('/admin/login');
  const { slug = [] } = await params; const query = await searchParams;
  const route = '/' + slug.join('/'); const View = views[route]; if (!View) notFound();
  if (typeof query.draft !== 'string' || !/^[a-f\d]{24}$/i.test(query.draft)) notFound();
  const draft = await PreviewDraft.findOne({ _id: query.draft, adminId: String(admin._id), expiresAt: { $gt: new Date() } }).lean();
  if (!draft) return <div className="soft-panel m-6"><h1 className="font-display text-2xl font-bold">Preview expired</h1><p className="mt-3">Return to the website editor and refresh the preview.</p></div>;
  const d = draft.content;
  const pageQuery = { ...query }; delete pageQuery.draft; delete pageQuery.v;
  return <><PreviewBridge draft={String(draft._id)} path={route}/><Navbar school={d.school} nav={d.pages.navigation} logo={d.pages.images.logo}/><main><View previewContent={d} searchParams={Promise.resolve(pageQuery)}/></main><Footer s={d.school} logo={d.pages.images.logo}/></>;
}
