import { NextResponse } from 'next/server';
import { makeToken, COOKIE, sameOrigin } from '@/lib/auth';
import { comparePassword } from '@/lib/password.mjs';
import connectDB from '@/server/config/database';
import { AdminUser, LoginAttempt, AuditLog } from '@/lib/models';

export const runtime = 'nodejs';
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    if (Number(request.headers.get('content-length') || 0) > 4096) return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
    const { username, password } = await request.json();
    if (typeof username !== 'string' || typeof password !== 'string' || username.length > 100 || password.length > 200) return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    await connectDB();
    const usernameKey = username.trim().toLowerCase();
    // One counter for the account and one for the originating IP. Trust the direct socket IP
    // rather than spoofable X-Forwarded-For unless an upstream proxy is explicitly configured.
    const ip = process.env.TRUST_PROXY === '1' ? request.headers.get('x-real-ip') : null;
    const keys = [`account:${usernameKey}`, ...(ip ? [`ip:${ip.slice(0, 64)}`] : [])];
    const now = new Date();
    const counters = await Promise.all(keys.map((key) => LoginAttempt.findOne({ key }).lean()));
    if (counters.some((a) => a && a.expiresAt > now && a.attempts >= 8))
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429, headers: { 'Retry-After': '900' } });
    const user = await AdminUser.findOne({ username: usernameKey, active: true }).select('+passwordHash');
    // Execute the password check even for absent accounts to reduce account enumeration timing.
    const dummy = 'scrypt$' + '0'.repeat(48) + '$' + '0'.repeat(128);
    const valid = comparePassword(password, user?.passwordHash || dummy);
    if (!user || user.role !== 'admin' || !valid) {
      await Promise.all(keys.map((key) => LoginAttempt.findOneAndUpdate({ key }, [
        { $set: { attempts: { $add: [{ $cond: [{ $gt: ['$expiresAt', now] }, '$attempts', 0] }, 1] }, expiresAt: new Date(Date.now() + 15 * 60 * 1000) } }
      ], { upsert: true, returnDocument: 'after', updatePipeline: true }).catch(() => null)));
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }
    await LoginAttempt.deleteMany({ key: { $in: keys } });
    await AuditLog.create({ adminId: String(user._id), action: 'auth.login', summary: 'Administrator logged in' });
    const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(COOKIE, makeToken(user), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 8 * 3600 });
    return response;
  } catch { return NextResponse.json({ error: 'Unable to sign in.' }, { status: 503 }); }
}
