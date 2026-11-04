import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prideInput, pridePage } from '../src/lib/pride-core.mjs';
import { PrideAchievement } from '../src/lib/pride-model.mjs';

function form(overrides = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ name: 'Test record', achievement: 'Test achievement', isPublished: 'false', ...overrides })) result.set(key, value);
  return result;
}
test('pride validation requires names, achievements, booleans and valid optional years', () => {
  assert.equal(prideInput(form()).achievementYear, null);
  assert.equal(prideInput(form({ achievementYear: '2026' })).achievementYear, 2026);
  for (const fields of [{ name: '' }, { achievement: '' }, { name: 'a'.repeat(121) }, { achievementYear: '2026.5' }, { achievementYear: '1899' }, { isPublished: '$ne' }, { removeImage: 'yes' }]) assert.throws(() => prideInput(form(fields)));
  const fileName = form(); fileName.set('name', new Blob(['bad']), 'name.txt'); assert.throws(() => prideInput(fileName));
});
test('pagination clamps invalid pages, empty lists and out-of-range requests', () => {
  assert.deepEqual(pridePage('2', 12), { page: 2, pages: 2, total: 12, limit: 9 });
  for (const page of ['-1', 'NaN', '2.5', ['2'], '999999999999999999']) assert.equal(pridePage(page, 12).page, 1);
  assert.equal(pridePage('99', 12).page, 2);
  assert.equal(pridePage('0', 0).page, 1);
});
test('original achievement model retains exact original names, ranks and award titles without photos or invented dates', async () => {
  const source = JSON.parse(fs.readFileSync('data/site.json', 'utf8'));
  for (const entry of source.achievers) {
    const record = new PrideAchievement({ name: entry.name, achievement: entry.rank, title: entry.title });
    await record.validate();
    assert.equal(record.name, entry.name); assert.equal(record.achievement, entry.rank); assert.equal(record.title, entry.title);
    assert.equal(record.image, null); assert.equal(record.achievementYear, null);
  }
});
