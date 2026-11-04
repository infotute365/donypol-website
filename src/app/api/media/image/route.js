import { getAdmin, sameOrigin, recordAudit } from '@/lib/auth';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { saveFile, deleteFile, UPLOAD_DIR } from '@/lib/upload';
import { errorJson } from '@/lib/validate';
import { boundedBody, BodyLimitError } from '@/lib/request-body.mjs';
import { allowAdminAction } from '@/lib/admin-rate-limit';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const file = new URL(req.url).searchParams.get('file') || '';
  if (!/^[a-zA-Z0-9._ -]{1,50}-[a-f0-9]{32}\.(jpg|png|webp|gif)$/.test(file) || path.basename(file) !== file) return errorJson('Image not found.', 404);
  try {
    const mime = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[file.split('.').pop()];
    const bytes = await fs.readFile(path.join(UPLOAD_DIR, file));
    return new Response(bytes, { headers: { 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=31536000, immutable' } });
  } catch { return errorJson('Image not found.', 404); }
}
export async function POST(req) {
  if (!sameOrigin(req)) return errorJson('Invalid origin', 403);
  const admin = await getAdmin(); if (!admin) return errorJson('Unauthorized', 401);
  let saved;
  try {
    if (!(await allowAdminAction(admin, 'site-image-upload', 30, 15 * 60000))) return errorJson('Too many uploads. Please try again later.', 429);
    const body = await boundedBody(req, 8 * 1024 * 1024 + 65536);
    const form = await new Response(body, { headers: { 'Content-Type': req.headers.get('content-type') || '' } }).formData();
    if (form.getAll('file').length !== 1) return errorJson('Choose one image.');
    saved = await saveFile(form.get('file'), 'image');
    saved.url = `/api/media/image?file=${encodeURIComponent(saved.fileName)}`;
    await recordAudit(admin, 'media.upload', saved.originalName);
    return Response.json(saved, { status: 201 });
  } catch (error) {
    if (saved) await deleteFile(saved.fileName).catch(() => {});
    return errorJson('Upload a JPEG, PNG, WebP, or GIF image (max 8MB).', error instanceof BodyLimitError ? 413 : 400);
  }
}
