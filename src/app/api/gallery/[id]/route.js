import { NextResponse } from 'next/server';
import { getAdmin, sameOrigin, recordAudit } from '@/lib/auth';
import connectDb from '@/lib/mongodb';
import { Gallery } from '@/lib/models';
import { deleteFile, saveFile, validateImage } from '@/lib/upload';

export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const saved = [];
  try {
    const { id } = await params;
    await connectDb();
    const event = await Gallery.findById(id);
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    const form = await request.formData();
    const title = String(form.get('title') || '').trim();
    const files = form.getAll('photos').filter((file) => file && file.size > 0);
    const removeIds = form.getAll('removePhotoIds').map(String);
    if (!title || title.length > 180) return NextResponse.json({ error: 'Event title is required.' }, { status: 400 });
    if (files.length > 4) return NextResponse.json({ error: 'Upload a maximum of 4 images at a time.' }, { status: 400 });
    if (files.some((file) => !validateImage(file))) return NextResponse.json({ error: 'Only images up to 10 MB are allowed.' }, { status: 400 });
    const removed = event.photos.filter((photo) => removeIds.includes(String(photo._id)));
    for (const file of files) saved.push(await saveFile(file, 'image'));
    event.title = title;
    event.photos = event.photos.filter((photo) => !removeIds.includes(String(photo._id)));
    event.photos.push(...saved);
    await event.save();
    await recordAudit(admin, 'gallery.update', title);
    await Promise.all(removed.filter((photo) => photo.fileName).map((photo) => deleteFile(photo.fileName)));
    return NextResponse.json(event);
  } catch (error) {
    await Promise.all(saved.map((file) => deleteFile(file.fileName)));
    return NextResponse.json({ error: 'Unable to process gallery request.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    await connectDb();
    const event = await Gallery.findByIdAndDelete(id);
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    await Promise.all(event.photos.filter((photo) => photo.fileName).map((photo) => deleteFile(photo.fileName)));
    await recordAudit(admin, 'gallery.delete', event.title);
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: 'Unable to process gallery request.' }, { status: 500 }); }
}
