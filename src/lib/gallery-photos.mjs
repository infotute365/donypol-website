import { createHash } from "node:crypto";

export function withGalleryPhotoIds(gallery) {
  return {
    ...gallery,
    photos: gallery.photos.map((photo, index) => ({
      ...photo,
      // Legacy seeds have no subdocument IDs. Keep their identity consistent
      // between lean reads and hydrated updates until the next album save.
      _id:
        photo._id ??
        createHash("sha256")
          .update(JSON.stringify([String(gallery._id), index, photo.url]))
          .digest("hex")
          .slice(0, 24),
    })),
  };
}
