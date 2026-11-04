import { NextResponse } from 'next/server';
import { COOKIE, sameOrigin, getAdmin, recordAudit } from '@/lib/auth';
export async function POST(req) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const admin = await getAdmin();
  if (admin) await recordAudit(admin, 'auth.logout');
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  return res;
}
