import { NextResponse } from "next/server";
import { getAdmin, sameOrigin, recordAudit } from "@/lib/auth";
import connectDb from "@/lib/mongodb";
import { Gallery } from "@/lib/models";
import { getGalleries } from "@/lib/content";
import {
  deleteFile,
  publicImageUrl,
  saveFile,
  validateImage,
} from "@/lib/upload";
import { allowAdminAction } from "@/lib/admin-rate-limit";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    return NextResponse.json(
      await getGalleries(searchParams.get("page"), searchParams.get("limit")),
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to process gallery request." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const admin = await getAdmin();
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const saved = [];
  let committed = false;
  try {
    await connectDb();
    if (!(await allowAdminAction(admin, "gallery-upload", 30, 15 * 60000)))
      return NextResponse.json(
        { error: "Too many uploads. Please try again later." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    const form = await request.formData();
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const files = form.getAll("photos").filter((file) => file && file.size > 0);
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
    if (!files.length || files.length > 4)
      return NextResponse.json(
        { error: "Upload between 1 and 4 images at a time." },
        { status: 400 },
      );
    if (files.some((file) => !validateImage(file)))
      return NextResponse.json(
        { error: "Only images up to 8 MB are allowed." },
        { status: 400 },
      );
    for (const file of files) {
      const photo = await saveFile(file, "image");
      saved.push({ ...photo, url: publicImageUrl(photo) });
    }
    const event = await Gallery.create({ title, description, photos: saved });
    committed = true;
    await recordAudit(admin, "gallery.create", title);
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    if (!committed)
      await Promise.all(saved.map((file) => deleteFile(file.fileName)));
    return NextResponse.json(
      { error: "Unable to process gallery request." },
      { status: 500 },
    );
  }
}
