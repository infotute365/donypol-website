import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import mongoose from "mongoose";
import {
  AdminUser,
  CbseDocument,
  Circular,
  Gallery,
  SiteContent,
} from "../src/lib/models.js";
import { hashPassword } from "../src/lib/password.mjs";
import { seedPrideRecords } from "../src/lib/pride-core.mjs";
import { PrideAchievement } from "../src/lib/pride-model.mjs";

// Uses a unique disposable database. School records and configuration are untouched.
const dbName = `dpvn_pride_test_${crypto.randomBytes(8).toString("hex")}`;
const uri = process.env.MONGODB_URI;
if (!uri)
  throw new Error("Load .env.local before running this integration script.");
const parts = uri.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)(?:\/[^?]*)?(\?.*)?$/);
if (!parts) throw new Error("Unsupported test connection URI.");
const testUri = `${parts[1]}/${dbName}${parts[2] || ""}`;
const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), `${dbName}_`));
const base = "http://127.0.0.1:3100";
let server;
let browser;
let logs = "";
let passed = 0;
const temporaryFiles = new Set();
const check = (label) => {
  passed++;
  console.log(`PASS ${label}`);
};
const source = JSON.parse(await fs.readFile("data/seed-content.json", "utf8"));
const stateSchema = new mongoose.Schema(
  { key: { type: String, unique: true } },
  { timestamps: true },
);
const State =
  mongoose.models.SeedState || mongoose.model("SeedState", stateSchema);
let cookie = "";
const fields = (overrides = {}) => {
  const f = new FormData();
  for (const [key, value] of Object.entries({
    name: "Integration fixture",
    achievement: "Integration fixture achievement",
    title: "",
    description: "",
    className: "",
    achievementYear: "",
    isPublished: "false",
    ...overrides,
  }))
    f.set(key, String(value));
  return f;
};
const request = (route, options = {}) =>
  fetch(base + route, { redirect: "manual", ...options });
async function mutation(route, method, body) {
  return request(route, {
    method,
    headers: { Origin: base, Cookie: cookie },
    body,
  });
}
async function json(response, status = 200) {
  assert.equal(response.status, status, await response.clone().text());
  return response.json();
}
const imageBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
async function upload(id, label) {
  const f = fields({ name: "Integration fixture with photo" });
  f.set("file", new Blob([imageBytes], { type: "image/png" }), label + ".png");
  const result = await json(await mutation(`/api/our-pride/${id}`, "PUT", f));
  temporaryFiles.add(result.image.fileName);
  return result;
}
function galleryForm(title, count = 1, description = "") {
  const form = new FormData();
  form.set("title", title);
  form.set("description", description);
  for (let i = 0; i < count; i++)
    form.append(
      "photos",
      new Blob([imageBytes], { type: "image/png" }),
      `${title.replaceAll(/[^a-z0-9]/gi, "_")}_${i}.png`,
    );
  return form;
}
async function waitReady(url) {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    if (server?.exitCode !== null)
      throw new Error("Test server exited before readiness.");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Test server did not become ready.");
}
async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  const ended = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  await Promise.race([
    ended,
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}

try {
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 5000 });
  const compatibilitySchema = new mongoose.Schema({
    name: String,
    achievement: String,
    title: String,
    description: String,
    seedKey: { type: String, unique: true, sparse: true },
    seedOrder: Number,
    isPublished: Boolean,
    publishedAt: Date,
  });
  const CompatibilityPride = mongoose.model(
    "PrideSeedCompatibilityFixture",
    compatibilitySchema,
  );
  const CompatibilityState = mongoose.model(
    "PrideSeedCompatibilityState",
    new mongoose.Schema(
      { key: { type: String, unique: true } },
      { timestamps: true },
    ),
  );
  const legacyOriginal = source.achievers[0];
  const originalFixture = await CompatibilityPride.create({
    name: legacyOriginal.name,
    achievement: legacyOriginal.rank,
    title: legacyOriginal.title,
    description: legacyOriginal.description || "",
    isPublished: true,
    publishedAt: new Date("2024-01-01T00:00:00.000Z"),
  });
  await seedPrideRecords(
    CompatibilityPride,
    CompatibilityState,
    source.achievers,
  );
  const taggedOriginal = await CompatibilityPride.findById(
    originalFixture._id,
  ).lean();
  assert.equal(taggedOriginal.seedOrder, 1);
  assert.ok(taggedOriginal.seedKey);
  assert.equal(taggedOriginal.name, legacyOriginal.name);
  assert.equal(await CompatibilityPride.countDocuments(), 3);
  await seedPrideRecords(
    CompatibilityPride,
    CompatibilityState,
    source.achievers,
  );
  assert.equal(await CompatibilityPride.countDocuments(), 3);
  console.log(
    "PASS legacy original achievements are tagged for protection without changing their IDs or content",
  );
  const Admin = AdminUser;
  const password = crypto.randomBytes(24).toString("base64url");
  const admin = await Admin.create({
    username: "integration_admin",
    passwordHash: hashPassword(password),
    role: "admin",
    active: true,
    sessionVersion: 1,
  });
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      "3100",
      "-H",
      "127.0.0.1",
    ],
    {
      env: {
        ...process.env,
        MONGODB_URI: testUri,
        APP_ORIGIN: base,
        DPVN_STORAGE_ROOT: storageRoot,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  server.stdout.on("data", (chunk) => {
    logs += chunk;
  });
  server.stderr.on("data", (chunk) => {
    logs += chunk;
  });
  await waitReady(base + "/admin/login");
  const [
    unseededPride,
    unseededGallery,
    unseededCbse,
    unseededCirculars,
    unseededContent,
  ] = await Promise.all([
    json(await request("/api/our-pride")),
    json(await request("/api/gallery")),
    json(await request("/api/cbse")),
    json(await request("/api/circulars")),
    json(await request("/api/content")),
  ]);
  assert.equal(unseededPride.total, 0);
  assert.equal(unseededGallery.total, 0);
  assert.equal(unseededCbse.length, 0);
  assert.equal(unseededCirculars.length, 0);
  assert.equal(await PrideAchievement.countDocuments(), 0);
  assert.equal(await Gallery.countDocuments(), 0);
  assert.equal(await CbseDocument.countDocuments(), 0);
  assert.equal(await Circular.countDocuments(), 0);
  assert.equal(await State.countDocuments(), 0);
  assert.equal(unseededContent.revision, 0);
  assert.equal(await SiteContent.countDocuments(), 0);
  check("public reads do not seed or modify school-content collections");
  await SiteContent.create({ key: "public", content: source, revision: 1 });
  const migrationEnv = { ...process.env, MONGODB_URI: testUri };
  const migrationPreview = execFileSync(
    process.execPath,
    ["scripts/migrate-managed-content.mjs"],
    { encoding: "utf8", env: migrationEnv },
  );
  assert.match(
    migrationPreview,
    /Read-only preview only; no database changes were made/,
  );
  assert.equal(await PrideAchievement.countDocuments(), 0);
  assert.equal(await Gallery.countDocuments(), 0);
  assert.equal(await CbseDocument.countDocuments(), 0);
  const rejectedMigration = spawnSync(
    process.execPath,
    [
      "scripts/migrate-managed-content.mjs",
      "--apply",
      "--confirm-db=wrong-disposable-db",
    ],
    { encoding: "utf8", env: migrationEnv },
  );
  assert.notEqual(rejectedMigration.status, 0);
  assert.match(rejectedMigration.stderr, /confirmation did not match/);
  assert.equal(await PrideAchievement.countDocuments(), 0);
  assert.equal(await Gallery.countDocuments(), 0);
  assert.equal(await CbseDocument.countDocuments(), 0);
  check(
    "migration refuses to write unless the exact database name is confirmed",
  );
  const migrationArgs = [
    "scripts/migrate-managed-content.mjs",
    "--apply",
    `--confirm-db=${dbName}`,
  ];
  execFileSync(process.execPath, migrationArgs, {
    encoding: "utf8",
    env: migrationEnv,
  });
  execFileSync(process.execPath, migrationArgs, {
    encoding: "utf8",
    env: migrationEnv,
  });
  assert.equal(await PrideAchievement.countDocuments(), 3);
  assert.equal(await Gallery.countDocuments(), source.albums.length);
  assert.equal(await CbseDocument.countDocuments(), source.documents.length);
  assert.equal(await Circular.countDocuments(), 0);
  check(
    "explicit idempotent fixture migration adds originals once without altering administrator records",
  );
  const initial = await json(await request("/api/our-pride"));
  assert.equal(initial.total, 3);
  initial.items.forEach((item, i) => {
    assert.equal(item.name, source.achievers[i].name);
    assert.equal(item.achievement, source.achievers[i].rank);
    assert.equal(item.title, source.achievers[i].title);
    assert.equal(item.image, null);
    assert.equal(item.achievementYear, null);
  });
  check(
    "original three names, ranks and titles seeded in deterministic order without photos or historical dates",
  );
  const [a, b] = await Promise.all([
    request("/api/our-pride"),
    request("/api/our-pride"),
  ]);
  assert.equal((await json(a)).total, 3);
  assert.equal((await json(b)).total, 3);
  await seedPrideRecords(PrideAchievement, State, source.achievers);
  assert.equal(await PrideAchievement.countDocuments(), 3);
  check(
    "repeated and concurrent migration requests preserve three records without duplicates",
  );
  for (const [route, method] of [
    ["/api/our-pride", "POST"],
    [`/api/our-pride/${initial.items[0]._id}`, "PUT"],
    [`/api/our-pride/${initial.items[0]._id}`, "DELETE"],
  ]) {
    assert.equal(
      (
        await request(route, {
          method,
          headers: { Origin: base },
          body: method !== "DELETE" ? fields() : undefined,
        })
      ).status,
      401,
    );
  }
  assert.equal((await request("/api/our-pride?scope=admin")).status, 401);
  check(
    "unauthenticated create, edit, delete and private listing are rejected",
  );
  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ username: admin.username, password }),
  });
  await json(login);
  cookie = login.headers.get("set-cookie").split(";")[0];
  check("administrator can log in through the real authentication API");
  assert.equal(
    (
      await request("/api/our-pride", {
        method: "POST",
        headers: { Origin: "https://invalid.example", Cookie: cookie },
        body: fields(),
      })
    ).status,
    403,
  );
  const [, token] = cookie.split("=");
  const badCookie = cookie.slice(0, -1) + (cookie.at(-1) === "a" ? "b" : "a");
  assert.equal(
    (
      await request("/api/our-pride", {
        method: "POST",
        headers: { Origin: base, Cookie: badCookie },
        body: fields(),
      })
    ).status,
    401,
  );
  await Admin.updateOne({ _id: admin._id }, { $set: { role: "viewer" } });
  assert.equal(
    (await mutation("/api/our-pride", "POST", fields())).status,
    401,
  );
  await Admin.updateOne({ _id: admin._id }, { $set: { role: "admin" } });
  check("cross-origin, tampered-session and non-admin mutations are rejected");
  assert.equal(
    (await mutation("/api/our-pride", "POST", fields({ name: "" }))).status,
    400,
  );
  const invalid = fields();
  invalid.set("file", new Blob(["<svg/>"], { type: "image/png" }), "fake.png");
  assert.equal((await mutation("/api/our-pride", "POST", invalid)).status, 400);
  const mismatch = fields();
  mismatch.set(
    "file",
    new Blob([imageBytes], { type: "image/jpeg" }),
    "fake.jpg",
  );
  assert.equal(
    (await mutation("/api/our-pride", "POST", mismatch)).status,
    400,
  );
  const oversized = fields();
  oversized.set(
    "file",
    new Blob([new Uint8Array(8 * 1024 * 1024 + 1)], { type: "image/png" }),
    "large.png",
  );
  assert.equal(
    (await mutation("/api/our-pride", "POST", oversized)).status,
    400,
  );
  check(
    "invalid details, forged signatures, MIME mismatches and oversized images are rejected",
  );
  const created = await json(
    await mutation("/api/our-pride", "POST", fields()),
    201,
  );
  assert.equal((await json(await request("/api/our-pride"))).total, 3);
  assert.equal(
    (
      await json(
        await request("/api/our-pride?scope=admin", {
          headers: { Cookie: cookie },
        }),
      )
    ).total,
    4,
  );
  check(
    "hidden achievements are saved and visible only in authenticated listings",
  );
  const originalId = initial.items[0]._id;
  const originalForm = (student = initial.items[0]) =>
    fields({
      name: student.name,
      achievement: student.achievement,
      title: student.title,
      description: student.description || "",
      className: student.className || "",
      achievementYear: student.achievementYear || "",
      isPublished: true,
    });
  const f = originalForm();
  f.set(
    "file",
    new Blob([imageBytes], { type: "image/png" }),
    "original-photo.png",
  );
  const withPhoto = await json(
    await mutation(`/api/our-pride/${originalId}`, "PUT", f),
  );
  temporaryFiles.add(withPhoto.image.fileName);
  assert.equal(withPhoto.name, initial.items[0].name);
  assert.equal(withPhoto.achievement, initial.items[0].achievement);
  assert.equal(withPhoto.title, initial.items[0].title);
  assert.equal(
    (await request(withPhoto.image.url)).status,
    200,
    "New photo is served by the production server",
  );
  const optimizedPhoto = await request(
    `/_next/image?url=${encodeURIComponent(withPhoto.image.url)}&w=640&q=75`,
  );
  assert.equal(
    optimizedPhoto.status,
    200,
    "Published photo supports Next.js image optimization",
  );
  const replacement = originalForm();
  replacement.set(
    "file",
    new Blob([imageBytes], { type: "image/png" }),
    "replacement.png",
  );
  const replaced = await json(
    await mutation(`/api/our-pride/${originalId}`, "PUT", replacement),
  );
  temporaryFiles.add(replaced.image.fileName);
  assert.notEqual(replaced.image.fileName, withPhoto.image.fileName);
  await assert.rejects(
    fs.stat(path.join(storageRoot, "upload", withPhoto.image.fileName)),
    { code: "ENOENT" },
  );
  const remove = originalForm();
  remove.set("removeImage", "true");
  const removed = await json(
    await mutation(`/api/our-pride/${originalId}`, "PUT", remove),
  );
  assert.equal(removed.image, null);
  assert.equal(removed.name, initial.items[0].name);
  await assert.rejects(
    fs.stat(path.join(storageRoot, "upload", replaced.image.fileName)),
    { code: "ENOENT" },
  );
  check(
    "original student photo can be uploaded, replaced and removed; old files are cleaned up and student preserved",
  );
  const hiddenPhoto = await upload(created._id, "temporary");
  assert.equal((await request(hiddenPhoto.image.url)).status, 404);
  assert.equal(
    (await request(hiddenPhoto.image.url, { headers: { Cookie: cookie } }))
      .status,
    200,
  );
  for (let i = 0; i < 10; i++)
    await json(
      await mutation(
        "/api/our-pride",
        "POST",
        fields({ name: `Pagination fixture ${i}`, isPublished: true }),
      ),
      201,
    );
  const first = await json(await request("/api/our-pride?page=1"));
  const second = await json(await request("/api/our-pride?page=2"));
  assert.equal(first.total, 13);
  assert.equal(first.items.length, 9);
  assert.equal(second.items.length, 4);
  assert.equal(
    new Set([...first.items, ...second.items].map((item) => item._id)).size,
    13,
  );
  assert.equal(first.items[0].name, "Pagination fixture 9");
  assert.equal((await json(await request("/api/our-pride?page=999"))).page, 2);
  assert.equal(
    (await json(await request("/api/our-pride?page=invalid"))).page,
    1,
  );
  const homepage = await (await request("/")).text();
  assert.equal((homepage.match(/<article class="pride-card/g) || []).length, 3);
  assert.ok(homepage.includes("Pagination fixture 9"));
  assert.ok(!homepage.includes("Pagination fixture 6"));
  assert.ok(homepage.includes("View All Our Pride"));
  assert.equal((await request("/our-pride?page=999")).status, 307);
  check(
    "newest-first homepage has exactly three cards; listing has nine per page, stable pages, totals and invalid-page redirects",
  );
  const publishedDraft = await json(
    await mutation(
      `/api/our-pride/${created._id}`,
      "PUT",
      fields({ isPublished: true }),
    ),
  );
  assert.ok(publishedDraft.publishedAt);
  assert.equal(
    (await json(await request("/api/our-pride"))).items[0]._id,
    created._id,
  );
  const editedPublished = await json(
    await mutation(
      `/api/our-pride/${created._id}`,
      "PUT",
      fields({ isPublished: true, description: "Edited test description" }),
    ),
  );
  assert.equal(editedPublished.publishedAt, publishedDraft.publishedAt);
  await json(
    await mutation(
      `/api/our-pride/${created._id}`,
      "PUT",
      fields({ isPublished: false }),
    ),
  );
  assert.equal((await json(await request("/api/our-pride"))).total, 13);
  check(
    "publishing a hidden draft makes it newest, editing preserves publication order and hiding removes it publicly",
  );
  const search = await json(
    await request(
      "/api/our-pride?scope=admin&search=Pagination%20fixture%209",
      { headers: { Cookie: cookie } },
    ),
  );
  assert.equal(search.total, 1);
  assert.equal(
    (
      await json(
        await request("/api/our-pride?scope=admin&search=%5B", {
          headers: { Cookie: cookie },
        }),
      )
    ).total,
    0,
  );
  check(
    "admin search filters records and escapes regular expression characters",
  );
  await json(await mutation(`/api/our-pride/${created._id}`, "DELETE"));
  assert.equal(await PrideAchievement.exists({ _id: created._id }), null);
  assert.equal(
    (await mutation(`/api/our-pride/${initial.items[2]._id}`, "DELETE")).status,
    409,
  );
  await json(await request("/api/our-pride"));
  assert.equal(
    await PrideAchievement.countDocuments({ seedKey: { $exists: true } }),
    3,
  );
  check(
    "administrator-created achievements can be deleted while all three original students are protected from deletion",
  );
  await mongoose.connection
    .collection("loginattempts")
    .updateOne(
      { key: `pride-write:${admin._id}` },
      { $set: { attempts: 60, expiresAt: new Date(Date.now() + 60000) } },
    );
  assert.equal(
    (await mutation("/api/our-pride", "POST", fields())).status,
    429,
  );
  await mongoose.connection
    .collection("loginattempts")
    .updateOne(
      { key: `pride-write:${admin._id}` },
      { $set: { attempts: 60, expiresAt: new Date(Date.now() - 60000) } },
    );
  const afterLimit = await json(
    await mutation("/api/our-pride", "POST", fields()),
    201,
  );
  check(
    "database-backed mutation rate limit rejects excess writes and resets expired windows",
  );
  const badLogin = await request("/api/auth/login", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ username: "throttle_fixture", password: "wrong" }),
  });
  assert.equal(badLogin.status, 401);
  const throttle = await mongoose.connection
    .collection("loginattempts")
    .findOne({ key: "account:throttle_fixture" });
  assert.equal(throttle.attempts, 1);
  check("existing failed-login throttle still executes under Mongoose 9");
  for (const route of [
    "/about",
    "/admission",
    "/facilities",
    "/contact",
    "/gallery",
    "/cbse-information",
    "/circulars",
    "/admin/dashboard",
  ]) {
    const response = await request(route, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200, route);
  }
  assert.equal((await request("/admin/dashboard")).status, 307);
  const [documentsResponse, documentsAgainResponse, cbsePageResponse] =
    await Promise.all([
      request("/api/cbse"),
      request("/api/cbse"),
      request("/cbse-information"),
    ]);
  const docs = await json(documentsResponse);
  assert.equal(
    docs.length,
    source.documents.length,
    JSON.stringify(docs.map(({ _id, title, url }) => ({ _id, title, url }))),
  );
  const docsAgain = await json(documentsAgainResponse);
  assert.equal(
    docsAgain.length,
    source.documents.length,
    JSON.stringify(
      docsAgain.map(({ _id, title, url }) => ({ _id, title, url })),
    ),
  );
  const CbseFixture =
    mongoose.models.CbseDocument ||
    mongoose.model("CbseDocument", new mongoose.Schema({}, { strict: false }));
  assert.equal(await CbseFixture.countDocuments(), source.documents.length);
  const concurrentCbsePage = await cbsePageResponse.text();
  for (const document of source.documents)
    assert.ok(concurrentCbsePage.includes(document.title));
  assert.equal(docs.length, source.documents.length);
  assert.ok(
    docs.every(
      (document) =>
        !document.available && document.url.startsWith("/cbse_information/"),
    ),
  );
  const fireSafety = docs.find((document) => document.title === "Fire Safety");
  const noc = docs.find((document) => document.title === "NOC");
  assert.ok(fireSafety && noc);
  const missingPdf = await request(fireSafety.url);
  assert.equal(missingPdf.status, 404);
  assert.equal(missingPdf.headers.get("location"), null);
  const cbsePage = await (await request("/cbse-information")).text();
  for (const document of docs) assert.ok(cbsePage.includes(document.title));
  const unavailableCount = (cbsePage.match(/role="status"/g) || []).length;
  assert.equal(unavailableCount, source.documents.length);
  check(
    "all original CBSE records remain visible; missing PDFs are marked unavailable without external redirects",
  );

  const pdfOne = Buffer.from("%PDF-1.4\nFire safety fixture one");
  const pdfTwo = Buffer.from("%PDF-1.4\nFire safety fixture replacement");
  const fireForm = (bytes, fileName) => {
    const form = new FormData();
    form.set("title", fireSafety.title);
    form.set("description", "Fire safety fixture");
    form.set("file", new Blob([bytes], { type: "application/pdf" }), fileName);
    return form;
  };
  const uploadedFire = await json(
    await mutation(
      `/api/cbse/${fireSafety._id}`,
      "PUT",
      fireForm(pdfOne, "Fire Safety.pdf"),
    ),
  );
  temporaryFiles.add(uploadedFire.fileName);
  assert.equal(uploadedFire._id, fireSafety._id);
  assert.equal(uploadedFire.title, fireSafety.title);
  assert.equal(uploadedFire.url, fireSafety.url);
  assert.equal(uploadedFire.available, true);
  assert.ok(
    (
      await fs.stat(
        path.join(storageRoot, "cbse-information", uploadedFire.fileName),
      )
    ).isFile(),
  );
  const stableFireUrl = uploadedFire.url;
  for (const url of [stableFireUrl, `/api/media/cbse/${fireSafety._id}`]) {
    const result = await request(url);
    assert.equal(result.status, 200);
    assert.deepEqual(Buffer.from(await result.arrayBuffer()), pdfOne);
  }
  const firstStoredName = uploadedFire.fileName;
  const invalidPdfForm = fireForm(Buffer.from("not a PDF"), "fake.pdf");
  assert.equal(
    (await mutation(`/api/cbse/${fireSafety._id}`, "PUT", invalidPdfForm))
      .status,
    400,
  );
  const forgedPdfForm = fireForm(imageBytes, "forged.pdf");
  assert.equal(
    (await mutation(`/api/cbse/${fireSafety._id}`, "PUT", forgedPdfForm))
      .status,
    400,
  );
  const oversizedPdfForm = fireForm(
    Buffer.alloc(20 * 1024 * 1024 + 1),
    "large.pdf",
  );
  assert.equal(
    (await mutation(`/api/cbse/${fireSafety._id}`, "PUT", oversizedPdfForm))
      .status,
    400,
  );
  assert.equal(
    (
      await request(`/api/cbse/${fireSafety._id}`, {
        method: "PUT",
        headers: { Origin: base },
        body: fireForm(pdfOne, "unauthorized.pdf"),
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request(`/api/cbse/${fireSafety._id}`, {
        method: "PUT",
        headers: { Origin: "https://invalid.example", Cookie: cookie },
        body: fireForm(pdfOne, "cross-origin.pdf"),
      })
    ).status,
    403,
  );
  const textOnlyUpdate = new FormData();
  textOnlyUpdate.set("title", fireSafety.title);
  textOnlyUpdate.set("description", "Text-only edit");
  const editedFire = await json(
    await mutation(`/api/cbse/${fireSafety._id}`, "PUT", textOnlyUpdate),
  );
  assert.equal(editedFire.fileName, firstStoredName);
  assert.equal(editedFire.url, stableFireUrl);
  const attachPdfOnly = new FormData();
  attachPdfOnly.set(
    "file",
    new Blob([pdfTwo], { type: "application/pdf" }),
    "Fire Safety replacement.pdf",
  );
  const attachedPdfOnly = await json(
    await mutation(`/api/cbse/${fireSafety._id}`, "PUT", attachPdfOnly),
  );
  temporaryFiles.add(attachedPdfOnly.fileName);
  assert.equal(attachedPdfOnly.title, fireSafety.title);
  assert.equal(attachedPdfOnly.description, editedFire.description);
  assert.equal(attachedPdfOnly.url, stableFireUrl);
  assert.deepEqual(
    Buffer.from(await (await request(stableFireUrl)).arrayBuffer()),
    pdfTwo,
  );
  const replacedFire = await json(
    await mutation(
      `/api/cbse/${fireSafety._id}`,
      "PUT",
      fireForm(pdfTwo, "Fire Safety new.pdf"),
    ),
  );
  temporaryFiles.add(replacedFire.fileName);
  assert.equal(replacedFire._id, fireSafety._id);
  assert.equal(replacedFire.title, fireSafety.title);
  assert.equal(replacedFire.url, stableFireUrl);
  await assert.rejects(
    fs.stat(path.join(storageRoot, "cbse-information", firstStoredName)),
    { code: "ENOENT" },
  );
  assert.deepEqual(
    Buffer.from(await (await request(stableFireUrl)).arrayBuffer()),
    pdfTwo,
  );
  const concurrentForms = [
    fireForm(pdfOne, "concurrent-one.pdf"),
    fireForm(pdfTwo, "concurrent-two.pdf"),
  ];
  const concurrentResponses = await Promise.all(
    concurrentForms.map((form) =>
      mutation(`/api/cbse/${fireSafety._id}`, "PUT", form),
    ),
  );
  assert.ok(
    concurrentResponses.every((response) =>
      [200, 409].includes(response.status),
    ),
  );
  assert.ok(concurrentResponses.some((response) => response.status === 200));
  const currentFire = (await json(await request("/api/cbse"))).find(
    (document) => document._id === fireSafety._id,
  );
  assert.ok(currentFire?.available);
  assert.ok(
    (
      await fs.stat(
        path.join(storageRoot, "cbse-information", currentFire.fileName),
      )
    ).isFile(),
  );
  const firePdfFiles = await fs.readdir(
    path.join(storageRoot, "cbse-information"),
  );
  assert.equal(firePdfFiles.length, 1);
  check(
    "CBSE replacements preserve ID/title/path, reject forged/oversized/unauthorized writes, retain PDFs on text edits and clean concurrent replacement files",
  );

  const nocUrl = noc.url;
  const uploadedNoc = await json(
    await mutation(
      `/api/cbse/${noc._id}`,
      "PUT",
      fireForm(pdfOne, "NOC (1).pdf"),
    ),
  );
  temporaryFiles.add(uploadedNoc.fileName);
  assert.equal(uploadedNoc.url, nocUrl);
  assert.deepEqual(
    Buffer.from(await (await request(nocUrl)).arrayBuffer()),
    pdfOne,
  );
  const futureForm = new FormData();
  futureForm.set("title", "Future school document");
  futureForm.set("description", "Created before PDF is ready");
  const future = await json(
    await mutation("/api/cbse", "POST", futureForm),
    201,
  );
  assert.equal(future.available, false);
  assert.equal((await request(future.url)).status, 404);
  const futurePdf = new FormData();
  futurePdf.set("title", future.title);
  futurePdf.set("description", future.description);
  futurePdf.set(
    "file",
    new Blob([pdfOne], { type: "application/pdf" }),
    "future.pdf",
  );
  const attachedFuturePdf = await json(
    await mutation(`/api/cbse/${future._id}`, "PUT", futurePdf),
  );
  temporaryFiles.add(attachedFuturePdf.fileName);
  assert.equal(attachedFuturePdf.available, true);
  assert.equal(attachedFuturePdf.url, future.url);
  assert.equal((await request(attachedFuturePdf.url)).status, 200);
  assert.equal((await request("/api/media/cbse/not-an-id")).status, 400);
  check(
    "encoded legacy filenames and future documents without PDFs receive stable links that work when files are attached",
  );

  const galleries = await json(await request("/api/gallery"));
  assert.equal(galleries.items.length, source.albums.length);
  const galleriesAgain = await json(await request("/api/gallery"));
  assert.equal(galleriesAgain.items.length, source.albums.length);
  check(
    "original gallery albums persist without duplicates after repeated reads",
  );
  const originalAlbum = galleries.items[0];
  const originalPhotoCount = originalAlbum.photos.length;
  const withAddedPhoto = await json(
    await mutation(
      `/api/gallery/${originalAlbum._id}`,
      "PUT",
      galleryForm(
        originalAlbum.title,
        1,
        "Preserved album description fixture",
      ),
    ),
  );
  assert.equal(withAddedPhoto.title, originalAlbum.title);
  assert.equal(
    withAddedPhoto.description,
    "Preserved album description fixture",
  );
  assert.equal(withAddedPhoto.photos.length, originalPhotoCount + 1);
  const addedPhoto = withAddedPhoto.photos.at(-1);
  assert.ok(addedPhoto.url.startsWith("/api/media/image?file="));
  assert.equal((await request(addedPhoto.url)).status, 200);
  temporaryFiles.add(addedPhoto.fileName);
  const removePhoto = new FormData();
  removePhoto.set("title", originalAlbum.title);
  removePhoto.append("removePhotoIds", String(addedPhoto._id));
  const withoutAddedPhoto = await json(
    await mutation(`/api/gallery/${originalAlbum._id}`, "PUT", removePhoto),
  );
  assert.equal(withoutAddedPhoto.title, originalAlbum.title);
  assert.equal(withoutAddedPhoto.photos.length, originalPhotoCount);
  assert.equal(
    (
      await request(
        `/api/media/image?file=${encodeURIComponent(addedPhoto.fileName)}`,
      )
    ).status,
    404,
  );
  check(
    "gallery photo uploads and removals preserve the original album and delete only the removed managed image",
  );

  const galleryAlbumTitle = `Integration gallery ${crypto.randomUUID()}`;
  const galleryAlbumDescription = "Integration gallery description fixture";
  const createdGallery = await json(
    await mutation(
      "/api/gallery",
      "POST",
      galleryForm(galleryAlbumTitle, 2, galleryAlbumDescription),
    ),
    201,
  );
  assert.equal(createdGallery.title, galleryAlbumTitle);
  assert.equal(createdGallery.photos.length, 2);
  assert.equal(createdGallery.description, galleryAlbumDescription);
  assert.ok(
    createdGallery.photos.every((photo) =>
      photo.url.startsWith("/api/media/image?file="),
    ),
  );
  assert.equal((await request(createdGallery.photos[0].url)).status, 200);
  createdGallery.photos.forEach((photo) => temporaryFiles.add(photo.fileName));
  const concurrentGalleryResponses = await Promise.all(
    [0, 1].map(() =>
      mutation(
        `/api/gallery/${createdGallery._id}`,
        "PUT",
        galleryForm(galleryAlbumTitle, 1, galleryAlbumDescription),
      ),
    ),
  );
  const concurrentGalleryResults = await Promise.all(
    concurrentGalleryResponses.map(async (response) => ({
      status: response.status,
      body: await response.json(),
    })),
  );
  assert.ok(
    concurrentGalleryResults.every(({ status }) => [200, 409].includes(status)),
  );
  const successfulGalleryWrites = concurrentGalleryResults.filter(
    ({ status }) => status === 200,
  );
  assert.ok(successfulGalleryWrites.length > 0);
  successfulGalleryWrites.forEach(({ body }) =>
    body.photos
      .filter(
        (photo) =>
          !createdGallery.photos.some(
            (original) => original.fileName === photo.fileName,
          ),
      )
      .forEach((photo) => temporaryFiles.add(photo.fileName)),
  );
  const persistedGalleries = await json(await request("/api/gallery"));
  const persistedGallery = persistedGalleries.items.find(
    (item) => item._id === createdGallery._id,
  );
  assert.equal(
    persistedGallery.photos.length,
    createdGallery.photos.length + successfulGalleryWrites.length,
  );
  check(
    "concurrent gallery updates preserve all successful writes and reject stale conflicts without orphaning uploads",
  );
  for (let i = 0; i < 9; i++) {
    const album = await json(
      await mutation(
        "/api/gallery",
        "POST",
        galleryForm(`Integration pagination ${i} ${crypto.randomUUID()}`),
      ),
      201,
    );
    album.photos.forEach((photo) => temporaryFiles.add(photo.fileName));
  }
  const firstGalleryPage = await json(
    await request("/api/gallery?page=1&limit=12"),
  );
  const secondGalleryPage = await json(
    await request("/api/gallery?page=2&limit=12"),
  );
  assert.equal(firstGalleryPage.total, source.albums.length + 10);
  assert.equal(firstGalleryPage.pages, 2);
  assert.equal(firstGalleryPage.items.length, 12);
  assert.equal(secondGalleryPage.page, 2);
  assert.equal(secondGalleryPage.items.length, firstGalleryPage.total - 12);
  assert.equal((await request("/gallery?page=2")).status, 200);
  check(
    "gallery creation, multi-photo uploads, pagination and page-two rendering work against isolated storage",
  );

  const publishedSite = await json(await request("/api/content"));
  const editorSession = crypto.randomUUID();
  let editorSequence = 0;
  const savePreview = (content, sequence = ++editorSequence) =>
    mutation(
      "/api/content/preview",
      "POST",
      JSON.stringify({ content, sessionId: editorSession, sequence }),
    );
  assert.equal(
    (
      await request("/api/content/preview", {
        method: "POST",
        headers: { Origin: base, "Content-Type": "application/json" },
        body: JSON.stringify({
          content: publishedSite.content,
          sessionId: editorSession,
          sequence: 1,
        }),
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/api/media/image", {
        method: "POST",
        headers: { Origin: base },
        body: fields(),
      })
    ).status,
    401,
  );
  check("website draft preview and background uploads require authentication");
  const imageForm = new FormData();
  imageForm.set(
    "file",
    new Blob([imageBytes], { type: "image/png" }),
    "homepage-test.png",
  );
  const uploadedBackground = await json(
    await mutation("/api/media/image", "POST", imageForm),
    201,
  );
  temporaryFiles.add(uploadedBackground.fileName);
  assert.ok(uploadedBackground.url.startsWith("/api/media/image?file="));
  assert.equal((await request(uploadedBackground.url)).status, 200);
  assert.equal(
    (await request("/api/media/image?file=..%2F.env.local")).status,
    404,
  );
  assert.equal((await request("/api/media/image?file=test.pdf")).status, 404);
  check(
    "website image uploads are immediately available in production and media paths reject traversal/non-image files",
  );
  const draftContent = structuredClone(publishedSite.content);
  draftContent.pages.home.heroTitle = "Unpublished homepage preview fixture";
  draftContent.pages.images.heroBackground = uploadedBackground.url;
  const originalLogo = draftContent.pages.images.logo;
  draftContent.pages.images.logo = uploadedBackground.url;
  const preview = await json(await savePreview(draftContent));
  assert.equal(
    (await request(`/admin/preview?draft=${preview.id}`)).status,
    307,
  );
  const privatePreview = await request(`/admin/preview?draft=${preview.id}`, {
    headers: { Cookie: cookie },
  });
  const privateHtml = await privatePreview.text();
  assert.equal(privatePreview.status, 200);
  assert.ok(privateHtml.includes(draftContent.pages.home.heroTitle));
  assert.ok(privateHtml.includes(uploadedBackground.fileName));
  assert.ok(privateHtml.includes(`src="${uploadedBackground.url}"`));
  assert.equal(privatePreview.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.match(
    privatePreview.headers.get("content-security-policy"),
    /frame-ancestors 'self'/,
  );
  assert.match(privatePreview.headers.get("cache-control"), /no-store/);
  const liveHome = await request("/");
  assert.equal(liveHome.headers.get("x-frame-options"), "DENY");
  assert.ok(
    !(await liveHome.text()).includes(draftContent.pages.home.heroTitle),
  );
  const unchangedSite = await json(await request("/api/content"));
  assert.equal(unchangedSite.revision, publishedSite.revision);
  assert.equal(unchangedSite.content.pages.images.logo, originalLogo);
  check(
    "authenticated draft preview shows unsaved text/background while published content and revision remain unchanged",
  );
  const otherAdmin = await Admin.create({
    username: "preview_other_admin",
    passwordHash: hashPassword(password),
    role: "admin",
    active: true,
    sessionVersion: 1,
  });
  const otherLogin = await request("/api/auth/login", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ username: otherAdmin.username, password }),
  });
  assert.equal(otherLogin.status, 200);
  const otherCookie = otherLogin.headers.get("set-cookie").split(";")[0];
  const otherPreview = await request(`/admin/preview?draft=${preview.id}`, {
    headers: { Cookie: otherCookie },
  });
  assert.ok(
    !(await otherPreview.text()).includes(draftContent.pages.home.heroTitle),
  );
  draftContent.pages.home.heroTitle = "Newer unpublished homepage fixture";
  await json(await savePreview(draftContent, 3));
  const stale = structuredClone(draftContent);
  stale.pages.home.heroTitle = "Stale preview request";
  await json(await savePreview(stale, 2));
  const newestPreview = await (
    await request(`/admin/preview?draft=${preview.id}`, {
      headers: { Cookie: cookie },
    })
  ).text();
  assert.ok(newestPreview.includes(draftContent.pages.home.heroTitle));
  assert.ok(!newestPreview.includes("Stale preview request"));
  for (const route of [
    "about",
    "admission",
    "facilities",
    "contact",
    "gallery",
    "cbse-information",
    "our-pride",
    "circulars",
  ])
    assert.equal(
      (
        await request(`/admin/preview/${route}?draft=${preview.id}`, {
          headers: { Cookie: cookie },
        })
      ).status,
      200,
      route,
    );
  check(
    "drafts stay private to their administrator, stale requests cannot overwrite newer edits and all nine pages preview",
  );
  const unsafeDraft = structuredClone(draftContent);
  unsafeDraft.pages.images.heroBackground = "javascript:alert(1)";
  assert.equal((await savePreview(unsafeDraft, 4)).status, 400);
  const publication = await json(
    await mutation(
      "/api/content",
      "PUT",
      JSON.stringify({
        content: draftContent,
        revision: publishedSite.revision,
      }),
    ),
  );
  const changedPublic = await (await request("/")).text();
  assert.ok(changedPublic.includes(draftContent.pages.home.heroTitle));
  assert.ok(changedPublic.includes(uploadedBackground.fileName));
  assert.ok(changedPublic.includes(`src="${uploadedBackground.url}"`));
  const savedSite = await json(await request("/api/content"));
  assert.equal(savedSite.content.pages.images.logo, uploadedBackground.url);
  assert.equal(
    savedSite.content.pages.images.schoolGate,
    publishedSite.content.pages.images.schoolGate,
  );
  await json(
    await mutation(
      "/api/content",
      "PUT",
      JSON.stringify({
        content: publishedSite.content,
        revision: publication.revision,
      }),
    ),
  );
  await mongoose.connection
    .collection("previewdrafts")
    .updateOne(
      { _id: new mongoose.Types.ObjectId(preview.id) },
      { $set: { expiresAt: new Date(Date.now() - 60000) } },
    );
  assert.ok(
    (
      await (
        await request(`/admin/preview?draft=${preview.id}`, {
          headers: { Cookie: cookie },
        })
      ).text()
    ).includes("Preview expired"),
  );
  check(
    "invalid image URLs are rejected, publishing applies the banner independently and expired previews cannot expose old drafts",
  );

  await PrideAchievement.updateMany({}, { $set: { isPublished: false } });
  const empty = await json(await request("/api/our-pride"));
  assert.equal(empty.total, 0);
  assert.equal(empty.items.length, 0);
  assert.ok(
    (await (await request("/our-pride")).text()).includes(
      "Student achievements will appear here when published.",
    ),
  );
  assert.equal(
    (
      (await (await request("/")).text()).match(
        /<article class="pride-card/g,
      ) || []
    ).length,
    0,
  );
  check(
    "empty public listing and homepage render graceful states without resurrecting hidden original entries",
  );
  // Restore only the disposable database to the original three for screenshots.
  await PrideAchievement.deleteMany({});
  await State.deleteMany({ key: /^pride-v1/ });
  await seedPrideRecords(PrideAchievement, State, source.achievers);
  if (process.argv.includes("--browser")) {
    const { browserQA } = await import("./test-pride-browser.mjs");
    browser = await browserQA({
      base,
      cookie,
      credentials: { username: admin.username, password },
      galleryAlbumTitle,
      galleryAlbumDescription,
      onCheck: check,
      temporaryFiles,
    });
  }
  for (const student of initial.items) {
    const form = originalForm(student);
    form.set(
      "file",
      new Blob([imageBytes], { type: "image/png" }),
      `${student.name.replaceAll(" ", "-")}.png`,
    );
    const updated = await json(
      await mutation(`/api/our-pride/${student._id}`, "PUT", form),
    );
    temporaryFiles.add(updated.image.fileName);
    assert.equal(updated.name, student.name);
    assert.equal(updated.achievement, student.achievement);
    assert.equal(updated.title, student.title);
    assert.equal((await request(updated.image.url)).status, 200);
  }
  assert.equal(
    await PrideAchievement.countDocuments({
      name: { $in: initial.items.map((student) => student.name) },
      "image.fileName": { $exists: true, $ne: "" },
    }),
    3,
  );
  check(
    "each original student's photo can be uploaded while preserving their existing identity and achievement details",
  );
  let galleryUploadThrottled = false;
  for (let attempt = 0; attempt < 31; attempt++) {
    const response = await mutation("/api/gallery", "POST", new FormData());
    if (response.status === 429) {
      assert.equal(response.headers.get("retry-after"), "900");
      galleryUploadThrottled = true;
      break;
    }
    assert.equal(response.status, 400, await response.clone().text());
  }
  assert.equal(galleryUploadThrottled, true);
  check("gallery upload mutations are rate-limited with a retry interval");
  assert.ok(
    !/\[MONGOOSE\].*(deprecated|Warning)|the `new` option.*deprecated/i.test(
      logs,
    ),
  );
  check("application log has no deprecated Mongoose return-option warnings");
  console.log(`Integration checks passed: ${passed}`);
} catch (error) {
  console.error("Integration failure:", error.message);
  process.exitCode = 1;
} finally {
  await stopChild(browser);
  await stopChild(server);
  for (const name of temporaryFiles)
    await fs
      .unlink(path.join(storageRoot, "upload", path.basename(name)))
      .catch(() => {});
  if (
    mongoose.connection.name === dbName &&
    /^dpvn_pride_test_[a-f0-9]{16}$/.test(dbName)
  )
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await fs.rm(storageRoot, { recursive: true, force: true });
}
