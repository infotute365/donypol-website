import { FileText, ArrowUpRight } from 'lucide-react';
import PageHeader from '@/components/public/PageHeader';
import { getDocuments } from '@/lib/content';
import {readSite} from '@/lib/db';
export const metadata = { title: 'CBSE information' };
export default async function Cbse({ previewContent } = {}){const [{pages},documents]=await Promise.all([previewContent || readSite(),getDocuments()]);return <><PageHeader title={pages.cbse.pageTitle}/><div className="inner-content grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{documents.map((d)=><a key={d._id} href={d.url} target="_blank" rel="noreferrer" className="soft-panel group block transition hover:-translate-y-1 hover:border-[#bc926a]"><span className="clay-icon flex h-14 w-14 items-center justify-center rounded-2xl text-[#8d2a4a]"><FileText size={26}/></span><p className="mt-5 font-display text-xl font-bold text-[#5d2037]">{d.title}</p><p className="mt-2 text-sm text-stone-500">{d.description||pages.cbse.pdfLabel}</p><p className="mt-5 flex items-center gap-2 text-xs font-semibold text-[#a37a51]">{pages.cbse.pdfLabel}<ArrowUpRight size={15}/></p></a>)}</div></>}
