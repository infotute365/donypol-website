export class BodyLimitError extends Error {}
export async function boundedBody(request, maximum) {
  if (Number(request.headers.get('content-length')) > maximum) throw new BodyLimitError('Request is too large.');
  const reader = request.body?.getReader(); if (!reader) throw new Error('Request body required.');
  let size = 0; const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > maximum) { await reader.cancel(); throw new BodyLimitError('Request is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
