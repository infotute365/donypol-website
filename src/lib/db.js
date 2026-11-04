import { promises as fs } from 'node:fs';
import path from 'node:path';
import connectDB from '@/server/config/database';
import { SiteContent } from '@/lib/models';
import { checkSiteInput } from '@/lib/validate';
import { withSiteDefaults } from './site-editor.mjs';

const seedFile = path.join(process.cwd(), 'data', 'seed-content.json');
export async function getSeed() { return JSON.parse(await fs.readFile(seedFile, 'utf8')); }
export async function readSite() {
  await connectDB();
  // Only initial insert: never overwrite the admin's changes on restart.
  const site = await SiteContent.findOneAndUpdate({ key: 'public' },
    { $setOnInsert: { content: await getSeed(), revision: 1 } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }).lean();
  return withSiteDefaults(site.content);
}
export async function writeSite(content, revision) {
  const validation = checkSiteInput(content, await getSeed());
  if (validation) throw new Error(validation);
  await connectDB();
  const existing = await SiteContent.findOneAndUpdate({ key: 'public', revision },
    { $set: { content: withSiteDefaults(content) }, $inc: { revision: 1 } }, { returnDocument: 'after' }).lean();
  if (!existing) throw new Error('Conflict: website content was modified by another admin. Reload and try again.');
  return existing.revision;
}
export async function readSiteWithRevision() {
  await readSite();
  const record = await SiteContent.findOne({ key: 'public' }).lean();
  return { content: withSiteDefaults(record.content), revision: record.revision };
}
