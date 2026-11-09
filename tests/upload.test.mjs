import { after, test } from "node:test";
import assert from "node:assert/strict";
import { File } from "node:buffer";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const storageRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "dpvn-upload-test-"),
);
process.env.DPVN_STORAGE_ROOT = storageRoot;
const { saveFile, deleteFile, validateImage, validatePdf, PDF_UPLOAD_DIR } =
  await import("../src/lib/upload.js");
after(async () => {
  await fs.rm(storageRoot, { recursive: true, force: true });
  delete process.env.DPVN_STORAGE_ROOT;
});

test("PDF and image input size/MIME gates", () => {
  assert.equal(
    validatePdf(new File(["fake"], "x.pdf", { type: "text/plain" })),
    false,
  );
  assert.equal(
    validateImage(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" })),
    false,
  );
  assert.equal(
    validatePdf(new File(["%PDF-1.7"], "x.pdf", { type: "application/pdf" })),
    true,
  );
});
test("uploaded file bytes are validated, renamed, and removable", async () => {
  await assert.rejects(
    saveFile(
      new File(["not a real pdf"], "fake.pdf", { type: "application/pdf" }),
      "pdf",
    ),
    /does not match/,
  );
  const f = new File([Buffer.from("%PDF-1.7\n1 0 obj\n")], "../../test.pdf", {
    type: "application/pdf",
  });
  const saved = await saveFile(f, "pdf");
  assert.match(saved.fileName, /^[a-zA-Z0-9_-]+-[a-f0-9]{32}\.pdf$/);
  assert.match(saved.url, /^\/cbse-information\//);
  assert.equal(
    (await fs.stat(path.join(PDF_UPLOAD_DIR, saved.fileName))).isFile(),
    true,
  );
  await deleteFile(saved.fileName, "pdf");
});

test("mismatched image MIME and signatures are rejected", async () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  await assert.rejects(
    saveFile(new File([png], "fake.jpg", { type: "image/jpeg" })),
    /does not match/,
  );
  await assert.rejects(
    saveFile(
      new File(["<script>bad</script>"], "fake.png", { type: "image/png" }),
    ),
    /does not match/,
  );
  assert.equal(
    validateImage({ type: "image/png", size: 8 * 1024 * 1024 + 1 }),
    false,
  );
});
