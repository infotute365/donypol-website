import connectDB from "@/server/config/database";
import { PrideAchievement } from "@/lib/models";
import { PRIDE_SORT, pridePage } from "./pride-core.mjs";

export async function getPride({
  page = "1",
  limit = 9,
  admin = false,
  search = "",
} = {}) {
  await connectDB();
  const filter = admin ? {} : { isPublished: true };
  if (admin && search) {
    const escaped = search.slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      "name",
      "achievement",
      "title",
      "description",
      "className",
    ].map((key) => ({ [key]: { $regex: escaped, $options: "i" } }));
  }
  const total = await PrideAchievement.countDocuments(filter);
  const pagination = pridePage(page, total, limit);
  const items = await PrideAchievement.find(filter)
    .sort(PRIDE_SORT)
    .skip((pagination.page - 1) * limit)
    .limit(limit)
    .lean();
  return { ...pagination, items: JSON.parse(JSON.stringify(items)) };
}
