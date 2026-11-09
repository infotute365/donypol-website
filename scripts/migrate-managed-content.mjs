import mongoose from "mongoose";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CbseDocument,
  Circular,
  Gallery,
  SeedState,
  SiteContent,
} from "../src/lib/models.js";
import { PrideAchievement } from "../src/lib/pride-model.mjs";
import { seedPrideRecords } from "../src/lib/pride-core.mjs";
import { seedDynamicCollections } from "../src/lib/dynamic-content-seed.mjs";
import { formatSeedError, loadSeedEnvironment } from "./seed-config.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const confirmDb = args
  .find((arg) => arg.startsWith("--confirm-db="))
  ?.slice("--confirm-db=".length);

async function main() {
  loadSeedEnvironment(root);
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI is required.");
  if (args.some((arg) => arg !== "--apply" && !arg.startsWith("--confirm-db=")))
    throw new Error(
      "Only --apply and --confirm-db=<database-name> are supported.",
    );
  if (apply && !confirmDb)
    throw new Error("--confirm-db=<database-name> is required with --apply.");
  if (!apply && confirmDb)
    throw new Error("--confirm-db can only be used together with --apply.");

  const source = JSON.parse(
    await fs.readFile(path.join(root, "data", "seed-content.json"), "utf8"),
  );
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const database = mongoose.connection.name;
  const [pride, galleries, documents, circulars, markers] = await Promise.all([
    PrideAchievement.countDocuments(),
    Gallery.countDocuments(),
    CbseDocument.countDocuments(),
    Circular.countDocuments(),
    SeedState.find(
      { key: { $in: ["galleries", "cbse", "circulars", "pride-v1-start"] } },
      { key: 1, _id: 0 },
    ).lean(),
  ]);
  console.log(`Connected database: ${database}`);
  console.log(
    `Current records: Our Pride ${pride}, gallery ${galleries}, CBSE ${documents}, circulars ${circulars}.`,
  );
  console.log(
    `Source records: Our Pride ${(source.achievers || []).length}, gallery ${(source.albums || []).length}, CBSE ${(source.documents || []).length}.`,
  );
  console.log(
    `Existing seed markers: ${markers.map(({ key }) => key).join(", ") || "none"}.`,
  );

  if (!apply) {
    console.log("Read-only preview only; no database changes were made.");
    console.log(
      "After verifying backups and approving this target, apply with --apply --confirm-db=<exact-database-name>.",
    );
    return;
  }
  if (confirmDb !== database)
    throw new Error(
      `Database confirmation did not match the connected database "${database}". No migration was applied.`,
    );

  const currentSite = await SiteContent.findOne({ key: "public" }).lean();
  await seedPrideRecords(
    PrideAchievement,
    SeedState,
    source.achievers || [],
    currentSite?.content?.achievers || [],
  );
  await seedDynamicCollections({
    source,
    Gallery,
    CbseDocument,
    Circular,
    SeedState,
  });
  const [finalPride, finalGalleries, finalDocuments, finalCirculars] =
    await Promise.all([
      PrideAchievement.countDocuments(),
      Gallery.countDocuments(),
      CbseDocument.countDocuments(),
      Circular.countDocuments(),
    ]);
  console.log(
    `Migration complete. Current records: Our Pride ${finalPride}, gallery ${finalGalleries}, CBSE ${finalDocuments}, circulars ${finalCirculars}.`,
  );
  console.log(
    "The operation is idempotent and does not overwrite existing records or delete data.",
  );
}

main()
  .catch((error) => {
    console.error(
      `Managed-content migration failed: ${formatSeedError(error)}`,
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect().catch(() => {}));
