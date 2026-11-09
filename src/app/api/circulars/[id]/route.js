import mongoose from "mongoose";
import { getAdmin, sameOrigin, recordAudit } from "@/lib/auth";
import connectDB from "@/server/config/database";
import { Circular } from "@/lib/models";
import { saveFile, deleteFile } from "@/lib/upload";
import { errorJson } from "@/lib/validate";
import { allowAdminAction } from "@/lib/admin-rate-limit";
export const runtime = "nodejs";
const goodUrl = (url) =>
  !url ||
  (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) ||
  /^https:\/\/[^\s<>]+$/i.test(url);
export async function PUT(req, { params }) {
  if (!sameOrigin(req)) return errorJson("Invalid origin", 403);
  const admin = await getAdmin();
  if (!admin) return errorJson("Unauthorized", 401);
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return errorJson("Invalid ID");
  let saved;
  try {
    await connectDB();
    if (!(await allowAdminAction(admin, "circular-upload", 30, 15 * 60000)))
      return Response.json(
        { error: "Too many uploads. Please try again later." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    const item = await Circular.findById(id);
    if (!item) return errorJson("Not found", 404);
    const f = await req.formData();
    const title = String(f.get("title") || "").trim();
    const description = String(f.get("description") || "").trim();
    const url = String(f.get("url") || "").trim();
    const pinned = f.get("pinned") === "true";
    const publishedAt = f.get("publishedAt")
      ? new Date(String(f.get("publishedAt")))
      : new Date(item.publishedAt);
    if (
      !title ||
      title.length > 180 ||
      description.length > 3000 ||
      !goodUrl(url) ||
      !Number.isFinite(publishedAt.getTime())
    )
      return errorJson("Invalid details");
    const file = f.get("file");
    if (file?.size) saved = await saveFile(file, "pdf");
    const previous = item.fileName;
    Object.assign(item, {
      title,
      description,
      url,
      pinned,
      publishedAt,
      ...saved,
    });
    await item.save();
    if (saved) await deleteFile(previous, "pdf");
    await recordAudit(admin, "circular.update", title);
    return Response.json({
      ...item.toObject(),
      _id: String(item._id),
      url: item.fileName ? `/api/media/circulars/${item._id}` : item.url,
    });
  } catch {
    if (saved) await deleteFile(saved.fileName, "pdf");
    return errorJson("Unable to update circular", 400);
  }
}
export async function DELETE(req, { params }) {
  if (!sameOrigin(req)) return errorJson("Invalid origin", 403);
  const admin = await getAdmin();
  if (!admin) return errorJson("Unauthorized", 401);
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return errorJson("Invalid ID");
  try {
    await connectDB();
    const item = await Circular.findByIdAndDelete(id);
    if (!item) return errorJson("Not found", 404);
    await deleteFile(item.fileName, "pdf");
    await recordAudit(admin, "circular.delete", item.title);
    return Response.json({ ok: true });
  } catch {
    return errorJson("Unable to delete circular", 500);
  }
}
