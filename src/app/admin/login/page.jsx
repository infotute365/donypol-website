import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import LoginForm from '@/components/admin/LoginForm';

export const metadata = { title: 'Admin sign in', robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await isAdmin()) redirect('/admin/dashboard');
  return <LoginForm />;
}
