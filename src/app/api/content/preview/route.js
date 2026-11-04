import { getAdmin, sameOrigin } from '@/lib/auth';
import { getSeed } from '@/lib/db';
import { PreviewDraft } from '@/lib/models';
import { checkSiteInput, errorJson } from '@/lib/validate';
import { withSiteDefaults } from '@/lib/site-editor.mjs';
import { boundedBody, BodyLimitError } from '@/lib/request-body.mjs';
import { allowAdminAction } from '@/lib/admin-rate-limit';
export const runtime = 'nodejs';
export async function POST(request) {
  if (!sameOrigin(request)) return errorJson('Origin not allowed', 403);
  const admin = await getAdmin(); if (!admin) return errorJson('Unauthorized', 401);
  try {
    if (!(await allowAdminAction(admin, 'site-preview', 120, 60000))) return errorJson('Preview refreshed too often. Please wait a minute.', 429);
    const { content, sessionId, sequence } = JSON.parse((await boundedBody(request, 650000)).toString('utf8'));
    if (typeof sessionId !== 'string' || !/^[a-f\d-]{36}$/i.test(sessionId) || !Number.isSafeInteger(sequence) || sequence < 1) return errorJson('Invalid preview session. Reload the editor.');
    const problem = checkSiteInput(content, await getSeed()); if (problem) return errorJson(problem);
    await PreviewDraft.init();
    let draft;
    const owner = { adminId: String(admin._id), sessionId };
    try {
      draft = await PreviewDraft.findOneAndUpdate({ ...owner, $or: [{ sequence: { $lt: sequence } }, { sequence: { $exists: false } }] }, {
        $set: { ...owner, sequence, content: withSiteDefaults(content), expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
      }, { upsert: true, returnDocument: 'after', runValidators: true });
    } catch (error) { if (error.code !== 11000) throw error; draft = await PreviewDraft.findOne(owner); }
    return Response.json({ id: String(draft._id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorJson(error instanceof BodyLimitError ? 'Preview content is too large.' : 'Unable to refresh preview. Please try again.', error instanceof BodyLimitError ? 413 : 400); }
}
