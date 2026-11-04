import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';

// Every page under /admin/dashboard is blocked here unless the admin cookie is valid.
export default async function DashboardLayout({ children }) {
  if (!(await isAdmin())) redirect('/admin/login');
  return children;
}
