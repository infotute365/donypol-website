import { getAdmin, sameOrigin, recordAudit } from "@/lib/auth";
import connectDB from "@/server/config/database";
import { Circular } from "@/lib/models";
import { getCirculars } from "@/lib/content";
import { saveFile } from "@/lib/upload";
import { errorJson } from "@/lib/validate";
import { allowAdminAction } from "@/lib/admin-rate-limit";
export const runtime = "nodejs";
function safeLink(url) {
  return (
    !url ||
    (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) ||
    /^https:\/\/[^\s<>]+$/i.test(url)
  );
}
export async function GET() {
  try {
    return Response.json(await getCirculars(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return errorJson("Circulars temporarily unavailable", 503);
  }
}
export async function POST(req) {
  if (!sameOrigin(req)) return errorJson("Invalid origin", 403);
  const admin = await getAdmin();
  if (!admin) return errorJson("Unauthorized", 401);
  let saved;
  try {
    await connectDB();
    if (!(await allowAdminAction(admin, "circular-upload", 30, 15 * 60000)))
      return Response.json(
        { error: "Too many uploads. Please try again later." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    const f = await req.formData();
    const title = String(f.get("title") || "").trim();
    const description = String(f.get("description") || "").trim();
    const url = String(f.get("url") || "").trim();
    const pinned = f.get("pinned") === "true";
    const publishedAt = f.get("publishedAt")
      ? new Date(String(f.get("publishedAt")))
      : new Date();
    if (
      !title ||
      title.length > 180 ||
      description.length > 3000 ||
      !safeLink(url) ||
      !Number.isFinite(publishedAt.getTime())
    )
      return errorJson("Invalid circular details");
    const file = f.get("file");
    if (file?.size) saved = await saveFile(file, "pdf");
    const item = await Circular.create({
      title,
      description,
      url,
      pinned,
      publishedAt,
      ...saved,
    });
    await recordAudit(admin, "circular.create", title);
    return Response.json(
      {
        ...item.toObject(),
        _id: String(item._id),
        url: saved ? `/api/media/circulars/${item._id}` : url,
      },
      { status: 201 },
    );
  } catch {
    if (saved) {
      const { deleteFile } = await import("@/lib/upload");
      await deleteFile(saved.fileName, "pdf");
    }
    return errorJson("Unable to create circular", 400);
  }
}
