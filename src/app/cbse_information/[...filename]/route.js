import connectDB from "@/server/config/database";
import { CbseDocument } from "@/lib/models";
import { legacyCbseUrl } from "@/lib/cbse-url.mjs";
import { servePdf } from "@/lib/serve-file";
export const runtime = "nodejs";

export async function GET(request, { params }) {
  const { filename } = await params;
  if (
    !Array.isArray(filename) ||
    filename.length !== 1 ||
    !/^[a-z0-9._ ()-]{1,180}\.pdf$/i.test(filename[0])
  ) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }
  try {
    await connectDB();
    const document = await CbseDocument.findOne({
      url: legacyCbseUrl(filename[0]),
    }).lean();
    return servePdf(document);
  } catch {
    return Response.json({ error: "Document unavailable" }, { status: 503 });
  }
}
