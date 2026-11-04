import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPride } from '@/lib/pride';
import { readSite } from '@/lib/db';
import PrideCard from '@/components/public/PrideCard';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ searchParams }) {
  const { page } = await searchParams;
  return { title: `Our Pride${/^\d+$/.test(page || '') && Number(page) > 1 ? ` — Page ${page}` : ''}`, description: 'Celebrating the students and achievements of Donyi Polo Vidya Niketan, Pasighat.' };
}
export default async function OurPride({ searchParams, previewContent }) {
  const query = await searchParams;
  const [result, site] = await Promise.all([getPride({ page: query.page }), previewContent || readSite()]);
  if (!previewContent && query.page !== undefined && query.page !== String(result.page)) redirect(`/our-pride?page=${result.page}`);
  const start = Math.max(1, Math.min(result.page - 2, result.pages - 4));
  const numbers = Array.from({ length: Math.min(5, result.pages) }, (_, i) => start + i);
  return <div className="inner-content">
    <p className="eyebrow">Celebrating our students</p><h1 className="section-title mt-3">{site.pages.home.prideHeading}</h1><p className="mt-4 text-[#6c6160]">{site.school.pride}</p>
    <p className="mt-6 text-sm text-[#75605b]">Page {result.page} of {result.pages} · {result.total} {result.total === 1 ? 'achievement' : 'achievements'}{result.total > 0 && ` · Showing ${(result.page - 1) * 9 + 1}–${Math.min(result.page * 9, result.total)}`}</p>
    {result.items.length ? <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{result.items.map((student) => <PrideCard key={student._id} student={student} />)}</div> : <p className="soft-panel mt-8">Student achievements will appear here when published.</p>}
    <nav aria-label="Our Pride pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {result.page > 1 ? <Link className="pride-page" href={`/our-pride?page=${result.page - 1}`} rel="prev">Previous</Link> : <span className="pride-page opacity-40" aria-disabled="true">Previous</span>}
      {numbers.map((page) => <Link className={`pride-page ${page === result.page ? 'pride-page-current' : ''}`} key={page} aria-label={`Page ${page}`} aria-current={page === result.page ? 'page' : undefined} href={`/our-pride?page=${page}`}>{page}</Link>)}
      {result.page < result.pages ? <Link className="pride-page" href={`/our-pride?page=${result.page + 1}`} rel="next">Next</Link> : <span className="pride-page opacity-40" aria-disabled="true">Next</span>}
    </nav>
  </div>;
}
