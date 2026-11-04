import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';
import {readSite} from '@/lib/db';
export const dynamic='force-dynamic';
export default async function PublicLayout({children}){const d=await readSite();return <><Navbar school={d.school} nav={d.pages.navigation} logo={d.pages.images.logo}/><main>{children}</main><Footer s={d.school} logo={d.pages.images.logo}/></>}
