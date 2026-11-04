import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=JSON.parse(fs.readFileSync('data/site.json','utf8'));
const current=JSON.parse(fs.readFileSync('data/seed-content.json','utf8'));
test('original school name, text, images, albums, and PDFs remain unchanged in seed',()=>{
  for(const key of Object.keys(src))assert.deepEqual(current[key],src[key],`original ${key}`);
});
test('seed includes dynamic page text and image slots',()=>{
  for(const key of ['home','about','admission','facilities','contact','cbse','gallery','navigation','images'])assert.ok(current.pages[key]);
  assert.match(current.pages.images.schoolGate,/school_gate\.jpeg$/);
});
