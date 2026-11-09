import connectDB from "@/server/config/database";
import { Gallery, CbseDocument, Circular } from "@/lib/models";
import { publicDocumentUrl } from "./cbse-url.mjs";
import { publicImageUrl } from "./upload.js";
import { withGalleryPhotoIds } from "./gallery-photos.mjs";
const idString = (item) => ({ ...item, _id: String(item._id) });
export async function getGalleries(page = 1, limit = 12) {
  await connectDB();
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safeLimit = Math.min(200, Math.max(1, Math.floor(Number(limit) || 12)));
  const [items, total] = await Promise.all([
    Gallery.find()
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    Gallery.countDocuments(),
  ]);
  return {
    items: items.map((item) => ({
      ...idString(item),
      photos: withGalleryPhotoIds(item).photos.map((p) => {
        const photo = { ...p, _id: String(p._id) };
        return { ...photo, url: publicImageUrl(photo) };
      }),
    })),
    page: safePage,
    limit: safeLimit,
    total,
    pages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}
export async function getDocuments() {
  await connectDB();
  return (await CbseDocument.find().sort({ createdAt: 1 }).lean()).map((d) => ({
    ...idString(d),
    available: Boolean(d.fileName),
    url: publicDocumentUrl(d),
  }));
}
export async function getCirculars() {
  await connectDB();
  return (
    await Circular.find()
      .sort({ pinned: -1, publishedAt: -1 })
      .limit(300)
      .lean()
  ).map((d) => ({
    ...idString(d),
    url: d.fileName ? `/api/media/circulars/${d._id}` : d.url,
  }));
}
