import mongoose from 'mongoose';
import { getAdmin, sameOrigin, recordAudit } from '@/lib/auth';
import connectDB from '@/server/config/database';
import { CbseDocument } from '@/lib/models';
import { deleteFile, saveFile } from '@/lib/upload';
import { errorJson } from '@/lib/validate';
export const runtime = 'nodejs';
export async function PUT(req, { params }) {
  if (!sameOrigin(req)) return errorJson('Invalid origin', 403);
  const admin = await getAdmin(); if (!admin) return errorJson('Unauthorized', 401);
  const { id } = await params; if (!mongoose.isValidObjectId(id)) return errorJson('Invalid document', 400);
  let saved;
  try {
    await connectDB(); const doc = await CbseDocument.findById(id); if (!doc) return errorJson('Not found', 404);
    const form = await req.formData(); const title = String(form.get('title') || '').trim(); const description = String(form.get('description') || '').trim();
    if (!title || title.length > 180 || description.length > 3000) return errorJson('Invalid title/description');
    const file = form.get('file');
    if (file && file.size > 0) saved = await saveFile(file, 'pdf');
    const previous = doc.fileName;
    doc.title = title; doc.description = description;
    if (saved) Object.assign(doc, saved);
    await doc.save();
    if (saved) await deleteFile(previous);
    await recordAudit(admin, 'cbse.update', title);
    return Response.json({ ...doc.toObject(), _id: String(doc._id), url: `/api/media/cbse/${doc._id}` });
  } catch { if (saved) await deleteFile(saved.fileName); return errorJson('Unable to update PDF', 400); }
}
export async function DELETE(req, { params }) {
  if (!sameOrigin(req)) return errorJson('Invalid origin', 403);
  const admin = await getAdmin(); if (!admin) return errorJson('Unauthorized', 401);
  const { id } = await params; if (!mongoose.isValidObjectId(id)) return errorJson('Invalid document');
  try { await connectDB(); const doc = await CbseDocument.findByIdAndDelete(id); if (!doc) return errorJson('Not found', 404); await deleteFile(doc.fileName); await recordAudit(admin, 'cbse.delete', doc.title); return Response.json({ ok: true }); }
  catch { return errorJson('Unable to delete PDF', 500); }
}
