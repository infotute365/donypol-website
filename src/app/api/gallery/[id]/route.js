import { NextResponse } from "next/server";
import { getAdmin, sameOrigin, recordAudit } from "@/lib/auth";
import connectDb from "@/lib/mongodb";
import { Gallery } from "@/lib/models";
import { withGalleryPhotoIds } from "@/lib/gallery-photos.mjs";
import {
  deleteFile,
  publicImageUrl,
  saveFile,
  validateImage,
} from "@/lib/upload";
import { allowAdminAction } from "@/lib/admin-rate-limit";

export const runtime = "nodejs";

export async function PUT(request, { params }) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const admin = await getAdmin();
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const saved = [];
  let committed = false;
  try {
    const { id } = await params;
    await connectDb();
    if (!(await allowAdminAction(admin, "gallery-upload", 30, 15 * 60000)))
      return NextResponse.json(
        { error: "Too many uploads. Please try again later." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    const stored = await Gallery.findById(id).lean();
    if (!stored)
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    const event = Gallery.hydrate(withGalleryPhotoIds(stored));
    const form = await request.formData();
    const title = String(form.get("title") || "").trim();
    const description = form.has("description")
      ? String(form.get("description") || "").trim()
      : event.description;
    const files = form.getAll("photos").filter((file) => file && file.size > 0);
    const removeIds = form.getAll("removePhotoIds").map(String);
    if (!title || title.length > 180)
      return NextResponse.json(
        { error: "Event title is required." },
        { status: 400 },
      );
    if (description.length > 3000)
      return NextResponse.json(
        { error: "Description is too long." },
        { status: 400 },
      );
    if (files.length > 4)
      return NextResponse.json(
        { error: "Upload a maximum of 4 images at a time." },
        { status: 400 },
      );
    if (files.some((file) => !validateImage(file)))
      return NextResponse.json(
        { error: "Only images up to 8 MB are allowed." },
        { status: 400 },
      );
    const removed = event.photos.filter((photo) =>
      removeIds.includes(String(photo._id)),
    );
    for (const file of files) {
      const photo = await saveFile(file, "image");
      saved.push({ ...photo, url: publicImageUrl(photo) });
    }
    event.title = title;
    event.description = description;
    event.photos = event.photos.filter(
      (photo) => !removeIds.includes(String(photo._id)),
    );
    event.photos.forEach((photo) => {
      if (photo.fileName) photo.url = publicImageUrl(photo);
    });
    event.photos.push(...saved);
    await event.save();
    committed = true;
    await recordAudit(admin, "gallery.update", title);
    await Promise.all(
      removed
        .filter((photo) => photo.fileName)
        .map((photo) => deleteFile(photo.fileName)),
    );
    return NextResponse.json(event);
  } catch (error) {
    if (!committed)
      await Promise.all(saved.map((file) => deleteFile(file.fileName)));
    if (error.name === "VersionError")
      return NextResponse.json(
        { error: "Album changed during this update. Reload and try again." },
        { status: 409 },
      );
    return NextResponse.json(
      { error: "Unable to process gallery request." },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const admin = await getAdmin();
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    await connectDb();
    const event = await Gallery.findByIdAndDelete(id);
    if (!event)
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    await Promise.all(
      event.photos
        .filter((photo) => photo.fileName)
        .map((photo) => deleteFile(photo.fileName)),
    );
    await recordAudit(admin, "gallery.delete", event.title);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to process gallery request." },
      { status: 500 },
    );
  }
}
