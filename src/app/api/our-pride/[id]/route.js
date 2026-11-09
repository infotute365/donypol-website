import { PrideAchievement } from "@/lib/models";
import { prideInput, PrideInputError } from "@/lib/pride-core.mjs";
import {
  prideWriteAccess,
  prideForm,
  pridePhoto,
  cleanupPridePhoto,
  auditPride,
} from "@/lib/pride-write";
import { errorJson } from "@/lib/validate";
export const runtime = "nodejs";
export async function PUT(req, { params }) {
  const { admin, response } = await prideWriteAccess(req);
  if (response) return response;
  const { id } = await params;
  if (!/^[a-f\d]{24}$/i.test(id)) return errorJson("Invalid ID.");
  let image;
  let committed = false;
  try {
    const item = await PrideAchievement.findById(id);
    if (!item) return errorJson("Achievement not found.", 404);
    const form = await prideForm(req);
    const data = prideInput(form);
    image = await pridePhoto(form);
    const previous = item.image?.fileName;
    const remove = form.get("removeImage") === "true";
    if (data.isPublished && !item.isPublished) item.publishedAt = new Date();
    Object.assign(item, data);
    if (image || remove) item.image = image;
    if (image)
      item.image.url = `/api/media/our-pride/${item._id}?v=${encodeURIComponent(image.fileName)}`;
    await item.save();
    committed = true;
    if (image || remove) await cleanupPridePhoto(previous);
    await auditPride(admin, "pride.update");
    return Response.json(item);
  } catch (error) {
    if (image && !committed) await cleanupPridePhoto(image.fileName);
    if (error.name === "VersionError")
      return errorJson("This record changed. Reload before saving again.", 409);
    return errorJson(
      error instanceof PrideInputError
        ? error.message
        : "Unable to update achievement. Try again.",
      error instanceof PrideInputError ? 400 : 503,
    );
  }
}
export async function DELETE(req, { params }) {
  const { admin, response } = await prideWriteAccess(req);
  if (response) return response;
  const { id } = await params;
  if (!/^[a-f\d]{24}$/i.test(id)) return errorJson("Invalid ID.");
  try {
    const item = await PrideAchievement.findById(id);
    if (!item) return errorJson("Achievement not found.", 404);
    if (item.seedKey)
      return errorJson(
        "Original school achievements cannot be deleted. You can hide them instead.",
        409,
      );
    await item.deleteOne();
    await cleanupPridePhoto(item.image?.fileName);
    await auditPride(admin, "pride.delete");
    return Response.json({ ok: true });
  } catch {
    return errorJson("Unable to delete achievement.", 503);
  }
}
