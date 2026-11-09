import mongoose from "mongoose";
import { getAdmin, sameOrigin, recordAudit } from "@/lib/auth";
import connectDB from "@/server/config/database";
import { CbseDocument } from "@/lib/models";
import { deleteFile, saveFile } from "@/lib/upload";
import { errorJson } from "@/lib/validate";
import { publicDocumentUrl } from "@/lib/cbse-url.mjs";
import { allowAdminAction } from "@/lib/admin-rate-limit";
export const runtime = "nodejs";
export async function PUT(req, { params }) {
  if (!sameOrigin(req)) return errorJson("Invalid origin", 403);
  const admin = await getAdmin();
  if (!admin) return errorJson("Unauthorized", 401);
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return errorJson("Invalid document", 400);
  let saved;
  let doc;
  let previous;
  try {
    await connectDB();
    if (!(await allowAdminAction(admin, "cbse-upload", 30, 15 * 60000)))
      return Response.json(
        { error: "Too many uploads. Please try again later." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    doc = await CbseDocument.findById(id);
    if (!doc) return errorJson("Not found", 404);
    const form = await req.formData();
    const submittedTitle = form.get("title");
    const submittedDescription = form.get("description");
    const title =
      submittedTitle === null ? doc.title : String(submittedTitle || "").trim();
    const description =
      submittedDescription === null
        ? doc.description
        : String(submittedDescription || "").trim();
    if (!title || title.length > 180 || description.length > 3000)
      return errorJson("Invalid title/description");
    const file = form.get("file");
    if (file && file.size > 0) saved = await saveFile(file, "pdf");
    previous = doc.fileName;
    doc.title = title;
    doc.description = description;
    if (saved) {
      doc.fileName = saved.fileName;
      doc.mimeType = saved.mimeType;
    }
    await doc.save();
  } catch (error) {
    if (saved) await deleteFile(saved.fileName, "pdf");
    if (error.name === "VersionError")
      return errorJson(
        "Document changed during this update. Reload and try again.",
        409,
      );
    return errorJson("Unable to update PDF", 400);
  }
  if (saved) await deleteFile(previous, "pdf");
  await recordAudit(admin, "cbse.update", doc.title);
  return Response.json({
    ...doc.toObject(),
    _id: String(doc._id),
    available: Boolean(doc.fileName),
    url: publicDocumentUrl(doc),
  });
}
export async function DELETE(req, { params }) {
  if (!sameOrigin(req)) return errorJson("Invalid origin", 403);
  const admin = await getAdmin();
  if (!admin) return errorJson("Unauthorized", 401);
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return errorJson("Invalid document");
  try {
    await connectDB();
    const doc = await CbseDocument.findByIdAndDelete(id);
    if (!doc) return errorJson("Not found", 404);
    await deleteFile(doc.fileName, "pdf");
    await recordAudit(admin, "cbse.delete", doc.title);
    return Response.json({ ok: true });
  } catch {
    return errorJson("Unable to delete PDF", 500);
  }
}
