import { getAdmin, sameOrigin, recordAudit } from '@/lib/auth';
import connectDB from '@/server/config/database';
import { CbseDocument } from '@/lib/models';
import { getDocuments, seedDynamicContent } from '@/lib/content';
import { saveFile } from '@/lib/upload';
import { errorJson } from '@/lib/validate';
export const runtime = 'nodejs';
export async function GET() { try { return Response.json(await getDocuments()); } catch { return errorJson('Documents are temporarily unavailable', 503); } }
export async function POST(req) {
  if (!sameOrigin(req)) return errorJson('Invalid origin', 403);
  const admin = await getAdmin(); if (!admin) return errorJson('Unauthorized', 401);
  let saved;
  try {
    await connectDB(); await seedDynamicContent();
    const form = await req.formData();
    const title = String(form.get('title') || '').trim(); const description = String(form.get('description') || '').trim();
    if (!title || title.length > 180 || description.length > 3000) return errorJson('Valid title and description are required');
    saved = await saveFile(form.get('file'), 'pdf');
    const doc = await CbseDocument.create({ title, description, ...saved });
    await recordAudit(admin, 'cbse.create', title);
    return Response.json({ ...doc.toObject(), _id: String(doc._id), url: `/api/media/cbse/${doc._id}` }, { status: 201 });
  } catch { if (saved) { const { deleteFile } = await import('@/lib/upload'); await deleteFile(saved.fileName); } return errorJson('Unable to add PDF', 400); }
}
