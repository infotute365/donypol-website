import { revalidatePath } from 'next/cache';
import { getAdmin, sameOrigin, recordAudit } from '@/lib/auth';
import { readSite, readSiteWithRevision, writeSite } from '@/lib/db';
import { errorJson } from '@/lib/validate';

export const dynamic = 'force-dynamic';
export async function GET() {
  // Public content is intentionally public. Revision is not sensitive.
  const data = await readSiteWithRevision();
  return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
export async function PUT(request) {
  if (!sameOrigin(request)) return errorJson('Origin not allowed', 403);
  const admin = await getAdmin();
  if (!admin) return errorJson('Unauthorized', 401);
  if (Number(request.headers.get('content-length')) > 650000) return errorJson('Content too large', 413);
  try {
    const { content, revision } = await request.json();
    if (!Number.isInteger(revision) || revision < 1) return errorJson('Invalid revision');
    const updatedRevision = await writeSite(content, revision);
    await recordAudit(admin, 'content.update', 'Public site text and images');
    revalidatePath('/', 'layout');
    return Response.json({ ok: true, revision: updatedRevision });
  } catch (e) { return e?.message?.startsWith('Conflict') ? errorJson(e.message, 409) : errorJson('Unable to save content. Verify inputs or database availability.', 400); }
}
