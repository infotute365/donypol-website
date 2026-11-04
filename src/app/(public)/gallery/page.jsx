import PageHeader from '@/components/public/PageHeader';
import GalleryView from '@/components/public/GalleryView';
import {getGalleries} from '@/lib/content';
import {readSite} from '@/lib/db';
export const metadata={title:'Gallery'};
export default async function Gallery({searchParams, previewContent}){const page=Number((await searchParams)?.page||1);const [data,site]=await Promise.all([getGalleries(page,12),previewContent || readSite()]);return <><PageHeader title={site.pages.gallery.pageTitle}/><div className="inner-content"><GalleryView items={data.items} page={data.page} pages={data.pages}/></div></>}
