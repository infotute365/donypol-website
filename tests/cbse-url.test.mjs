import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { legacyCbseUrl, publicDocumentUrl } from "../src/lib/cbse-url.mjs";

test("original CBSE filenames retain same-domain paths, including spaces and parentheses", () => {
  const source = JSON.parse(fs.readFileSync("data/seed-content.json", "utf8"));
  for (const document of source.documents) {
    const fileName = new URL(document.url).pathname.split("/").at(-1);
    const legacyUrl = legacyCbseUrl(decodeURIComponent(fileName));
    assert.equal(
      publicDocumentUrl({ _id: "fixture", url: legacyUrl }),
      new URL(document.url).pathname,
    );
  }
});

test("new CBSE records use their stable ID endpoint instead of arbitrary stored URLs", () => {
  assert.equal(
    publicDocumentUrl({
      _id: "0123456789abcdef01234567",
      url: "/upload/random.pdf",
    }),
    "/api/media/cbse/0123456789abcdef01234567",
  );
  assert.equal(
    publicDocumentUrl({
      _id: "fixture",
      url: "https://untrusted.example/document.pdf",
    }),
    "/api/media/cbse/fixture",
  );
});
