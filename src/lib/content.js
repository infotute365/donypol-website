import { getSeed } from '@/lib/db';
import connectDB from '@/server/config/database';
import { Gallery, CbseDocument, Circular, SeedState } from '@/lib/models';
import path from 'node:path';

export async function seedDynamicContent() {
  await connectDB();
  const source = await getSeed();
  // Each collection is seeded exactly once. Deleting all items must NOT resurrect old data.
  const initial = [
    ['galleries', Gallery, (source.albums || []).map((a) => ({ title: a.title, photos: a.images.map((url) => ({ originalName: path.basename(url), url, fileName: '', mimeType: 'image/jpeg' })) }))],
    ['cbse', CbseDocument, (source.documents || []).map((d) => ({ title: d.title, description: '', originalName: path.basename(decodeURIComponent(d.url)), url: d.url, fileName: '', mimeType: 'application/pdf' }))],
    ['circulars', Circular, []], // New feature: do not invent circulars from old notices.
  ];
  for (const [key, model, entries] of initial) {
    try {
      const marker = await SeedState.updateOne({ key }, { $setOnInsert: { key } }, { upsert: true });
      if (marker.upsertedCount && entries.length) await model.insertMany(entries);
    } catch (error) {
      // Concurrent seeding from another request may hit the unique key.
      if (error.code !== 11000) throw error;
    }
  }
}
const idString = (item) => ({ ...item, _id: String(item._id) });
export async function getGalleries(page = 1, limit = 12) {
  await seedDynamicContent();
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safeLimit = Math.min(200, Math.max(1, Math.floor(Number(limit) || 12)));
  const [items, total] = await Promise.all([
    Gallery.find().sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    Gallery.countDocuments(),
  ]);
  return { items: items.map((item) => ({ ...idString(item), photos: item.photos.map((p) => ({ ...p, _id: String(p._id) })) })), page: safePage, limit: safeLimit, total, pages: Math.max(1, Math.ceil(total / safeLimit)) };
}
export async function getDocuments() {
  await seedDynamicContent();
  return (await CbseDocument.find().sort({ createdAt: 1 }).lean()).map((d) => ({ ...idString(d), url: `/api/media/cbse/${d._id}` }));
}
export async function getCirculars() {
  await seedDynamicContent();
  return (await Circular.find().sort({ pinned: -1, publishedAt: -1 }).limit(300).lean()).map((d) => ({ ...idString(d), url: d.fileName ? `/api/media/circulars/${d._id}` : d.url }));
}
