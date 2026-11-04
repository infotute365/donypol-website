import { promises as fs } from 'node:fs';
import path from 'node:path';
import { UPLOAD_DIR } from '@/lib/upload';
export async function servePdf(doc) {
  if (!doc) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!doc.fileName) {
    if (!/^https:\/\/www\.donyipolovidyaniketanpasighat\.in\//i.test(doc.url)) return Response.json({ error: 'File not found' }, { status: 404 });
    return Response.redirect(doc.url, 302);
  }
  try {
    const data = await fs.readFile(path.join(UPLOAD_DIR, path.basename(doc.fileName)));
    return new Response(data, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="document.pdf"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return Response.json({ error: 'File not found on server' }, { status: 404 }); }
}
