import crypto from "node:crypto";

export const PRIDE_SORT = { publishedAt: -1, seedOrder: 1, _id: -1 };
export class PrideInputError extends Error {}
export function pridePage(value, total, limit = 9) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const number =
    typeof value === "string" && /^\d{1,8}$/.test(value) ? Number(value) : 1;
  return { page: Math.min(pages, Math.max(1, number)), pages, total, limit };
}
export function prideInput(form) {
  const fields = {
    name: 120,
    achievement: 240,
    title: 240,
    description: 2000,
    className: 80,
  };
  const data = {};
  for (const [key, max] of Object.entries(fields)) {
    const raw = form.get(key) ?? "";
    if (typeof raw !== "string" || raw.length > max)
      throw new PrideInputError(
        `${key} must be text of at most ${max} characters.`,
      );
    data[key] = raw.trim();
  }
  if (!data.name || !data.achievement)
    throw new PrideInputError("Student name and achievement are required.");
  const year = form.get("achievementYear") ?? "";
  if (
    typeof year !== "string" ||
    (year && !/^(19|20|21)\d{2}$|^2200$/.test(year))
  )
    throw new PrideInputError(
      "Enter a year between 1900 and 2200, or leave it empty.",
    );
  data.achievementYear = year ? Number(year) : null;
  if (!["true", "false"].includes(form.get("isPublished")))
    throw new PrideInputError("Choose published or hidden.");
  data.isPublished = form.get("isPublished") === "true";
  const remove = form.get("removeImage");
  if (remove !== null && !["true", "false"].includes(remove))
    throw new PrideInputError("Invalid photo action.");
  return data;
}

// Per-record completion markers survive intentional deletions. Deterministic IDs
// make retries safe even if the process stops between insertion and marking done.
export async function seedPrideRecords(Model, State, originals, legacy = []) {
  await Promise.all([Model.init(), State.init()]);
  const all = [...originals];
  for (const item of legacy)
    if (
      !all.some(
        (a) =>
          a.name === item.name &&
          a.rank === item.rank &&
          a.title === item.title,
      )
    )
      all.push(item);
  let migration;
  try {
    migration = await State.findOneAndUpdate(
      { key: "pride-v1-start" },
      { $setOnInsert: { key: "pride-v1-start" } },
      { upsert: true, returnDocument: "after" },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    migration = await State.findOne({ key: "pride-v1-start" });
  }
  const migrationTime = migration.createdAt;
  for (const [index, item] of all.entries()) {
    const key = `pride-v1:${crypto
      .createHash("sha256")
      .update(JSON.stringify([item.name, item.rank, item.title]))
      .digest("hex")}`;
    if (await State.exists({ key })) continue;
    const existing = await Model.findOne({
      name: item.name,
      achievement: item.rank,
      title: item.title,
    })
      .select("_id seedKey")
      .lean();
    if (existing && !existing.seedKey) {
      await Model.updateOne(
        { _id: existing._id, seedKey: { $exists: false } },
        { $set: { seedKey: key, seedOrder: index + 1 } },
      );
    } else if (!existing) {
      try {
        await Model.updateOne(
          {
            _id: crypto
              .createHash("sha256")
              .update(key)
              .digest("hex")
              .slice(0, 24),
          },
          {
            $setOnInsert: {
              name: item.name,
              achievement: item.rank,
              title: item.title,
              description: item.description || "",
              seedKey: key,
              seedOrder: index + 1,
              isPublished: true,
              publishedAt: migrationTime,
            },
          },
          { upsert: true, runValidators: true },
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }
    try {
      await State.updateOne(
        { key },
        { $setOnInsert: { key } },
        { upsert: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
}
