import crypto from "node:crypto";
import path from "node:path";
import { withGalleryPhotoIds } from "./gallery-photos.mjs";

function seedRecordId(collectionKey, index, entry) {
  const identity = JSON.stringify([
    collectionKey,
    index,
    entry.title,
    entry.url || "",
  ]);
  return crypto
    .createHash("sha256")
    .update(identity)
    .digest("hex")
    .slice(0, 24);
}

export async function seedDynamicCollections({
  source,
  Gallery,
  CbseDocument,
  Circular,
  SeedState,
}) {
  const initial = [
    [
      "galleries",
      Gallery,
      (source.albums || []).map((album) => ({
        title: album.title,
        photos: album.images.map((url) => ({
          originalName: path.basename(url),
          url,
          fileName: "",
          mimeType: "image/jpeg",
        })),
      })),
    ],
    [
      "cbse",
      CbseDocument,
      (source.documents || []).map((document) => ({
        title: document.title,
        description: "",
        originalName: path.basename(decodeURIComponent(document.url)),
        url: document.url,
        fileName: "",
        mimeType: "application/pdf",
      })),
    ],
    ["circulars", Circular, []],
  ];

  for (const [key, Model, entries] of initial) {
    if (await SeedState.exists({ key })) continue;
    for (const [index, entry] of entries.entries()) {
      const identity =
        key === "galleries"
          ? { title: entry.title }
          : { title: entry.title, url: entry.url };
      if (await Model.exists(identity)) continue;
      const _id = seedRecordId(key, index, entry);
      const seededEntry =
        key === "galleries"
          ? withGalleryPhotoIds({ ...entry, _id })
          : entry;
      try {
        await Model.updateOne(
          { _id },
          { $setOnInsert: seededEntry },
          { upsert: true },
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }
    try {
      await SeedState.updateOne(
        { key },
        { $setOnInsert: { key } },
        { upsert: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
}
