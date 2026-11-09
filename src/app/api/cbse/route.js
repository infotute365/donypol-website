import { getAdmin, sameOrigin, recordAudit } from "@/lib/auth";
import connectDB from "@/server/config/database";
import { CbseDocument } from "@/lib/models";
import { getDocuments } from "@/lib/content";
import { safeOriginalName, saveFile } from "@/lib/upload";
import { errorJson } from "@/lib/validate";
import { publicDocumentUrl } from "@/lib/cbse-url.mjs";
import { allowAdminAction } from "@/lib/admin-rate-limit";
export const runtime = "nodejs";
export async function GET() {
  try {
    return Response.json(await getDocuments());
  } catch {
    return errorJson("Documents are temporarily unavailable", 503);
  }
}
export async function POST(req) {
  if (!sameOrigin(req)) return errorJson("Invalid origin", 403);
  const admin = await getAdmin();
  if (!admin) return errorJson("Unauthorized", 401);
  let saved;
  let doc;
  try {
    await connectDB();
    if (!(await allowAdminAction(admin, "cbse-upload", 30, 15 * 60000)))
      return Response.json(
        { error: "Too many uploads. Please try again later." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    const form = await req.formData();
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    if (!title || title.length > 180 || description.length > 3000)
      return errorJson("Valid title and description are required");
    const file = form.get("file");
    if (file && file.size > 0) saved = await saveFile(file, "pdf");
    doc = new CbseDocument({
      title,
      description,
      originalName: saved?.originalName || safeOriginalName(`${title}.pdf`),
      fileName: saved?.fileName || "",
      url: "",
      mimeType: saved?.mimeType || "application/pdf",
    });
    doc.url = `/api/media/cbse/${doc._id}`;
    await doc.save();
  } catch {
    if (saved) {
      const { deleteFile } = await import("@/lib/upload");
      await deleteFile(saved.fileName, "pdf");
    }
    return errorJson("Unable to add PDF", 400);
  }
  await recordAudit(admin, "cbse.create", doc.title);
  return Response.json(
    {
      ...doc.toObject(),
      _id: String(doc._id),
      available: Boolean(doc.fileName),
      url: publicDocumentUrl(doc),
    },
    { status: 201 },
  );
}
