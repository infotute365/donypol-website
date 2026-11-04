import PageHeader from '@/components/public/PageHeader';
import PhotoGrid from '@/components/public/PhotoGrid';
import {readSite} from '@/lib/db';
export const metadata={title:'Facilities'};
export default async function Facilities({ previewContent } = {}){const {pages}=previewContent || await readSite();return <><PageHeader title={pages.facilities.pageTitle}/><div className="inner-content space-y-14">{pages.facilities.sections.map((x,i)=><section key={i}><h2 className="mb-5 font-display text-2xl font-bold text-[#5c2137]">{x.title}</h2><PhotoGrid images={x.images} cols="sm:grid-cols-3"/></section>)}</div></>}
