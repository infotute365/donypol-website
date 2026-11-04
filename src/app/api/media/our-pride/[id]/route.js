import path from 'node:path';
import { promises as fs } from 'node:fs';
import connectDB from '@/server/config/database';
import { PrideAchievement } from '@/lib/models';
import { getAdmin } from '@/lib/auth';
import { UPLOAD_DIR } from '@/lib/upload';
import { errorJson } from '@/lib/validate';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Serve new uploads without depending on Next.js's startup public-file manifest.
export async function GET(req, { params }) {
  const { id } = await params;
  if (!/^[a-f\d]{24}$/i.test(id)) return errorJson('Photo not found.', 404);
  try {
    await connectDB();
    const item = await PrideAchievement.findById(id).select('image isPublished').lean();
    if (!item?.image || (!item.isPublished && !(await getAdmin()))) return errorJson('Photo not found.', 404);
    const { fileName, mimeType } = item.image;
    if (!fileName || fileName !== path.basename(fileName) || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)) return errorJson('Photo not found.', 404);
    if (new URL(req.url).searchParams.get('v') !== fileName) return errorJson('Photo not found.', 404);
    const bytes = await fs.readFile(path.join(UPLOAD_DIR, fileName));
    return new Response(bytes, { headers: { 'Content-Type': mimeType, 'Content-Length': String(bytes.length), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } });
  } catch { return errorJson('Photo not found.', 404); }
}
