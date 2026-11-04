import { getAdmin, sameOrigin, recordAudit } from '@/lib/auth';
import { LoginAttempt } from '@/lib/models';
import { errorJson } from '@/lib/validate';
import { saveFile, deleteFile } from '@/lib/upload';
import { PrideInputError } from './pride-core.mjs';

export async function prideWriteAccess(req) {
  if (!sameOrigin(req)) return { response: errorJson('Invalid origin', 403) };
  const admin = await getAdmin();
  if (!admin) return { response: errorJson('Unauthorized', 401) };
  try {
    const now = new Date();
    const counter = await LoginAttempt.findOneAndUpdate({ key: `pride-write:${admin._id}` }, [
      { $set: {
        attempts: { $add: [{ $cond: [{ $gt: ['$expiresAt', now] }, '$attempts', 0] }, 1] },
        expiresAt: { $cond: [{ $gt: ['$expiresAt', now] }, '$expiresAt', new Date(Date.now() + 15 * 60 * 1000)] },
      } },
    ], { upsert: true, returnDocument: 'after', updatePipeline: true });
    if (counter.attempts > 60) return { response: Response.json({ error: 'Too many changes. Try again in 15 minutes.' }, { status: 429, headers: { 'Retry-After': '900' } }) };
    return { admin };
  } catch { return { response: errorJson('Unable to authorize changes. Try again.', 503) }; }
}

// Enforce the limit while reading, including requests without Content-Length.
export async function prideForm(req) {
  const maximum = 8 * 1024 * 1024 + 65536;
  if (Number(req.headers.get('content-length')) > maximum) throw new PrideInputError('Photo must be no larger than 8 MB.');
  const reader = req.body?.getReader();
  if (!reader) throw new PrideInputError('Form data required.');
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > maximum) { await reader.cancel(); throw new PrideInputError('Photo must be no larger than 8 MB.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new Response(Buffer.concat(chunks), { headers: { 'Content-Type': req.headers.get('content-type') || '' } }).formData();
}
export async function pridePhoto(form) {
  const files = form.getAll('file');
  if (files.length > 1) throw new PrideInputError('Choose a single student photo.');
  const file = files[0];
  if (file && typeof file !== 'object') throw new PrideInputError('Choose an image file.');
  if (file?.size && form.get('removeImage') === 'true') throw new PrideInputError('Choose replace or remove photo.');
  if (!file?.size) return null;
  try { return await saveFile(file, 'image'); }
  catch (error) {
    if (['Upload required', 'Invalid file type or size', 'The file content does not match the allowed format'].includes(error.message)) throw new PrideInputError(error.message);
    throw error;
  }
}
// Cleanup and audit failures must not undo a committed database change or delete
// its newly referenced image. Log only the operation, never student data/secrets.
export async function cleanupPridePhoto(fileName) {
  try { await deleteFile(fileName); } catch { console.error('Our Pride: unused photo cleanup failed.'); }
}
export async function auditPride(admin, action) {
  try { await recordAudit(admin, action); } catch { console.error('Our Pride: audit logging failed.'); }
}
