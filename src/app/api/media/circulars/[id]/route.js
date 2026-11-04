import mongoose from 'mongoose';
import connectDB from '@/server/config/database';
import { Circular } from '@/lib/models';
import { servePdf } from '@/lib/serve-file';
export const runtime = 'nodejs';
export async function GET(req, { params }) {
  const { id } = await params; if (!mongoose.isValidObjectId(id)) return Response.json({ error: 'Invalid ID' }, { status: 400 });
  try { await connectDB(); const item = await Circular.findById(id).lean(); if (!item) return Response.json({ error: 'Not found' }, { status: 404 }); return servePdf(item); }
  catch { return Response.json({ error: 'Circular unavailable' }, { status: 503 }); }
}
