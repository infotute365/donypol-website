import { getAdmin } from '@/lib/auth';
import { getPride, seedOurPride } from '@/lib/pride';
import { PrideAchievement } from '@/lib/models';
import { prideInput, PrideInputError } from '@/lib/pride-core.mjs';
import { prideWriteAccess, prideForm, pridePhoto, cleanupPridePhoto, auditPride } from '@/lib/pride-write';
import { errorJson } from '@/lib/validate';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const query = new URL(req.url).searchParams;
  const admin = query.get('scope') === 'admin';
  if (admin && !(await getAdmin())) return errorJson('Unauthorized', 401);
  try {
    return Response.json(await getPride({ page: query.get('page'), limit: admin ? 20 : 9, admin, search: query.get('search') || '' }), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return errorJson('Student achievements are temporarily unavailable.', 503); }
}
export async function POST(req) {
  const { admin, response } = await prideWriteAccess(req); if (response) return response;
  let image;
  try {
    const form = await prideForm(req); const data = prideInput(form);
    await seedOurPride();
    image = await pridePhoto(form);
    const item = new PrideAchievement({ ...data, image, publishedAt: data.isPublished ? new Date() : null });
    if (image) item.image.url = `/api/media/our-pride/${item._id}?v=${encodeURIComponent(image.fileName)}`;
    await item.save();
    await auditPride(admin, 'pride.create');
    return Response.json(item, { status: 201 });
  } catch (error) {
    if (image) await cleanupPridePhoto(image.fileName);
    return errorJson(error instanceof PrideInputError ? error.message : 'Unable to save achievement. Try again.', error instanceof PrideInputError ? 400 : 503);
  }
}
