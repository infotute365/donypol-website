import { promises as fs } from "node:fs";
import path from "node:path";
import { PDF_UPLOAD_DIR, UPLOAD_DIR } from "@/lib/upload";

async function readPdf(fileName) {
  const safeName = path.basename(fileName);
  for (const directory of [PDF_UPLOAD_DIR, UPLOAD_DIR]) {
    try {
      return await fs.readFile(path.join(directory, safeName));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return null;
}

export async function servePdf(doc) {
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });
  if (!doc.fileName)
    return Response.json({ error: "File not found" }, { status: 404 });
  const data = await readPdf(doc.fileName);
  if (!data)
    return Response.json(
      { error: "File not found on server" },
      { status: 404 },
    );
  return new Response(data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="document.pdf"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
