import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withSiteDefaults, previewUrl, isEditorImage, imageFileName } from '../src/lib/site-editor.mjs';
import { checkSiteInput } from '../src/lib/validate.js';
import { boundedBody, BodyLimitError } from '../src/lib/request-body.mjs';
const seed = JSON.parse(fs.readFileSync('data/seed-content.json', 'utf8'));

test('existing content gains a separate homepage background without changing the original photo or seed', () => {
  const baseline = JSON.stringify(seed); const content = withSiteDefaults(seed);
  assert.equal(content.pages.images.heroBackground, seed.pages.images.schoolGate);
  content.pages.images.heroBackground = '/api/media/image?file=new-photo.png';
  assert.equal(content.pages.images.schoolGate, seed.pages.images.schoolGate);
  assert.equal(JSON.stringify(seed), baseline);
  assert.equal(checkSiteInput(content, seed), null);
  assert.equal(checkSiteInput(seed, seed), null);
  content.pages.images.heroBackground = 'javascript:alert(1)';
  assert.match(checkSiteInput(content, seed), /Unsafe URL/);
});
test('image fields recognize version-safe API uploads and display the current filename', () => {
  const url = '/api/media/image?file=school%20banner-123456789012345678901234567890ab.png';
  assert.equal(isEditorImage(url), true);
  assert.equal(imageFileName(url), 'school banner-123456789012345678901234567890ab.png');
  assert.equal(imageFileName(seed.pages.images.schoolGate), 'school_gate.jpeg');
  assert.equal(isEditorImage('A school heading'), false);
});
test('preview navigation remains on approved private routes and preserves pagination', () => {
  assert.equal(previewUrl('/', 'abc'), '/admin/preview?draft=abc');
  assert.equal(previewUrl('/our-pride?page=2', 'abc', 3), '/admin/preview/our-pride?page=2&draft=abc&v=3');
  assert.equal(previewUrl('/admin/dashboard', 'abc'), '');
});
test('bounded request reader rejects oversized streaming and declared bodies', async () => {
  const good = new Request('http://localhost', { method: 'POST', body: 'small' });
  assert.equal((await boundedBody(good, 5)).toString(), 'small');
  await assert.rejects(boundedBody(new Request('http://localhost', { method: 'POST', body: 'too large' }), 3), BodyLimitError);
  await assert.rejects(boundedBody(new Request('http://localhost', { method: 'POST', headers: { 'Content-Length': '500' }, body: 'small' }), 10), BodyLimitError);
});
