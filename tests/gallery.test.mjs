import test from "node:test";
import assert from "node:assert/strict";
import { Gallery } from "../src/lib/models.js";
import { withGalleryPhotoIds } from "../src/lib/gallery-photos.mjs";
import { seedDynamicCollections } from "../src/lib/dynamic-content-seed.mjs";

function legacyAlbum() {
  return {
    _id: "507f1f77bcf86cd799439011",
    title: "Original school album",
    photos: ["/images/one.jpg", "/images/two.jpg", "/images/one.jpg"].map(
      (url) => ({ originalName: "school.jpg", url, mimeType: "image/jpeg" }),
    ),
  };
}

test("legacy photos get repeatable, unique IDs, including repeated image URLs", () => {
  const album = legacyAlbum();
  const snapshot = structuredClone(album);
  const ids = withGalleryPhotoIds(album).photos.map((photo) => photo._id);
  assert.equal(new Set(ids).size, album.photos.length);
  ids.forEach((id) => assert.match(id, /^[a-f0-9]{24}$/));
  assert.deepEqual(
    withGalleryPhotoIds(legacyAlbum()).photos.map((photo) => photo._id),
    ids,
  );
  assert.deepEqual(album, snapshot);
  const otherAlbum = { ...album, _id: "507f1f77bcf86cd799439012" };
  assert.notEqual(withGalleryPhotoIds(otherAlbum).photos[0]._id, ids[0]);
});

test("existing photo IDs are preserved, including Mongoose ObjectIds", () => {
  const album = new Gallery(legacyAlbum()).toObject();
  const normalized = withGalleryPhotoIds(album);
  album.photos.forEach((photo, index) => {
    assert.equal(normalized.photos[index]._id, photo._id);
  });
  assert.deepEqual(withGalleryPhotoIds(normalized), normalized);
});

test("legacy read IDs select only the intended photo in a hydrated album update", async () => {
  const displayed = withGalleryPhotoIds(legacyAlbum());
  const removeId = displayed.photos[0]._id;
  const event = Gallery.hydrate(withGalleryPhotoIds(legacyAlbum()));
  const removed = event.photos.filter((photo) => String(photo._id) === removeId);
  assert.equal(removed.length, 1);
  event.photos = event.photos.filter((photo) => String(photo._id) !== removeId);
  assert.deepEqual(
    event.photos.map((photo) => String(photo._id)),
    displayed.photos.slice(1).map((photo) => photo._id),
  );
  // The save includes these IDs, so deleting a preceding photo does not
  // change the remaining photos' identities on subsequent reads.
  const savedPhotos = event.$getChanges().$set.photos;
  assert.deepEqual(
    withGalleryPhotoIds({ ...legacyAlbum(), photos: savedPhotos }).photos.map(
      (photo) => String(photo._id),
    ),
    displayed.photos.slice(1).map((photo) => photo._id),
  );
  await event.validate();
});

test("gallery seeding supplies photo IDs even without a nested Mongoose schema", async () => {
  async function seed() {
    const inserted = [];
    const Model = {
      exists: async () => false,
      updateOne: async (filter, update) => {
        inserted.push(update.$setOnInsert);
      },
    };
    await seedDynamicCollections({
      source: {
        albums: [{ title: "Seeded album", images: ["/one.jpg", "/two.jpg"] }],
      },
      Gallery: Model,
      CbseDocument: Model,
      Circular: Model,
      SeedState: { exists: async () => false, updateOne: async () => {} },
    });
    return inserted;
  }
  const [album] = await seed();
  assert.equal(new Set(album.photos.map((photo) => photo._id)).size, 2);
  album.photos.forEach((photo) => assert.match(photo._id, /^[a-f0-9]{24}$/));
  assert.deepEqual(await seed(), [album]);
});
