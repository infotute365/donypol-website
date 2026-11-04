import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import connectDB from '@/server/config/database';
import { AdminUser, AuditLog } from '@/lib/models';
import { sameOriginAllowed } from './request-origin.mjs';

export const COOKIE = 'dpvn_admin';
const b64 = (data) => Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)).toString('base64url');
const secret = () => {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 48) throw new Error('JWT_SECRET must be at least 48 characters');
  return value;
};
export function makeToken(admin) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ sub: String(admin._id), role: 'admin', sv: admin.sessionVersion,
    iss: 'dpvn', aud: 'dpvn-admin', iat: now, exp: now + 8 * 3600 });
  const signature = crypto.createHmac('sha256', secret()).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${signature}`;
}
export function verifyToken(token) {
  try {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [head, body, sig] = parts;
    const expected = crypto.createHmac('sha256', secret()).update(`${head}.${body}`).digest('base64url');
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const header = JSON.parse(Buffer.from(head, 'base64url').toString());
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'HS256' || header.typ !== 'JWT' || payload.iss !== 'dpvn' ||
      payload.aud !== 'dpvn-admin' || payload.role !== 'admin' || !payload.sub ||
      !Number.isInteger(payload.sv) || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) ||
      payload.iat > now + 30 || payload.exp <= now || payload.exp > payload.iat + 8 * 3600) return null;
    return payload;
  } catch { return null; }
}
export async function getAdmin() {
  const decoded = verifyToken((await cookies()).get(COOKIE)?.value);
  if (!decoded || !/^[0-9a-f]{24}$/.test(decoded.sub)) return null;
  try {
    await connectDB();
    const admin = await AdminUser.findById(decoded.sub).lean();
    if (!admin || !admin.active || admin.role !== 'admin' || admin.sessionVersion !== decoded.sv) return null;
    return admin;
  } catch { return null; }
}
export async function isAdmin() { return !!(await getAdmin()); }
export function sameOrigin(request) {
  return sameOriginAllowed(request, process.env.APP_ORIGIN, process.env.NODE_ENV);
}
export async function recordAudit(admin, action, summary = '') {
  if (admin) await AuditLog.create({ adminId: String(admin._id), action, summary: String(summary).slice(0, 240) });
}
