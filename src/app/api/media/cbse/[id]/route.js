import mongoose from 'mongoose';
import connectDB from '@/server/config/database';
import { CbseDocument } from '@/lib/models';
import { servePdf } from '@/lib/serve-file';
export const runtime = 'nodejs';
export async function GET(req, { params }) {
  const { id } = await params; if (!mongoose.isValidObjectId(id)) return Response.json({ error: 'Invalid ID' }, { status: 400 });
  try { await connectDB(); return servePdf(await CbseDocument.findById(id).lean()); }
  catch { return Response.json({ error: 'Document unavailable' }, { status: 503 }); }
}
